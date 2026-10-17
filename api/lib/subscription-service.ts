// ABOUTME: Shared subscription payment recording — inserts the payment row, posts to accounting,
// ABOUTME: advances the schedule and clears notifications in one caller-owned transaction.
// ABOUTME: Used by both the tRPC subscriptions router and the external /api/v1 REST API.
import { and, eq, isNull } from "drizzle-orm";
import { subscriptionPayments, subscriptions, type Subscription } from "@db/schema";
import { advanceDueDate, daysBetween, parsePositiveAmount, type CycleUnit } from "./subscription-math";
import { postSubscriptionPayment, type SubscriptionPaymentMethod } from "./subscription-posting";
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
export async function recordPaymentInTx(tx: DbClient, args: RecordPaymentArgs): Promise<RecordPaymentResult> {
  const { subscription, cycleDueDate } = args;
  parsePositiveAmount(args.amount);

  const [existing] = await tx
    .select({ id: subscriptionPayments.id })
    .from(subscriptionPayments)
    .where(
      and(
        eq(subscriptionPayments.subscriptionId, subscription.id),
        eq(subscriptionPayments.cycleDueDate, cycleDueDate),
        isNull(subscriptionPayments.deletedAt),
      ),
    )
    .limit(1);
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

  const [payment] = await tx
    .insert(subscriptionPayments)
    .values({
      subscriptionId: subscription.id,
      businessId: args.businessId,
      locationId: subscription.locationId ?? subscription.postingLocationId,
      cycleDueDate,
      amount: parsePositiveAmount(args.amount).toFixed(2),
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
