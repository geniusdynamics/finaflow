// ABOUTME: Party grouping for bank statement contacts: strips prefixes, references and phone fragments.
// ABOUTME: Adds a grouped view without changing the exact-name report.

import Decimal from "decimal.js";
import type { ContactRow } from "./analyze";
import { compareAmounts, sumAmounts } from "./normalize/amount";

export interface GroupedContactRow extends ContactRow {
  /** Number of distinct printed names combined into this group. */
  members: number;
  aliases: string[];
}

/**
 * Normalises a printed counterparty so variants such as
 * `G BAMBURI CE MENT PUBLIC LIMITED FT2604` and `H BAMBURI CE MENT PUBLIC LIMITED FT2604`
 * land in the same group.
 *
 * Bank narrations that describe an operation rather than a counterparty collapse to the
 * operation head — every `CASH WITHDRAWAL ...` line becomes `CASH WITHDRAWAL` — while the
 * exact-name reports keep the full narration.
 */
export function normalisePartyName(raw: string): string {
  const original = raw.replace(/\s+/g, " ").trim().toUpperCase();
  const operation = original.match(/^(CASH WITHDRAWAL|CASH DEPOSIT)\b/);
  if (operation) return operation[1];

  let name = original
    .replace(/[#*]/g, " ")
    .replace(/\b(?:FT[A-Z0-9]{4,}|TT[A-Z0-9]{4,}|U[A-Z0-9]{8,}|MBN[A-Z0-9]{8,})\b/g, " ")
    .replace(/\bF\s+T\d{4,}\b/g, " ")
    .replace(/\bCHQ\s?\d+\b/g, " ")
    .replace(/\bAT-?T\b/g, " ")
    // Mixed letter/digit tokens are transaction references (WNCTR416, FT26083, CHQ28).
    .replace(/\b(?=[A-Z0-9-]*\d)[A-Z][A-Z0-9-]{3,}\b/g, " ")
    .replace(/\b(?:2547\d{8}|07\d{8})\b/g, " ")
    .replace(/\b\d{4,}\b/g, " ")
    .replace(/\bAC-?\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  name = name
    .replace(/^(?:MPES|MPESA|M-?PES|LIPANA KCB|BANK TO MOBILE|BILLPAY|AIRTEL MONEY|CUSTOMER TRANSFER|FUNDS RECEIVED|TRANSFER|PAYMENT)\b/, "")
    .trim();
  const operationAfterPrefix = name.match(/^(CASH WITHDRAWAL|CASH DEPOSIT)\b/);
  if (operationAfterPrefix) return operationAfterPrefix[1];
  name = name.replace(/^(?:[A-Z]\s+)+(?=[A-Z]{2,})/, "");
  name = name.replace(/\s+\b[A-Z]\b$/, "");
  name = name.replace(/^[-:]+|[-:]+$/g, "").replace(/\s+/g, " ").trim();
  return name.length >= 2 ? name : original;
}

export function groupContacts(rows: ContactRow[]): GroupedContactRow[] {
  const groups = new Map<string, { count: number; total: string[]; aliases: Set<string> }>();
  for (const row of rows) {
    const key = normalisePartyName(row.name);
    const entry = groups.get(key) ?? { count: 0, total: [], aliases: new Set<string>() };
    entry.count += row.count;
    entry.total.push(row.total);
    entry.aliases.add(row.name);
    groups.set(key, entry);
  }

  return [...groups.entries()]
    .map(([name, entry]) => {
      const total = sumAmounts(entry.total);
      return {
        name,
        count: entry.count,
        total,
        average: new Decimal(total).div(entry.count).toFixed(2),
        members: entry.aliases.size,
        aliases: [...entry.aliases].sort(),
      };
    })
    .sort((a, b) => compareAmounts(b.total, a.total));
}
