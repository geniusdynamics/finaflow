// ABOUTME: Unit tests for period.ts — tracked bucket generation, analytical months, labels, fiscal months.
// ABOUTME: Covers monthly, quarterly, half-yearly, and annual periods with fiscal-year start at April (default).

import { describe, it, expect } from "vitest";
import {
  generateTrackedBuckets,
  generateAnalyticalMonths,
  bucketLabel,
  fiscalMonths,
} from "../period";
import { getFiscalYearStart } from "../fiscal-year";

const APRIL = 4;
const JANUARY = 1;

describe("generateTrackedBuckets", () => {
  describe("monthly", () => {
    const buckets = generateTrackedBuckets("monthly", APRIL);

    it("generates 12 buckets", () => {
      expect(buckets).toHaveLength(12);
    });

    it("assigns bucketType 'month' to all buckets", () => {
      for (const b of buckets) {
        expect(b.bucketType).toBe("month");
      }
    });

    it("has correct startMonth/endMonth for each bucket (April start)", () => {
      // FY starts April: index 0=Apr, 1=May, ..., 11=Mar
      const expectedMonths = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
      for (let i = 0; i < 12; i++) {
        expect(buckets[i].startMonth).toBe(expectedMonths[i]);
        expect(buckets[i].endMonth).toBe(expectedMonths[i]);
      }
    });

    it("labels buckets 'Month 1' through 'Month 12'", () => {
      for (let i = 0; i < 12; i++) {
        expect(buckets[i].label).toBe(`Month ${i + 1}`);
      }
    });

    it("generates correct buckets for January fiscal year start", () => {
      const janBuckets = generateTrackedBuckets("monthly", JANUARY);
      expect(janBuckets).toHaveLength(12);
      expect(janBuckets[0].startMonth).toBe(1);
      expect(janBuckets[11].startMonth).toBe(12);
    });
  });

  describe("quarterly", () => {
    const buckets = generateTrackedBuckets("quarterly", APRIL);

    it("generates 4 buckets", () => {
      expect(buckets).toHaveLength(4);
    });

    it("assigns bucketType 'quarter'", () => {
      for (const b of buckets) {
        expect(b.bucketType).toBe("quarter");
      }
    });

    it("defines correct month ranges", () => {
      // Q1: Apr-Jun (4-6), Q2: Jul-Sep (7-9), Q3: Oct-Dec (10-12), Q4: Jan-Mar (1-3)
      const expected = [
        { start: 4, end: 6 },
        { start: 7, end: 9 },
        { start: 10, end: 12 },
        { start: 1, end: 3 },
      ];
      for (let i = 0; i < 4; i++) {
        expect(buckets[i].startMonth).toBe(expected[i].start);
        expect(buckets[i].endMonth).toBe(expected[i].end);
      }
    });

    it("labels buckets Q1 through Q4", () => {
      expect(buckets[0].label).toBe("Q1");
      expect(buckets[1].label).toBe("Q2");
      expect(buckets[2].label).toBe("Q3");
      expect(buckets[3].label).toBe("Q4");
    });
  });

  describe("half-yearly", () => {
    const buckets = generateTrackedBuckets("half-yearly", APRIL);

    it("generates 2 buckets", () => {
      expect(buckets).toHaveLength(2);
    });

    it("assigns bucketType 'half'", () => {
      for (const b of buckets) {
        expect(b.bucketType).toBe("half");
      }
    });

    it("defines correct month ranges", () => {
      // H1: Apr-Sep (4-9), H2: Oct-Mar (10-3)
      expect(buckets[0].startMonth).toBe(4);
      expect(buckets[0].endMonth).toBe(9);
      expect(buckets[1].startMonth).toBe(10);
      expect(buckets[1].endMonth).toBe(3);
    });

    it("labels buckets H1 and H2", () => {
      expect(buckets[0].label).toBe("H1");
      expect(buckets[1].label).toBe("H2");
    });
  });

  describe("annual", () => {
    const buckets = generateTrackedBuckets("annual", APRIL);

    it("generates 1 bucket", () => {
      expect(buckets).toHaveLength(1);
    });

    it("assigns bucketType 'annual'", () => {
      expect(buckets[0].bucketType).toBe("annual");
    });

    it("covers the full fiscal year (Apr–Mar)", () => {
      expect(buckets[0].startMonth).toBe(4);
      expect(buckets[0].endMonth).toBe(3);
    });

    it("labels bucket 'Annual'", () => {
      expect(buckets[0].label).toBe("Annual");
    });
  });
});

