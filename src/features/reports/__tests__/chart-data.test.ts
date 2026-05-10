// ABOUTME: Verifies report chart data transforms and row selection state for the reports dashboard.
// ABOUTME: Keeps the chart logic testable without relying on DOM rendering or mocked financial data.
import { describe, expect, it } from "vitest";

import {
  buildBudgetActualChartData,
  buildInflowOutflowChartData,
  getVisibleBudgetRows,
} from "../chart-data";

describe("buildInflowOutflowChartData", () => {
  it("maps revenue, cogs, expenses, and payroll into inflow and outflow totals", () => {
    const result = buildInflowOutflowChartData({
      revenue: "125000.00",
      cogs: "18000.00",
      expenses: "22000.00",
      payroll: "15000.00",
    });

    expect(result.totalMovement).toBe("180000.00");
    expect(result.net).toBe("70000.00");
    expect(result.segments).toEqual([
      expect.objectContaining({ key: "inflow", value: 125000 }),
      expect.objectContaining({ key: "outflow", value: 55000 }),
    ]);
  });

  it("returns an empty flag when both sides are zero", () => {
    const result = buildInflowOutflowChartData({
      revenue: "0.00",
      cogs: "0.00",
      expenses: "0.00",
      payroll: "0.00",
    });

    expect(result.isEmpty).toBe(true);
    expect(result.segments).toEqual([]);
  });
});

describe("buildBudgetActualChartData", () => {
  it("builds chart segments from non-zero actuals and keeps totals for the center summary", () => {
    const result = buildBudgetActualChartData({
      totalBudgeted: "90000.00",
      totalActual: "76000.00",
      totalVariance: "14000.00",
      categories: [
        {
          categoryId: 1,
          categoryName: "Rent",
          categoryColor: "#d9a3b7",
          budgeted: "40000.00",
          actual: "35000.00",
          variance: "5000.00",
          variancePercent: "12.5",
          isOverBudget: false,
        },
        {
          categoryId: 2,
          categoryName: "Marketing",
          categoryColor: "#e9d6df",
          budgeted: "20000.00",
          actual: "0.00",
          variance: "20000.00",
          variancePercent: "100.0",
          isOverBudget: false,
        },
      ],
    });

    expect(result.isEmpty).toBe(false);
    expect(result.totalActual).toBe("76000.00");
    expect(result.segments).toEqual([
      expect.objectContaining({ categoryId: 1, value: 35000 }),
    ]);
    expect(result.legendItems).toHaveLength(2);
  });
});

describe("getVisibleBudgetRows", () => {
  it("marks only the selected category row as active", () => {
    const rows = getVisibleBudgetRows(
      [
        { categoryId: 1, categoryName: "Rent" },
        { categoryId: 2, categoryName: "Utilities" },
      ],
      2,
    );

    expect(rows).toEqual([
      expect.objectContaining({ categoryId: 1, isSelected: false, isDimmed: true }),
      expect.objectContaining({ categoryId: 2, isSelected: true, isDimmed: false }),
    ]);
  });
});
