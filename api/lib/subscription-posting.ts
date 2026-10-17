// ABOUTME: Posts confirmed subscription payments to accounting — either an expense (P&L) or a paid bill (AP),
// ABOUTME: reusing the house ledgerEntries + accounts.currentBalance mechanics from expenses-router and payBill.
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  accounts,
  bills,
  expenseCategories,
  expenses,
  ledgerEntries,
  locations,
  suppliers,
  type Subscription,
} from "@db/schema";
import { d } from "./decimal";
import { payBill } from "./bill-payment";
import { ensureSystemAccount } from "./accounting-accounts";
import type { DbClient } from "./account-subscriptions";

export type SubscriptionPaymentMethod = "cash" | "wallet" | "bank_transfer" | "card";

/** Allowed accounts.type values per payment method (matches Bills.tsx PAYMENT_METHOD_ACCOUNT_TYPES). */
const PAYMENT_METHOD_ACCOUNT_TYPES: Record<SubscriptionPaymentMethod, string[]> = {
  cash: ["cash"],
  wallet: ["mpesa", "wallet"],
  bank_transfer: ["bank_account"],
  card: ["bank_account"],
};

export interface SubscriptionPostInput {
  subscription: Subscription;
  amount: string;
  cycleDueDate: string;
  paidDate: string;
  accountId?: number | null;
  paymentMethod: SubscriptionPaymentMethod;
  reference?: string | null;
  notes?: string | null;
  userId: number;
}

export interface SubscriptionPostResult {
  expenseId: number | null;
  billId: number | null;
  billPaymentId: number | null;
}

/** Branch a subscription's postings land on: its own branch, else its declared posting branch. */
export function resolvePostingLocationId(subscription: Subscription): number {
  const locationId = subscription.locationId ?? subscription.postingLocationId;
  if (!locationId) {
    throw new Error(
      "Subscription has no posting location. Business-wide subscriptions with posting enabled need a 'Post to branch' (postingLocationId).",
    );
  }
  return locationId;
}

/** Move an account balance by amount using natural-balance rules and write its ledger entry. */
async function postLedgerEntry(
  tx: DbClient,
  args: {
    accountId: number;
    transactionType: "expense" | "bill_payment";
    transactionId: number;
    entryType: "debit" | "credit";
    amount: string;
    paidDate: string;
    userId: number;
    refNo: string;
    description?: string;
  },
): Promise<void> {
  const [acct] = await tx.select().from(accounts).where(eq(accounts.id, args.accountId)).limit(1);
  if (!acct) throw new Error("Ledger account not found");
  // Asset/expense accounts have a debit-natural balance; liability/equity/revenue credit-natural.
  // Operational cash/wallet/bank rows have a null accountType and behave like assets.
  const debitNatural = acct.accountType == null || acct.accountType === "asset" || acct.accountType === "expense";
  const sign = args.entryType === "debit" ? (debitNatural ? 1 : -1) : (debitNatural ? -1 : 1);
  const newBal = d(acct.currentBalance || "0").plus(d(args.amount).times(sign));
  await tx.insert(ledgerEntries).values({
    accountId: args.accountId,
    transactionType: args.transactionType,
    transactionId: args.transactionId,
    entryType: args.entryType,
    amount: args.amount,
    balanceAfter: newBal.toFixed(2),
    entryDate: args.paidDate,
    createdBy: args.userId,
    refNo: args.refNo,
    description: args.description,
  } as typeof ledgerEntries.$inferInsert);
  await tx.update(accounts).set({ currentBalance: newBal.toFixed(2) }).where(eq(accounts.id, args.accountId));
}

/** Cash/wallet account is credited with the payment amount. */
async function postCashCredit(
  tx: DbClient,
  cashAccountId: number,
  input: SubscriptionPostInput,
  refNo: string,
  transactionType: "expense" | "bill_payment",
  transactionId: number,
): Promise<void> {
  await postLedgerEntry(tx, {
    accountId: cashAccountId,
    transactionType,
    transactionId,
    entryType: "credit",
    amount: input.amount,
    paidDate: input.paidDate,
    userId: input.userId,
    refNo,
  });
}

