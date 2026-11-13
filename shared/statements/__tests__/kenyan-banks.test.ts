// ABOUTME: Synthetic coverage for Co-operative Bank and Family Bank statement layouts.
// ABOUTME: Exercises wrapped descriptions, multiple pages, debits and hash preservation.
import { describe, expect, it } from "vitest";
import type { ExtractedDocument, TextLine } from "../types";
import { parseStatement } from "../parsers/registry";
import { shortenStatementHashes } from "../display";

const line = (page: number, y: number, ...cells: [number, string][]): TextLine => ({ page, y, cells: cells.map(([x, text]) => ({ x, text })) });
const doc = (lines: TextLine[]): ExtractedDocument => ({ pages: 2, lines, charCount: 1000 });

describe("additional bank statements", () => {
  it("parses Co-op wrapped descriptions and both movement columns", () => {
    const parsed = parseStatement(doc([
      line(1, 800, [10, "Co-operative Bank"]),
      line(1, 780, [10, "from 01-Oct-26 to 02-Oct-26"]),
      line(1, 760, [10, "Opening Balance"], [300, "100.00"]),
      line(1, 740, [10, "Closing Balance"], [300, "130.00"]),
      line(1, 700, [20, "Date"], [65, "Value Date"], [168, "Transaction Details"], [308, "Ref Number"], [405, "Money In"], [469, "Money Out"], [548, "Balance"]),
      line(1, 680, [110, "CODE~123456~~MPESAC2B~TEST"]),
      line(1, 676, [20, "02-Oct-26"], [65, "02-Oct-26"], [306, "CODE"], [410, "+ 50.00"], [540, "150.00"]),
      line(1, 672, [110, "PERSON"]),
      line(1, 650, [110, "Transfer fee"]),
      line(1, 646, [20, "01-Oct-26"], [65, "01-Oct-26"], [470, "10.00"], [540, "100.00"]),
    ]));
    expect(parsed.parserId).toBe("coop-bank-statement");
    expect(parsed.order).toBe("desc");
    expect(parsed.totals).toMatchObject({ rowCount: 2, totalIn: "50.00", totalOut: "10.00", totalFees: "10.00" });
    expect(parsed.rows[0]).toMatchObject({ counterpartyName: "TEST PERSON", accountReference: "123456" });
    expect(parsed.warnings.join(" ")).toContain("do not reconcile");
  });

  it("reassembles Family hashes and retains full values while shortening the display", () => {
    const hash = "a123456789abcdef".repeat(4);
    const parsed = parseStatement(doc([
      line(1, 800, [10, "Family Bank"]),
      line(1, 750, [10, "Account Name"]), line(1, 740, [10, "TEST CUSTOMER"]),
      line(1, 700, [10, "Transaction Date"], [90, "Value date"], [150, "Description"], [425, "Credit"], [487, "Debit"], [531, "Running Bal"]),
      line(1, 680, [20, "01-10-2026"], [150, `Paybill Credit ABC123-12345678 From ${hash.slice(0, 5)}`], [415, "20.00"], [492, "0.00"], [525, "120.00"]),
      line(1, 668, [150, hash.slice(5, 50)]),
      line(1, 656, [150, `${hash.slice(50)} TEST PERSON Alias Code 123`]),
      line(2, 680, [20, "02-10-2026"], [150, "Bank charge"], [415, "0.00"], [492, "5.00"], [525, "115.00"]),
    ]));
    expect(parsed.parserId).toBe("family-bank-statement");
    expect(parsed.metadata.accountName).toBe("TEST CUSTOMER");
    expect(parsed.totals).toMatchObject({ rowCount: 2, totalIn: "20.00", totalOut: "5.00" });
    expect(parsed.rows[0]).toMatchObject({ counterpartyId: hash, counterpartyName: "TEST PERSON" });
    expect(shortenStatementHashes(parsed.rows[0].details)).toContain(`${hash.slice(0, 8)}…${hash.slice(-4)} TEST PERSON`);
    expect(shortenStatementHashes(hash)).not.toContain(hash);
  });
});
