// ABOUTME: Unit tests for rollups.ts — computeBucketTotal, computeAnalyticalSplit, computePlanRollup.
// ABOUTME: Validates deterministic even-split with remainder distribution and full plan rollup across all periods.

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import {
  computeBucketTotal,
  computeAnalyticalSplit,
  computePlanRollup,
} from "../rollups";
import { d } from "../../../../api/lib/decimal";

describe("computeBucketTotal", () => {
  it("sums amounts from multiple lines", () => {
    const lines = [
      { amount: "100.00" },
      { amount: "250.50" },
      { amount: "49.50" },
    ];
    const total = computeBucketTotal(lines);
    expect(total.toNumber()).toBe(400);
  });

  it("returns zero for empty lines array", () => {
    const total = computeBucketTotal([]);
    expect(total.toNumber()).toBe(0);
  });

  it("handles a single line", () => {
    const total = computeBucketTotal([{ amount: "1234.56" }]);
    expect(total.toNumber()).toBe(1234.56);
  });

  it("handles numeric and Decimal inputs", () => {
    const lines = [
      { amount: 100 },
      { amount: d("200.50") },
    ];
    const total = computeBucketTotal(lines);
    expect(total.toNumber()).toBe(300.5);
  });
});

describe("computeAnalyticalSplit", () => {
  describe("annual (12 parts)", () => {
    it("splits round amount evenly", () => {
      const result = computeAnalyticalSplit("1200.00", 12, "annual");
      expect(result).toHaveLength(12);
      for (const r of result) {
        expect(r.toNumber()).toBe(100);
      }
    });

    it("distributes remainder cents to earliest months", () => {
      // 100.00 / 12 = 8.333... -> baseCents = 833, remainder = 4 cents
      // 4 earliest months get 8.34, rest get 8.33
      const result = computeAnalyticalSplit("100.00", 12, "annual");
      expect(result).toHaveLength(12);

      // First 4 months get 8.34
      for (let i = 0; i < 4; i++) {
        expect(result[i].toNumber()).toBe(8.34);
      }
      // Remaining 8 months get 8.33
      for (let i = 4; i < 12; i++) {
        expect(result[i].toNumber()).toBe(8.33);
      }

      // Total should still equal 100.00
      const sum = result.reduce((acc, r) => acc.plus(r), d(0));
      expect(sum.toNumber()).toBe(100);
    });

    it("handles odd cents distribution", () => {
      // 10.01 / 12 = 0.834166... -> baseCents = 83, remainder = 5 cents
      // 5 earliest get 0.84, rest get 0.83
      const result = computeAnalyticalSplit("10.01", 12, "annual");
      expect(result).toHaveLength(12);

      for (let i = 0; i < 5; i++) {
        expect(result[i].toNumber()).toBe(0.84);
      }
      for (let i = 5; i < 12; i++) {
        expect(result[i].toNumber()).toBe(0.83);
      }

      const sum = result.reduce((acc, r) => acc.plus(r), d(0));
      expect(sum.toFixed(2)).toBe("10.01");
    });
  });

  describe("quarterly (3 parts)", () => {
    it("splits quarter total evenly", () => {
      const result = computeAnalyticalSplit("300.00", 3, "quarterly");
      expect(result).toHaveLength(3);
      for (const r of result) {
        expect(r.toNumber()).toBe(100);
      }
    });

    it("distributes remainder cents to earliest months", () => {
      // 100.00 / 3 = 33.333... -> baseCents = 3333, remainder = 1 cent
      const result = computeAnalyticalSplit("100.00", 3, "quarterly");
      expect(result).toHaveLength(3);

      expect(result[0].toNumber()).toBe(33.34);
      expect(result[1].toNumber()).toBe(33.33);
      expect(result[2].toNumber()).toBe(33.33);

      const sum = result.reduce((acc, r) => acc.plus(r), d(0));
      expect(sum.toNumber()).toBe(100);
    });

    it("handles tiny amounts", () => {
      // 0.01 / 3 = 0.00333... -> baseCents = 0, remainder = 1
      const result = computeAnalyticalSplit("0.01", 3, "quarterly");
      expect(result).toHaveLength(3);
      expect(result[0].toNumber()).toBe(0.01);
      expect(result[1].toNumber()).toBe(0);
      expect(result[2].toNumber()).toBe(0);
    });
  });

  describe("half-yearly (6 parts)", () => {
    it("splits half-year total evenly", () => {
      const result = computeAnalyticalSplit("600.00", 6, "half-yearly");
      expect(result).toHaveLength(6);
      for (const r of result) {
        expect(r.toNumber()).toBe(100);
      }
    });

    it("distributes remainder cents to earliest months", () => {
      // 100.00 / 6 = 16.666... -> baseCents = 1666, remainder = 4 cents
      const result = computeAnalyticalSplit("100.00", 6, "half-yearly");
      expect(result).toHaveLength(6);

      // First 4 months get 16.67
      for (let i = 0; i < 4; i++) {
        expect(result[i].toNumber()).toBe(16.67);
      }
      // Last 2 months get 16.66
      for (let i = 4; i < 6; i++) {
        expect(result[i].toNumber()).toBe(16.66);
      }

      const sum = result.reduce((acc, r) => acc.plus(r), d(0));
      expect(sum.toFixed(2)).toBe("100.00");
    });
  });

  it("handles zero total", () => {
    const result = computeAnalyticalSplit("0.00", 12, "annual");
    expect(result).toHaveLength(12);
    for (const r of result) {
      expect(r.toNumber()).toBe(0);
    }
  });
});

