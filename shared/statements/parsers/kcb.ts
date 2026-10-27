// ABOUTME: KCB online account statement parser (positioned text, oldest-first, negative money-out column).
// ABOUTME: Bank profiles share the canonical statement row shape so analysis, exports and imports stay generic.

import type {
  ExtractedDocument,
  ParsedStatement,
  ParsedStatementRow,
  StatementDirection,
  StatementMetadata,
  StatementRail,
  StatementTxnType,
  TextLine,
} from "../types";
import { absoluteAmount, compareAmounts, normalizeAmount, sumAmounts } from "../normalize/amount";
import { UnsupportedStatementError } from "../errors";

export const KCB_PARSER_ID = "kcb-bank-statement";
export const KCB_PARSER_VERSION = "1.0.0";

const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

const DATE_TOKEN = /^\d{2} [A-Z]{3} \d{4}$/i;
const MONEY_TOKEN = /^-?\d[\d,]*(?:\.\d{1,2})?$/;

interface KcbLayout {
  dateX: number;
  descX: number;
  valueX: number;
  outX: number;
  inX: number;
  balanceX: number;
}

interface KcbRawRow {
  page: number;
  date: string;
  valueDate: string | null;
  details: string;
  paidIn: string;
  withdrawn: string;
  balance: string;
  rawLines: string[];
}

function findLayout(doc: ExtractedDocument): KcbLayout | null {
  for (const line of doc.lines) {
    const labels = new Map(line.cells.map((cell) => [cell.text.trim().toUpperCase(), cell.x]));
    if (
      labels.has("TXN DATE")
      && labels.has("DESCRIPTION")
      && labels.has("VALUE DATE")
      && labels.has("MONEY OUT")
      && labels.has("MONEY IN")
      && labels.has("LEDGER BALANCE")
    ) {
      return {
        dateX: labels.get("TXN DATE")!,
        descX: labels.get("DESCRIPTION")!,
        valueX: labels.get("VALUE DATE")!,
        outX: labels.get("MONEY OUT")!,
        inX: labels.get("MONEY IN")!,
        balanceX: labels.get("LEDGER BALANCE")!,
      };
    }
  }
  return null;
}

/** KCB prints dates like `01 MAR 2026` and period ends like `31 FEB 2026`; clamp impossible days. */
export function parseKcbDate(raw: string, clamp = true): string | null {
  const match = /^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/i.exec(raw.trim());
  if (!match) return null;
  const month = MONTHS[match[2].toUpperCase()];
  if (!month) return null;
  const year = Number(match[3]);
  const day = Number(match[1]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const safeDay = clamp ? Math.min(Math.max(1, day), lastDay) : day;
  const date = new Date(Date.UTC(year, month - 1, safeDay));
  if (!clamp && (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day)) return null;
  return date.toISOString().slice(0, 10);
}

function isMoney(text: string): boolean {
  return MONEY_TOKEN.test(text.trim());
}

function moneyValue(text: string): string {
  const value = normalizeAmount(text).value;
  return absoluteAmount(value);
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, "0");
}

