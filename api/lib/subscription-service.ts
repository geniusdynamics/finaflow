// ABOUTME: Shared subscription payment recording — inserts the payment row, posts to accounting,
// ABOUTME: advances the schedule and clears notifications in one caller-owned transaction.
// ABOUTME: Used by both the tRPC subscriptions router and the external /api/v1 REST API.
import { and, eq, isNull } from "drizzle-orm";
import { subscriptionPayments, subscriptions, type Subscription } from "@db/schema";
import { advanceDueDate, daysBetween, parsePositiveAmount, type CycleUnit } from "./subscription-math";
import {
  postSubscriptionPayment,
  settleSubscriptionBill,
  findSubscriptionBill,
  type SubscriptionPaymentMethod,
} from "./subscription-posting";
import { clearNotificationsForSubscription } from "./notification-clearance";
import type { DbClient } from "./account-subscriptions";

export interface RecordPaymentArgs {
  subscription: Subscription;
  cycleDueDate: string;
  amount: string;
  paidDate: string;
  accountId: number | null;
  paymentMethod: SubscriptionPaymentMethod;
  reference: string | null;
  notes: string | null;
  userId: number;
  businessId: number;
  advance: boolean;
  /** Allow paying a cycle that is further ahead than the pay-ahead window. */
  allowEarly?: boolean;
  /** Days before a cycle's due date that it may be paid without `allowEarly`. */
  payAheadWindowDays?: number;
}

const DEFAULT_PAY_AHEAD_WINDOW_DAYS = 7;

export interface RecordPaymentResult {
  paymentId: number;
  expenseId: number | null;
  billId: number | null;
}

/**
 * Record a subscription payment for one cycle. The caller owns the transaction:
 * pass the same `tx` used for any surrounding writes. Rejects duplicate payments
 * for the same (subscriptionId, cycleDueDate) — the idempotency guard.
 */
/**
 * Settle a pending (materialization- or auto-renew-created) payment row: pays the linked
 * bill when there is one, otherwise posts per the subscription's postingMode, then marks
 * the row confirmed. Caller owns the transaction.
 */
export async function settlePendingPaymentInTx(
  tx: DbClient,
  args: {
    subscription: Subscription;
    payment: typeof subscriptionPayments.$inferSelect;
    paidDate: string;
    accountId: number | null;
    paymentMethod: SubscriptionPaymentMethod;
    reference: string | null;
    notes: string | null;
    userId: number;
  },
): Promise<RecordPaymentResult> {
  const { subscription, payment } = args;
  if (payment.confirmed) throw new Error("Payment for this cycle is already recorded");

  let expenseId: number | null = null;
  let billId: number | null = payment.billId;

  if (payment.billId) {
    await settleSubscriptionBill(tx, {
      subscription,
      billId: payment.billId,
      amount: payment.amount,
      paidDate: args.paidDate,
      cashAccountId: args.accountId ?? subscription.defaultAccountId ?? null,
      paymentMethod: args.paymentMethod,
      reference: args.reference,
      notes: args.notes,
      userId: args.userId,
    });
  } else {
    const posted = await postSubscriptionPayment(tx, {
      subscription,
      amount: payment.amount,
      cycleDueDate: payment.cycleDueDate,
      paidDate: args.paidDate,
      accountId: args.accountId,
      paymentMethod: args.paymentMethod,
      reference: args.reference,
      notes: args.notes,
      userId: args.userId,
    });
    expenseId = posted.expenseId;
    billId = posted.billId;
  }

  await tx
    .update(subscriptionPayments)
    .set({
      confirmed: true,
      paidDate: args.paidDate,
      accountId: args.accountId,
      paymentMethod: args.paymentMethod,
      reference: args.reference,
      notes: args.notes,
      expenseId,
      billId,
    })
    .where(eq(subscriptionPayments.id, payment.id));

  await clearNotificationsForSubscription(tx, { subscriptionId: subscription.id });
  return { paymentId: payment.id, expenseId, billId };
}

