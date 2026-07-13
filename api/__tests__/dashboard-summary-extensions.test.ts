// ABOUTME: Source-level regression test for the dashboard router extensions (cashflowTrend, previousPeriodTotals, cashPosition).
// ABOUTME: Guards the public surface of the router without spinning up the database.
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const ROUTER_PATH = resolve(import.meta.dirname, "../dashboard-router.ts");
const SOURCE = readFileSync(ROUTER_PATH, "utf8");

describe("dashboard-router extensions", () => {
  it("exposes a cashflowTrend query", () => {
    expect(SOURCE).toMatch(/cashflowTrend:\s*authedQuery/);
  });

  it("accepts dateFrom and dateTo in the cashflowTrend input", () => {
    // Slice from the cashflowTrend declaration to the end of the file and assert shape.
    const idx = SOURCE.indexOf("cashflowTrend: authedQuery");
    expect(idx, "expected to find cashflowTrend declaration").toBeGreaterThan(-1);
    const tail = SOURCE.slice(idx);
    expect(tail).toMatch(/\.input\(\s*z\.object\(\s*\{[^}]*dateFrom[^}]*dateTo/s);
  });

  it("returns a days array from the cashflowTrend query", () => {
    expect(SOURCE).toMatch(/return\s*\{\s*days:\s*Array\.from\(dayMap\.values\(\)\)\s*\}/);
  });

  it("groups daily sales by saleDate for the trend series", () => {
    expect(SOURCE).toMatch(/groupBy\(sql`\$\{dailySales\.saleDate\}`\)/);
  });

  it("groups expenses by expenseDate for the trend series", () => {
    expect(SOURCE).toMatch(/groupBy\(sql`\$\{expenses\.expenseDate\}`\)/);
  });

  it("includes previousPeriodTotals in the summary response", () => {
    expect(SOURCE).toContain("previousPeriodTotals");
  });

  it("computes the prior period as equal-length and immediately preceding the current range", () => {
    expect(SOURCE).toMatch(/priorFrom\s*=\s*new Date\(priorTo\.getTime\(\)\s*-\s*periodMs\)/);
    expect(SOURCE).toMatch(/priorTo\s*=\s*new Date\(fromDate\.getTime\(\)\s*-\s*86400000\)/);
  });

  it("includes a cashPosition breakdown in the summary response", () => {
    expect(SOURCE).toContain("cashPosition");
    // Each bucket key is bucketed in the source via .toFixed(2).
    for (const key of ["cash", "bank", "wallet", "other"]) {
      expect(SOURCE, `expected cashPosition.byType.${key} bucket`).toContain(
        `${key}: cashPosition.byType.${key}.toFixed(2)`,
      );
    }
  });

  it("returns an empty cashPosition when the user has no locations", () => {
    expect(SOURCE).toMatch(
      /cashPosition:\s*\{\s*total:\s*"0",\s*byType:\s*\{\s*cash:\s*"0",\s*bank:\s*"0",\s*wallet:\s*"0",\s*other:\s*"0"\s*\}\s*\}/,
    );
  });
});