/** Category's default expense account is debited (same rule as expenses-router). */
async function postCategoryDebit(
  tx: DbClient,
  subscription: Subscription,
  input: SubscriptionPostInput,
  refNo: string,
  cashAccountId: number,
  expenseId: number,
): Promise<void> {
  if (!subscription.categoryId) return;
  const [category] = await tx
    .select()
    .from(expenseCategories)
    .where(and(eq(expenseCategories.id, subscription.categoryId), isNull(expenseCategories.deletedAt)))
    .limit(1);
  if (!category || !category.defaultAccountId) {
    throw new Error(
      "Expense category is not linked to a chart of accounts expense entry. " +
        "Please update the category settings to select a default expense account.",
    );
  }
  const expenseAccountId = category.defaultAccountId;
  if (expenseAccountId === cashAccountId) return;
  await postLedgerEntry(tx, {
    accountId: expenseAccountId,
    transactionType: "expense",
    transactionId: expenseId,
    entryType: "debit",
    amount: input.amount,
    paidDate: input.paidDate,
    userId: input.userId,
    refNo,
    description: `Subscription: ${subscription.name}`,
  });
}

/** Vendor totals follow the expenses-router convention (totalPaid up, currentBalance down). */
async function bumpSupplierTotals(tx: DbClient, vendorId: number, amount: string): Promise<void> {
  const [sup] = await tx.select().from(suppliers).where(eq(suppliers.id, vendorId)).limit(1);
  if (!sup) return;
  const newPaid = d(sup.totalPaid).plus(d(amount));
  const newBal = d(sup.currentBalance).minus(d(amount));
  await tx
    .update(suppliers)
    .set({ totalPaid: newPaid.toFixed(2), currentBalance: newBal.toFixed(2) })
    .where(eq(suppliers.id, vendorId));
}

/** Post a subscription payment as an expense row + ledger entries (mirrors expenses-router create). */
async function postExpense(
  tx: DbClient,
  input: SubscriptionPostInput,
  locationId: number,
  businessId: number,
  cashAccountId: number | null,
): Promise<SubscriptionPostResult> {
  const { subscription, amount, paidDate, userId, paymentMethod, reference, cycleDueDate } = input;
  if (!subscription.categoryId) {
    throw new Error("Subscriptions that post as expenses need a category (for the expense account).");
  }
  if (!cashAccountId) {
    throw new Error(
      `Select a funding source: no ${paymentMethod.replace("_", " ")} account exists for this branch.`,
    );
  }

  const [location] = await tx.select().from(locations).where(eq(locations.id, locationId)).limit(1);
  if (!location) throw new Error("Posting location not found");
  const nextNum = location.nextExpenseNumber ?? 1;
  const expenseNumber = `EXP-SUB-${String(nextNum).padStart(4, "0")}`;
  await tx.update(locations).set({ nextExpenseNumber: nextNum + 1 }).where(eq(locations.id, locationId));

  const [expense] = await tx
    .insert(expenses)
    .values({
      locationId,
      businessId,
      categoryId: subscription.categoryId,
      supplierId: subscription.vendorId,
      expenseNumber,
      amount,
      description: `${subscription.name} — ${cycleDueDate}`,
      expenseDate: paidDate,
      paymentMethod,
      accountId: cashAccountId,
      enteredBy: userId,
      refNo: reference ? reference.slice(0, 50) : undefined,
    } as typeof expenses.$inferInsert)
    .returning();

  const refNo = reference ? reference.slice(0, 50) : expenseNumber;
  if (cashAccountId) {
    await postCashCredit(tx, cashAccountId, input, refNo, "expense", expense.id);
    await postCategoryDebit(tx, subscription, input, refNo, cashAccountId, expense.id);
  }
  if (subscription.vendorId) {
    await bumpSupplierTotals(tx, subscription.vendorId, amount);
  }

  return { expenseId: expense.id, billId: null, billPaymentId: null };
}

/** Stable external key tagging a bill as generated by a subscription cycle. */
export function subscriptionBillExternalId(subscriptionId: number, cycleDueDate: string): string {
  return `${subscriptionId}:${cycleDueDate}`;
}

