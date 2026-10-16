// ABOUTME: Tests for the pure subscription billing math helpers in api/lib/subscription-math.ts.
// ABOUTME: Covers due-date advancing with month-end clamping, Wallos-parity cost normalization, cycle progress, due/overdue helpers, and month projections.
import { describe, expect, it } from "vitest";
import { d, Decimal } from "../lib/decimal";
import {
  advanceDueDate,
  cycleProgress,
  daysBetween,
  isDueSoon,
  isOverdue,
  monthlyNormalized,
  nextDueAfter,
  projectMonths,
  yearlyNormalized,
  type SubscriptionSchedule,
} from "../lib/subscription-math";

function makeSub(overrides: Partial<SubscriptionSchedule> = {}): SubscriptionSchedule {
  return {
    id: 1,
    amount: "100",
    currency: "USD",
    cycleUnit: "month",
    cycleCount: 1,
    nextDueDate: "2026-11-05",
    status: "active",
    ...overrides,
  };
}

describe("advanceDueDate", () => {
  it("clamps month-end forward when the target month is shorter", () => {
    expect(advanceDueDate("2026-01-31", "month", 1)).toBe("2026-02-28");
  });

  it("clamps to Feb 29 in a leap year", () => {
    expect(advanceDueDate("2028-01-31", "month", 1)).toBe("2028-02-29");
  });

  it("does not drift when adding multiple months at once", () => {
    expect(advanceDueDate("2026-01-31", "month", 2)).toBe("2026-03-31");
    expect(advanceDueDate("2026-01-31", "month", 14)).toBe("2027-03-31");
  });

  it("clamps April 30 from March 31", () => {
    expect(advanceDueDate("2026-03-31", "month", 1)).toBe("2026-04-30");
  });

  it("clamps forward-only with no anchor preservation", () => {
    // 2026-01-31 -> 2026-02-28 -> 2026-03-28 (the 28th is the new anchor)
    const step = advanceDueDate("2026-01-31", "month", 1);
    expect(step).toBe("2026-02-28");
    expect(advanceDueDate(step, "month", 1)).toBe("2026-03-28");
  });

  it("crosses year boundaries on month advances", () => {
    expect(advanceDueDate("2026-11-30", "month", 3)).toBe("2027-02-28");
  });

  it("advances day cycles, including across year ends", () => {
    expect(advanceDueDate("2026-01-01", "day", 1)).toBe("2026-01-02");
    expect(advanceDueDate("2026-12-31", "day", 1)).toBe("2027-01-01");
  });

  it('handles "every 90 days" as unit day with count 90', () => {
    expect(advanceDueDate("2026-01-01", "day", 90)).toBe("2026-04-01");
  });

  it("advances week cycles", () => {
    expect(advanceDueDate("2026-01-01", "week", 1)).toBe("2026-01-08");
    expect(advanceDueDate("2026-01-01", "week", 2)).toBe("2026-01-15");
  });

  it("advances year cycles with leap-day clamping", () => {
    expect(advanceDueDate("2024-02-29", "year", 1)).toBe("2025-02-28");
    expect(advanceDueDate("2026-06-15", "year", 3)).toBe("2029-06-15");
  });

  it("rejects non-positive-integer counts and invalid dates", () => {
    expect(() => advanceDueDate("2026-01-01", "day", 0)).toThrow();
    expect(() => advanceDueDate("2026-01-01", "day", -1)).toThrow();
    expect(() => advanceDueDate("2026-01-01", "day", 1.5)).toThrow();
    expect(() => advanceDueDate("2026-02-30", "month", 1)).toThrow();
    expect(() => advanceDueDate("not-a-date", "month", 1)).toThrow();
    expect(() => advanceDueDate("2026-1-1", "month", 1)).toThrow();
  });
});

