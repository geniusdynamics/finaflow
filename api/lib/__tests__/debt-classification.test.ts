// ABOUTME: Unit tests for the pure helpers in debt-classification.ts — the date math
// ABOUTME: and the long-term threshold logic. The DB-bound helpers are exercised by
// ABOUTME: the integration suite for the debts router.
import { describe, it, expect } from "vitest";
import { isLongTermLoan, frequencyToDays, advanceDateByFrequency } from "../debt-classification";

describe("isLongTermLoan", () => {
  it("returns false when term is 1 year or less", () => {
    const loan = "2026-01-01";
    const due = "2026-12-31"; // 364 days
    expect(isLongTermLoan(loan, due)).toBe(false);
  });

  it("returns false for an exactly 365-day term (boundary is > 365)", () => {
    const loan = "2026-01-01";
    const due = "2027-01-01"; // 365 days
    expect(isLongTermLoan(loan, due)).toBe(false);
  });

  it("returns true when term exceeds 365 days", () => {
    const loan = "2026-01-01";
    const due = "2027-01-02"; // 366 days
    expect(isLongTermLoan(loan, due)).toBe(true);
  });

  it("returns false when dueDate is missing", () => {
    expect(isLongTermLoan("2026-01-01", null)).toBe(false);
    expect(isLongTermLoan("2026-01-01", undefined)).toBe(false);
  });

  it("accepts both Date and string inputs", () => {
    const loan = new Date("2026-01-01");
    const due = new Date("2027-06-01");
    expect(isLongTermLoan(loan, due)).toBe(true);
  });
});

describe("frequencyToDays", () => {
  it("returns the right day count for each frequency", () => {
    expect(frequencyToDays("daily")).toBe(1);
    expect(frequencyToDays("weekly")).toBe(7);
    expect(frequencyToDays("monthly")).toBe(30);
    expect(frequencyToDays("quarterly")).toBe(91);
    expect(frequencyToDays("annually")).toBe(365);
  });
});

describe("advanceDateByFrequency", () => {
  it("advances a date by the right number of days per frequency", () => {
    const start = new Date("2026-06-01T00:00:00.000Z");
    expect(advanceDateByFrequency(start, "daily").toISOString().slice(0, 10)).toBe("2026-06-02");
    expect(advanceDateByFrequency(start, "weekly").toISOString().slice(0, 10)).toBe("2026-06-08");
    expect(advanceDateByFrequency(start, "monthly").toISOString().slice(0, 10)).toBe("2026-07-01");
    expect(advanceDateByFrequency(start, "quarterly").toISOString().slice(0, 10)).toBe("2026-08-31");
    expect(advanceDateByFrequency(start, "annually").toISOString().slice(0, 10)).toBe("2027-06-01");
  });
});
