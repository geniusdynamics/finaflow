// ABOUTME: Stable JSON export shape for statement transactions and analysis.
// ABOUTME: Used by the export API and the public converter so both produce the same document.

import type { StatementAnalysis } from "../analyze";
import type { ExportTransaction } from "./csv";

export interface StatementJsonMeta {
  provider: string;
  kind: string;
  currency: string;
  fileName?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  generatedAt: string;
}

export interface StatementJson {
  meta: StatementJsonMeta;
  totals: {
    rowCount: number;
    totalIn: string;
    totalOut: string;
    totalFees: string;
  };
  transactions: ExportTransaction[];
  analysis?: StatementAnalysis;
}

export function buildStatementJson(input: {
  meta: StatementJsonMeta;
  totals: StatementJson["totals"];
  transactions: ExportTransaction[];
  analysis?: StatementAnalysis;
}): string {
  const payload: StatementJson = {
    meta: input.meta,
    totals: input.totals,
    transactions: input.transactions,
    ...(input.analysis ? { analysis: input.analysis } : {}),
  };
  return JSON.stringify(payload, null, 2);
}