describe("monthlyNormalized (Wallos stats_calculations parity)", () => {
  it("normalizes daily amounts at 30 days per month", () => {
    expect(monthlyNormalized("100", "day", 1).toFixed(2)).toBe("3000.00");
    expect(monthlyNormalized("100", "day", 3).toFixed(2)).toBe("1000.00");
  });

  it("normalizes weekly amounts at 4.35 weeks per month", () => {
    expect(monthlyNormalized("100", "week", 1).toFixed(2)).toBe("435.00");
    expect(monthlyNormalized("100", "week", 2).toFixed(2)).toBe("217.50");
  });

  it("normalizes monthly amounts by the cycle count", () => {
    expect(monthlyNormalized("1200", "month", 1).toFixed(2)).toBe("1200.00");
    expect(monthlyNormalized("1200", "month", 2).toFixed(2)).toBe("600.00");
  });

  it("normalizes yearly amounts over 12 * count months", () => {
    expect(monthlyNormalized("12000", "year", 1).toFixed(2)).toBe("1000.00");
    expect(monthlyNormalized("12000", "year", 2).toFixed(2)).toBe("500.00");
  });

  it("rounds to 2dp with ROUND_HALF_UP", () => {
    expect(monthlyNormalized("100", "month", 3).toFixed(2)).toBe("33.33");
    // 1 / 8 = 0.125 -> 0.13 half-up
    expect(monthlyNormalized("1", "month", 8).toFixed(2)).toBe("0.13");
  });

  it("uses decimal math, not float parsing", () => {
    // 0.1 + 0.2 style hazard: 3 * (1.10 / 3) must stay exact at 2dp
    expect(monthlyNormalized("1.10", "month", 3).toFixed(2)).toBe("0.37");
  });

  it("rejects counts below 1 or non-integer counts", () => {
    expect(() => monthlyNormalized("100", "month", 0)).toThrow();
    expect(() => monthlyNormalized("100", "month", -2)).toThrow();
    expect(() => monthlyNormalized("100", "month", 2.5)).toThrow();
  });
});

describe("yearlyNormalized", () => {
  it("is the monthly normalization times 12", () => {
    expect(yearlyNormalized("1200", "month", 1).toFixed(2)).toBe("14400.00");
    expect(yearlyNormalized("100", "day", 1).toFixed(2)).toBe("36000.00");
    expect(yearlyNormalized("12000", "year", 1).toFixed(2)).toBe("12000.00");
  });

  it("multiplies the rounded monthly value (2dp)", () => {
    // monthly(100, 3 months) = 33.33 -> yearly = 399.96
    expect(yearlyNormalized("100", "month", 3).toFixed(2)).toBe("399.96");
    expect(yearlyNormalized("10", "month", 3).toFixed(2)).toBe("39.96");
  });

  it("rejects counts below 1 or non-integer counts", () => {
    expect(() => yearlyNormalized("100", "month", 0)).toThrow();
    expect(() => yearlyNormalized("100", "month", 1.5)).toThrow();
  });
});

describe("daysBetween", () => {
  it("returns whole days from today until due (negative = overdue)", () => {
    expect(daysBetween("2026-10-16", "2026-10-16")).toBe(0);
    expect(daysBetween("2026-10-20", "2026-10-16")).toBe(4);
    expect(daysBetween("2026-10-10", "2026-10-16")).toBe(-6);
  });

  it("handles month and year boundaries", () => {
    expect(daysBetween("2027-01-01", "2026-12-31")).toBe(1);
    expect(daysBetween("2026-03-01", "2026-02-28")).toBe(1);
    expect(daysBetween("2028-03-01", "2028-02-28")).toBe(2);
  });
});

describe("cycleProgress (Wallos getSubscriptionProgress parity)", () => {
  it("reports mid-cycle progress around 50%", () => {
    expect(cycleProgress("2026-02-15", "month", 1, "2026-01-31")).toBe(50);
  });

  it("is 100 on the due date itself", () => {
    expect(cycleProgress("2026-01-31", "month", 1, "2026-01-31")).toBe(100);
  });

  it("is 0 exactly one full cycle before the due date", () => {
    expect(cycleProgress("2026-03-02", "month", 1, "2026-01-31")).toBe(0);
  });

  it("walks back whole cycles when the due date is many cycles ahead", () => {
    // 2026-04-15 is 74 days out (3 cycles of 30); window starts 2026-01-15
    expect(cycleProgress("2026-04-15", "month", 1, "2026-01-31")).toBe(53);
  });

  it("clamps stale past-due dates to 100", () => {
    // next due is ~2 cycles in the past; raw progress would be 300
    expect(cycleProgress("2025-12-31", "month", 1, "2026-03-01")).toBe(100);
  });

  it("returns 0 for one-time purchases", () => {
    expect(cycleProgress("2026-02-15", "month", 1, "2026-02-01", true)).toBe(0);
    expect(cycleProgress("2026-02-15", "day", 90, "2026-02-01", true)).toBe(0);
  });

  it("uses 7 * count days for weekly cycles", () => {
    expect(cycleProgress("2026-02-15", "week", 1, "2026-02-11")).toBe(42);
  });

  it("uses count days for daily cycles", () => {
    expect(cycleProgress("2026-04-01", "day", 90, "2026-01-16")).toBe(16);
  });

  it("uses 365 * count days for yearly cycles", () => {
    expect(cycleProgress("2027-06-15", "year", 1, "2026-12-16")).toBe(50);
  });

  it("supports multi-month cycles", () => {
    // every 2 months = 60-day window; 16 days in on 2026-01-16
    expect(cycleProgress("2026-03-01", "month", 2, "2026-01-16")).toBe(26);
  });

  it("rejects counts below 1 or non-integer counts", () => {
    expect(() => cycleProgress("2026-02-15", "month", 0, "2026-02-01")).toThrow();
    expect(() => cycleProgress("2026-02-15", "month", -1, "2026-02-01")).toThrow();
    expect(() => cycleProgress("2026-02-15", "month", 1.5, "2026-02-01")).toThrow();
  });
});

