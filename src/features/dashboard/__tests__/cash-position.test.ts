// ABOUTME: Verifies the cash position aggregator buckets balances correctly using decimal.js.
// ABOUTME: Keeps the math testable without a React tree.
import { describe, expect, it } from "vitest";

import { aggregateCashPosition, emptyCashPosition } from "../cash-position";

describe("aggregateCashPosition", () => {
  it("sums all balances into the total", () => {
    const result = aggregateCashPosition([
      { id: 1, name: "Drawer", type: "cash", currentBalance: "1500.50" },
      { id: 2, name: "Bank", type: "bank", currentBalance: "12000.00" },
    ]);
    expect(result.total).toBe("13500.50");
  });

  it("buckets balances by account type", () => {
    const result = aggregateCashPosition([
      { id: 1, name: "Drawer", type: "cash", currentBalance: "1000" },
      { id: 2, name: "Mpesa Till", type: "wallet", currentBalance: "5000" },
      { id: 3, name: "KCB", type: "bank", currentBalance: "20000" },
      { id: 4, name: "Prepaid", type: "prepaid", currentBalance: "300" },
    ]);
    expect(result.byType).toEqual({
      cash: "1000.00",
      wallet: "5000.00",
      bank: "20000.00",
      other: "300.00",
    });
  });

  it("handles empty input as all zeros", () => {
    expect(emptyCashPosition()).toEqual({
      total: "0.00",
      byType: { cash: "0.00", bank: "0.00", wallet: "0.00", other: "0.00" },
    });
    expect(aggregateCashPosition([]).total).toBe("0.00");
    expect(aggregateCashPosition([]).byType).toEqual({
      cash: "0.00", bank: "0.00", wallet: "0.00", other: "0.00",
    });
  });

  it("treats null/undefined type as 'other'", () => {
    const result = aggregateCashPosition([
      { id: 1, name: "Mystery", type: null, currentBalance: "42.00" },
    ]);
    expect(result.byType.other).toBe("42.00");
    expect(result.total).toBe("42.00");
  });

  it("is case-insensitive on the type field", () => {
    const result = aggregateCashPosition([
      { id: 1, name: "Cash USD", type: "CASH", currentBalance: "99.99" },
      { id: 2, name: "Bank USD", type: "Bank", currentBalance: "1.01" },
    ]);
    expect(result.byType.cash).toBe("99.99");
    expect(result.byType.bank).toBe("1.01");
  });
});
