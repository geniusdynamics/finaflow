// ABOUTME: Stateless public statement analysis: parse uploaded files, consolidate and return AI-ready JSON.
// ABOUTME: Does not persist files, passwords or rows; the caller's API key only supplies business identity.

import { buildAnalysisSheets } from "@shared/statements/analysis-sheets";
import { consolidateStatements } from "@shared/statements/consolidate";
import { CATEGORY_KEY_LABELS } from "@shared/statements/categorize/taxonomy";
import type { ParsedStatementRow } from "@shared/statements/types";
import { parseStatementFile, type ParsedFile } from "./service";

export interface PublicAnalysisInput {
  fileName: string;
  bytes: Uint8Array;
  password?: string;
}

export interface PublicAnalysisFile {
  fileName: string;
  provider: string;
  kind: string;
  parserId: string;
  parserVersion: string;
  sourceType: "pdf" | "csv";
  periodStart: string | null;
  periodEnd: string | null;
  rowCount: number;
  passwordProtected: boolean;
  warnings: string[];
}

export interface PublicAnalysisResult {
  schemaVersion: string;
  generatedAt: string;
  files: PublicAnalysisFile[];
  fileCount: number;
  totalRowCount: number;
  duplicateRows: number;
  periodStart: string | null;
  periodEnd: string | null;
  banks: string[];
  analysis: Record<string, unknown>;
  coverage: ReturnType<typeof consolidateStatements>["files"];
  sheets: ReturnType<typeof buildAnalysisSheets>;
  transactions?: Array<Record<string, unknown>>;
  warnings: string[];
  dataDictionary: Record<string, unknown>;
}

function compactTransaction(row: ParsedStatementRow): Record<string, unknown> {
  return {
    externalId: row.externalId,
    date: row.date,
    time: row.time,
    details: row.details,
    direction: row.direction,
    amount: row.amount,
    paidIn: row.paidIn,
    withdrawn: row.withdrawn,
    balance: row.balance,
    currency: row.currency,
    rail: row.rail,
    txnType: row.txnType,
    channel: row.channel ?? null,
    transactionCode: row.transactionCode ?? null,
    counterpartyName: row.counterpartyName,
    counterpartyId: row.counterpartyId,
    accountReference: row.accountReference,
    categoryKey: row.categoryKey,
    status: row.status,
  };
}

export async function analyzePublicStatements(
  inputs: PublicAnalysisInput[],
  options: { includeTransactions?: boolean } = {},
): Promise<PublicAnalysisResult> {
  const parsedFiles: ParsedFile[] = [];
  for (const input of inputs) {
    parsedFiles.push(await parseStatementFile({
      fileName: input.fileName,
      bytes: input.bytes,
      password: input.password,
    }));
  }

  const consolidated = consolidateStatements(
    parsedFiles.map((file) => ({ fileName: file.fileName, parsed: file.parsed })),
    {
      categoryOf: (row) => ({
        id: null,
        name: row.categoryKey
          ? CATEGORY_KEY_LABELS[row.categoryKey] ?? row.categoryKey
          : "No category",
      }),
    },
  );

  const warnings = [...new Set(parsedFiles.flatMap((file) => file.parsed.warnings))];
  const analysis = { ...consolidated.analysis, balance: undefined };

  return {
    schemaVersion: "2026-10-28",
    generatedAt: new Date().toISOString(),
    files: parsedFiles.map((file) => ({
      fileName: file.fileName,
      provider: file.parsed.provider,
      kind: file.parsed.kind,
      parserId: file.parsed.parserId,
      parserVersion: file.parsed.parserVersion,
      sourceType: file.sourceType,
      periodStart: file.parsed.metadata.periodStart ?? null,
      periodEnd: file.parsed.metadata.periodEnd ?? null,
      rowCount: file.parsed.rows.length,
      passwordProtected: file.passwordProtected,
      warnings: file.parsed.warnings,
    })),
    fileCount: consolidated.fileCount,
    totalRowCount: consolidated.totalRowCount,
    duplicateRows: consolidated.duplicateRows,
    periodStart: consolidated.periodStart,
    periodEnd: consolidated.periodEnd,
    banks: consolidated.banks,
    analysis,
    coverage: consolidated.files,
    sheets: buildAnalysisSheets(consolidated),
    warnings,
    ...(options.includeTransactions
      ? { transactions: consolidated.transactions.map(compactTransaction) }
      : {}),
    dataDictionary: {
      currency: "KES",
      dates: "ISO 8601 calendar dates (YYYY-MM-DD)",
      time: "HH:MM:SS or null",
      direction: "in = money received, out = money paid",
      amountStrings: "Analysis totals are exact decimal strings; sheet values are JSON numbers.",
      contacts: "counterpartyName when printed; otherwise the payer phone in counterpartyId.",
      grouping: "Use 'Money In - Grouped' / 'Money Out - Grouped' for party-level totals.",
      sheets: "Every entry mirrors the Excel report workbook; each has name, columns and rows.",
      coverage: "Per-file periods, totals, reconciliation and balance continuity.",
      balance: "Combined balance is intentionally omitted because multiple accounts cannot be summed; see coverage for per-file balances.",
      includeTransactions: "Pass includeTransactions=true to add the deduplicated transaction list.",
    },
  };
}