describe("isOverdue", () => {
  it("is true only for active subs past their due date", () => {
    expect(isOverdue("2026-10-15", "active", "2026-10-16")).toBe(true);
  });

  it("is false on the due date itself", () => {
    expect(isOverdue("2026-10-16", "active", "2026-10-16")).toBe(false);
  });

  it("is false for future due dates", () => {
    expect(isOverdue("2026-10-20", "active", "2026-10-16")).toBe(false);
  });

  it("is false for non-active statuses even when past due", () => {
    expect(isOverdue("2026-10-15", "paused", "2026-10-16")).toBe(false);
    expect(isOverdue("2026-10-15", "cancelled", "2026-10-16")).toBe(false);
    expect(isOverdue("2026-10-15", "expired", "2026-10-16")).toBe(false);
  });

  it("matches the active status case-insensitively", () => {
    expect(isOverdue("2026-10-15", "Active", "2026-10-16")).toBe(true);
  });
});

describe("isDueSoon", () => {
  it("is true within the notify window", () => {
    expect(isDueSoon("2026-10-19", 3, "2026-10-16")).toBe(true);
  });

  it("is false outside the notify window", () => {
    expect(isDueSoon("2026-10-19", 2, "2026-10-16")).toBe(false);
  });

  it("includes the window boundary", () => {
    expect(isDueSoon("2026-10-23", 7, "2026-10-16")).toBe(true);
  });

  it("supports day-of only when notifyDaysBefore is 0 or negative", () => {
    expect(isDueSoon("2026-10-16", 0, "2026-10-16")).toBe(true);
    expect(isDueSoon("2026-10-16", -5, "2026-10-16")).toBe(true);
    expect(isDueSoon("2026-10-17", -5, "2026-10-16")).toBe(false);
    expect(isDueSoon("2026-10-17", 0, "2026-10-16")).toBe(false);
  });

  it("is never true for overdue dates", () => {
    expect(isDueSoon("2026-10-15", 7, "2026-10-16")).toBe(false);
    expect(isDueSoon("2026-10-16", 7, "2026-10-17")).toBe(false);
  });
});

