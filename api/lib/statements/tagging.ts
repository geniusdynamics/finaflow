// ABOUTME: Tags imported statement rows and links them to bills for AI-driven reconciliation.
// ABOUTME: Tagging reuses the manual category path; linking is metadata unless postPayment is true.

import { and, eq, isNull } from "drizzle-orm";
import { bills, locations, mobileWalletTransactions } from "@db/schema";
import { getDb } from "../../queries/connection";
import { payBillForBusiness } from "../integration-service";
import { setWalletCategory } from "./categories";

export interface TagTransactionsInput {
  businessId: number;
  transactionIds: number[];
  categoryId: number | null;
  rememberMerchant?: boolean;
  userId?: number | null;
}

/** Applies one category to many rows; rows outside the business are reported, not updated. */
export async function tagWalletTransactions(input: TagTransactionsInput) {
  const ids = [...new Set(input.transactionIds)].slice(0, 500);
  let updated = 0;
  const missing: number[] = [];

  for (const walletTxnId of ids) {
    const result = await setWalletCategory({
      businessId: input.businessId,
      walletTxnId,
      categoryId: input.categoryId,
      rememberMerchant: input.rememberMerchant,
      userId: input.userId,
    });
    if (result) updated += 1;
    else missing.push(walletTxnId);
  }

  return { updated, missing, requested: ids.length };
}

export interface LinkTransactionInput {
  businessId: number;
  transactionId: number;
  billId: number;
  /** Post the matching bill payment as well as recording the link. Defaults to false. */
  postPayment?: boolean;
  categoryId?: number;
  userId?: number | null;
}

/**
 * Links a statement row to a bill.
 *
 * `postPayment: false` records the match only, so an already-imported row can be
 * reconciled without double-posting a payment. `postPayment: true` runs the same
 * accounting path as the app and attaches the created expense to the row.
 */
export async function linkWalletTransactionToBill(input: LinkTransactionInput) {
  const db = getDb();
  const [txn] = await db
    .select({
      id: mobileWalletTransactions.id,
      locationId: mobileWalletTransactions.locationId,
      businessId: locations.businessId,
      direction: mobileWalletTransactions.direction,
      amount: mobileWalletTransactions.amount,
      txnDate: mobileWalletTransactions.txnDate,
      provider: mobileWalletTransactions.provider,
      providerRef: mobileWalletTransactions.providerRef,
      providerTxnId: mobileWalletTransactions.providerTxnId,
      description: mobileWalletTransactions.description,
      sourceAccountId: mobileWalletTransactions.sourceAccountId,
      linkedExpenseId: mobileWalletTransactions.linkedExpenseId,
    })
    .from(mobileWalletTransactions)
    .innerJoin(locations, eq(locations.id, mobileWalletTransactions.locationId))
    .where(and(eq(mobileWalletTransactions.id, input.transactionId), isNull(mobileWalletTransactions.deletedAt)))
    .limit(1);
  if (!txn || txn.businessId !== input.businessId) return null;

  const [bill] = await db
    .select({
      id: bills.id,
      supplierId: bills.supplierId,
      status: bills.status,
    })
    .from(bills)
    .where(and(eq(bills.id, input.billId), eq(bills.businessId, input.businessId), isNull(bills.deletedAt)))
    .limit(1);
  if (!bill) throw new Error("Bill not found");

  let payment: Awaited<ReturnType<typeof payBillForBusiness>> | undefined;
  let linkedExpenseId: number | null = txn.linkedExpenseId ?? null;

  if (input.postPayment) {
    if (txn.direction !== "out") {
      throw new Error("Only outgoing transactions can be posted as a bill payment.");
    }
    const paymentMethod = txn.provider === "bank" ? "bank_transfer" : txn.provider === "mpesa" ? "wallet" : "cash";
    payment = await payBillForBusiness(input.businessId, {
      billId: input.billId,
      paymentMethod,
      amount: txn.amount,
      paymentDate: txn.txnDate,
      reference: txn.providerRef ?? txn.providerTxnId,
      notes: txn.description ?? undefined,
      accountId: txn.sourceAccountId ?? undefined,
      categoryId: input.categoryId,
    });
    linkedExpenseId = payment.expenseId ?? linkedExpenseId;
  }

  const [updated] = await db
    .update(mobileWalletTransactions)
    .set({
      isLinked: true,
      isReconciled: true,
      linkedBillId: bill.id,
      linkedSupplierId: bill.supplierId ?? null,
      linkedExpenseId,
    })
    .where(eq(mobileWalletTransactions.id, txn.id))
    .returning({
      id: mobileWalletTransactions.id,
      isLinked: mobileWalletTransactions.isLinked,
      isReconciled: mobileWalletTransactions.isReconciled,
      linkedBillId: mobileWalletTransactions.linkedBillId,
      linkedSupplierId: mobileWalletTransactions.linkedSupplierId,
      linkedExpenseId: mobileWalletTransactions.linkedExpenseId,
    });

  return { transaction: updated, payment: payment ?? null };
}
