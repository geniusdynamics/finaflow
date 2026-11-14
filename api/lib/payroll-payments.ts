// ABOUTME: Applies payroll disbursements. Records each payment, posts the matching ledger
// ABOUTME: entries, updates per-entry settlement, and can reverse a single payment exactly.
import { and, eq, isNull } from "drizzle-orm";
import { accounts, billItems, bills, billPayments, employees, ledgerEntries, payrollAdvances, payrollEntries, payrollPayments, payrollPeriods } from "@db/schema";
import { getDb } from "../queries/connection";
import { d, Decimal } from "./decimal";
import { paymentStatusFor, splitComponent } from "./payroll-calc";

export type PayrollPaymentMethod = "cash" | "mpesa" | "bank_transfer" | "wallet";
export type PaymentRequest = { entryId: number; amount: string };

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

type Entry = typeof payrollEntries.$inferSelect;
type Advance = typeof payrollAdvances.$inferSelect;

/** The period fields payment posting needs (kept structural so callers can pass an authorized entity). */
export type PeriodRef = { id: number; periodName: string; totalNetPay: string | null; generatedBillId: number | null };
export type AccountRef = { id: number; currentBalance: string | null };

/** Applies an advance deduction across an employee's open advances, oldest first. */
export async function recoverAdvances(tx: Tx, advances: Advance[], deduction: Decimal): Promise<void> {
  let remaining = deduction;
  for (const advance of advances) {
    if (remaining.lte(0)) break;
    const balance = d(advance.balanceRemaining);
    const applied = Decimal.min(balance, remaining);
    const next = balance.minus(applied);
    await tx.update(payrollAdvances).set({
      balanceRemaining: next.toFixed(2),
      status: next.lte(0) ? "repaid" : "partially_repaid",
    }).where(eq(payrollAdvances.id, advance.id));
    remaining = remaining.minus(applied);
  }
}