describe("projectMonths", () => {
  it("returns one bucket per month from the month containing today", () => {
    const projections = projectMonths([makeSub({ nextDueDate: "2026-11-05" })], 3, "2026-10-20");
    expect(projections.map((p) => p.month)).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(projections[0].total.toFixed(2)).toBe("0.00");
    expect(projections[1].total.toFixed(2)).toBe("100.00");
    expect(projections[2].total.toFixed(2)).toBe("100.00");
  });

  it("projects across a year boundary", () => {
    const projections = projectMonths(
      [
        makeSub({ id: 1, amount: "40", nextDueDate: "2026-12-01" }),
        makeSub({ id: 2, amount: "120", cycleUnit: "year", nextDueDate: "2027-01-10" }),
      ],
      3,
      "2026-11-15",
    );
    expect(projections.map((p) => p.month)).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(projections[0].total.toFixed(2)).toBe("0.00");
    expect(projections[1].total.toFixed(2)).toBe("40.00");
    expect(projections[2].total.toFixed(2)).toBe("160.00");
  });

  it("skips one-time purchases", () => {
    const projections = projectMonths(
      [makeSub({ isOneTime: true, nextDueDate: "2026-11-05" })],
      3,
      "2026-10-20",
    );
    expect(projections.every((p) => p.total.equals(d("0")))).toBe(true);
  });

  it("skips paused, cancelled and expired subscriptions entirely", () => {
    const projections = projectMonths(
      [
        makeSub({ id: 1, status: "paused", nextDueDate: "2026-11-05" }),
        makeSub({ id: 2, status: "cancelled", nextDueDate: "2026-11-05" }),
        makeSub({ id: 3, status: "expired", nextDueDate: "2026-11-05" }),
      ],
      3,
      "2026-10-20",
    );
    expect(projections.every((p) => p.total.equals(d("0")))).toBe(true);
  });

  it("stops at cancellationDate but includes the cycle due on it", () => {
    const projections = projectMonths(
      [makeSub({ nextDueDate: "2026-10-25", cancellationDate: "2026-11-30" })],
      3,
      "2026-10-20",
    );
    expect(projections.map((p) => p.total.toFixed(2))).toEqual(["100.00", "100.00", "0.00"]);
  });

  it("excludes a cycle due after cancellationDate", () => {
    const projections = projectMonths(
      [makeSub({ nextDueDate: "2026-10-25", cancellationDate: "2026-10-24" })],
      3,
      "2026-10-20",
    );
    expect(projections.every((p) => p.total.equals(d("0")))).toBe(true);
  });

  it("treats cancellationDate as inclusive when the due date lands on it", () => {
    const projections = projectMonths(
      [makeSub({ nextDueDate: "2026-10-25", cancellationDate: "2026-10-25" })],
      3,
      "2026-10-20",
    );
    expect(projections.map((p) => p.total.toFixed(2))).toEqual(["100.00", "0.00", "0.00"]);
  });

  it("projects past-due subs from their next future cycle", () => {
    const projections = projectMonths(
      [makeSub({ amount: "50", nextDueDate: "2026-08-15" })],
      3,
      "2026-10-20",
    );
    // 2026-08-15 / 09-15 / 10-15 are all past; first future cycle is 2026-11-15
    expect(projections.map((p) => p.total.toFixed(2))).toEqual(["0.00", "50.00", "50.00"]);
  });

  it("includes a cycle due today", () => {
    const projections = projectMonths(
      [makeSub({ amount: "19.99", nextDueDate: "2026-10-20" })],
      3,
      "2026-10-20",
    );
    expect(projections[0].total.toFixed(2)).toBe("19.99");
    expect(projections[1].total.toFixed(2)).toBe("19.99");
    expect(projections[2].total.toFixed(2)).toBe("19.99");
  });

  it("walks real due dates with month-end clamping", () => {
    const projections = projectMonths(
      [makeSub({ amount: "10", nextDueDate: "2026-08-31" })],
      3,
      "2026-08-01",
    );
    // due dates: 2026-08-31, 2026-09-30, 2026-10-30 (clamped, no drift)
    expect(projections.map((p) => p.total.toFixed(2))).toEqual(["10.00", "10.00", "10.00"]);
  });

  it("sums perCurrency unconverted and totals via the convert callback", () => {
    const convert = (amount: Decimal, currency: string): Decimal =>
      currency === "EUR" ? amount.times(2) : amount;
    const projections = projectMonths(
      [
        makeSub({ id: 1, amount: "100", currency: "USD", nextDueDate: "2026-11-01" }),
        makeSub({ id: 2, amount: "50", currency: "EUR", nextDueDate: "2026-11-01" }),
      ],
      2,
      "2026-10-20",
      convert,
    );
    expect(projections[0].total.toFixed(2)).toBe("0.00");
    expect(projections[0].perCurrency["USD"]).toBeUndefined();
    expect(projections[1].total.toFixed(2)).toBe("200.00");
    expect(projections[1].perCurrency["USD"]?.toFixed(2)).toBe("100.00");
    expect(projections[1].perCurrency["EUR"]?.toFixed(2)).toBe("50.00");
  });

  it("uses identity conversion by default", () => {
    const projections = projectMonths(
      [
        makeSub({ id: 1, amount: "100", currency: "USD", nextDueDate: "2026-11-01" }),
        makeSub({ id: 2, amount: "50", currency: "EUR", nextDueDate: "2026-11-01" }),
      ],
      2,
      "2026-10-20",
    );
    expect(projections[0].total.toFixed(2)).toBe("0.00");
    expect(projections[1].total.toFixed(2)).toBe("150.00");
  });

  it("caps at 12 months even when more are requested", () => {
    const projections = projectMonths([], 24, "2026-10-20");
    expect(projections).toHaveLength(12);
    expect(projections[0].month).toBe("2026-10");
    expect(projections[11].month).toBe("2027-09");
  });

  it("returns no buckets when fewer than 1 month is requested", () => {
    expect(projectMonths([], 0, "2026-10-20")).toEqual([]);
    expect(projectMonths([], -3, "2026-10-20")).toEqual([]);
  });

  it("returns zero-filled buckets when no subscriptions project", () => {
    const projections = projectMonths([], 3, "2026-10-20");
    expect(projections.map((p) => p.month)).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(projections.every((p) => p.total.equals(d("0")))).toBe(true);
    expect(projections.every((p) => Object.keys(p.perCurrency).length === 0)).toBe(true);
  });
});

describe("nextDueAfter", () => {
  it("matches advanceDueDate", () => {
    expect(nextDueAfter("2026-01-31", "month", 1)).toBe("2026-02-28");
    expect(nextDueAfter("2026-01-01", "day", 90)).toBe("2026-04-01");
  });
});
