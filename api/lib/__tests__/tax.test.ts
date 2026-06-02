import { describe, it, expect } from "vitest";
import { computePaye, computeNhif, computeNssf, computeHousingLevy, PAYE_BANDS, PERSONAL_RELIEF } from "../tax";

describe("PAYE Calculation (2026 bands)", () => {
  it("should return 0 for income below personal relief threshold", () => {
    expect(computePaye(0)).toBe(0);
    expect(computePaye(10000)).toBe(0);
    expect(computePaye(20000)).toBe(0);
    expect(computePaye(24000)).toBe(0);
  });

  it("should calculate PAYE for 50,000 correctly (2026 bands)", () => {
    expect(computePaye(50000)).toBeCloseTo(7383.35, 1);
  });

  it("should calculate PAYE for 100,000 correctly (2026 bands)", () => {
    expect(computePaye(100000)).toBeCloseTo(22383.35, 1);
  });

  it("should calculate PAYE for band 4 (450,000)", () => {
    const result = computePaye(450000);
    expect(result).toBeGreaterThan(120000);
  });

  it("should calculate PAYE for band 5 (600,000)", () => {
    const result = computePaye(600000);
    expect(result).toBeGreaterThan(170000);
  });

  it("should calculate PAYE for band 5 (1,000,000)", () => {
    const result = computePaye(1000000);
    expect(result).toBeGreaterThan(300000);
  });

  it("should handle exactly at band boundaries", () => {
    expect(computePaye(24000)).toBe(0);
    expect(computePaye(24001)).toBeGreaterThan(0);
    expect(computePaye(32333)).toBeGreaterThan(0);
  });

  it("should not produce negative PAYE", () => {
    expect(computePaye(0)).toBe(0);
    expect(computePaye(1000)).toBe(0);
    expect(computePaye(5000)).toBe(0);
  });
});

describe("NHIF Calculation", () => {
  it("should calculate 2.75% of gross pay", () => {
    expect(computeNhif(50000)).toBeCloseTo(1375, 1);
  });

  it("should return 0 for zero income", () => {
    expect(computeNhif(0)).toBe(0);
  });
});

describe("NSSF Calculation", () => {
  it("should calculate NSSF for income >= tier 2 max", () => {
    const result = computeNssf(36000);
    expect(result.employee).toBe(2160);
    expect(result.employer).toBe(2160);
  });

  it("should calculate NSSF for income within tier 1", () => {
    const result = computeNssf(5000);
    expect(result.employee).toBe(300);
    expect(result.employer).toBe(300);
  });

  it("should calculate NSSF for income within tier 2", () => {
    const result = computeNssf(20000);
    expect(result.employee).toBe(1200);
    expect(result.employer).toBe(1200);
  });
});

describe("Housing Levy Calculation", () => {
  it("should calculate 1.5% of gross pay", () => {
    expect(computeHousingLevy(100000)).toBeCloseTo(1500, 1);
  });

  it("should return 0 for zero income", () => {
    expect(computeHousingLevy(0)).toBe(0);
  });
});

describe("Payroll Computation (integration)", () => {
  it("should compute correct deductions for 100,000 gross with Housing Levy", () => {
    const gross = 100000;
    const nssf = computeNssf(gross);
    const housingLevy = computeHousingLevy(gross);
    const taxableIncome = Math.max(0, gross - nssf.employee - housingLevy);
    const paye = computePaye(taxableIncome);
    const nhif = computeNhif(gross);

    expect(nssf.employee).toBeCloseTo(2160, 0);
    expect(housingLevy).toBeCloseTo(1500, 0);
    expect(taxableIncome).toBeCloseTo(96340, 0);
    expect(paye).toBeGreaterThan(0);
    expect(nhif).toBeCloseTo(2750, 0);
  });
});