/** Find the bill generated for a subscription cycle (idempotency key for materialization). */
export async function findSubscriptionBill(
  tx: DbClient,
  businessId: number,
  subscriptionId: number,
  cycleDueDate: string,
): Promise<typeof bills.$inferSelect | null> {
  const [bill] = await tx
    .select()
    .from(bills)
    .where(
      and(
        eq(bills.businessId, businessId),
        eq(bills.externalSystem, "subscription"),
        eq(bills.externalId, subscriptionBillExternalId(subscriptionId, cycleDueDate)),
        isNull(bills.deletedAt),
      ),
    )
    .limit(1);
  return bill ?? null;
}

export interface MaterializeBillResult {
  billId: number;
  billNumber: string;
  created: boolean;
}

/**
 * Create the AP obligation for one subscription cycle: a pending bill plus the accrual
 * ledger (expense debit / AP credit), mirroring bills-router `create`. Idempotent via the
 * (externalSystem='subscription', externalId) tag — repeated sweep runs never duplicate.
 */
export async function materializeSubscriptionBill(
  tx: DbClient,
  args: { subscription: Subscription; cycleDueDate: string; issueDate?: string; userId: number | null },
): Promise<MaterializeBillResult> {
  const { subscription, cycleDueDate } = args;
  const existing = await findSubscriptionBill(tx, subscription.businessId, subscription.id, cycleDueDate);
  if (existing) return { billId: existing.id, billNumber: existing.billNumber ?? "", created: false };

  const locationId = resolvePostingLocationId(subscription);
  const businessId = subscription.businessId;
  const issueDate = args.issueDate ?? cycleDueDate;

  const [location] = await tx.select().from(locations).where(eq(locations.id, locationId)).limit(1);
  if (!location) throw new Error("Posting location not found");
  const nextNum = location.nextBillNumber ?? 1;
  const billNumber = `BILL-SUB-${String(nextNum).padStart(4, "0")}`;
  await tx.update(locations).set({ nextBillNumber: nextNum + 1 }).where(eq(locations.id, locationId));

  const [bill] = await tx
    .insert(bills)
    .values({
      locationId,
      businessId,
      supplierId: subscription.vendorId,
      categoryId: subscription.categoryId,
      billNumber,
      description: `${subscription.name} — ${cycleDueDate}`,
      amount: subscription.amount,
      amountPaid: "0.00",
      balanceDue: subscription.amount,
      issueDate,
      dueDate: cycleDueDate,
      status: "pending",
      externalSystem: "subscription",
      externalId: subscriptionBillExternalId(subscription.id, cycleDueDate),
      enteredBy: args.userId ?? undefined,
    } as typeof bills.$inferInsert)
    .returning();

  // Accrual: expense debit + AP credit, exactly as bills-router create does.
  const [category] = subscription.categoryId
    ? await tx
        .select()
        .from(expenseCategories)
        .where(and(eq(expenseCategories.id, subscription.categoryId), isNull(expenseCategories.deletedAt)))
        .limit(1)
    : [];
  const expenseAccountId =
    category?.defaultAccountId ??
    (await ensureSystemAccount({ businessId, accountType: "expense", accountSubType: "operating_expense", name: "Operating Expenses" })).id;
  const apAccountId = (
    await ensureSystemAccount({ businessId, accountType: "liability", accountSubType: "accounts_payable", name: "Accounts Payable" })
  ).id;

  await postLedgerEntry(tx, {
    accountId: expenseAccountId,
    transactionType: "expense",
    transactionId: bill.id,
    entryType: "debit",
    amount: bill.amount,
    paidDate: issueDate,
    userId: args.userId ?? 0,
    refNo: billNumber,
    description: `Bill: ${bill.description}`,
  });
  await postLedgerEntry(tx, {
    accountId: apAccountId,
    transactionType: "bill_payment",
    transactionId: bill.id,
    entryType: "credit",
    amount: bill.amount,
    paidDate: issueDate,
    userId: args.userId ?? 0,
    refNo: billNumber,
    description: `Bill: ${bill.description}`,
  });

  return { billId: bill.id, billNumber, created: true };
}

