// ABOUTME: Tests for the delimited reader and the CSV → statement document adapter.
// ABOUTME: Proves an M-PESA CSV export re-parses into the same canonical rows as the PDF parser.

import { describe, expect, it } from "vitest";
import { buildDelimitedDocument, detectDelimiter, parseDelimitedRows } from "../table/delimited";
import { buildStatementCsv, type ExportTransaction } from "../export/csv";
import { parseMpesaStatement } from "../parsers/mpesa";
import { syntheticMpesaDocument } from "../__fixtures__/synthetic";

function exportRows(): ExportTransaction[] {
  return parseMpesaStatement(syntheticMpesaDocument()).rows.map((row) => ({
    receiptNo: row.groupId,
    date: row.date,
    time: row.time,
    details: row.details,
    status: row.status,
    paidIn: row.paidIn,
    withdrawn: row.withdrawn,
    balance: row.balance,
    direction: row.direction,
    txnType: row.txnType,
    rail: row.rail,
    groupId: row.groupId,
    counterpartyName: row.counterpartyName,
  }));
}

describe("delimited reader", () => {
  it("handles quoted commas, escaped quotes and newlines inside cells", () => {
    const rows = parseDelimitedRows('a,"b,c","d""e"\r\n"multi\nline",2,3\r\n');
    expect(rows).toEqual([
      ["a", "b,c", 'd"e'],
      ["multi\nline", "2", "3"],
    ]);
  });

  it("detects the delimiter", () => {
    expect(detectDelimiter("a,b,c")).toBe(",");
    expect(detectDelimiter("a;b;c")).toBe(";");
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
  });

  it("round-trips an exported M-PESA statement CSV", () => {
    const csv = buildStatementCsv(exportRows(), { sortOrder: "asc" });
    const parsed = parseMpesaStatement(buildDelimitedDocument(csv));
    expect(parsed.rows).toHaveLength(5);
    expect(parsed.totals).toMatchObject({
      rowCount: 5,
      totalIn: "1751.37",
      totalOut: "657.00",
      totalFees: "7.00",
    });
    expect(parsed.provider).toBe("mpesa");
    expect(parsed.warnings.filter((warning) => /No transactions/i.test(warning))).toEqual([]);
  });
});
