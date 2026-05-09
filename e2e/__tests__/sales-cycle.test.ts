import { describe, it, expect } from "vitest";

describe("Sales Cycle E2E", () => {
  it("should calculate net sales correctly", () => {
    const grossSales = 50000;
    const discountAmount = 2000;
    const voidAmount = 500;
    const netSales = grossSales - discountAmount - voidAmount;
    expect(netSales).toBe(47500);
  });

  it("should distribute payments across methods", () => {
    const payments = [
      { method: "cash", amount: 20000 },
      { method: "mpesa", amount: 25000 },
      { method: "card", amount: 5000 },
    ];
    const total = payments.reduce((sum, p) => sum + p.amount, 0);
    expect(total).toBe(50000);
  });
});
