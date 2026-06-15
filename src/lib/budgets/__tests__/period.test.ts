// ABOUTME: Unit tests for period.ts — tracked bucket generation, analytical months, labels, fiscal months.
// ABOUTME: Month 1 = January through Month 12 = December — standard calendar alignment.

import { describe, it, expect } from "vitest";
import {
  generateTrackedBuckets,
  generateAnalyticalMonths,
  bucketLabel,
  fiscalMonths,
} from "../period";

describe("generateTrackedBuckets", () => {
  describe("monthly", () => {
    const buckets = generateTrackedBuckets("monthly");

    it("generates 12 buckets", () => {
      expect(buckets).toHaveLength(12);
    });

    it("assigns bucketType 'month' to all buckets", () => {
      for (const b of buckets) {
        expect(b.bucketType).toBe("month");
      }
    });

    it("has correct startMonth/endMonth for each bucket (calendar alignment)", () => {
      // Standard calendar: index 0 = January (1), index 11 = December (12)
      for (let i = 0; i < 12; i++) {
        expect(buckets[i].startMonth).toBe(i + 1);
        expect(buckets[i].endMonth).toBe(i + 1);
      }
    });

    it("labels buckets with actual month names (January through December)", () => {
      const expectedLabels = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
      for (let i = 0; i < 12; i++) {
        expect(buckets[i].label).toBe(expectedLabels[i]);
      }
    });

    it("ignores fiscalYearStart parameter — always calendar order", () => {
      const aprilBuckets = generateTrackedBuckets("monthly", 4);
      const janBuckets = generateTrackedBuckets("monthly", 1);
      for (let i = 0; i < 12; i++) {
        expect(aprilBuckets[i].label).toBe(janBuckets[i].label);
        expect(aprilBuckets[i].startMonth).toBe(janBuckets[i].startMonth);
      }
    });
  });

  describe("quarterly", () => {
    const buckets = generateTrackedBuckets("quarterly");

    it("generates 4 buckets", () => {
      expect(buckets).toHaveLength(4);
    });

    it("assigns bucketType 'quarter'", () => {
      for (const b of buckets) {
        expect(b.bucketType).toBe("quarter");
      }
    });

    it("defines correct month ranges (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec)", () => {
      const expected = [
        { start: 1, end: 3 },
        { start: 4, end: 6 },
        { start: 7, end: 9 },
        { start: 10, end: 12 },
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
    const buckets = generateTrackedBuckets("half-yearly");

    it("generates 2 buckets", () => {
      expect(buckets).toHaveLength(2);
    });

    it("assigns bucketType 'half'", () => {
      for (const b of buckets) {
        expect(b.bucketType).toBe("half");
      }
    });

    it("defines correct month ranges (Jan–Jun, Jul–Dec)", () => {
      expect(buckets[0].startMonth).toBe(1);
      expect(buckets[0].endMonth).toBe(6);
      expect(buckets[1].startMonth).toBe(7);
      expect(buckets[1].endMonth).toBe(12);
    });

    it("labels buckets H1 and H2", () => {
      expect(buckets[0].label).toBe("H1");
      expect(buckets[1].label).toBe("H2");
    });
  });

  describe("annual", () => {
    const buckets = generateTrackedBuckets("annual");

    it("generates 1 bucket", () => {
      expect(buckets).toHaveLength(1);
    });

    it("assigns bucketType 'annual'", () => {
      expect(buckets[0].bucketType).toBe("annual");
    });

    it("covers January through December", () => {
      expect(buckets[0].startMonth).toBe(1);
      expect(buckets[0].endMonth).toBe(12);
    });

    it("labels bucket 'Annual'", () => {
      expect(buckets[0].label).toBe("Annual");
    });
  });
});

describe("generateAnalyticalMonths", () => {
  it("returns 12 months in calendar order for monthly period, all tracked=true", () => {
    const months = generateAnalyticalMonths("monthly");
    expect(months).toHaveLength(12);

    expect(months[0].name).toBe("January");
    expect(months[0].calendarMonth).toBe(1);
    expect(months[0].fiscalMonthIndex).toBe(0);
    expect(months[0].tracked).toBe(true);

    expect(months[11].name).toBe("December");
    expect(months[11].calendarMonth).toBe(12);
    expect(months[11].fiscalMonthIndex).toBe(11);
    expect(months[11].tracked).toBe(true);

    for (const m of months) {
      expect(m.tracked).toBe(true);
    }
  });

  it("returns 12 months for quarterly period, all tracked=false", () => {
    const months = generateAnalyticalMonths("quarterly");
    expect(months).toHaveLength(12);
    for (const m of months) {
      expect(m.tracked).toBe(false);
    }
  });

  it("returns 12 months for half-yearly period, all tracked=false", () => {
    const months = generateAnalyticalMonths("half-yearly");
    expect(months).toHaveLength(12);
    for (const m of months) {
      expect(m.tracked).toBe(false);
    }
  });

  it("returns 12 months for annual period, all tracked=false", () => {
    const months = generateAnalyticalMonths("annual");
    expect(months).toHaveLength(12);
    for (const m of months) {
      expect(m.tracked).toBe(false);
    }
  });
});

describe("bucketLabel", () => {
  it("returns month name for monthly period", () => {
    expect(bucketLabel("monthly", 0)).toBe("January");
    expect(bucketLabel("monthly", 11)).toBe("December");
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
  it("returns 12 months in calendar order (January through December)", () => {
    const months = fiscalMonths();
    expect(months).toHaveLength(12);

    expect(months[0].name).toBe("January");
    expect(months[0].index).toBe(1);
    expect(months[0].fiscalMonthIndex).toBe(0);

    expect(months[11].name).toBe("December");
    expect(months[11].index).toBe(12);
    expect(months[11].fiscalMonthIndex).toBe(11);

    const expectedNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    for (let i = 0; i < 12; i++) {
      expect(months[i].name).toBe(expectedNames[i]);
      expect(months[i].fiscalMonthIndex).toBe(i);
    }
  });
});
