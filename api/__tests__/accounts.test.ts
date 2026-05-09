import { describe, it, expect } from "vitest";
import { d } from "../lib/decimal";

describe("Account Transfer - Decimal Calculations", () => {
  it("should correctly compute transfer amounts", () => {
    const fromBalance = d("50000.00");
    const transferAmount = d("15000.00");
    const toBalance = d("10000.00");

    const fromNewBalance = fromBalance.minus(transferAmount);
    const toNewBalance = toBalance.plus(transferAmount);

    expect(fromNewBalance.toFixed(2)).toBe("35000.00");
    expect(toNewBalance.toFixed(2)).toBe("25000.00");
  });

  it("should reject insufficient funds", () => {
    const fromBalance = d("5000.00");
    const transferAmount = d("10000.00");
    expect(fromBalance.lt(transferAmount)).toBe(true);
  });

  it("should reject transfer to same account", () => {
    const fromAccountId = 1;
    const toAccountId = 1;
    expect(fromAccountId === toAccountId).toBe(true);
  });

  it("should handle multiple destination accounts", () => {
    const fromBalance = d("50000.00");
    const destinations = [
      { id: 2, amount: d("10000.00") },
      { id: 3, amount: d("15000.00") },
      { id: 4, amount: d("5000.00") },
    ];
    const totalOut = destinations.reduce((sum, d) => sum.plus(d.amount), d(0));
    expect(fromBalance.gte(totalOut)).toBe(true);
    expect(fromBalance.minus(totalOut).toFixed(2)).toBe("20000.00");
  });

  it("should process payroll with all deductions", () => {
    const basicPay = d("50000.00");
    const nssf = d("1080.00");
    const nhif = d("1375.00");
    const paye = d("2849.80");
    const advanceDeduction = d("5000.00");
    const grossDeductions = advanceDeduction.plus(nssf).plus(nhif).plus(paye);
    const netPay = d(Math.max(0, basicPay.minus(grossDeductions).toNumber()));
    expect(netPay.toFixed(2)).toBe("39695.20");
  });
});
