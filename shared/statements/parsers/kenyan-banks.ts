// ABOUTME: Positioned-text parsers for Co-operative Bank and Family Bank account statements.
// ABOUTME: Keeps printed identifiers and descriptions intact while normalising transactions for analysis.
import type { ExtractedDocument, ParsedStatement, ParsedStatementRow, TextLine } from "../types";
import Decimal from "decimal.js";
import { normalizeAmount, sumAmounts, compareAmounts } from "../normalize/amount";
import { UnsupportedStatementError } from "../errors";
import { parseKcbDate } from "./kcb";

type Bank = "coop" | "family";
const id = (bank: Bank) => `${bank}-bank-statement`;
const lineText = (line: TextLine) => line.cells.map(c => c.text).join(" ").replace(/\s+/g, " ").trim();
const money = (value: string) => normalizeAmount(value.replace(/^\+\s*/, "")).value;
const isMoney = (value: string) => /^[+-]?\s*[\d,]+\.\d{2}$/.test(value.trim());
const date = (value: string): string | null => {
  const numeric = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (numeric) {
    const iso = `${numeric[3]}-${numeric[2]}-${numeric[1]}`;
    const parsed = new Date(`${iso}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
  }
  const named = /^(\d{2})-([a-z]{3})-(\d{2}|\d{4})$/i.exec(value);
  return named ? parseKcbDate(`${named[1]} ${named[2]} ${named[3].length === 2 ? `20${named[3]}` : named[3]}`, false) : null;
};

function layout(doc: ExtractedDocument, bank: Bank) {
  for (const line of doc.lines) {
    const cells = line.cells;
    const find = (label: RegExp) => cells.find(c => label.test(c.text.trim()))?.x;
    const description = find(bank === "coop" ? /^transaction details$/i : /^description$/i);
    const credit = find(bank === "coop" ? /^money in$/i : /^credit$/i);
    const debit = find(bank === "coop" ? /^money out$/i : /^debit$/i);
    const balance = find(bank === "coop" ? /^balance$/i : /^running bal/i);
    const reference = bank === "coop" ? find(/^ref number$/i) : undefined;
    if (description !== undefined && credit !== undefined && debit !== undefined && balance !== undefined && (bank !== "coop" || reference !== undefined))
      return { description, credit, debit, balance, reference };
  }
  return null;
}

export function detectKenyanBank(doc: ExtractedDocument, bank: Bank): number {
  if (!layout(doc, bank)) return 0;
  const text = doc.lines.map(lineText).join("\n");
  return (bank === "coop" ? /co-operative bank|co-op bank|KCOOKENA/i : /family bank|familybank\.co\.ke/i).test(text) ? 0.99 : 0;
}

function hash(value: string) {
  let h = 2166136261;
  for (const ch of value) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36).toUpperCase();
}

export function parseKenyanBank(doc: ExtractedDocument, bank: Bank): ParsedStatement {
  const columns = layout(doc, bank);
  if (!columns) throw new UnsupportedStatementError("The expected bank statement columns were not found.");
  const texts = doc.lines.map(lineText);
  const text = texts.join("\n");
  const metadata: ParsedStatement["metadata"] = { bankName: bank === "coop" ? "Co-operative Bank" : "Family Bank" };
  const opening = /Opening Balance\s*:?\s*(?:KES\s*)?([\d,]+\.\d{2})/i.exec(text);
  const closing = /Closing Balance\s*:?\s*(?:KES\s*)?([\d,]+\.\d{2})/i.exec(text);
  if (opening) metadata.openingBalance = money(opening[1]);
  if (closing) metadata.closingBalance = money(closing[1]);
  const account = bank === "family" ? /Account Number\s*\n\s*(\d+)/i.exec(text) : /\bAccount\s+(\d{8,})/i.exec(text);
  if (account) metadata.accountNumber = account[1];
  if (bank === "family") {
    const nameIndex = doc.lines.findIndex(line => line.cells.some(c => /^Account Name$/i.test(c.text.trim())));
    const name = nameIndex >= 0 ? doc.lines[nameIndex + 1]?.cells.find(c => c.x < 100)?.text.trim() : null;
    if (name) metadata.accountName = metadata.customerName = name;
  }
  const dates = bank === "family" ? /From Date\s+(\S+)[\s\S]*?To date\s+(\S+)/i.exec(text) : /\bfrom\s+(\S+)\s+to\s+(\S+)/i.exec(text);
  if (dates) { metadata.periodStart = date(dates[1]) ?? undefined; metadata.periodEnd = date(dates[2]) ?? undefined; }

  const primary = doc.lines.flatMap(line => {
    const dateCell = line.cells.find(c => c.x < columns.description - 10 && date(c.text.trim()));
    if (!dateCell) return [];
    const amounts = line.cells.filter(c => c.x > columns.credit - 35 && isMoney(c.text)).sort((a, b) => a.x - b.x);
    if (amounts.length < 2) return [];
    const balanceCell = amounts[amounts.length - 1];
    const movements = amounts.slice(0, -1);
    const split = (columns.credit + columns.debit) / 2 - 10;
    const paidIn = movements.filter(c => c.x < split).map(c => money(c.text))[0] ?? "0.00";
    const withdrawn = movements.filter(c => c.x >= split).map(c => money(c.text))[0] ?? "0.00";
    return [{ line, date: date(dateCell.text.trim())!, paidIn, withdrawn, balance: money(balanceCell.text) }];
  });
  const occurrences = new Map<string, number>();
  const rows: ParsedStatementRow[] = primary.map((item, index): ParsedStatementRow => {
    const prev = primary[index - 1];
    const next = primary[index + 1];
    const descMin = bank === "coop" ? columns.description - 65 : columns.description - 5;
    const descMax = bank === "coop" ? columns.reference! - 5 : columns.credit - 35;
    const fragments = doc.lines.filter(line => {
      if (line.page !== item.line.page) return false;
      if (bank === "coop") return line.y <= (prev?.line.page === line.page ? (prev.line.y + item.line.y) / 2 : item.line.y + 20) && line.y > (next?.line.page === line.page ? (next.line.y + item.line.y) / 2 : item.line.y - 20);
      return line.y <= item.line.y && line.y > (next?.line.page === line.page ? next.line.y : item.line.y - 30);
    }).flatMap(line => line.cells.filter(c => c.x >= descMin && c.x < descMax).map(c => c.text.trim())).filter(Boolean);
    const details = fragments.join(" ").trim();
    let counterpartyName: string | null = null, counterpartyId: string | null = null, transactionCode: string | null = null, accountReference: string | null = null;
    if (bank === "coop") {
      const parts = details.replace(/~\s+/g, "~").split("~");
      if (parts.length >= 5) { transactionCode = parts[0]; accountReference = parts[1]; counterpartyId = parts[2] || null; counterpartyName = parts.slice(4).join("~").replace(/\s+/g, " ").trim() || null; }
    } else {
      transactionCode = /\bCredit\s+([A-Z0-9]+)-/i.exec(details)?.[1] ?? null;
      const party = /\bFrom\s+((?:[a-f0-9]+\s*){1,4})(.*?)(?:\s+Alias Code\b|$)/i.exec(details);
      if (party) { const candidate = party[1].replace(/\s/g, ""); if (candidate.length >= 32) { counterpartyId = candidate; counterpartyName = party[2].trim() || null; } }
    }
    const direction = item.withdrawn !== "0.00" ? "out" : "in";
    const charge = /\b(?:charge|commission|fee|excise|levy)\b/i.test(details) && direction === "out";
    const base = `${bank.toUpperCase()}-${hash(`${metadata.accountNumber ?? ""}|${item.date}|${details}|${item.paidIn}|${item.withdrawn}|${item.balance}`)}`;
    const occurrence = (occurrences.get(base) ?? 0) + 1; occurrences.set(base, occurrence);
    const externalId = occurrence === 1 ? base : `${base}-${occurrence}`;
    return { rowIndex: index, page: item.line.page, externalId, groupId: externalId, groupRole: "primary", receiptNo: externalId, date: item.date, time: null, details, status: "completed", paidIn: item.paidIn, withdrawn: item.withdrawn, balance: item.balance, direction, amount: direction === "in" ? item.paidIn : item.withdrawn, currency: "KES", rail: charge ? "charge" : "bank_transfer", txnType: charge ? "charge" : "bank_transfer", counterpartyName, counterpartyId, accountReference, transactionType: /paybill|mpesac2b/i.test(details) ? "M-PESA Paybill" : "Bank", channel: /paybill|mpesac2b/i.test(details) ? "M-PESA Paybill" : "Bank", transactionCode, categoryKey: charge ? "fees" : null, categoryConfidence: charge ? 0.95 : 0, fulizaFunded: false, linkedTxnExternalId: null, fulizaOf: null, rawLines: fragments, warnings: item.paidIn !== "0.00" && item.withdrawn !== "0.00" ? ["Both credit and debit are non-zero; kept both columns."] : [] };
  }).filter(row => row.paidIn !== "0.00" || row.withdrawn !== "0.00");
  if (!rows.length) throw new UnsupportedStatementError("No transactions were found in this bank statement.");
  rows.forEach((row, index) => { row.rowIndex = index; });
  const totalIn = sumAmounts(rows.map(r => r.paidIn)), totalOut = sumAmounts(rows.map(r => r.withdrawn));
  const printedIn = /Total Credits\s*:?\s*(?:KES\s*)?([\d,]+\.\d{2})/i.exec(text);
  const printedOut = /Total Debits\s*:?\s*(?:KES\s*)?([\d,]+\.\d{2})/i.exec(text);
  const warnings: string[] = [];
  if (printedIn && compareAmounts(totalIn, money(printedIn[1])) !== 0) warnings.push(`Parsed money in (${totalIn}) does not match the statement total (${money(printedIn[1])}).`);
  if (printedOut && compareAmounts(totalOut, money(printedOut[1])) !== 0) warnings.push(`Parsed money out (${totalOut}) does not match the statement total (${money(printedOut[1])}).`);
  if (metadata.openingBalance && metadata.closingBalance && !new Decimal(metadata.openingBalance).plus(totalIn).minus(totalOut).equals(metadata.closingBalance)) {
    warnings.push("The printed opening and closing balances do not reconcile with the parsed transactions. Check the statement period and balances.");
  }
  return { provider: "bank", kind: "bank_account", parserId: id(bank), parserVersion: "1.0.0", currency: "KES", metadata, rows, order: bank === "coop" ? "desc" : "asc", totals: { rowCount: rows.length, totalIn, totalOut, totalFees: sumAmounts(rows.filter(r => r.rail === "charge").map(r => r.withdrawn)) }, statementSummary: printedIn && printedOut ? { rails: [], totalIn: money(printedIn[1]), totalOut: money(printedOut[1]) } : undefined, warnings };
}
