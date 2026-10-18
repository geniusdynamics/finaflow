// ABOUTME: RFC-4180 CSV/TSV reader plus a synthetic positioned-text document for the statement parser.
// ABOUTME: Lets M-PESA CSV exports and future table statements reuse the same structural row parser as PDFs.

import type { ExtractedDocument, TextLine } from "../types";

/** Parses delimited text into rows, handling quoted commas, quotes and newlines. */
export function parseDelimitedRows(text: string, delimiter?: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  const sep = delimiter ?? detectDelimiter(input);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === sep) {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((value) => value.trim().length > 0)) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((value) => value.trim().length > 0)) rows.push(row);
  return rows;
}

export function detectDelimiter(text: string): string {
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const counts: Array<[string, number]> = [
    [",", (firstLine.match(/,/g) ?? []).length],
    [";", (firstLine.match(/;/g) ?? []).length],
    ["\t", (firstLine.match(/\t/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

/**
 * Builds a positioned document from a CSV table: a marker, the header, then one line per row.
 * Each cell is placed at its own x so the shared token parser sees the same shape as a PDF row.
 */
export function buildDelimitedDocument(text: string, options: { title?: string } = {}): ExtractedDocument {
  const rows = parseDelimitedRows(text).filter((row) => row.some((cell) => cell.trim().length > 0));
  if (rows.length === 0) {
    return { pages: 1, lines: [], charCount: 0 };
  }

  const [header, ...data] = rows;
  const lines: TextLine[] = [];
  let charCount = 0;
  let y = 1000 + rows.length;

  const pushLine = (cells: string[]) => {
    const line: TextLine = {
      page: 1,
      y,
      cells: cells.map((cell, index) => ({
        text: cell,
        x: index * 1000,
        width: Math.max(10, cell.length * 5),
      })),
    };
    lines.push(line);
    y -= 1;
    charCount += cells.reduce((sum, cell) => sum + cell.length, 0);
  };

  pushLine([options.title ?? "M-PESA STATEMENT"]);
  pushLine(header);
  pushLine(["DETAILED STATEMENT"]);
  for (const row of data) pushLine(row);

  return { pages: 1, lines, charCount };
}
