// ABOUTME: Centralized logging and querying for all mobile wallet transactions across providers.
// ABOUTME: Provides consistent transaction recording, cross-provider aggregation, and stats computation.

import { getDb } from "../../queries/connection";
import { mobileWalletTransactions } from "@db/schema";
import { eq, and, gte, lte, isNull, desc } from "drizzle-orm";
import { WalletTxnStatus, WalletTxnType, WalletDirection } from "./provider-interface";

export interface LogTransactionParams {
  locationId: number;
  provider: string;
  providerTxnId: string;
  providerRef?: string;
  txnDate: string;
  txnTime?: string;
  txnType: WalletTxnType | string;
  direction: WalletDirection | string;
  amount: string;
  currency: string;
  partyName?: string;
  partyIdentifier?: string;
  txnFee?: string;
  balance?: string;
  description?: string;
  rawText?: string;
  rawPayload?: unknown;
  status: WalletTxnStatus | string;
  isReconciled?: boolean;
  isLinked?: boolean;
  linkedExpenseId?: number;
  linkedBillId?: number;
  linkedSupplierId?: number;
  sourceAccountId?: number;
  destinationAccountId?: number;
  importedBy?: number;
  baseCurrency?: string;
  baseAmount?: string;
  conversionRate?: string;
}

export interface WalletTransactionFilter {
  locationId: number;
  provider?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  direction?: string;
  currency?: string;
  unlinkedOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface WalletStats {
  totalInflow: Record<string, string>;
  totalOutflow: Record<string, string>;
  totalFees: Record<string, string>;
  transactionCount: number;
  byProvider: Array<{
    provider: string;
    totalIn: string;
    totalOut: string;
    count: number;
  }>;
}

export async function logWalletTransaction(params: LogTransactionParams): Promise<number> {
  const [result] = await getDb()
    .insert(mobileWalletTransactions)
    .values({
      locationId: params.locationId,
      provider: params.provider,
      providerTxnId: params.providerTxnId,
      providerRef: params.providerRef,
      txnDate: params.txnDate,
      txnTime: params.txnTime,
      txnType: params.txnType,
      direction: params.direction,
      amount: params.amount,
      currency: params.currency,
      partyName: params.partyName,
      partyIdentifier: params.partyIdentifier,
      txnFee: params.txnFee ?? "0.00",
      balance: params.balance,
      description: params.description,
      rawText: params.rawText,
      rawPayload: params.rawPayload as Record<string, unknown> | undefined,
      status: params.status,
      isReconciled: params.isReconciled ?? false,
      isLinked: params.isLinked ?? false,
      linkedExpenseId: params.linkedExpenseId,
      linkedBillId: params.linkedBillId,
      linkedSupplierId: params.linkedSupplierId,
      sourceAccountId: params.sourceAccountId,
      destinationAccountId: params.destinationAccountId,
      importedBy: params.importedBy,
      baseCurrency: params.baseCurrency,
      baseAmount: params.baseAmount,
      conversionRate: params.conversionRate,
    })
    .returning({ id: mobileWalletTransactions.id });

  return result.id;
}

export async function listWalletTransactions(filters: WalletTransactionFilter) {
  const conditions = [
    eq(mobileWalletTransactions.locationId, filters.locationId),
    isNull(mobileWalletTransactions.deletedAt),
  ];

  if (filters.provider) conditions.push(eq(mobileWalletTransactions.provider, filters.provider));
  if (filters.dateFrom) conditions.push(gte(mobileWalletTransactions.txnDate, filters.dateFrom));
  if (filters.dateTo) conditions.push(lte(mobileWalletTransactions.txnDate, filters.dateTo));
  if (filters.status) conditions.push(eq(mobileWalletTransactions.status, filters.status));
  if (filters.direction) conditions.push(eq(mobileWalletTransactions.direction, filters.direction));
  if (filters.currency) conditions.push(eq(mobileWalletTransactions.currency, filters.currency));
  if (filters.unlinkedOnly) conditions.push(eq(mobileWalletTransactions.isLinked, false));

  const rows = await getDb()
    .select()
    .from(mobileWalletTransactions)
    .where(and(...conditions))
    .orderBy(desc(mobileWalletTransactions.createdAt))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0);

  return rows;
}

export async function getWalletStats(filters: {
  locationId: number;
  provider?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<WalletStats> {
  const conditions = [
    eq(mobileWalletTransactions.locationId, filters.locationId),
    isNull(mobileWalletTransactions.deletedAt),
  ];

  if (filters.provider) conditions.push(eq(mobileWalletTransactions.provider, filters.provider));
  if (filters.dateFrom) conditions.push(gte(mobileWalletTransactions.txnDate, filters.dateFrom));
  if (filters.dateTo) conditions.push(lte(mobileWalletTransactions.txnDate, filters.dateTo));

  const rows = await getDb()
    .select({
      provider: mobileWalletTransactions.provider,
      direction: mobileWalletTransactions.direction,
      currency: mobileWalletTransactions.currency,
      amount: mobileWalletTransactions.amount,
      fee: mobileWalletTransactions.txnFee,
    })
    .from(mobileWalletTransactions)
    .where(and(...conditions));

  const stats: WalletStats = {
    totalInflow: {},
    totalOutflow: {},
    totalFees: {},
    transactionCount: rows.length,
    byProvider: [],
  };

  const providerMap = new Map<string, { totalIn: number; totalOut: number; count: number }>();

  for (const row of rows) {
    const amount = parseFloat(row.amount) || 0;
    const fee = parseFloat(row.fee) || 0;
    const curr = row.currency || "KES";

    if (row.direction === "in") {
      stats.totalInflow[curr] = (parseFloat(stats.totalInflow[curr] || "0") + amount).toFixed(2);
    } else {
      stats.totalOutflow[curr] = (parseFloat(stats.totalOutflow[curr] || "0") + Math.abs(amount)).toFixed(2);
    }
    stats.totalFees[curr] = (parseFloat(stats.totalFees[curr] || "0") + fee).toFixed(2);

    const pKey = row.provider;
    if (!providerMap.has(pKey)) {
      providerMap.set(pKey, { totalIn: 0, totalOut: 0, count: 0 });
    }
    const pStats = providerMap.get(pKey)!;
    pStats.count++;
    if (row.direction === "in") {
      pStats.totalIn += amount;
    } else {
      pStats.totalOut += Math.abs(amount);
    }
  }

  stats.byProvider = Array.from(providerMap.entries()).map(([provider, data]) => ({
    provider,
    totalIn: data.totalIn.toFixed(2),
    totalOut: data.totalOut.toFixed(2),
    count: data.count,
  }));

  return stats;
}

export async function getWalletTransactionById(id: number) {
  const rows = await getDb()
    .select()
    .from(mobileWalletTransactions)
    .where(and(eq(mobileWalletTransactions.id, id), isNull(mobileWalletTransactions.deletedAt)))
    .limit(1);
  return rows.length > 0 ? rows[0] : null;
}
