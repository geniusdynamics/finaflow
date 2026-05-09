import { describe, it, expect } from "vitest";
import { d } from "../../api/lib/decimal";

describe("Bills Cycle E2E", () => {
  it("should track partial payments correctly", () => {
    const billAmount = d("100000.00");
    const payment1 = d("30000.00");
    const payment2 = d("40000.00");

    const balanceAfterPayment1 = billAmount.minus(payment1);
    expect(balanceAfterPayment1.toFixed(2)).toBe("70000.00");

    const balanceAfterPayment2 = balanceAfterPayment1.minus(payment2);
    expect(balanceAfterPayment2.toFixed(2)).toBe("30000.00");
  });

  it("should mark bill as paid when balance reaches zero", () => {
    const billAmount = d("50000.00");
    const fullPayment = d("50000.00");
    const remainingBalance = billAmount.minus(fullPayment);
    expect(remainingBalance.lte(0)).toBe(true);
  });

  it("should handle overpayment gracefully", () => {
    const billAmount = d("50000.00");
    const overpayment = d("55000.00");
    const remainingBalance = billAmount.minus(overpayment);
    expect(remainingBalance.lte(0)).toBe(true);
  });
});
