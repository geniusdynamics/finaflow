import { describe, it, expect } from "vitest";
import { computePaye, computeNhif, computeNssf } from "../../api/lib/tax";

describe("Payroll Cycle E2E", () => {
  it("should process full payroll for an employee", () => {
    const basicPay = 75000;

    const paye = computePaye(basicPay);
    const nhif = computeNhif(basicPay);
    const nssf = computeNssf(basicPay);

    expect(paye).toBeGreaterThan(0);
    expect(nhif).toBeCloseTo(2062.5, 1);
    expect(nssf.employee).toBeGreaterThan(0);

    const totalDeductions = paye + nhif + nssf.employee;
    const netPay = Math.max(0, basicPay - totalDeductions);
    expect(netPay).toBeGreaterThan(0);
    expect(netPay).toBeLessThan(basicPay);
  });

  it("should handle zero-deduction employee (very low salary)", () => {
    const basicPay = 5000;
    const paye = computePaye(basicPay);
    expect(paye).toBe(0);

    const nhif = computeNhif(basicPay);
    expect(nhif).toBeCloseTo(137.5, 1);
  });
});
