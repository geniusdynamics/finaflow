// ABOUTME: Verifies the cashflow-trend chart helper produces a Recharts-ready dense series.
// ABOUTME: Guards the empty-state path and the y-axis ceiling helper.
import { describe, expect, it } from "vitest";

import {
  buildCashflowTrendSeries,
  cashflowTrendIsEmpty,
  computeCashflowYAxisMax,
} from "../cashflow-trend-data";

describe("buildCashflowTrendSeries", () => {
  it("returns an empty array for undefined or empty input", () => {
    expect(buildCashflowTrendSeries(undefined)).toEqual([]);
    expect(buildCashflowTrendSeries(null)).toEqual([]);
    expect(buildCashflowTrendSeries([])).toEqual([]);
  });

  it("maps each day to label + numbers", () => {
    const result = buildCashflowTrendSeries([
      { date: "2026-01-01", sales: "1000.00", expenses: "250.00", net: "750.00" },
      { date: "2026-01-02", sales: "0", expenses: "0", net: "0" },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      date: "2026-01-01",
      label: "1 Jan",
      sales: 1000,
      expenses: 250,
      net: 750,
    });
  });

  it("falls back to zero for non-numeric strings", () => {
    const result = buildCashflowTrendSeries([
      { date: "2026-01-01", sales: "nope", expenses: "5.0", net: "0" },
    ]);
    expect(result[0].sales).toBe(0);
    expect(result[0].expenses).toBe(5);
  });
});

describe("cashflowTrendIsEmpty", () => {
  it("returns true for empty input", () => {
    expect(cashflowTrendIsEmpty([])).toBe(true);
  });

  it("returns true when all days have zero sales and expenses", () => {
    const points = buildCashflowTrendSeries([
      { date: "2026-01-01", sales: "0", expenses: "0", net: "0" },
      { date: "2026-01-02", sales: "0", expenses: "0", net: "0" },
    ]);
    expect(cashflowTrendIsEmpty(points)).toBe(true);
  });

  it("returns false when at least one day has activity", () => {
    const points = buildCashflowTrendSeries([
      { date: "2026-01-01", sales: "0", expenses: "0", net: "0" },
      { date: "2026-01-02", sales: "100", expenses: "0", net: "100" },
    ]);
    expect(cashflowTrendIsEmpty(points)).toBe(false);
  });
});

describe("computeCashflowYAxisMax", () => {
  it("returns a positive default for empty input", () => {
    expect(computeCashflowYAxisMax([])).toBeGreaterThan(0);
  });

  it("rounds up to the nearest 1000 of the largest value", () => {
    const points = buildCashflowTrendSeries([
      { date: "2026-01-01", sales: "1234.56", expenses: "200", net: "1034.56" },
    ]);
    expect(computeCashflowYAxisMax(points)).toBe(2000);
  });

  it("handles negative net values via absolute value", () => {
    const points = buildCashflowTrendSeries([
      { date: "2026-01-01", sales: "500", expenses: "1500", net: "-1000" },
    ]);
    expect(computeCashflowYAxisMax(points)).toBe(2000);
  });
});