describe("computePlanRollup", () => {
  function makeBucket(id: number) {
    return { id };
  }

  function makeLine(amount: string) {
    return { amount };
  }

  describe("monthly period", () => {
    const plan = { period: "monthly" as const };
    const buckets = Array.from({ length: 12 }, (_, i) => makeBucket(i));

    it("analyticalMonths equal bucket totals for monthly period", () => {
      const linesByBucket: Record<number, { amount: string }[]> = {};
      for (let i = 0; i < 12; i++) {
        linesByBucket[i] = [makeLine(String((i + 1) * 100))];
      }

      const result = computePlanRollup(plan, buckets, linesByBucket);

      expect(result.bucketTotals[0].toNumber()).toBe(100);
      expect(result.bucketTotals[11].toNumber()).toBe(1200);
      expect(result.grandTotal.toNumber()).toBe(7800); // sum of 100+200+...+1200

      for (let i = 0; i < 12; i++) {
        expect(result.analyticalMonths[i].toNumber()).toBe((i + 1) * 100);
      }
    });

    it("handles empty lines", () => {
      const result = computePlanRollup(plan, buckets, {});
      expect(result.grandTotal.toNumber()).toBe(0);
      for (const m of result.analyticalMonths) {
        expect(m.toNumber()).toBe(0);
      }
    });
  });

  describe("quarterly period", () => {
    const plan = { period: "quarterly" as const };
    const buckets = [makeBucket(0), makeBucket(1), makeBucket(2), makeBucket(3)];

    it("splits each quarter into 3 monthly parts", () => {
      const linesByBucket: Record<number, { amount: string }[]> = {
        0: [makeLine("300.00")], // Q1 = 300 -> 100/mo
        1: [makeLine("600.00")], // Q2 = 600 -> 200/mo
        2: [makeLine("0.00")],   // Q3 = 0
        3: [makeLine("100.00")], // Q4 = 100 -> 33.34, 33.33, 33.33
      };

      const result = computePlanRollup(plan, buckets, linesByBucket);

      expect(result.bucketTotals[0].toNumber()).toBe(300);
      expect(result.bucketTotals[1].toNumber()).toBe(600);
      expect(result.grandTotal.toNumber()).toBe(1000);
      expect(result.analyticalMonths).toHaveLength(12);

      // Q1: 100, 100, 100
      expect(result.analyticalMonths[0].toNumber()).toBe(100);
      expect(result.analyticalMonths[1].toNumber()).toBe(100);
      expect(result.analyticalMonths[2].toNumber()).toBe(100);

      // Q2: 200, 200, 200
      expect(result.analyticalMonths[3].toNumber()).toBe(200);
      expect(result.analyticalMonths[4].toNumber()).toBe(200);
      expect(result.analyticalMonths[5].toNumber()).toBe(200);

      // Q3: 0, 0, 0
      expect(result.analyticalMonths[6].toNumber()).toBe(0);
      expect(result.analyticalMonths[7].toNumber()).toBe(0);
      expect(result.analyticalMonths[8].toNumber()).toBe(0);

      // Q4: 33.34, 33.33, 33.33
      expect(result.analyticalMonths[9].toNumber()).toBe(33.34);
      expect(result.analyticalMonths[10].toNumber()).toBe(33.33);
      expect(result.analyticalMonths[11].toNumber()).toBe(33.33);
    });
  });

  describe("half-yearly period", () => {
    const plan = { period: "half-yearly" as const };
    const buckets = [makeBucket(0), makeBucket(1)];

    it("splits each half into 6 monthly parts", () => {
      const linesByBucket: Record<number, { amount: string }[]> = {
        0: [makeLine("600.00")], // H1 = 600 -> 100/mo
        1: [makeLine("100.00")], // H2 = 100 -> 16.67 * 4 + 16.66 * 2
      };

      const result = computePlanRollup(plan, buckets, linesByBucket);

      expect(result.bucketTotals[0].toNumber()).toBe(600);
      expect(result.bucketTotals[1].toNumber()).toBe(100);
      expect(result.grandTotal.toNumber()).toBe(700);
      expect(result.analyticalMonths).toHaveLength(12);

      // H1: all 100
      for (let i = 0; i < 6; i++) {
        expect(result.analyticalMonths[i].toNumber()).toBe(100);
      }

      // H2: 16.67, 16.67, 16.67, 16.67, 16.66, 16.66
      for (let i = 6; i < 10; i++) {
        expect(result.analyticalMonths[i].toNumber()).toBe(16.67);
      }
      expect(result.analyticalMonths[10].toNumber()).toBe(16.66);
      expect(result.analyticalMonths[11].toNumber()).toBe(16.66);
    });
  });

  describe("annual period", () => {
    const plan = { period: "annual" as const };
    const buckets = [makeBucket(0)];

    it("splits total into 12 analytical months evenly", () => {
      const linesByBucket: Record<number, { amount: string }[]> = {
        0: [makeLine("1200.00")],
      };

      const result = computePlanRollup(plan, buckets, linesByBucket);

      expect(result.bucketTotals[0].toNumber()).toBe(1200);
      expect(result.grandTotal.toNumber()).toBe(1200);
      expect(result.analyticalMonths).toHaveLength(12);

      for (const m of result.analyticalMonths) {
        expect(m.toNumber()).toBe(100);
      }
    });

    it("distributes remainder cents across earliest months", () => {
      const linesByBucket: Record<number, { amount: string }[]> = {
        0: [makeLine("100.00")],
      };

      const result = computePlanRollup(plan, buckets, linesByBucket);

      expect(result.analyticalMonths).toHaveLength(12);
      // First 4 get 8.34, rest get 8.33
      for (let i = 0; i < 4; i++) {
        expect(result.analyticalMonths[i].toNumber()).toBe(8.34);
      }
      for (let i = 4; i < 12; i++) {
        expect(result.analyticalMonths[i].toNumber()).toBe(8.33);
      }
    });
  });
});
