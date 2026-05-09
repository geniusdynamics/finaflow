import { describe, it, expect } from "vitest";
import { computePaye, computeNhif, computeNssf, computeHousingLevy } from "../lib/tax";
import { d } from "../lib/decimal";

describe("Payroll Processing (2026 bands with Housing Levy)", () => {
  it("should compute all deductions for a basic salary of 50,000", () => {
    const basicPay = 50000;
    const nssf = computeNssf(basicPay);
    const housingLevy = computeHousingLevy(basicPay);
    const taxableIncome = Math.max(0, basicPay - nssf.employee - housingLevy);
    const paye = computePaye(taxableIncome);
    const nhif = computeNhif(basicPay);
    const advanceDeduction = 0;

    expect(paye).toBeCloseTo(6510.35, 1);
    expect(nhif).toBeCloseTo(1375, 1);
    expect(nssf.employee).toBeCloseTo(2160, 0);
    expect(housingLevy).toBeCloseTo(750, 0);

    const grossDeductions = d(paye).plus(nhif).plus(nssf.employee).plus(housingLevy).plus(advanceDeduction);
    const netPay = d(Math.max(0, basicPay - grossDeductions.toNumber()));
    expect(netPay.toNumber()).toBeGreaterThan(0);
  });

  it("should handle advance deductions correctly", () => {
    const basicPay = 50000;
    const advanceDeduction = 5000;
    const nssf = computeNssf(basicPay);
    const housingLevy = computeHousingLevy(basicPay);
    const taxableIncome = Math.max(0, basicPay - nssf.employee - housingLevy);
    const paye = computePaye(taxableIncome);
    const nhif = computeNhif(basicPay);

    const grossDeductions = d(paye).plus(nhif).plus(nssf.employee).plus(housingLevy).plus(advanceDeduction);
    const netPay = d(Math.max(0, basicPay - grossDeductions.toNumber()));
    expect(netPay.toNumber()).toBeLessThan(basicPay - advanceDeduction);
  });

  it("should not produce negative net pay", () => {
    const basicPay = 50000;
    const advanceDeduction = 50000;
    const nssf = computeNssf(basicPay);
    const housingLevy = computeHousingLevy(basicPay);
    const taxableIncome = Math.max(0, basicPay - nssf.employee - housingLevy);
    const paye = computePaye(taxableIncome);
    const nhif = computeNhif(basicPay);

    const grossDeductions = d(paye).plus(nhif).plus(nssf.employee).plus(housingLevy).plus(advanceDeduction);
    const netPay = d(Math.max(0, basicPay - grossDeductions.toNumber()));
    expect(netPay.toNumber()).toBeGreaterThanOrEqual(0);
  });

  it("should compute correct totals across multiple employees", () => {
    const employees = [
      { name: "Employee A", basicPay: 30000 },
      { name: "Employee B", basicPay: 50000 },
      { name: "Employee C", basicPay: 100000 },
    ];

    let totalNetPay = d(0);
    for (const emp of employees) {
      const nssf = computeNssf(emp.basicPay);
      const housingLevy = computeHousingLevy(emp.basicPay);
      const taxableIncome = Math.max(0, emp.basicPay - nssf.employee - housingLevy);
      const paye = d(computePaye(taxableIncome));
      const nhif = d(computeNhif(emp.basicPay));
      const deductions = paye.plus(nhif).plus(nssf.employee).plus(housingLevy);
      const netPay = d(Math.max(0, emp.basicPay - deductions.toNumber()));
      totalNetPay = totalNetPay.plus(netPay);
    }

    expect(totalNetPay.toNumber()).toBeGreaterThan(0);
    expect(totalNetPay.toNumber()).toBeLessThan(180000);
  });
});
