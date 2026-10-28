// ABOUTME: Consolidates several parsed bank statements into one deduplicated, detailed analysis.
// ABOUTME: Keeps per-file coverage/reconciliation alongside the combined cash-flow view.

import { subtractAmounts, sumAmounts } from "./normalize/amount";
import {
  buildStatementAnalysis,
  type AnalysisOptions,
  type AnalysisBalance,
  type StatementAnalysis,
} from "./analyze";
import type { ParsedStatement, ParsedStatementRow } from "./types";

export interface ConsolidatedFileSummary {
  fileName: string;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  rowCount: number;
  totalIn: string;
  totalOut: string;
  totalFees: string;
  net: string;
  reconciliation: StatementAnalysis["reconciliation"];
  balance: AnalysisBalance;
}

export interface ConsolidationInput {
  fileName: string;
  parsed: ParsedStatement;
  analysis?: StatementAnalysis;
}

export interface ConsolidatedAnalysis {
  analysis: StatementAnalysis;
  files: ConsolidatedFileSummary[];
  fileCount: number;
  /** Rows across all files before cross-file deduplication. */
  totalRowCount: number;
  /** Rows removed because the same transaction appeared in another uploaded statement. */
  duplicateRows: number;
  banks: string[];
  periodStart: string | null;
  periodEnd: string | null;
  /** Deduplicated rows in chronological order, used by the public analysis API. */
  transactions: ParsedStatementRow[];
}

/** The report payload without row-level transactions, for storage and transport. */
export type ConsolidatedReport = Omit<ConsolidatedAnalysis, "transactions">;

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function netOf(parsed: ParsedStatement): string {
  return subtractAmounts(parsed.totals.totalIn, parsed.totals.totalOut);
}

export function consolidateStatements(
  inputs: ConsolidationInput[],
  options: AnalysisOptions = {},
): ConsolidatedAnalysis {
  if (inputs.length === 0) {
    throw new Error("At least one statement is required for consolidation.");
  }

  const rows: ParsedStatementRow[] = [];
  const seen = new Set<string>();
  let duplicateRows = 0;

  for (const input of inputs) {
    for (const row of input.parsed.rows) {
      const key = `${input.parsed.provider}|${row.externalId}`;
      if (seen.has(key)) {
        duplicateRows++;
        continue;
      }
      seen.add(key);
      rows.push(row);
    }
  }

  const orderedRows = [...rows].sort((a, b) =>
    a.date.localeCompare(b.date)
    || (a.time ?? "").localeCompare(b.time ?? "")
    || a.rowIndex - b.rowIndex,
  ).map((row, index) => ({ ...row, rowIndex: index }));

  const banks = unique(inputs.map((input) => input.parsed.metadata.bankName ?? ""));
  const periodStart = inputs
    .map((input) => input.parsed.metadata.periodStart)
    .filter((value): value is string => Boolean(value))
    .sort()[0] ?? orderedRows[0]?.date ?? null;
  const periodEnd = inputs
    .map((input) => input.parsed.metadata.periodEnd)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? orderedRows[orderedRows.length - 1]?.date ?? null;

  const accountNumbers = unique(inputs.map((input) => input.parsed.metadata.accountNumber ?? ""));
  const accountNames = unique(inputs.map((input) => input.parsed.metadata.accountName ?? ""));

  const allHaveSummary = inputs.every((input) => Boolean(input.parsed.statementSummary));
  const statementSummary = allHaveSummary
    ? {
        rails: inputs.flatMap((input) => input.parsed.statementSummary?.rails ?? []),
        totalIn: sumAmounts(inputs.map((input) => input.parsed.statementSummary!.totalIn)),
        totalOut: sumAmounts(inputs.map((input) => input.parsed.statementSummary!.totalOut)),
      }
    : undefined;

  const totalIn = sumAmounts(orderedRows.map((row) => row.paidIn));
  const totalOut = sumAmounts(orderedRows.map((row) => row.withdrawn));
  const totalFees = sumAmounts(
    orderedRows.filter((row) => row.txnType === "charge" || row.rail === "charge").map((row) => row.withdrawn),
  );

  const combined: ParsedStatement = {
    provider: inputs[0].parsed.provider,
    kind: inputs[0].parsed.kind,
    parserId: "consolidated-bank-statements",
    parserVersion: "1.0.0",
    currency: inputs[0].parsed.currency,
    metadata: {
      bankName: banks.length === 1 ? banks[0] : banks.length > 1 ? "Multiple banks" : undefined,
      accountNumber:
        accountNumbers.length === 1
          ? accountNumbers[0]
          : accountNumbers.length > 1
            ? `${accountNumbers.length} accounts`
            : undefined,
      accountName:
        accountNames.length === 1
          ? accountNames[0]
          : accountNames.length > 1
            ? `${accountNames.length} account holders`
            : undefined,
      periodStart: periodStart ?? undefined,
      periodEnd: periodEnd ?? undefined,
    },
    rows: orderedRows,
    order: "asc",
    totals: {
      rowCount: orderedRows.length,
      totalIn,
      totalOut,
      totalFees,
    },
    statementSummary,
    warnings: unique(inputs.flatMap((input) => input.parsed.warnings)),
  };

  const analysis = buildStatementAnalysis(combined, {
    ...options,
    contactLimit: options.contactLimit ?? Number.MAX_SAFE_INTEGER,
    feeRecipientLimit: options.feeRecipientLimit ?? Number.MAX_SAFE_INTEGER,
    duplicateCount: duplicateRows,
  });

  const files: ConsolidatedFileSummary[] = inputs.map((input) => {
    const fileAnalysis = input.analysis ?? buildStatementAnalysis(input.parsed, {
      ...options,
      duplicateCount: 0,
    });
    return {
      fileName: input.fileName,
      bankName: input.parsed.metadata.bankName ?? null,
      accountNumber: input.parsed.metadata.accountNumber ?? null,
      accountName: input.parsed.metadata.accountName ?? null,
      periodStart: input.parsed.metadata.periodStart ?? null,
      periodEnd: input.parsed.metadata.periodEnd ?? null,
      rowCount: input.parsed.rows.length,
      totalIn: input.parsed.totals.totalIn,
      totalOut: input.parsed.totals.totalOut,
      totalFees: input.parsed.totals.totalFees,
      net: netOf(input.parsed),
      reconciliation: fileAnalysis.reconciliation,
      balance: fileAnalysis.balance,
    };
  });

  return {
    analysis,
    files,
    fileCount: inputs.length,
    totalRowCount: inputs.reduce((sum, input) => sum + input.parsed.rows.length, 0),
    duplicateRows,
    banks,
    periodStart,
    periodEnd,
    transactions: orderedRows,
  };
}