describe("generateAnalyticalMonths", () => {
  const APRIL = 4;

  it("returns 12 months for monthly period, all tracked=true", () => {
    const months = generateAnalyticalMonths("monthly", APRIL);
    expect(months).toHaveLength(12);

    // First month should be April (index 4) with fiscalMonthIndex 0
    expect(months[0].name).toBe("April");
    expect(months[0].calendarMonth).toBe(4);
    expect(months[0].fiscalMonthIndex).toBe(0);
    expect(months[0].tracked).toBe(true);

    // Last month should be March with fiscalMonthIndex 11
    expect(months[11].name).toBe("March");
    expect(months[11].calendarMonth).toBe(3);
    expect(months[11].fiscalMonthIndex).toBe(11);
    expect(months[11].tracked).toBe(true);

    // All 12 tracked=true
    for (const m of months) {
      expect(m.tracked).toBe(true);
    }
  });

  it("returns 12 months for quarterly period, all tracked=false", () => {
    const months = generateAnalyticalMonths("quarterly", APRIL);
    expect(months).toHaveLength(12);
    for (const m of months) {
      expect(m.tracked).toBe(false);
    }
  });

  it("returns 12 months for half-yearly period, all tracked=false", () => {
    const months = generateAnalyticalMonths("half-yearly", APRIL);
    expect(months).toHaveLength(12);
    for (const m of months) {
      expect(m.tracked).toBe(false);
    }
  });

  it("returns 12 months for annual period, all tracked=false", () => {
    const months = generateAnalyticalMonths("annual", APRIL);
    expect(months).toHaveLength(12);
    for (const m of months) {
      expect(m.tracked).toBe(false);
    }
  });

  it("orders months correctly for January fiscal year start", () => {
    const months = generateAnalyticalMonths("monthly", JANUARY);
    expect(months[0].name).toBe("January");
    expect(months[0].calendarMonth).toBe(1);
    expect(months[11].name).toBe("December");
    expect(months[11].calendarMonth).toBe(12);
  });
});

describe("bucketLabel", () => {
  it("returns 'Month N' for monthly period", () => {
    expect(bucketLabel("monthly", 0)).toBe("Month 1");
    expect(bucketLabel("monthly", 11)).toBe("Month 12");
  });

  it("returns 'QN' for quarterly period", () => {
    expect(bucketLabel("quarterly", 0)).toBe("Q1");
    expect(bucketLabel("quarterly", 3)).toBe("Q4");
  });

  it("returns 'HN' for half-yearly period", () => {
    expect(bucketLabel("half-yearly", 0)).toBe("H1");
    expect(bucketLabel("half-yearly", 1)).toBe("H2");
  });

  it("returns 'Annual' for annual period", () => {
    expect(bucketLabel("annual", 0)).toBe("Annual");
  });
});

describe("fiscalMonths", () => {
  it("returns 12 months ordered from fiscal year start (April)", () => {
    const months = fiscalMonths(APRIL);
    expect(months).toHaveLength(12);

    // First entry is April (calendar month 4, fiscal offset 0)
    expect(months[0].name).toBe("April");
    expect(months[0].index).toBe(4);
    expect(months[0].fiscalMonthIndex).toBe(0);

    // Last entry is March (calendar month 3, fiscal offset 11)
    expect(months[11].name).toBe("March");
    expect(months[11].index).toBe(3);
    expect(months[11].fiscalMonthIndex).toBe(11);

    // Verify sequential months
    const expectedNames = [
      "April", "May", "June", "July", "August", "September",
      "October", "November", "December", "January", "February", "March",
    ];
    for (let i = 0; i < 12; i++) {
      expect(months[i].name).toBe(expectedNames[i]);
      expect(months[i].fiscalMonthIndex).toBe(i);
    }
  });

  it("returns 12 months in calendar order for January fiscal start", () => {
    const months = fiscalMonths(JANUARY);
    expect(months[0].name).toBe("January");
    expect(months[11].name).toBe("December");
  });
});
