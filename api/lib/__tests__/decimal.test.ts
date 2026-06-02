import { describe, it, expect } from "vitest";
import { d } from "../decimal";

describe("Decimal utilities", () => {
  it("should create Decimal from number", () => {
    const val = d(100);
    expect(val.toNumber()).toBe(100);
  });

  it("should create Decimal from string", () => {
    const val = d("100.50");
    expect(val.toNumber()).toBe(100.5);
  });

  it("should handle addition precisely", () => {
    // 0.1 + 0.2 = 0.3 (not 0.30000000000000004)
    const result = d(0.1).plus(0.2);
    expect(result.toNumber()).toBe(0.3);
  });

  it("should handle subtraction precisely", () => {
    const result = d(0.3).minus(0.1);
    expect(result.toNumber()).toBe(0.2);
  });

  it("should handle multiplication precisely", () => {
    const result = d(0.1).mul(0.2);
    expect(result.toNumber()).toBe(0.02);
  });

  it("should handle division precisely", () => {
    const result = d(1).div(3);
    // precision 15, ROUND_HALF_UP
    expect(result.toFixed(2)).toBe("0.33");
  });

  it("should round half up correctly", () => {
    expect(d(2.5).toFixed(0)).toBe("3");
    expect(d(1.5).toFixed(0)).toBe("2");
    expect(d(1.4).toFixed(0)).toBe("1");
  });

  it("should format to fixed decimal places", () => {
    expect(d("100").toFixed(2)).toBe("100.00");
    expect(d("50.5").toFixed(2)).toBe("50.50");
    expect(d("0.01").toFixed(2)).toBe("0.01");
  });

  it("should compare values correctly", () => {
    expect(d(100).gt(50)).toBe(true);
    expect(d(50).lt(100)).toBe(true);
    expect(d(50).gte(50)).toBe(true);
    expect(d(50).lte(50)).toBe(true);
    expect(d(100).eq(100)).toBe(true);
    expect(d(100).eq(d(100))).toBe(true);
  });

  it("should chain operations", () => {
    const result = d(100).plus(50).minus(20).mul(2).div(2);
    expect(result.toNumber()).toBe(130);
  });

  it("should compute abs correctly", () => {
    expect(d(-5).abs().toNumber()).toBe(5);
    expect(d(5).abs().toNumber()).toBe(5);
  });

  it("should handle financial calculations precisely", () => {
    const price = d("1499.99");
    const tax = price.mul(0.16);
    const total = price.plus(tax);
    expect(total.toFixed(2)).toBe("1739.99");
  });
});