function classify(details: string, direction: StatementDirection): {
  rail: StatementRail;
  txnType: StatementTxnType;
  categoryKey: string | null;
  categoryConfidence: number;
} {
  const d = details.toLowerCase();
  if (/\b(reversal|returned|bounce|declined|rejected)\b/.test(d)) {
    return { rail: "reversal", txnType: "refund", categoryKey: null, categoryConfidence: 0 };
  }
  // A charge credited back to the account is a fee reversal, not income from a charge.
  if (direction === "in" && /\b(charge|commission|fee|tax)\b/.test(d)) {
    return { rail: "reversal", txnType: "refund", categoryKey: null, categoryConfidence: 0 };
  }
  if (/\b(charge|commission|fee|excise|vat|levy|tax)\b/.test(d)) {
    return { rail: "charge", txnType: "charge", categoryKey: "fees", categoryConfidence: 0.95 };
  }
  if (/\b(salary|payroll|wages)\b/.test(d)) {
    return {
      rail: "salary",
      txnType: "bank_transfer",
      categoryKey: direction === "out" ? "salaries" : null,
      categoryConfidence: direction === "out" ? 0.8 : 0,
    };
  }
  if (/\binterest\b/.test(d)) {
    return { rail: "interest", txnType: "bank_transfer", categoryKey: null, categoryConfidence: 0 };
  }
  if (/\b(atm|cash withdrawal)\b/.test(d)) {
    return { rail: "cash_withdrawal", txnType: "withdrawal", categoryKey: "cash_withdrawal", categoryConfidence: 0.9 };
  }
  if (/\b(cash deposit|deposit)\b/.test(d)) {
    return { rail: "cash_deposit", txnType: "bank_transfer", categoryKey: null, categoryConfidence: 0 };
  }
  if (/\bcheque\b|\bchq\d*/i.test(d)) {
    return { rail: "cheque", txnType: "transfer", categoryKey: null, categoryConfidence: 0 };
  }
  if (/\bstanding order\b/.test(d)) {
    return { rail: "standing_order", txnType: "payment", categoryKey: null, categoryConfidence: 0 };
  }
  if (/\b(loan|overdraft|facility)\b/.test(d)) {
    return {
      rail: "loan",
      txnType: direction === "in" ? "loan_drawdown" : "loan_repayment",
      categoryKey: "loans_savings",
      categoryConfidence: 0.8,
    };
  }

  let categoryKey: string | null = null;
  let categoryConfidence = 0;
  if (direction === "out") {
    if (/\b(kplc|kenya power|water|utility|dstv|zuku|internet)\b/.test(d)) {
      categoryKey = "utilities";
      categoryConfidence = 0.85;
    } else if (/\b(fuel|petroleum|shell|total|rubis|vivo)\b/.test(d)) {
      categoryKey = "fuel";
      categoryConfidence = 0.8;
    } else if (/\b(cement|bamburi|hardware|steel|supplies)\b/.test(d)) {
      categoryKey = "supplies";
      categoryConfidence = 0.75;
    } else if (/\b(rent|landlord)\b/.test(d)) {
      categoryKey = "rent";
      categoryConfidence = 0.75;
    } else if (/\b(airtime)\b/.test(d)) {
      categoryKey = "airtime";
      categoryConfidence = 0.8;
    }
  }

  const transfer = /\b(transfer|rtgs|eft|swift|pesalink|m-?pesa|bank to mobile|bill ?pay|paybill|direct credit)\b/.test(d);
  return {
    rail: transfer ? "bank_transfer" : "other",
    txnType: transfer ? "bank_transfer" : "transfer",
    categoryKey,
    categoryConfidence,
  };
}

function counterpartyOf(details: string): string | null {
  const cleaned = details.replace(/\s+/g, " ").trim();
  if (/^(balance b\/fwd|balance c\/fwd)/i.test(cleaned)) return null;
  const match = /^(?:transfer|payment|cash deposit|cash withdrawal|cheque|standing order|salary|rtgs|eft|swift|bank to mobile|bill ?pay|direct credit)\s+(?:from\s+|to\s+)?(.+)$/i.exec(cleaned);
  if (!match) return null;
  const name = match[1].trim();
  return name.length >= 2 ? name : null;
}

function readPrimary(line: TextLine, layout: KcbLayout): Omit<KcbRawRow, "rawLines"> | null {
  const dateCell = line.cells.find((cell) => cell.x < layout.dateX + 250 && DATE_TOKEN.test(cell.text));
  if (!dateCell) return null;

  const balanceCell = line.cells.find(
    (cell) => cell.x > layout.balanceX - 120 && isMoney(cell.text),
  );
  if (!balanceCell) return null;

  const outMax = layout.outX + (layout.inX - layout.outX) * 0.9;
  const inMax = layout.inX + (layout.balanceX - layout.inX) * 0.9;
  const outCell = line.cells.find(
    (cell) => cell.x > layout.valueX && cell.x <= outMax && isMoney(cell.text),
  );
  const inCell = line.cells.find(
    (cell) => cell.x > outMax && cell.x < inMax && isMoney(cell.text),
  );

  const details = line.cells
    .filter((cell) => cell.x >= layout.descX - 250 && cell.x < layout.valueX - 250 && !DATE_TOKEN.test(cell.text))
    .map((cell) => cell.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!details) return null;

  const valueCell = line.cells.find(
    (cell) => cell.x >= layout.valueX - 250 && cell.x < layout.outX - 250 && DATE_TOKEN.test(cell.text),
  );

  const paidIn = inCell ? moneyValue(inCell.text) : "0.00";
  const withdrawn = outCell ? moneyValue(outCell.text) : "0.00";
  const balance = normalizeAmount(balanceCell.text).value;

  return {
    page: line.page,
    date: parseKcbDate(dateCell.text) ?? "",
    valueDate: valueCell ? parseKcbDate(valueCell.text) : null,
    details,
    paidIn,
    withdrawn,
    balance,
  };
}

