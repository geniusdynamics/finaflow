// ABOUTME: Tests the report-sheet matrix used by the Excel and CSV bundle exports.
// ABOUTME: Ensures every analysis section is present and grouped sheets are produced.

import { describe, expect, it } from "vitest";
import { parseKcbBankStatement } from "../parsers/kcb";
import { consolidateStatements } from "../consolidate";
import { buildAnalysisSheets } from "../analysis-sheets";
import { syntheticKcbFebruaryStatement, syntheticKcbStatement } from "../__fixtures__/kcb";

describe("analysis export sheets", () => {
  const consolidated = consolidateStatements([
    { fileName: "january.pdf", parsed: parseKcbBankStatement(syntheticKcbStatement()) },
    { fileName: "february.pdf", parsed: parseKcbBankStatement(syntheticKcbFebruaryStatement()) },
  ]);
  const sheets = buildAnalysisSheets(consolidated);
  const byName = new Map(sheets.map((sheet) => [sheet.name, sheet]));

  it("creates a sheet for every report section", () => {
    expect([...byName.keys()]).toEqual(expect.arrayContaining([
      "Summary",
      "Coverage",
      "Monthly",
      "Money In - Exact",
      "Money In - Grouped",
      "Money Out - Exact",
      "Money Out - Grouped",
      "Channels",
      "Categories",
      "Fees",
      "Review",
    ]));
    expect(byName.get("Coverage")?.rows).toHaveLength(2);
    expect(byName.get("Monthly")?.rows).toHaveLength(2);
  });

  it("writes numeric amounts for spreadsheet analysis", () => {
    const summary = byName.get("Summary")!;
    expect(summary.rows.find((row) => row[0] === "Total money in")?.[1]).toBe(30000);
    expect(summary.rows.find((row) => row[0] === "Total money out")?.[1]).toBe(6057.5);
    const monthly = byName.get("Monthly")!;
    expect(monthly.columns).toEqual(["Month", "Transactions", "In", "Out", "Net"]);
    expect(monthly.rows[0]).toEqual(["Jan 2026", 3, 10000, 5057.5, 4942.5]);
  });

  it("includes both exact and grouped contact sheets", () => {
    expect(byName.get("Money In - Exact")?.columns).toEqual(["Party", "Transactions", "Total", "Average"]);
    expect(byName.get("Money In - Grouped")?.columns).toEqual(["Party", "Variants", "Transactions", "Total", "Average"]);
    expect(byName.get("Money Out - Grouped")?.rows.length).toBeGreaterThan(0);
  });
});
