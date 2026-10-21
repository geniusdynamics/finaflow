// ABOUTME: Builds statement export files (CSV/XLSX/JSON) from a persisted import and its frozen analysis.
// ABOUTME: Reads only wallet rows and the statement_imports snapshot; the original file is never touched.

import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../queries/connection";
import { expenseCategories, mobileWalletTransactions, statementImports } from "@db/schema";
import {
  statementCsvBytes,
  type CsvDateFormat,
  type CsvSortOrder,
  type ExportTransaction,
} from "@shared/statements/export/csv";
import { buildStatementJson } from "@shared/statements/export/json";
import { isStatementAnalysis } from "@shared/statements/analyze";
import { StatementError } from "@shared/statements/errors";
import { buildStatementWorkbook } from "./export-xlsx";

export type ExportFormat = "csv" | "xlsx" | "json";

export interface StatementExportOptions {
  excludeCharges?: boolean;
  sortOrder?: CsvSortOrder;
  dateFormat?: CsvDateFormat;
  maskPii?: boolean;
}

export interface StatementExportResult {
  fileName: string;
  mimeType: string;
  base64: string;
}

function baseName(fileName: string | null, id: number): string {
  const source = fileName ?? `statement-${id}`;
  const dot = source.lastIndexOf(".");
  return (dot > 0 ? source.slice(0, dot) : source).replace(/[^\w.-]+/g, "-");
}

export async function exportStatementImport(input: {
  businessId: number;
  importId: number;
  format: ExportFormat;
  options?: StatementExportOptions;
}): Promise<StatementExportResult | null> {
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

  const analysis = record.analysis;
  if (!isStatementAnalysis(analysis)) {
    throw new StatementError(
      "PARSE_FAILED",
      "This import has no full analysis snapshot. Re-import the statement to generate one.",
    );
  }

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
      balance: mobileWalletTransactions.balance,
      description: mobileWalletTransactions.description,
      status: mobileWalletTransactions.status,
      rawPayload: mobileWalletTransactions.rawPayload,
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
    .orderBy(asc(mobileWalletTransactions.txnDate), asc(mobileWalletTransactions.txnTime));

  const transactions: ExportTransaction[] = rows.map((row) => {
    const raw = (row.rawPayload ?? {}) as {
      rail?: string;
      groupId?: string;
      accountReference?: string | null;
      transactionType?: string | null;
      otherParty?: string | null;
    };
    const isIn = row.direction === "in";
    return {
      receiptNo: row.providerRef ?? row.providerTxnId,
      date: row.txnDate,
      time: row.txnTime,
      details: row.description ?? row.providerTxnId,
      status: row.status,
      paidIn: isIn ? row.amount : "0.00",
      withdrawn: isIn ? "0.00" : row.amount,
      balance: row.balance ?? "0.00",
      direction: row.direction as "in" | "out",
      txnType: row.txnType,
      transactionType: raw.transactionType ?? null,
      otherParty: raw.otherParty ?? null,
      rail: raw.rail,
      groupId: raw.groupId,
      counterpartyName: row.partyName,
      counterpartyId: row.partyIdentifier,
      accountReference: raw.accountReference ?? null,
      categoryName: row.categoryName,
    };
  });

  const meta = {
    provider: record.provider,
    kind: record.kind,
    currency: record.currency,
    fileName: record.fileName,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    generatedAt: new Date().toISOString(),
  };

  if (input.format === "json") {
    const json = buildStatementJson({
      meta,
      totals: {
        rowCount: record.rowCount,
        totalIn: analysis.summary.totalIn,
        totalOut: analysis.summary.totalOut,
        totalFees: analysis.summary.totalFees,
      },
      transactions,
      analysis,
    });
    return {
      fileName: `${baseName(record.fileName, record.id)}.json`,
      mimeType: "application/json",
      base64: Buffer.from(json, "utf8").toString("base64"),
    };
  }

  if (input.format === "csv") {
    const bytes = statementCsvBytes(transactions, {
      excludeCharges: input.options?.excludeCharges,
      sortOrder: input.options?.sortOrder ?? "asc",
      dateFormat: input.options?.dateFormat ?? "iso",
      maskPii: input.options?.maskPii,
      paybillColumns: record.kind === "mobile_money_paybill",
    });
    return {
      fileName: `${baseName(record.fileName, record.id)}.csv`,
      mimeType: "text/csv; charset=utf-8",
      base64: Buffer.from(bytes).toString("base64"),
    };
  }

  const workbook = await buildStatementWorkbook({
    fileName: record.fileName,
    provider: record.provider,
    kind: record.kind,
    currency: record.currency,
    rows: transactions,
    analysis,
  });
  return {
    fileName: `${baseName(record.fileName, record.id)}.xlsx`,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    base64: workbook.toString("base64"),
  };
}