function parseHeader(doc: ExtractedDocument): {
  metadata: StatementMetadata;
  totalIn: string | null;
  totalOut: string | null;
  closing: string | null;
} {
  const texts = doc.lines.map((line) => line.cells.map((cell) => cell.text).join(" ").replace(/\s+/g, " ").trim());
  const metadata: StatementMetadata = { bankName: "KCB" };

  for (const text of texts) {
    const account = /^Account:\s*(\d+)\s*(.*)$/i.exec(text);
    if (account) {
      metadata.accountNumber = account[1];
      if (account[2]) metadata.accountName = account[2].trim();
      metadata.customerName = metadata.accountName;
    }
    const product = /^Product Name:\s*(.+)$/i.exec(text);
    if (product) metadata.productName = product[1].trim();

    const period = /^Statement Period:\s*(\d{2} [A-Z]{3} \d{4})\s*-\s*(?:(\d{2} [A-Z]{3} \d{4}))?/i.exec(text);
    if (period) {
      const start = parseKcbDate(period[1], true);
      const end = period[2] ? parseKcbDate(period[2], true) : null;
      if (start) metadata.periodStart = start;
      if (end) metadata.periodEnd = end;
    }

    const startBalance = /Balance at Period Start\s+(-?[\d,]+\.\d{2})/i.exec(text);
    if (startBalance) metadata.openingBalance = normalizeAmount(startBalance[1]).value;
    const endBalance = /Balance at Period End:?\s*(-?[\d,]+\.\d{2})/i.exec(text);
    if (endBalance) metadata.closingBalance = normalizeAmount(endBalance[1]).value;
  }

  let totalIn: string | null = null;
  let totalOut: string | null = null;
  let closing: string | null = null;
  for (const text of texts) {
    const totals = /BALANCE AT PERIOD E(?:ND)?\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})/i.exec(text);
    if (totals) {
      totalOut = absoluteAmount(normalizeAmount(totals[1]).value);
      totalIn = absoluteAmount(normalizeAmount(totals[2]).value);
      closing = normalizeAmount(totals[3]).value;
      break;
    }
  }

  return { metadata, totalIn, totalOut, closing };
}

export function detectKcbBankStatement(doc: ExtractedDocument): number {
  const layout = findLayout(doc);
  if (!layout) return 0;
  const text = doc.lines.map((line) => line.cells.map((cell) => cell.text).join(" ")).join("\n");
  let score = 0.95;
  if (/BALANCE B\/FWD/i.test(text)) score += 0.03;
  if (/KCB|KENYA COMMERCIAL BANK/i.test(text)) score += 0.02;
  return Math.min(1, score);
}

