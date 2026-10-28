// ABOUTME: Tests for cross-file bank statement consolidation, deduplication and complete contact lists.
// ABOUTME: Pins monthly aggregation across different periods and per-file coverage summaries.

import { describe, expect, it } from "vitest";
import { parseKcbBankStatement } from "../parsers/kcb";
import { parseMpesaStatement } from "../parsers/mpesa";
import { buildStatementAnalysis } from "../analyze";
import { consolidateStatements } from "../consolidate";
import { syntheticKcbFebruaryStatement, syntheticKcbStatement } from "../__fixtures__/kcb";
import { syntheticMpesaDocument } from "../__fixtures__/synthetic";

const january = parseKcbBankStatement(syntheticKcbStatement());
const february = parseKcbBankStatement(syntheticKcbFebruaryStatement());

describe("consolidated bank statement analysis", () => {
  it("combines different months into one analysis while keeping per-file coverage", () => {
    const consolidated = consolidateStatements([
      { fileName: "january.pdf", parsed: january },
      { fileName: "february.pdf", parsed: february },
    ]);

    expect(consolidated.fileCount).toBe(2);
    expect(consolidated.totalRowCount).toBe(5);
    expect(consolidated.duplicateRows).toBe(0);
    expect(consolidated.periodStart).toBe("2026-01-01");
    expect(consolidated.periodEnd).toBe("2026-02-28");
    expect(consolidated.analysis.summary).toMatchObject({
      rowCount: 5,
      totalIn: "30000.00",
      totalOut: "6057.50",
      totalFees: "57.50",
      net: "23942.50",
    });
    expect(consolidated.analysis.breakdown.monthly.map((row) => row.label)).toEqual(["Jan 2026", "Feb 2026"]);
    expect(consolidated.analysis.breakdown.monthly.map((row) => row.totalIn)).toEqual(["10000.00", "20000.00"]);
    expect(consolidated.analysis.breakdown.monthly.map((row) => row.totalOut)).toEqual(["5057.50", "1000.00"]);

    expect(consolidated.files).toHaveLength(2);
    expect(consolidated.files[0].fileName).toBe("january.pdf");
    expect(consolidated.files[0].net).toBe("4942.50");
    expect(consolidated.files[1].fileName).toBe("february.pdf");
    expect(consolidated.files[1].net).toBe("19000.00");
    expect(consolidated.files.every((file) => file.reconciliation.matches)).toBe(true);
  });

  it("deduplicates repeated statements instead of double-counting", () => {
    const consolidated = consolidateStatements([
      { fileName: "january.pdf", parsed: january },
      { fileName: "january-copy.pdf", parsed: january },
    ]);

    expect(consolidated.fileCount).toBe(2);
    expect(consolidated.totalRowCount).toBe(6);
    expect(consolidated.duplicateRows).toBe(3);
    expect(consolidated.analysis.summary.rowCount).toBe(3);
    expect(consolidated.analysis.summary.totalIn).toBe("10000.00");
    expect(consolidated.analysis.summary.totalOut).toBe("5057.50");
  });

  it("keeps every contact when there are more than the dashboard limit", () => {
    const base = parseKcbBankStatement(syntheticKcbStatement());
    const rows = Array.from({ length: 25 }, (_, index) => ({
      ...base.rows[1],
      rowIndex: index,
      externalId: `MANY-${index}`,
      groupId: `MANY-${index}`,
      receiptNo: `MANY-${index}`,
      date: `2026-03-${String((index % 28) + 1).padStart(2, "0")}`,
      details: `Cash Deposit contact-${index}`,
      counterpartyName: `Contact ${index}`,
      direction: "in" as const,
      paidIn: "100.00",
      withdrawn: "0.00",
      amount: "100.00",
      balance: `${100000 + index * 100}.00`,
      categoryKey: null,
    }));
    const many = { ...base, rows, order: "asc" as const };

    expect(buildStatementAnalysis(many, { contactLimit: 1000 }).topContacts.received).toHaveLength(25);
    const consolidated = consolidateStatements([{ fileName: "many.pdf", parsed: many }]);
    expect(consolidated.analysis.topContacts.received).toHaveLength(25);
    expect(consolidated.analysis.moneyIn.bySource).toHaveLength(25);
  });

  it("works for a single uploaded statement too", () => {
    const consolidated = consolidateStatements([{ fileName: "january.pdf", parsed: january }]);
    expect(consolidated.fileCount).toBe(1);
    expect(consolidated.analysis.summary.totalIn).toBe("10000.00");
    expect(consolidated.analysis.summary.totalOut).toBe("5057.50");
    expect(consolidated.analysis.breakdown.monthly).toHaveLength(1);
  });

  it("gives M-PESA statements the same consolidated report and identity", () => {
    const mpesa = parseMpesaStatement(syntheticMpesaDocument());
    const consolidated = consolidateStatements([
      { fileName: "mpesa.pdf", parsed: mpesa },
      { fileName: "mpesa-copy.pdf", parsed: mpesa },
    ]);

    expect(consolidated.fileCount).toBe(2);
    expect(consolidated.banks).toEqual(["M-PESA"]);
    expect(consolidated.duplicateRows).toBe(mpesa.rows.length);
    expect(consolidated.analysis.summary.rowCount).toBe(mpesa.rows.length);
    expect(consolidated.files[0]).toMatchObject({
      provider: "mpesa",
      accountNumber: mpesa.metadata.mobileNumber ?? null,
    });
    expect(consolidated.analysis.breakdown.monthly.length).toBeGreaterThan(0);
    expect(consolidated.analysis.moneyIn.byChannel?.length).toBeGreaterThan(0);
  });
});
