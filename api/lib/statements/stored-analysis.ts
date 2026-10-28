// ABOUTME: Rebuilds the full consolidated analysis for an already-imported statement.
// ABOUTME: Uses live categories so AI or manual tagging is reflected without re-importing.

import { and, asc, eq, isNull } from "drizzle-orm";
import type { ConsolidatedAnalysis } from "@shared/statements/consolidate";
import { consolidateStatements } from "@shared/statements/consolidate";
import { sumAmounts } from "@shared/statements/normalize/amount";
import type {
  ParsedStatement,
  ParsedStatementRow,
  StatementDirection,
  StatementKind,
  StatementProvider,
  StatementRail,
  StatementStatus,
  StatementTxnType,
} from "@shared/statements/types";
import { expenseCategories, mobileWalletTransactions, statementImports } from "@db/schema";
import { getDb } from "../../queries/connection";

interface StoredPayload {
  rail?: StatementRail;
  groupId?: string;
  groupRole?: ParsedStatementRow["groupRole"];
  accountReference?: string | null;
  transactionType?: string | null;
  channel?: string | null;
  transactionCode?: string | null;
  fulizaFunded?: boolean;
  linkedTxnExternalId?: string | null;
  fulizaOf?: string | null;
}

export type StoredAnalysis = ConsolidatedAnalysis;

function payloadOf(value: unknown): StoredPayload {
  return value && typeof value === "object" ? (value as StoredPayload) : {};
}

/**
 * Returns the same consolidated shape the public analyzer produces, rebuilt from the
 * rows stored for one import. Categories come from the database, so tagging changes
 * the analysis immediately.
 */
export async function analyzeStatementImport(input: {
  businessId: number;
  importId: number;
}): Promise<StoredAnalysis | null> {
  const db = getDb();
  const [record] = await db
    .select()
    .from(statementImports)
    .where(
      and(
        eq(statementImports.id, input.importId),
        eq(statementImports.businessId, input.businessId),
        isNull(statementImports.deletedAt),
      ),
    )
    .limit(1);
  if (!record) return null;

  const rows = await db
    .select({
      id: mobileWalletTransactions.id,
      providerTxnId: mobileWalletTransactions.providerTxnId,
      providerRef: mobileWalletTransactions.providerRef,
      txnDate: mobileWalletTransactions.txnDate,
      txnTime: mobileWalletTransactions.txnTime,
      txnType: mobileWalletTransactions.txnType,
      direction: mobileWalletTransactions.direction,
      partyName: mobileWalletTransactions.partyName,
      partyIdentifier: mobileWalletTransactions.partyIdentifier,
      amount: mobileWalletTransactions.amount,
      currency: mobileWalletTransactions.currency,
      balance: mobileWalletTransactions.balance,
      description: mobileWalletTransactions.description,
      rawText: mobileWalletTransactions.rawText,
      rawPayload: mobileWalletTransactions.rawPayload,
      status: mobileWalletTransactions.status,
      categoryId: mobileWalletTransactions.categoryId,
      categoryName: expenseCategories.name,
    })
    .from(mobileWalletTransactions)
    .leftJoin(expenseCategories, eq(mobileWalletTransactions.categoryId, expenseCategories.id))
    .where(
      and(
        eq(mobileWalletTransactions.statementImportId, input.importId),
        isNull(mobileWalletTransactions.deletedAt),
      ),
    )
    .orderBy(asc(mobileWalletTransactions.txnDate), asc(mobileWalletTransactions.txnTime), asc(mobileWalletTransactions.id));

  const categoryByExternalId = new Map<string, { id: number; name: string }>();
  for (const row of rows) {
    if (row.categoryId === null) continue;
    categoryByExternalId.set(row.providerTxnId, {
      id: row.categoryId,
      name: row.categoryName ?? "Category",
    });
  }

  const parsedRows: ParsedStatementRow[] = rows.map((row, index) => {
    const payload = payloadOf(row.rawPayload);
    const direction = (row.direction === "in" ? "in" : "out") as StatementDirection;
    const amount = row.amount ?? "0.00";
    return {
      rowIndex: index,
      page: 1,
      externalId: row.providerTxnId,
      groupId: payload.groupId ?? row.providerRef ?? row.providerTxnId,
      groupRole: payload.groupRole ?? "primary",
      receiptNo: row.providerRef ?? row.providerTxnId,
      date: row.txnDate,
      time: row.txnTime ?? null,
      details: row.description ?? "",
      status: (row.status ?? "completed") as StatementStatus,
      paidIn: direction === "in" ? amount : "0.00",
      withdrawn: direction === "out" ? amount : "0.00",
      balance: row.balance ?? "0.00",
      direction,
      amount,
      currency: row.currency ?? "KES",
      rail: (payload.rail ?? (record.provider === "bank" ? "bank" : "mpesa")) as StatementRail,
      txnType: (row.txnType ?? "payment") as StatementTxnType,
      counterpartyName: row.partyName ?? null,
      counterpartyId: row.partyIdentifier ?? null,
      accountReference: payload.accountReference ?? null,
      transactionType: payload.transactionType ?? null,
      channel: payload.channel ?? null,
      transactionCode: payload.transactionCode ?? null,
      categoryKey: null,
      categoryConfidence: row.categoryId ? 1 : 0,
      fulizaFunded: payload.fulizaFunded === true,
      linkedTxnExternalId: payload.linkedTxnExternalId ?? null,
      fulizaOf: payload.fulizaOf ?? null,
      rawLines: row.rawText ? row.rawText.split(/\r?\n/) : [row.description ?? ""],
      warnings: [],
    };
  });

  const parsed: ParsedStatement = {
    provider: record.provider as StatementProvider,
    kind: record.kind as StatementKind,
    parserId: record.parserId ?? record.provider,
    parserVersion: record.parserVersion ?? "1",
    currency: record.currency ?? "KES",
    metadata: {
      bankName: record.provider === "bank" ? "Bank" : record.provider.toUpperCase(),
      periodStart: record.periodStart ?? undefined,
      periodEnd: record.periodEnd ?? undefined,
      openingBalance: record.openingBalance ?? undefined,
      closingBalance: record.closingBalance ?? undefined,
    },
    rows: parsedRows,
    order: "asc",
    totals: {
      rowCount: parsedRows.length,
      totalIn: sumAmounts(parsedRows.map((row) => row.paidIn)),
      totalOut: sumAmounts(parsedRows.map((row) => row.withdrawn)),
      totalFees: sumAmounts(
        parsedRows
          .filter((row) => row.txnType === "charge" || row.rail === "charge")
          .map((row) => row.withdrawn),
      ),
    },
    warnings: Array.isArray(record.warnings) ? (record.warnings as string[]) : [],
  };

  return consolidateStatements(
    [{ fileName: record.fileName ?? `Statement ${record.id}`, parsed }],
    {
      categoryOf: (row) => categoryByExternalId.get(row.externalId) ?? { id: null, name: "No category" },
    },
  );
}