export function parseKcbBankStatement(doc: ExtractedDocument): ParsedStatement {
  const layout = findLayout(doc);
  if (!layout) {
    throw new UnsupportedStatementError(
      "This does not look like a KCB account statement. The expected columns are TXN DATE, DESCRIPTION, VALUE DATE, MONEY OUT, MONEY IN and LEDGER BALANCE.",
    );
  }

  const header = parseHeader(doc);
  const metadata = header.metadata;
  const raw: KcbRawRow[] = [];
  let current: KcbRawRow | null = null;

  for (const line of doc.lines) {
    const primary = readPrimary(line, layout);
    if (primary) {
      if (current) raw.push(current);
      current = { ...primary, rawLines: [line.cells.map((cell) => cell.text).join(" ").trim()] };
      continue;
    }
    if (!current) continue;
    const continuation = line.cells
      .filter((cell) => cell.x >= layout.descX - 250 && cell.x < layout.valueX - 250 && !DATE_TOKEN.test(cell.text))
      .map((cell) => cell.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (continuation) {
      current.details = `${current.details} ${continuation}`.replace(/\s+/g, " ").trim();
      current.rawLines.push(continuation);
    }
  }
  if (current) raw.push(current);

  const rows: ParsedStatementRow[] = [];
  const occurrences = new Map<string, number>();

  for (const item of raw) {
    if (/^balance b\/fwd/i.test(item.details)) {
      if (!metadata.openingBalance) metadata.openingBalance = item.balance;
      continue;
    }
    if (!item.date) continue;
    if (item.paidIn === "0.00" && item.withdrawn === "0.00") continue;

    const direction: StatementDirection = item.withdrawn !== "0.00" ? "out" : "in";
    const amount = direction === "in" ? item.paidIn : item.withdrawn;
    const classified = classify(item.details, direction);
    const accountKey = (metadata.accountNumber ?? "BANK").replace(/[^A-Za-z0-9]/g, "");
    const base = `KCB-${accountKey}-${item.date.replace(/-/g, "")}-${stableHash(
      `${item.date}|${item.valueDate ?? ""}|${item.details}|${item.paidIn}|${item.withdrawn}|${item.balance}`,
    )}`;
    const occurrence = (occurrences.get(base) ?? 0) + 1;
    occurrences.set(base, occurrence);
    const externalId = occurrence === 1 ? base : `${base}-${occurrence}`;

    const rowWarnings: string[] = [];
    if (item.paidIn !== "0.00" && item.withdrawn !== "0.00") {
      rowWarnings.push("Both money in and money out are non-zero; kept both columns.");
    }

    rows.push({
      rowIndex: rows.length,
      page: item.page,
      externalId,
      groupId: externalId,
      groupRole: "primary",
      receiptNo: externalId,
      date: item.date,
      time: null,
      details: item.details,
      status: "completed",
      paidIn: item.paidIn,
      withdrawn: item.withdrawn,
      balance: item.balance,
      direction,
      amount,
      currency: "KES",
      rail: classified.rail,
      txnType: classified.txnType,
      counterpartyName: counterpartyOf(item.details),
      counterpartyId: null,
      accountReference: /\bAC-?([A-Z0-9-]+)/i.exec(item.details)?.[1] ?? null,
      transactionType: null,
      otherParty: null,
      categoryKey: classified.categoryKey,
      categoryConfidence: classified.categoryConfidence,
      fulizaFunded: false,
      linkedTxnExternalId: null,
      fulizaOf: null,
      rawLines: item.rawLines,
      warnings: rowWarnings,
    });
  }

  if (rows.length === 0) {
    throw new UnsupportedStatementError("No transactions were found in this KCB statement.");
  }

  rows.sort((a, b) => a.date.localeCompare(b.date) || a.rowIndex - b.rowIndex);
  rows.forEach((row, index) => {
    row.rowIndex = index;
  });

  const totalIn = sumAmounts(rows.map((row) => row.paidIn));
  const totalOut = sumAmounts(rows.map((row) => row.withdrawn));
  const totalFees = sumAmounts(rows.filter((row) => row.rail === "charge").map((row) => row.withdrawn));
  const closing = metadata.closingBalance ?? header.closing ?? rows[rows.length - 1].balance;
  const opening = metadata.openingBalance ?? rows[0].balance;

  if (!metadata.periodStart) metadata.periodStart = rows[0].date;
  if (!metadata.periodEnd) metadata.periodEnd = rows[rows.length - 1].date;

  const warnings: string[] = [];
  if (header.totalIn && compareAmounts(totalIn, header.totalIn) !== 0) {
    warnings.push(`Parsed money in (${totalIn}) does not match the statement footer (${header.totalIn}).`);
  }
  if (header.totalOut && compareAmounts(totalOut, header.totalOut) !== 0) {
    warnings.push(`Parsed money out (${totalOut}) does not match the statement footer (${header.totalOut}).`);
  }

  return {
    provider: "bank",
    kind: "bank_account",
    parserId: KCB_PARSER_ID,
    parserVersion: KCB_PARSER_VERSION,
    currency: "KES",
    metadata: { ...metadata, openingBalance: opening, closingBalance: closing },
    rows,
    order: "asc",
    totals: { rowCount: rows.length, totalIn, totalOut, totalFees },
    statementSummary: header.totalIn && header.totalOut
      ? {
          rails: [
            { label: "MONEY OUT", paidIn: "0.00", paidOut: header.totalOut },
            { label: "MONEY IN", paidIn: header.totalIn, paidOut: "0.00" },
          ],
          totalIn: header.totalIn,
          totalOut: header.totalOut,
        }
      : undefined,
    warnings,
  };
}