/** Rewrites the payroll bill's line items so they match the period's current entries. */
export async function rebuildBillItems(tx: Tx, billId: number, periodId: number): Promise<void> {
  await tx.update(billItems).set({ deletedAt: new Date() }).where(eq(billItems.billId, billId));
  const entries = await tx.select().from(payrollEntries).where(
    and(eq(payrollEntries.periodId, periodId), isNull(payrollEntries.deletedAt)),
  );
  for (const entry of entries) {
    const [emp] = await tx.select({ fullName: employees.fullName }).from(employees).where(eq(employees.id, entry.employeeId)).limit(1);
    await tx.insert(billItems).values({
      billId,
      itemName: emp?.fullName ?? `Employee #${entry.employeeId}`,
      quantity: "1.000",
      unitPrice: entry.netPay,
      totalPrice: entry.netPay,
      notes: `Basic: ${entry.basicPay}, Deductions: ${entry.deductions}, PAYE: ${entry.payeDeducted ?? "0"}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }
}

const EXPENSE_CODE = "6300";
const PAYE_CODE = "2200";
const NSSF_CODE = "2300";
const NHIF_CODE = "2400";
const HOUSING_LEVY_CODE = "2600";

const money = (value: number | string) => d(value).toDecimalPlaces(2).toFixed(2);

/** Posts one ledger line and moves the account balance by the signed delta. */
async function postLedgerLine(
  tx: Tx,
  line: {
    accountId: number;
    entryType: "debit" | "credit";
    amount: string;
    signedDelta: string;
    description: string;
    entryDate: string;
    userId: number;
    periodId: number;
    refNo: string;
  },
): Promise<number> {
  const [acct] = await tx.select().from(accounts).where(eq(accounts.id, line.accountId)).limit(1);
  const next = d(acct?.currentBalance || "0").plus(line.signedDelta).toDecimalPlaces(2);
  const [row] = await tx.insert(ledgerEntries).values({
    accountId: line.accountId,
    transactionType: "payroll",
    transactionId: line.periodId,
    entryType: line.entryType,
    amount: line.amount,
    balanceAfter: next.toFixed(2),
    entryDate: line.entryDate,
    description: line.description,
    refNo: line.refNo,
    createdBy: line.userId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any).returning({ id: ledgerEntries.id });
  await tx.update(accounts).set({ currentBalance: next.toFixed(2) }).where(eq(accounts.id, line.accountId));
  return row.id;
}

async function findAccountId(tx: Tx, code: string, businessId: number | null): Promise<number | null> {
  if (!businessId) return null;
  const [acct] = await tx.select({ id: accounts.id }).from(accounts)
    .where(and(eq(accounts.accountCode, code), eq(accounts.businessId, businessId), isNull(accounts.deletedAt)))
    .limit(1);
  return acct?.id ?? null;
}

async function refreshBill(tx: Tx, period: PeriodRef): Promise<void> {
  if (!period.generatedBillId) return;
  const payments = await tx.select().from(payrollPayments).where(
    and(eq(payrollPayments.periodId, period.id), isNull(payrollPayments.reversedAt)),
  );
  const paid = payments.reduce((sum, p) => sum.plus(d(p.amount)), d(0)).toDecimalPlaces(2);
  const total = d(period.totalNetPay || "0").toDecimalPlaces(2);
  const balance = total.minus(paid);
  const status = balance.lte(0) ? "paid" : paid.gt(0) ? "partial" : "pending";
  await tx.update(bills).set({
    amountPaid: paid.toFixed(2),
    balanceDue: balance.lt(0) ? "0.00" : balance.toFixed(2),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status: status as any,
  }).where(eq(bills.id, period.generatedBillId));
}

async function refreshPeriodStatus(tx: Tx, periodId: number): Promise<void> {
  const entries = await tx.select().from(payrollEntries).where(
    and(eq(payrollEntries.periodId, periodId), isNull(payrollEntries.deletedAt)),
  );
  const allSettled = entries.length > 0 && entries.every((e) => paymentStatusFor(e.netPay, e.paidAmount ?? "0") === "paid");
  await tx.update(payrollPeriods).set({ status: allSettled ? "paid" : "processing" }).where(eq(payrollPeriods.id, periodId));
}

/**
 * Records payments against individual entries. Each payment posts cash out, the
 * proportional salary expense and statutory payables, and settles the entry.
 * Statutory components are split proportionally and trued up on the final
 * payment, so the sum across payments always equals the full amount.
 */
export async function postPayments(params: {
  period: PeriodRef;
  account: AccountRef;
  businessId: number | null;
  userId: number;
  paymentMethod: PayrollPaymentMethod;
  reference?: string | null;
  payments: PaymentRequest[];
}) {
  const db = getDb();
  const { period, account } = params;

  const entries = await db.select().from(payrollEntries).where(
    and(eq(payrollEntries.periodId, period.id), isNull(payrollEntries.deletedAt)),
  );
  const byId = new Map<number, Entry>(entries.map((e) => [e.id, e]));

  const requested = params.payments.filter((p) => d(p.amount).gt(0));
  if (requested.length === 0) throw new Error("Enter an amount to pay for at least one employee");

  for (const req of requested) {
    const entry = byId.get(req.entryId);
    if (!entry) throw new Error(`Payroll entry ${req.entryId} is not part of this period`);
    const remaining = d(entry.netPay).minus(d(entry.paidAmount ?? "0"));
    if (d(req.amount).gt(remaining.plus("0.005"))) {
      throw new Error(`Payment exceeds the remaining ${money(remaining.toFixed(2))} owed to this employee`);
    }
  }

  const created: { paymentId: number; entryId: number; employeeId: number; amount: string }[] = [];

  await db.transaction(async (tx) => {
    const entryDate = new Date().toISOString().split("T")[0];
    const expenseAccountId = await findAccountId(tx, EXPENSE_CODE, params.businessId);
    const payeAccountId = await findAccountId(tx, PAYE_CODE, params.businessId);
    const nssfAccountId = await findAccountId(tx, NSSF_CODE, params.businessId);
    const nhifAccountId = await findAccountId(tx, NHIF_CODE, params.businessId);
    const levyAccountId = await findAccountId(tx, HOUSING_LEVY_CODE, params.businessId);

    const existingPayments = await tx.select().from(payrollPayments).where(
      and(eq(payrollPayments.periodId, period.id), isNull(payrollPayments.reversedAt)),
    );

    for (const req of requested) {
      const entry = byId.get(req.entryId)!;
      const amount = d(req.amount).toDecimalPlaces(2);
      const net = d(entry.netPay);
      const priorAmounts = existingPayments
        .filter((p) => p.entryId === entry.id)
        .map((p) => p.amount);
      const paidBefore = priorAmounts.reduce((sum, a) => sum.plus(d(a)), d(0));
      const isFinal = paidBefore.plus(amount).gte(net.minus("0.005"));

      const [payment] = await tx.insert(payrollPayments).values({
        periodId: period.id,
        entryId: entry.id,
        employeeId: entry.employeeId,
        amount: amount.toFixed(2),
        accountId: account.id,
        paymentMethod: params.paymentMethod,
        reference: params.reference ?? null,
        createdBy: params.userId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).returning({ id: payrollPayments.id });

      const refNo = `PAY-${payment.id}`;
      const [emp] = await tx.select({ fullName: employees.fullName }).from(employees).where(eq(employees.id, entry.employeeId)).limit(1);
      const who = emp?.fullName ?? `Employee #${entry.employeeId}`;
      const label = `${period.periodName} · ${who}`;

      // Cash leaves the disbursing account.
      await postLedgerLine(tx, {
        accountId: account.id, entryType: "credit", amount: amount.toFixed(2),
        signedDelta: amount.negated().toFixed(2), description: `Payroll payment: ${label}`,
        entryDate, userId: params.userId, periodId: period.id, refNo,
      });

      const grossExAdvances = d(entry.basicPay).minus(d(entry.advancesDeducted ?? "0"));
      const lines: Array<{ code: number | null; total: string; entryType: "debit" | "credit"; desc: string }> = [
        { code: expenseAccountId, total: grossExAdvances.toFixed(2), entryType: "debit", desc: `Salaries & Wages: ${label}` },
        { code: payeAccountId, total: entry.payeDeducted ?? "0", entryType: "credit", desc: `PAYE Payable: ${label}` },
        { code: nssfAccountId, total: entry.nssfDeducted ?? "0", entryType: "credit", desc: `NSSF Payable: ${label}` },
        { code: nhifAccountId, total: entry.nhifDeducted ?? "0", entryType: "credit", desc: `NHIF Payable: ${label}` },
        { code: levyAccountId, total: entry.housingLevyDeducted ?? "0", entryType: "credit", desc: `Housing Levy Payable: ${label}` },
      ];

      for (const line of lines) {
        if (!line.code) continue;
        const posted = splitComponent(line.total, entry.netPay, amount.toFixed(2), priorAmounts, isFinal);
        if (d(posted).lte(0)) continue;
        await postLedgerLine(tx, {
          accountId: line.code, entryType: line.entryType, amount: posted,
          signedDelta: line.entryType === "debit" ? posted : posted,
          description: line.desc, entryDate, userId: params.userId, periodId: period.id, refNo,
        });
      }

      const paidAfter = paidBefore.plus(amount).toDecimalPlaces(2);
      await tx.update(payrollEntries).set({
        paidAmount: paidAfter.toFixed(2),
        paymentStatus: paymentStatusFor(entry.netPay, paidAfter.toFixed(2)),
        paidAt: paidAfter.gte(net.minus("0.005")) ? new Date() : null,
        paymentMethod: params.paymentMethod,
      }).where(eq(payrollEntries.id, entry.id));

      if (period.generatedBillId) {
        await tx.insert(billPayments).values({
          billId: period.generatedBillId,
          paymentMethod: params.paymentMethod === "wallet" ? "wallet" : params.paymentMethod,
          amount: amount.toFixed(2),
          paymentDate: new Date(),
          accountId: account.id,
          reference: refNo,
          enteredBy: params.userId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }

      created.push({ paymentId: payment.id, entryId: entry.id, employeeId: entry.employeeId, amount: amount.toFixed(2) });
    }

    await refreshBill(tx, period);
    await refreshPeriodStatus(tx, period.id);
  });

  return { payments: created, success: true };
}

/**
 * Reverses one payment: mirrors its ledger lines back, restores the balance,
 * reopens the entry and the period, and records the reason on the payment.
 */
export async function reversePayment(params: { paymentId: number; reason: string; userId: number; accountIdHint?: number | null }) {
  const db = getDb();
  const [payment] = await db.select().from(payrollPayments).where(eq(payrollPayments.id, params.paymentId)).limit(1);
  if (!payment) throw new Error("Payment not found");
  if (payment.reversedAt) throw new Error("This payment has already been reversed");
  if (!params.reason.trim()) throw new Error("A reason is required to reverse a payment");

  const [period] = await db.select().from(payrollPeriods).where(eq(payrollPeriods.id, payment.periodId)).limit(1);
  if (!period) throw new Error("Payroll period not found");
  const [entry] = await db.select().from(payrollEntries).where(eq(payrollEntries.id, payment.entryId)).limit(1);
  if (!entry) throw new Error("Payroll entry not found");

  const refNo = `PAY-${payment.id}`;
  const entryDate = new Date().toISOString().split("T")[0];

  await db.transaction(async (tx) => {
    const lines = await tx.select().from(ledgerEntries).where(
      and(eq(ledgerEntries.transactionType, "payroll"), eq(ledgerEntries.refNo, refNo), isNull(ledgerEntries.deletedAt)),
    );
    for (const line of lines) {
      const amount = d(line.amount);
      const flip = line.entryType === "credit" ? "debit" : "credit";
      const [acct] = await tx.select().from(accounts).where(eq(accounts.id, line.accountId)).limit(1);
      const restore = line.entryType === "credit" ? amount : amount.negated();
      const next = d(acct?.currentBalance || "0").plus(restore).toDecimalPlaces(2);
      await tx.insert(ledgerEntries).values({
        accountId: line.accountId,
        transactionType: "payroll",
        transactionId: period.id,
        entryType: flip,
        amount: amount.toFixed(2),
        balanceAfter: next.toFixed(2),
        entryDate,
        description: `Reversal (${params.reason}): ${line.description ?? refNo}`,
        refNo: `REV-${payment.id}`,
        createdBy: params.userId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      await tx.update(accounts).set({ currentBalance: next.toFixed(2) }).where(eq(accounts.id, line.accountId));
    }

    const paidAfter = d(entry.paidAmount ?? "0").minus(d(payment.amount)).toDecimalPlaces(2);
    const restored = paidAfter.lt(0) ? d(0) : paidAfter;
    await tx.update(payrollEntries).set({
      paidAmount: restored.toFixed(2),
      paymentStatus: paymentStatusFor(entry.netPay, restored.toFixed(2)),
      paidAt: null,
    }).where(eq(payrollEntries.id, entry.id));

    if (period.generatedBillId) {
      await tx.update(billPayments).set({ deletedAt: new Date() }).where(eq(billPayments.reference, refNo));
    }

    await tx.update(payrollPayments).set({
      reversedAt: new Date(),
      reversalReason: params.reason,
      reversedBy: params.userId,
    }).where(eq(payrollPayments.id, payment.id));

    await refreshBill(tx, period);
    await refreshPeriodStatus(tx, period.id);
  });

  return { success: true };
}
