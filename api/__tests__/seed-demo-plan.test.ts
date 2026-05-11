// ABOUTME: Verifies the demo reporting seed planner produces realistic reportable data.
// ABOUTME: Protects the seed-demo script from regressing back to empty report and export states.
import { describe, expect, it } from "vitest";

import { buildDemoReportingSeedPlan } from "../../db/seed-demo-plan.cjs";

function makeFixture() {
  return {
    anchorDate: "2026-05-09",
    locationIds: { main: 10, secondary: 11 },
    categoryIds: {
      food: 1,
      utilities: 2,
      salaries: 3,
      rent: 4,
      supplies: 5,
      marketing: 6,
    },
    paymentMethodIds: {
      cash: 1,
      mpesa: 2,
      bank: 3,
      card: 4,
    },
    accountIds: {
      cash: 101,
      mpesa: 102,
      bank: 103,
    },
    supplierIds: {
      landlord: 201,
      fuel: 202,
      utilities: 203,
      stationery: 204,
    },
    enteredBy: 8,
  };
}

describe("buildDemoReportingSeedPlan", () => {
  it("builds reportable data for a rolling three month window plus future bills", () => {
    const plan = buildDemoReportingSeedPlan(makeFixture());

    expect(plan.reportingMonths).toEqual([
      { year: 2026, month: 3 },
      { year: 2026, month: 4 },
      { year: 2026, month: 5 },
    ]);
    expect(plan.sales.length).toBeGreaterThan(0);
    expect(plan.salePayments.length).toBe(plan.sales.length * 3);
    expect(plan.expenses.length).toBeGreaterThan(0);
    expect(plan.budgets.length).toBe(18);
    expect(plan.mpesaTransactions.length).toBeGreaterThan(0);
    expect(plan.futureBills.length).toBeGreaterThanOrEqual(3);
  });

  it("creates deterministic mixed-direction mpesa activity for the same anchor date", () => {
    const first = buildDemoReportingSeedPlan(makeFixture());
    const second = buildDemoReportingSeedPlan(makeFixture());

    expect(first.mpesaTransactions.some((txn: { amount: string }) => Number(txn.amount) > 0)).toBe(
      true,
    );
    expect(first.mpesaTransactions.some((txn: { amount: string }) => Number(txn.amount) < 0)).toBe(
      true,
    );
    expect(second).toEqual(first);
  });
});
