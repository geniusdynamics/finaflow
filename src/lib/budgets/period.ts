// ABOUTME: Generates tracked period buckets, analytical month rows, and human-readable labels for budget plans.
// ABOUTME: Supports monthly, quarterly, half-yearly, and annual period types with fiscal-year-aware indexing.

import type { Period } from "./fiscal-year";

export interface TrackedBucket {
  bucketType: string;
  bucketIndex: number;
  startMonth: number;
  endMonth: number;
  label: string;
}

export interface AnalyticalMonth {
  name: string;
  calendarMonth: number;
  fiscalMonthIndex: number;
  tracked: boolean;
}

export interface FiscalMonth {
  name: string;
  index: number;
  fiscalMonthIndex: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function calendarMonth(fiscalYearStart: number, fiscalOffset: number): number {
  return ((fiscalYearStart - 1 + fiscalOffset) % 12) + 1;
}

export function generateTrackedBuckets(
  period: Period,
  fiscalYearStart: number,
): TrackedBucket[] {
  switch (period) {
    case "monthly": {
      const buckets: TrackedBucket[] = [];
      for (let i = 0; i < 12; i++) {
        const m = calendarMonth(fiscalYearStart, i);
        buckets.push({
          bucketType: "month",
          bucketIndex: i,
          startMonth: m,
          endMonth: m,
          label: bucketLabel(period, i),
        });
      }
      return buckets;
    }
    case "quarterly": {
      const buckets: TrackedBucket[] = [];
      for (let i = 0; i < 4; i++) {
        const start = calendarMonth(fiscalYearStart, i * 3);
        const end = calendarMonth(fiscalYearStart, i * 3 + 2);
        buckets.push({
          bucketType: "quarter",
          bucketIndex: i,
          startMonth: start,
          endMonth: end,
          label: bucketLabel(period, i),
        });
      }
      return buckets;
    }
    case "half-yearly": {
      const buckets: TrackedBucket[] = [];
      for (let i = 0; i < 2; i++) {
        const start = calendarMonth(fiscalYearStart, i * 6);
        const end = calendarMonth(fiscalYearStart, i * 6 + 5);
        buckets.push({
          bucketType: "half",
          bucketIndex: i,
          startMonth: start,
          endMonth: end,
          label: bucketLabel(period, i),
        });
      }
      return buckets;
    }
    case "annual": {
      const start = calendarMonth(fiscalYearStart, 0);
      const end = calendarMonth(fiscalYearStart, 11);
      return [{
        bucketType: "annual",
        bucketIndex: 0,
        startMonth: start,
        endMonth: end,
        label: bucketLabel(period, 0),
      }];
    }
  }
}

export function generateAnalyticalMonths(
  period: Period,
  fiscalYearStart: number,
): AnalyticalMonth[] {
  const months: AnalyticalMonth[] = [];
  for (let i = 0; i < 12; i++) {
    const m = calendarMonth(fiscalYearStart, i);
    months.push({
      name: MONTH_NAMES[m - 1],
      calendarMonth: m,
      fiscalMonthIndex: i,
      tracked: period === "monthly",
    });
  }
  return months;
}

export function bucketLabel(period: Period, index: number): string {
  switch (period) {
    case "monthly": return `Month ${index + 1}`;
    case "quarterly": return `Q${index + 1}`;
    case "half-yearly": return `H${index + 1}`;
    case "annual": return "Annual";
  }
}

export function fiscalMonths(fiscalYearStart: number): FiscalMonth[] {
  const months: FiscalMonth[] = [];
  for (let i = 0; i < 12; i++) {
    const m = calendarMonth(fiscalYearStart, i);
    months.push({
      name: MONTH_NAMES[m - 1],
      index: m,
      fiscalMonthIndex: i,
    });
  }
  return months;
}
