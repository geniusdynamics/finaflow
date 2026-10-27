// ABOUTME: Contract tests for the KCB bank parser and its order-aware analysis.
// ABOUTME: Covers negative money-out values, integer amounts, opening balance and reconciliation.

import { describe, expect, it } from "vitest";
import { parseKcbBankStatement, detectKcbBankStatement, parseKcbDate } from "../parsers/kcb";
import { parseStatement } from "../parsers/registry";
import { buildStatementAnalysis } from "../analyze";
import { syntheticKcbStatement } from "../__fixtures__/kcb";

describe("KCB bank statement parser", () => {
  const doc = syntheticKcbStatement();
  const parsed = parseKcbBankStatement(doc);

  it("detects the KCB positioned layout", () => {
    expect(detectKcbBankStatement(doc)).toBeGreaterThanOrEqual(0.95);
    expect(parseStatement(doc).parserId).toBe("kcb-bank-statement");
  });

  it("reads account metadata, period and printed balances", () => {
    expect(parsed.provider).toBe("bank");
    expect(parsed.kind).toBe("bank_account");
    expect(parsed.order).toBe("asc");
    expect(parsed.metadata).toMatchObject({
      bankName: "KCB",
      accountNumber: "1234567890",
      accountName: "TEST BUSINESS LTD",
      productName: "Entrepreneurs Account",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-04",
      openingBalance: "100000.00",
      closingBalance: "104942.50",
    });
  });

  it("normalises negative and whole-shilling amounts into positive row amounts", () => {
    expect(parsed.rows).toHaveLength(3);
    const charge = parsed.rows[0];
    expect(charge.direction).toBe("out");
    expect(charge.withdrawn).toBe("57.50");
    expect(charge.amount).toBe("57.50");
    expect(charge.rail).toBe("charge");
    expect(charge.categoryKey).toBe("fees");

    const deposit = parsed.rows[1];
    expect(deposit.direction).toBe("in");
    expect(deposit.paidIn).toBe("10000.00");
    expect(deposit.rail).toBe("cash_deposit");

    const transfer = parsed.rows[2];
    expect(transfer.direction).toBe("out");
    expect(transfer.withdrawn).toBe("5000.00");
    expect(transfer.details).toContain("LS TRADERS LIMITED");
    expect(transfer.rail).toBe("bank_transfer");
  });

  it("matches the printed totals and creates a reconciling summary", () => {
    expect(parsed.totals).toEqual({
      rowCount: 3,
      totalIn: "10000.00",
      totalOut: "5057.50",
      totalFees: "57.50",
    });
    expect(parsed.statementSummary?.totalIn).toBe("10000.00");
    expect(parsed.statementSummary?.totalOut).toBe("5057.50");
    expect(parsed.warnings.filter((warning) => /footer/i.test(warning))).toEqual([]);
  });

  it("analyses oldest-first rows without reversing the running balance", () => {
    const analysis = buildStatementAnalysis(parsed);
    expect(analysis.summary.totalIn).toBe("10000.00");
    expect(analysis.summary.totalOut).toBe("5057.50");
    expect(analysis.summary.net).toBe("4942.50");
    expect(analysis.balance.opening).toBe("100000.00");
    expect(analysis.balance.closing).toBe("104942.50");
    expect(analysis.balance.continuity).toMatchObject({ checked: 2, ok: 2, unexplained: 0 });
    expect(analysis.reconciliation).toMatchObject({ matches: true, diffIn: "0.00", diffOut: "0.00" });
    expect(analysis.moneyIn.byChannel).toEqual([
      { key: "cash_deposit", label: "Cash deposits", count: 1, total: "10000.00", share: 100 },
    ]);
  });

  it("parses impossible printed period days by clamping to the month end", () => {
    expect(parseKcbDate("31 FEB 2026")).toBe("2026-02-28");
    expect(parseKcbDate("31 APR 2026")).toBe("2026-04-30");
    expect(parseKcbDate("31 FEB 2026", false)).toBeNull();
  });
});