export async function recordPaymentInTx(tx: DbClient, args: RecordPaymentArgs): Promise<RecordPaymentResult> {
  const { subscription, cycleDueDate } = args;
  parsePositiveAmount(args.amount);

  const [existing] = await tx
    .select()
    .from(subscriptionPayments)
    .where(
      and(
        eq(subscriptionPayments.subscriptionId, subscription.id),
        eq(subscriptionPayments.cycleDueDate, cycleDueDate),
        isNull(subscriptionPayments.deletedAt),
      ),
    )
    .limit(1);

  // A pending row means this cycle was already materialized (bill due on the cycle date, or
  // an auto-renew pending): settle it instead of creating a second payment/bill.
  if (existing && !existing.confirmed) {
    return settlePendingPaymentInTx(tx, {
      subscription,
      payment: existing,
      paidDate: args.paidDate,
      accountId: args.accountId,
      paymentMethod: args.paymentMethod,
      reference: args.reference,
      notes: args.notes,
      userId: args.userId,
    });
  }
  if (existing) throw new Error("Payment for this cycle is already recorded");

  // Guard against marking the same item paid twice in one period: once the next cycle is
  // more than the pay-ahead window away, a payment must be explicitly confirmed as early.
  if (!args.allowEarly) {
    const windowDays = args.payAheadWindowDays ?? DEFAULT_PAY_AHEAD_WINDOW_DAYS;
    const daysAhead = daysBetween(cycleDueDate, args.paidDate);
    if (daysAhead > windowDays) {
      throw new Error(
        `This cycle isn't due until ${cycleDueDate} (${daysAhead} days ahead). ` +
          `Tick "Pay early" to record it now.`,
      );
    }
  }

  const amount = parsePositiveAmount(args.amount).toFixed(2);

  // A materialized bill whose pending row is missing: record the payment and settle it.
  const existingBill = await findSubscriptionBill(tx, args.businessId, subscription.id, cycleDueDate);
  if (existingBill) {
    const [payment] = await tx
      .insert(subscriptionPayments)
      .values({
        subscriptionId: subscription.id,
        businessId: args.businessId,
        locationId: subscription.locationId ?? subscription.postingLocationId,
        cycleDueDate,
        amount,
        currency: subscription.currency,
        paidDate: args.paidDate,
        accountId: args.accountId,
        paymentMethod: args.paymentMethod,
        reference: args.reference,
        confirmed: true,
        notes: args.notes,
        recordedBy: args.userId,
        billId: existingBill.id,
      } as typeof subscriptionPayments.$inferInsert)
      .returning();
    await settleSubscriptionBill(tx, {
      subscription,
      billId: existingBill.id,
      amount,
      paidDate: args.paidDate,
      cashAccountId: args.accountId ?? subscription.defaultAccountId ?? null,
      paymentMethod: args.paymentMethod,
      reference: args.reference,
      notes: args.notes,
      userId: args.userId,
    });
    await clearNotificationsForSubscription(tx, { subscriptionId: subscription.id });
    return { paymentId: payment.id, expenseId: null, billId: existingBill.id };
  }

  const [payment] = await tx
    .insert(subscriptionPayments)
    .values({
      subscriptionId: subscription.id,
      businessId: args.businessId,
      locationId: subscription.locationId ?? subscription.postingLocationId,
      cycleDueDate,
      amount,
      currency: subscription.currency,
      paidDate: args.paidDate,
      accountId: args.accountId,
      paymentMethod: args.paymentMethod,
      reference: args.reference,
      confirmed: true,
      notes: args.notes,
      recordedBy: args.userId,
    } as typeof subscriptionPayments.$inferInsert)
    .returning();

  const posted = await postSubscriptionPayment(tx, {
    subscription,
    amount: payment.amount,
    cycleDueDate,
    paidDate: args.paidDate,
    accountId: args.accountId,
    paymentMethod: args.paymentMethod,
    reference: args.reference,
    notes: args.notes,
    userId: args.userId,
  });

  await tx
    .update(subscriptionPayments)
    .set({ expenseId: posted.expenseId, billId: posted.billId })
    .where(eq(subscriptionPayments.id, payment.id));

  if (args.advance && !subscription.isOneTime) {
    const nextDueDate = advanceDueDate(subscription.nextDueDate, subscription.cycleUnit as CycleUnit, subscription.cycleCount);
    await tx.update(subscriptions).set({ nextDueDate }).where(eq(subscriptions.id, subscription.id));
  }

  await clearNotificationsForSubscription(tx, { subscriptionId: subscription.id });
  return { paymentId: payment.id, expenseId: posted.expenseId, billId: posted.billId };
}
