import { and, eq, isNull } from "drizzle-orm";
import { accounts, bills, billPayments, expenses, suppliers, ledgerEntries } from "@db/schema";
import { d } from "./decimal";
import { ensureSystemAccount } from "./accounting-accounts";
import type { DbClient } from "./account-subscriptions";
import type { AccountType } from "@db/schema";

export interface PayBillInput {
  db: DbClient;
  billId: number;
  paymentMethod: "cash" | "wallet" | "bank_transfer" | "card";
  amount: string;
  paymentDate: string;
  reference?: string;
  notes?: string;
  accountId?: number;
  liabilityAccountId?: number;
  categoryId: number;
  enteredBy: number;
  businessId: number;
  locationId: number;
  supplierId?: number | null;
  billNumber?: string | null;
  description?: string | null;
  skipExpenseCreation?: boolean;
}

export interface PayBillResult {
  paymentId: number;
  newBalanceDue: string;
  status: "paid" | "partial";
}

export async function payBill(input: PayBillInput): Promise<PayBillResult> {
  const { db: tx, billId, paymentMethod, amount, paymentDate, reference, notes, accountId, liabilityAccountId, categoryId, enteredBy, businessId, locationId, supplierId, billNumber, description, skipExpenseCreation } = input;

  const paymentAmount = d(amount);
  const paymentDateStr = new Date(paymentDate).toISOString().split("T")[0];

  const [billRecord] = await tx.select().from(bills).where(eq(bills.id, billId)).limit(1);
  const bill = billRecord;
  const currentPaid = d(bill?.amountPaid || "0");
  const totalAmount = d(bill?.amount || "0");
  const newPaid = currentPaid.plus(paymentAmount);
  const newBalance = d(Math.max(0, totalAmount.minus(currentPaid).minus(paymentAmount).toNumber()));
  const status: "paid" | "partial" = newBalance.lte(0) ? "paid" : "partial";

  await tx.update(bills).set({ amountPaid: newPaid.toFixed(2), balanceDue: newBalance.toFixed(2), status }).where(eq(bills.id, billId));

  const [paymentResult] = await tx.insert(billPayments).values({
    billId, paymentMethod,
    amount, paymentDate: paymentDateStr,
    reference, notes,
    accountId, enteredBy,
  } satisfies typeof billPayments.$inferInsert).returning();
  const paymentId = paymentResult.id;

  const resolvedSupplierId = supplierId ?? bill?.supplierId ?? null;
  if (resolvedSupplierId) {
    const [sup] = await tx.select().from(suppliers).where(eq(suppliers.id, resolvedSupplierId)).limit(1);
    if (sup) {
      const newPaidSup = d(sup.totalPaid).plus(paymentAmount);
      const newBalSup = d(Math.max(0, d(sup.currentBalance).minus(paymentAmount).toNumber()));
      await tx.update(suppliers).set({ totalPaid: newPaidSup.toFixed(2), currentBalance: newBalSup.toFixed(2) }).where(eq(suppliers.id, resolvedSupplierId));
    }
  }

  let cashAccountId = accountId;
  if (!cashAccountId) {
    const typeMap: Record<string, string> = { cash: "cash", wallet: "cash", bank_transfer: "bank", card: "bank" };
    const [defaultAccount] = await tx.select().from(accounts).where(
      and(
        eq(accounts.locationId, locationId),
        eq(accounts.type, typeMap[paymentMethod] as AccountType),
        isNull(accounts.deletedAt)
      )
    ).limit(1);
    if (defaultAccount) cashAccountId = defaultAccount.id;
  }

  if (cashAccountId) {
    const [acct] = await tx.select().from(accounts).where(eq(accounts.id, cashAccountId)).limit(1);
    if (acct) {
      const newBal = d(acct.currentBalance || "0").minus(paymentAmount);
      const refNo = billNumber ?? `BILL-${String(billId).padStart(4, "0")}`;
      await tx.insert(ledgerEntries).values({
        accountId: cashAccountId, transactionType: "bill_payment",
        transactionId: paymentId, entryType: "credit",
        amount, balanceAfter: newBal.toFixed(2),
        entryDate: paymentDateStr, createdBy: enteredBy,
        refNo,
      } satisfies typeof ledgerEntries.$inferInsert).returning();
      await tx.update(accounts).set({ currentBalance: newBal.toFixed(2) }).where(eq(accounts.id, cashAccountId));
    }
  }

  if (businessId) {
    const existingAp = liabilityAccountId
      ? await tx.select().from(accounts).where(and(eq(accounts.id, liabilityAccountId), isNull(accounts.deletedAt))).limit(1)
      : await tx.select().from(accounts).where(
          and(
            eq(accounts.businessId, businessId),
            eq(accounts.accountSubType, "accounts_payable"),
            isNull(accounts.deletedAt)
          )
        ).limit(1);

    if (existingAp[0]) {
      const billBalanceDue = d(bill?.balanceDue || "0");
      const apDebitAmount = paymentAmount.lte(billBalanceDue) ? paymentAmount : billBalanceDue;
      const prepaymentAmount = paymentAmount.gt(billBalanceDue) ? paymentAmount.minus(billBalanceDue) : d(0);
      const desc = `Bill Payment: ${reference || description || ""}`;

      if (apDebitAmount.gt(0)) {
        const apNewBal = d(existingAp[0].currentBalance || "0").minus(apDebitAmount);
        await tx.insert(ledgerEntries).values({
          accountId: existingAp[0].id,
          transactionType: "bill_payment",
          transactionId: paymentId,
          entryType: "debit",
          amount: apDebitAmount.toFixed(2),
          balanceAfter: apNewBal.toFixed(2),
          entryDate: paymentDateStr,
          createdBy: enteredBy,
          description: desc,
        } satisfies typeof ledgerEntries.$inferInsert).returning();
        await tx.update(accounts).set({ currentBalance: apNewBal.toFixed(2) }).where(eq(accounts.id, existingAp[0].id));
      }

      if (prepaymentAmount.gt(0)) {
        const prepayAccountId = (await ensureSystemAccount({
          businessId,
          accountType: "asset",
          accountSubType: "prepaid_expense",
          name: "Supplier Prepayments",
        })).id;
        const [prepayAcct] = await tx.select().from(accounts).where(
          and(eq(accounts.id, prepayAccountId), isNull(accounts.deletedAt))
        ).limit(1);
        if (prepayAcct) {
          const prepayNewBal = d(prepayAcct.currentBalance || "0").plus(prepaymentAmount);
          await tx.insert(ledgerEntries).values({
            accountId: prepayAcct.id,
            transactionType: "bill_payment",
            transactionId: paymentId,
            entryType: "debit",
            amount: prepaymentAmount.toFixed(2),
            balanceAfter: prepayNewBal.toFixed(2),
            entryDate: paymentDateStr,
            createdBy: enteredBy,
            description: `Supplier Overpayment (${reference || description || ""})`,
          } satisfies typeof ledgerEntries.$inferInsert).returning();
          await tx.update(accounts).set({ currentBalance: prepayNewBal.toFixed(2) }).where(eq(accounts.id, prepayAcct.id));
        }
      }
    }
  }

  if (!skipExpenseCreation) {
    const expenseNumber = `EXP-BP-${String(paymentId).padStart(6, "0")}`;
    await tx.insert(expenses).values({
      locationId,
      businessId,
      categoryId,
      supplierId: resolvedSupplierId,
      expenseNumber,
      billId,
      amount,
      description: `Bill Payment: ${reference || description || ""}`,
      expenseDate: paymentDateStr,
      paymentMethod,
      accountId: cashAccountId ?? null,
      enteredBy,
      refNo: billNumber ?? `BILL-${String(billId).padStart(4, "0")}`,
    } satisfies typeof expenses.$inferInsert).returning();
  }

  return { paymentId, newBalanceDue: newBalance.toFixed(2), status };
}
