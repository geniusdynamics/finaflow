// ABOUTME: Unit tests for validation.ts — ALL_PERIODS, ALL_STATUSES, type guards, and validation functions.
// ABOUTME: Covers all valid and invalid inputs for budget period and status validation.

import { describe, it, expect } from "vitest";
import {
  ALL_PERIODS,
  isPeriod,
  ALL_STATUSES,
  isStatus,
  validatePeriod,
  validateBudgetLines,
} from "../validation";

describe("ALL_PERIODS", () => {
  it("contains all four period values in order", () => {
    expect(ALL_PERIODS).toEqual(["monthly", "quarterly", "half-yearly", "annual"]);
  });
});

describe("isPeriod", () => {
  it("returns true for valid periods", () => {
    expect(isPeriod("monthly")).toBe(true);
    expect(isPeriod("quarterly")).toBe(true);
    expect(isPeriod("half-yearly")).toBe(true);
    expect(isPeriod("annual")).toBe(true);
  });

  it("returns false for invalid strings", () => {
    expect(isPeriod("weekly")).toBe(false);
    expect(isPeriod("yearly")).toBe(false);
    expect(isPeriod("biweekly")).toBe(false);
    expect(isPeriod("")).toBe(false);
  });

  it("returns false for non-string values", () => {
    expect(isPeriod(undefined)).toBe(false);
    expect(isPeriod(null)).toBe(false);
    expect(isPeriod(123)).toBe(false);
    expect(isPeriod({})).toBe(false);
  });
});

describe("ALL_STATUSES", () => {
  it("contains all four status values in order", () => {
    expect(ALL_STATUSES).toEqual(["draft", "active", "locked", "archived"]);
  });
});

describe("isStatus", () => {
  it("returns true for valid statuses", () => {
    expect(isStatus("draft")).toBe(true);
    expect(isStatus("active")).toBe(true);
    expect(isStatus("locked")).toBe(true);
    expect(isStatus("archived")).toBe(true);
  });

  it("returns false for invalid strings", () => {
    expect(isStatus("pending")).toBe(false);
    expect(isStatus("deleted")).toBe(false);
    expect(isStatus("inactive")).toBe(false);
    expect(isStatus("")).toBe(false);
  });

  it("returns false for non-string values", () => {
    expect(isStatus(undefined)).toBe(false);
    expect(isStatus(null)).toBe(false);
    expect(isStatus(0)).toBe(false);
    expect(isStatus([])).toBe(false);
  });
});

describe("validatePeriod", () => {
  it("does not throw for valid periods", () => {
    expect(() => validatePeriod("monthly")).not.toThrow();
    expect(() => validatePeriod("quarterly")).not.toThrow();
    expect(() => validatePeriod("half-yearly")).not.toThrow();
    expect(() => validatePeriod("annual")).not.toThrow();
  });

  it("throws for invalid periods", () => {
    expect(() => validatePeriod("weekly")).toThrow(
      'Invalid period: "weekly". Expected one of: monthly, quarterly, half-yearly, annual',
    );
  });

  it("throws for undefined", () => {
    expect(() => validatePeriod(undefined)).toThrow(/Invalid period/);
  });
});

describe("validateBudgetLines", () => {
  it("does not throw for valid lines", () => {
    expect(() =>
      validateBudgetLines([{ amount: "100.00" }, { amount: "250.50" }]),
    ).not.toThrow();
  });

  it("throws for empty lines array", () => {
    expect(() => validateBudgetLines([])).toThrow(
      "Budget lines must contain at least one entry.",
    );
  });

  it("throws for zero amount", () => {
    expect(() => validateBudgetLines([{ amount: "0.00" }])).toThrow(
      'Line 1 has an invalid amount: "0.00". Amount must be a positive number.',
    );
  });

  it("throws for negative amount", () => {
    expect(() => validateBudgetLines([{ amount: "-50.00" }])).toThrow(
      'Line 1 has an invalid amount: "-50.00". Amount must be a positive number.',
    );
  });

  it("throws for NaN amount", () => {
    expect(() => validateBudgetLines([{ amount: "abc" }])).toThrow(
      'Line 1 has an invalid amount: "abc". Amount must be a positive number.',
    );
  });

  it("reports correct line number for invalid lines", () => {
    expect(() =>
      validateBudgetLines([
        { amount: "100.00" },
        { amount: "0.00" },
      ]),
    ).toThrow("Line 2 has an invalid amount");
  });

  it("accepts integer string amounts", () => {
    expect(() => validateBudgetLines([{ amount: "500" }])).not.toThrow();
  });
});
