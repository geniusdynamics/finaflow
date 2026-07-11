// ABOUTME: Source-level regression test for the dashboard coherence refactor.
// ABOUTME: Ensures the new feature sub-components are wired into the page and the in-page KpiCard helper is gone.

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const DASHBOARD_PATH = join(process.cwd(), "src", "pages", "Dashboard.tsx");
const SOURCE = readFileSync(DASHBOARD_PATH, "utf8");

describe("Dashboard coherence", () => {
  it("imports the new dashboard feature components from the feature folder", () => {
    expect(SOURCE).toMatch(/from\s+["']@\/features\/dashboard["']/);
  });

  it("imports each of the new cards", () => {
    for (const name of [
      "CashPositionCard",
      "CashflowTrendCard",
      "MobileWalletSummaryCard",
      "TrendKpiCard",
      "BillsPipelineCard",
      "TodayStrip",
    ]) {
      const escaped = name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`);
      expect(SOURCE, `expected Dashboard.tsx to reference ${name}`).toMatch(re);
    }
  });

  it("renders the cashflowTrend query", () => {
    expect(SOURCE).toMatch(/trpc\.dashboard\.cashflowTrend\.useQuery/);
  });

  it("uses the wallet summary from the dashboard summary response", () => {
    expect(SOURCE).toMatch(/summary\?\.wallet/);
  });

  it("renders the Cash Position card", () => {
    expect(SOURCE).toMatch(/<CashPositionCard[^>]*\/>/);
  });

  it("renders the Cashflow Trend card", () => {
    expect(SOURCE).toMatch(/<CashflowTrendCard[^>]*\/>/);
  });

  it("renders the Mobile Wallet Summary card", () => {
    expect(SOURCE).toMatch(/<MobileWalletSummaryCard[^>]*\/>/);
  });

  it("renders the Bills Pipeline card", () => {
    expect(SOURCE).toMatch(/<BillsPipelineCard[^>]*\/>/);
  });

  it("renders the Today Strip", () => {
    expect(SOURCE).toMatch(/<TodayStrip[^>]*\/>/);
  });

  it("replaces the in-page KpiCard with TrendKpiCard", () => {
    expect(SOURCE).toMatch(/<TrendKpiCard\b/);
    expect(SOURCE).not.toMatch(/function\s+KpiCard/);
  });

  it("removes the duplicate Unpaid Sales KPI", () => {
    // The old KPI row had an "Unpaid Sales" card; ensure the new layout doesn't reference it.
    expect(SOURCE).not.toMatch(/Unpaid\s+Sales/);
  });
});
