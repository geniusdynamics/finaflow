// ABOUTME: Generates tracked period buckets, analytical month rows, and human-readable labels for budget plans.
// ABOUTME: Month 1 = January through Month 12 = December — standard calendar alignment.

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

/** Standard calendar alignment: offset 0 = January (month 1), offset 11 = December (month 12). */
function calendarMonth(offset: number): number {
  return offset + 1;
}

export function generateTrackedBuckets(
  period: Period,
  _fiscalYearStart?: number,
): TrackedBucket[] {
  switch (period) {
    case "monthly": {
      const buckets: TrackedBucket[] = [];
      for (let i = 0; i < 12; i++) {
        const m = calendarMonth(i);
        buckets.push({
          bucketType: "month",
          bucketIndex: i,
          startMonth: m,
          endMonth: m,
          label: MONTH_NAMES[i],
        });
      }
      return buckets;
    }
    case "quarterly": {
      return [
        { bucketType: "quarter", bucketIndex: 0, startMonth: 1,  endMonth: 3,  label: "Q1" },
        { bucketType: "quarter", bucketIndex: 1, startMonth: 4,  endMonth: 6,  label: "Q2" },
        { bucketType: "quarter", bucketIndex: 2, startMonth: 7,  endMonth: 9,  label: "Q3" },
        { bucketType: "quarter", bucketIndex: 3, startMonth: 10, endMonth: 12, label: "Q4" },
      ];
    }
    case "half-yearly": {
      return [
        { bucketType: "half", bucketIndex: 0, startMonth: 1, endMonth: 6,  label: "H1" },
        { bucketType: "half", bucketIndex: 1, startMonth: 7, endMonth: 12, label: "H2" },
      ];
    }
    case "annual": {
      return [{
        bucketType: "annual",
        bucketIndex: 0,
        startMonth: 1,
        endMonth: 12,
        label: "Annual",
      }];
    }
  }
}

export function generateAnalyticalMonths(
  period: Period,
  _fiscalYearStart?: number,
): AnalyticalMonth[] {
  const months: AnalyticalMonth[] = [];
  for (let i = 0; i < 12; i++) {
    const m = calendarMonth(i);
    months.push({
      name: MONTH_NAMES[i],
      calendarMonth: m,
      fiscalMonthIndex: i,
      tracked: period === "monthly",
    });
  }
  return months;
}

export function bucketLabel(period: Period, index: number): string {
  switch (period) {
    case "monthly": return MONTH_NAMES[index];
    case "quarterly": return `Q${index + 1}`;
    case "half-yearly": return `H${index + 1}`;
    case "annual": return "Annual";
  }
}

export function fiscalMonths(): FiscalMonth[] {
  const months: FiscalMonth[] = [];
  for (let i = 0; i < 12; i++) {
    months.push({
      name: MONTH_NAMES[i],
      index: i + 1,
      fiscalMonthIndex: i,
    });
  }
  return months;
}
