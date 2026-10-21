// ABOUTME: Tests for the statement analysis blocks and CSV export against the synthetic M-PESA document.
// ABOUTME: Pins the numbers the UI and workbook rely on: totals, fees, operating flows and reconciliation.

import { describe, expect, it } from "vitest";
import { parseMpesaStatement } from "../parsers/mpesa";
import { syntheticMpesaDocument } from "../__fixtures__/synthetic";
import { buildStatementAnalysis, isStatementAnalysis } from "../analyze";
import { buildStatementCsv, statementCsvBytes, type ExportTransaction } from "../export/csv";
import { buildStatementJson } from "../export/json";

const parsed = parseMpesaStatement(syntheticMpesaDocument());

const analysis = buildStatementAnalysis(parsed, {
  categoryOf: (row) => {
    if (row.categoryKey === "fees") return { id: 1, name: "Bank Charges & Fees" };
    if (row.categoryKey === "loans_savings") return { id: 2, name: "Loans & Savings" };
    return { id: null, name: "No category" };
  },
  duplicateCount: 2,
});

function exportRows(): ExportTransaction[] {
  return parsed.rows.map((row) => ({
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
    categoryName:
      row.categoryKey === "fees" ? "Bank Charges & Fees" : row.categoryKey === "loans_savings" ? "Loans & Savings" : null,
  }));
}

describe("statement analysis", () => {
  it("keeps cash totals and separates fees and financing", () => {
    expect(analysis.summary.totalIn).toBe("1751.37");
    expect(analysis.summary.totalOut).toBe("657.00");
    expect(analysis.summary.totalFees).toBe("7.00");
    expect(analysis.summary.net).toBe("1094.37");

    expect(analysis.moneyIn.total).toBe("1500.00");
    expect(analysis.moneyOut.total).toBe("650.00");
    expect(analysis.financing.drawdowns).toBe("251.37");
    expect(analysis.financing.repayments).toBe("0.00");
  });

  it("classifies fees and categories", () => {
    expect(analysis.fees.count).toBe(1);
    expect(analysis.fees.total).toBe("7.00");
    expect(analysis.fees.byType[0]).toMatchObject({ type: "Send Money Fee", count: 1, total: "7.00" });

    const feesCategory = analysis.categories.find((row) => row.name === "Bank Charges & Fees");
    expect(feesCategory?.totalOut).toBe("7.00");
    expect(feesCategory?.count).toBe(1);
  });

  it("reconciles the statement summary and reports duplicates", () => {
    expect(analysis.reconciliation.matches).toBe(true);
    expect(analysis.reconciliation.diffIn).toBe("0.00");
    expect(analysis.reconciliation.diffOut).toBe("0.00");
    expect(analysis.reconciliation.duplicateCount).toBe(2);
    expect(isStatementAnalysis(analysis)).toBe(true);
    expect(isStatementAnalysis({ totals: {}, byRail: [] })).toBe(false);
  });

  it("builds the remaining sheet blocks without crashing", () => {
    expect(analysis.period.days).toBeGreaterThan(180);
    expect(analysis.balance.continuity.checked).toBe(4);
    expect(analysis.distribution.length).toBeGreaterThan(0);
    expect(analysis.breakdown.monthly.length).toBeGreaterThan(0);
    expect(analysis.breakdown.weekly.length).toBeGreaterThan(0);
    expect(analysis.dailyBalance.length).toBeGreaterThan(0);
    expect(analysis.timeOfDay.hours.length).toBeGreaterThan(0);
    expect(analysis.dayOfWeek.length).toBeGreaterThan(0);
    expect(analysis.anomalies.uncategorisedSpend.count).toBe(2);
    expect(analysis.anomalies.uncategorisedSpend.total).toBe("650.00");
    expect(analysis.payBillsTills.shortcodes.some((row) => row.number === "915251")).toBe(true);
    expect(analysis.reversals).toEqual([]);
    expect(analysis.recurring).toEqual([]);
  });
});

describe("CSV export", () => {
  it("writes a UTF-8 BOM, stable headers and CRLF rows", () => {
    const bytes = statementCsvBytes(exportRows(), { sortOrder: "asc" });
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const csv = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
    expect(csv.startsWith("\uFEFFReceipt No,Completion Time,Details,Transaction Status,Paid In,Withdrawn,Balance")).toBe(true);
    expect(csv).toContain("\r\n");
    expect(csv).toContain("UG12KA80PR");
    expect(csv).toContain("2026-07-01 20:52:29");
  });

  it("supports hiding charges, date formats and paybill columns", () => {
    const withoutCharges = buildStatementCsv(exportRows(), { excludeCharges: true, sortOrder: "asc" });
    expect(withoutCharges).not.toContain("Customer Transfer of Funds Charge");
    expect(withoutCharges).toContain("Customer Transfer to 254*****8959 - salim mwazumi");

    const formatted = buildStatementCsv(exportRows(), { sortOrder: "asc", dateFormat: "dd-mmm-yyyy" });
    expect(formatted).toContain("01 Jul 2026 20:52:29");

    const paybill = buildStatementCsv(exportRows(), { paybillColumns: true });
    expect(paybill.split("\r\n")[0]).toContain("Transaction Type,Other Party");
  });

  it("keeps amounts plain so spreadsheets parse them", () => {
    const csv = buildStatementCsv(exportRows(), { sortOrder: "asc" });
    expect(csv).toContain(",400.00,");
    expect(csv).not.toContain("KES 400");
  });
});

describe("JSON export", () => {
  it("has a stable meta/totals/transactions/analysis shape", () => {
    const json = JSON.parse(
      buildStatementJson({
        meta: {
          provider: "mpesa",
          kind: "mobile_money_personal",
          currency: "KES",
          fileName: "sample.pdf",
          periodStart: "2026-01-01",
          periodEnd: "2026-07-02",
          generatedAt: new Date().toISOString(),
        },
        totals: { rowCount: parsed.rows.length, totalIn: "1751.37", totalOut: "657.00", totalFees: "7.00" },
        transactions: exportRows(),
        analysis,
      }),
    ) as Record<string, unknown>;
    expect(json.meta).toBeDefined();
    expect(json.totals).toBeDefined();
    expect(Array.isArray(json.transactions)).toBe(true);
    expect(json.analysis).toBeDefined();
  });
});