/** Settle an existing (materialized) subscription bill: AP debit + cash credit via payBill. */
export async function settleSubscriptionBill(
  tx: DbClient,
  args: {
    subscription: Subscription;
    billId: number;
    amount: string;
    paidDate: string;
    cashAccountId: number | null;
    paymentMethod: SubscriptionPaymentMethod;
    reference?: string | null;
    notes?: string | null;
    userId: number;
  },
): Promise<{ billPaymentId: number; status: "paid" | "partial" }> {
  const [bill] = await tx.select().from(bills).where(eq(bills.id, args.billId)).limit(1);
  if (!bill) throw new Error("Subscription bill not found");
  if (bill.status === "paid") throw new Error("This subscription cycle is already paid");
  if (!args.cashAccountId) {
    throw new Error(
      `Select a funding source: no ${args.paymentMethod.replace("_", " ")} account exists for this branch.`,
    );
  }

  const locationId = resolvePostingLocationId(args.subscription);
  // Settle against the same AP account the accrual used (ensureSystemAccount is deterministic),
  // otherwise payBill's subtype lookup can pick a different legacy AP row.
  const apAccountId = (
    await ensureSystemAccount({
      businessId: args.subscription.businessId,
      accountType: "liability",
      accountSubType: "accounts_payable",
      name: "Accounts Payable",
    })
  ).id;
  const result = await payBill({
    db: tx,
    billId: bill.id,
    paymentMethod: args.paymentMethod,
    amount: args.amount,
    paymentDate: args.paidDate,
    reference: args.reference ?? undefined,
    notes: args.notes ?? undefined,
    accountId: args.cashAccountId ?? undefined,
    liabilityAccountId: apAccountId,
    categoryId: args.subscription.categoryId ?? 0,
    enteredBy: args.userId,
    businessId: args.subscription.businessId,
    locationId,
    supplierId: args.subscription.vendorId,
    billNumber: bill.billNumber,
    description: args.subscription.name,
    skipExpenseCreation: true,
  });
  return { billPaymentId: result.paymentId, status: result.status };
}

/** Post a subscription payment as a bill settled in full (accrued first, then paid). */
async function postBill(
  tx: DbClient,
  input: SubscriptionPostInput,
  _locationId: number,
  _businessId: number,
  cashAccountId: number | null,
): Promise<SubscriptionPostResult> {
  const { subscription, amount, paidDate, cycleDueDate, userId, paymentMethod, reference, notes } = input;
  const materialized = await materializeSubscriptionBill(tx, {
    subscription,
    cycleDueDate,
    issueDate: paidDate,
    userId,
  });
  const settled = await settleSubscriptionBill(tx, {
    subscription,
    billId: materialized.billId,
    amount,
    paidDate,
    cashAccountId,
    paymentMethod,
    reference,
    notes,
    userId,
  });
  return { expenseId: null, billId: materialized.billId, billPaymentId: settled.billPaymentId };
}

/**
 * Post a confirmed subscription payment per the subscription's postingMode.
 * Caller owns the transaction: pass the same `tx` used to insert the subscriptionPayments row.
 */
export async function postSubscriptionPayment(
  tx: DbClient,
  input: SubscriptionPostInput,
): Promise<SubscriptionPostResult> {
  const { subscription } = input;
  if (subscription.postingMode === "none") {
    return { expenseId: null, billId: null, billPaymentId: null };
  }
  const locationId = resolvePostingLocationId(subscription);
  const businessId = subscription.businessId;

  // Resolve the cash account: explicit → subscription default → first matching type at the location.
  let cashAccountId = input.accountId ?? subscription.defaultAccountId ?? null;
  if (!cashAccountId) {
    const allowedTypes = PAYMENT_METHOD_ACCOUNT_TYPES[input.paymentMethod];
    const [acct] = await tx
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.locationId, locationId),
          inArray(accounts.type, allowedTypes as ("cash" | "mpesa" | "bank_account" | "wallet")[]),
          isNull(accounts.deletedAt),
        ),
      )
      .limit(1);
    cashAccountId = acct?.id ?? null;
  }

  if (subscription.postingMode === "bill") {
    return postBill(tx, input, locationId, businessId, cashAccountId);
  }
  return postExpense(tx, input, locationId, businessId, cashAccountId);
}
