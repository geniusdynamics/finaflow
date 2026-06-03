// ABOUTME: Debt-origination helpers — auto-classify a loan into 2600/2700, post the
// ABOUTME: paired double-entry ledger legs, create a recurring bill template, and
// ABOUTME: generate the next installment bill on demand.
import { and, eq, isNull } from "drizzle-orm";

import { accounts, debts, ledgerEntries, recurringBillTemplates, bills, type Debt } from "@db/schema";
import { d } from "./decimal";
import type { DbClient } from "./account-subscriptions";

export type Frequency = "daily" | "weekly" | "monthly" | "quarterly" | "annually";

const LONG_TERM_THRESHOLD_DAYS = 365;

const FREQUENCY_DAYS: Record<Frequency, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 91,
  annually: 365,
};

const FREQUENCY_MS: Record<Frequency, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 91,
  annually: 365,
};

export function isLongTermLoan(loanDate: Date | string, dueDate: Date | string | null | undefined): boolean {
  if (!dueDate) return false;
  const start = new Date(loanDate).getTime();
  const end = new Date(dueDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
  return diffDays > LONG_TERM_THRESHOLD_DAYS;
}

export function frequencyToDays(frequency: Frequency): number {
  return FREQUENCY_DAYS[frequency];
}

export function advanceDateByFrequency(from: Date, frequency: Frequency): Date {
  const out = new Date(from);
  out.setUTCDate(out.getUTCDate() + FREQUENCY_MS[frequency]);
  return out;
}

function toDateKey(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function toTimestamp(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export async function getLoanLiabilityAccountId(
  db: DbClient,
  businessId: number,
  loanDate: Date | string,
  dueDate: Date | string | null | undefined,
): Promise<number | null> {
  const subType = isLongTermLoan(loanDate, dueDate) ? "long_term_loan" : "current_loan";
  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.businessId, businessId),
        eq(accounts.accountType, "liability"),
        eq(accounts.accountSubType, subType),
        isNull(accounts.deletedAt),
      ),
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

interface PostOriginationInput {
  db: DbClient;
  businessId: number;
  debt: Debt;
  destinationAccountId: number;
  loanAccountId: number;
  totalAmount: string;
  loanDate: Date | string;
  immediate: boolean;
  enteredBy: number;
}

export async function postOriginationLedgerEntries(input: PostOriginationInput): Promise<void> {
  const { db, debt, destinationAccountId, loanAccountId, totalAmount, loanDate, immediate, enteredBy } = input;
  const loanDateStr = toDateKey(loanDate);

  await db.transaction(async (tx) => {
    const [destAcct] = await tx.select().from(accounts).where(eq(accounts.id, destinationAccountId)).limit(1);
    const [loanAcct] = await tx.select().from(accounts).where(eq(accounts.id, loanAccountId)).limit(1);
    if (!destAcct) throw new Error("Destination bank account not found");
    if (!loanAcct) throw new Error("Loan liability account not found");

    const total = d(totalAmount);
    const loanCurrentBal = d(loanAcct.currentBalance || "0");
    const loanNewBal = loanCurrentBal.plus(total);

    await tx.insert(ledgerEntries).values({
      accountId: loanAccountId,
      transactionType: "loan_origination",
      transactionId: debt.id,
      entryType: "credit",
      amount: total.toFixed(2),
      balanceAfter: loanNewBal.toFixed(2),
      description: `Loan originated: ${debt.creditorName} (#${debt.id})`,
      entryDate: loanDateStr,
      createdBy: enteredBy,
      refNo: `LOAN-${debt.id}`,
    } satisfies typeof ledgerEntries.$inferInsert);

    await tx.update(accounts).set({ currentBalance: loanNewBal.toFixed(2) }).where(eq(accounts.id, loanAccountId));

    if (immediate) {
      const destCurrentBal = d(destAcct.currentBalance || "0");
      const destNewBal = destCurrentBal.plus(total);

      await tx.insert(ledgerEntries).values({
        accountId: destinationAccountId,
        transactionType: "loan_origination",
        transactionId: debt.id,
        entryType: "debit",
        amount: total.toFixed(2),
        balanceAfter: destNewBal.toFixed(2),
        description: `Loan proceeds received from ${debt.creditorName} (#${debt.id})`,
        entryDate: loanDateStr,
        createdBy: enteredBy,
        refNo: `LOAN-${debt.id}`,
      } satisfies typeof ledgerEntries.$inferInsert);

      await tx.update(accounts).set({ currentBalance: destNewBal.toFixed(2) }).where(eq(accounts.id, destinationAccountId));

      await tx.update(debts).set({
        isDisbursed: true,
        disbursementDate: toTimestamp(loanDate),
      }).where(eq(debts.id, debt.id));
    } else {
      await tx.update(debts).set({ isDisbursed: false }).where(eq(debts.id, debt.id));
    }
  });
}

interface PostDisbursementInput {
  db: DbClient;
  debt: Debt;
  destinationAccountId: number;
  loanAccountId: number;
  totalAmount: string;
  disbursementDate: Date | string;
  fee?: string | null;
  enteredBy: number;
}

export async function postDisbursementLedgerEntries(input: PostDisbursementInput): Promise<void> {
  const { db, debt, destinationAccountId, loanAccountId, totalAmount, disbursementDate, fee, enteredBy } = input;
  const dateStr = toDateKey(disbursementDate);
  const total = d(totalAmount);
  const feeAmount = fee ? d(fee) : d(0);
  const netCashToBank = total.minus(feeAmount);

  await db.transaction(async (tx) => {
    const [destAcct] = await tx.select().from(accounts).where(eq(accounts.id, destinationAccountId)).limit(1);
    const [loanAcct] = await tx.select().from(accounts).where(eq(accounts.id, loanAccountId)).limit(1);
    if (!destAcct) throw new Error("Destination bank account not found");
    if (!loanAcct) throw new Error("Loan liability account not found");

    // Debit the bank account for the net cash.
    const destCurrentBal = d(destAcct.currentBalance || "0");
    const destNewBal = destCurrentBal.plus(netCashToBank);
    await tx.insert(ledgerEntries).values({
      accountId: destinationAccountId,
      transactionType: "loan_disbursement",
      transactionId: debt.id,
      entryType: "debit",
      amount: netCashToBank.toFixed(2),
      balanceAfter: destNewBal.toFixed(2),
      description: feeAmount.gt(0)
        ? `Loan proceeds from ${debt.creditorName} (#${debt.id}), net of ${feeAmount.toFixed(2)} fee`
        : `Loan proceeds from ${debt.creditorName} (#${debt.id})`,
      entryDate: dateStr,
      createdBy: enteredBy,
      refNo: `LOAN-${debt.id}`,
    } satisfies typeof ledgerEntries.$inferInsert);
    await tx.update(accounts).set({ currentBalance: destNewBal.toFixed(2) }).where(eq(accounts.id, destinationAccountId));

    // If there's a fee, debit the bank_charges expense account.
    if (feeAmount.gt(0)) {
      const { ensureSystemAccount } = await import("./accounting-accounts");
      const feeAccountId = (await ensureSystemAccount({
        businessId: debt.businessId ?? 0,
        accountType: "expense",
        accountSubType: "bank_charges",
        name: "Bank Charges",
      })).id;
      const [feeAcct] = await tx.select().from(accounts).where(eq(accounts.id, feeAccountId)).limit(1);
      if (feeAcct) {
        const feeCurrentBal = d(feeAcct.currentBalance || "0");
        const feeNewBal = feeCurrentBal.plus(feeAmount);
        await tx.insert(ledgerEntries).values({
          accountId: feeAcct.id,
          transactionType: "loan_disbursement",
          transactionId: debt.id,
          entryType: "debit",
          amount: feeAmount.toFixed(2),
          balanceAfter: feeNewBal.toFixed(2),
          description: `Arrangement fee: ${debt.creditorName} loan (#${debt.id})`,
          entryDate: dateStr,
          createdBy: enteredBy,
          refNo: `LOAN-${debt.id}`,
        } satisfies typeof ledgerEntries.$inferInsert);
        await tx.update(accounts).set({ currentBalance: feeNewBal.toFixed(2) }).where(eq(accounts.id, feeAcct.id));
      }
    }

    // Credit the loan liability account for the full disbursed amount.
    const loanCurrentBal = d(loanAcct.currentBalance || "0");
    const loanNewBal = loanCurrentBal.plus(total);
    await tx.insert(ledgerEntries).values({
      accountId: loanAccountId,
      transactionType: "loan_disbursement",
      transactionId: debt.id,
      entryType: "credit",
      amount: total.toFixed(2),
      balanceAfter: loanNewBal.toFixed(2),
      description: `Loan disbursed: ${debt.creditorName} (#${debt.id})`,
      entryDate: dateStr,
      createdBy: enteredBy,
      refNo: `LOAN-${debt.id}`,
    } satisfies typeof ledgerEntries.$inferInsert);
    await tx.update(accounts).set({ currentBalance: loanNewBal.toFixed(2) }).where(eq(accounts.id, loanAccountId));

    await tx.update(debts).set({
      isDisbursed: true,
      disbursementDate: toTimestamp(disbursementDate),
      disbursementFee: feeAmount.gt(0) ? feeAmount.toFixed(2) : null,
    }).where(eq(debts.id, debt.id));
  });
}

interface CreateRecurringTemplateInput {
  db: DbClient;
  debt: Debt;
  liabilityAccountId: number;
  installmentAmount: string;
  frequency: Frequency;
  nextDueDate: Date;
  enteredBy: number;
}

export async function createRecurringBillTemplateForDebt(input: CreateRecurringTemplateInput): Promise<number> {
  const { db, debt, liabilityAccountId, installmentAmount, frequency, nextDueDate } = input;
  const [result] = await db.insert(recurringBillTemplates).values({
    locationId: debt.locationId ?? 0,
    businessId: debt.businessId ?? null,
    liabilityAccountId,
    description: `Loan Repayment: ${debt.creditorName} (#${debt.id})`,
    amount: installmentAmount,
    frequency,
    nextDueDate: toDateKey(nextDueDate),
    isActive: true,
  } satisfies typeof recurringBillTemplates.$inferInsert).returning({ id: recurringBillTemplates.id });

  return result.id;
}

export async function generateNextInstallment(db: DbClient, templateId: number, debtId: number): Promise<number> {
  const [template] = await db.select().from(recurringBillTemplates).where(eq(recurringBillTemplates.id, templateId)).limit(1);
  if (!template) throw new Error("Recurring bill template not found");

  const [debt] = await db.select().from(debts).where(eq(debts.id, debtId)).limit(1);
  if (!debt) throw new Error("Debt not found");

  const dueDateKey = template.nextDueDate;
  const dueDateObj = typeof dueDateKey === "string" ? new Date(dueDateKey) : dueDateKey;
  const frequency = template.frequency as Frequency;
  const next = advanceDateByFrequency(dueDateObj, frequency);
  const nextKey = toDateKey(next);

  const dueDateString = toDateKey(dueDateObj);

  const [bill] = await db.insert(bills).values({
    locationId: template.locationId,
    businessId: template.businessId ?? null,
    description: template.description,
    amount: template.amount,
    amountPaid: "0.00",
    balanceDue: template.amount,
    issueDate: dueDateString,
    dueDate: dueDateString,
    status: "pending",
    debtId,
  } satisfies typeof bills.$inferInsert).returning({ id: bills.id });

  await db.update(recurringBillTemplates).set({ nextDueDate: nextKey }).where(eq(recurringBillTemplates.id, templateId));

  return bill.id;
}
