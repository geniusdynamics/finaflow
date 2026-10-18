// ABOUTME: Text-line helpers for statement reconstruction: tokenisation plus page header/footer filtering.
// ABOUTME: Boilerplate is detected by content because real footers sit above a safe vertical cutoff.

import type { StatementToken, TextLine } from "../types";

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function lineText(line: TextLine): string {
  return normalizeWhitespace(line.cells.map((c) => c.text).join(" "));
}

/** Flattens a line into whitespace tokens, preserving left-to-right order. */
export function tokensOf(line: TextLine): StatementToken[] {
  const tokens: StatementToken[] = [];
  const cells = [...line.cells].sort((a, b) => a.x - b.x);
  for (const cell of cells) {
    for (const part of cell.text.trim().split(/\s+/)) {
      if (part) tokens.push({ text: part, x: cell.x });
    }
  }
  return tokens;
}

const FOOTER_PATTERNS: RegExp[] = [
  /^Page \d+ of \d+$/i,
  /^Disclaimer:/i,
  /^guidance\.?$/i,
  /^Statement Verification Code$/i,
  /^To verify the validity/i,
  /^For self-help dial/i,
  /^This is a system generated/i,
  /^M-PESA STATEMENT$/i,
];

const HEADER_PATTERNS: RegExp[] = [
  /Receipt\s+No\.?\s+Completion\s+Time\s+Details/i,
  /Receipt\s+No\.?.*Paid\s+In.*Withdrawn.*Balance/i,
];

/** True for page boilerplate that must never become transaction text. */
export function isFooterLine(text: string): boolean {
  const t = normalizeWhitespace(text);
  if (!t) return true;
  return FOOTER_PATTERNS.some((re) => re.test(t));
}

/** True for the table header (page 1, and any repeated header in other templates). */
export function isHeaderLine(text: string): boolean {
  const t = normalizeWhitespace(text);
  return HEADER_PATTERNS.some((re) => re.test(t));
}

/** True for the marker that precedes the ledger on page 1. */
export function isLedgerStart(text: string): boolean {
  return /DETAILED\s+STATEMENT/i.test(text);
}

/** True for a line that only carries a page verification code (e.g. 3TUHA6HH). */
export function isVerificationCode(text: string): boolean {
  return /^[A-Z0-9]{8}$/.test(normalizeWhitespace(text));
}
