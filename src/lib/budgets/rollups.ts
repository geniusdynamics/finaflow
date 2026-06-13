// ABOUTME: Computes bucket totals, analytical monthly splits, and full plan rollups for budget plans.
// ABOUTME: Uses decimal.js for all financial calculations to avoid floating-point rounding errors.

import Decimal from "decimal.js";
import type { Period } from "./fiscal-year";
import { d } from "../../../api/lib/decimal";

/**
 * Sums all line amounts for one bucket into a single total.
 */
export function computeBucketTotal(lines: { amount: string | number | Decimal }[]): Decimal {
  return lines.reduce((sum, line) => sum.plus(d(line.amount)), d(0));
}

/**
 * Splits a total amount into `parts` equal pieces using deterministic even-split
 * at cent precision. The remainder cents are distributed to the earliest parts
 * (first parts get 1 extra cent each).
 *
 * Used to derive analytical monthly values from bucket-level totals.
 */
export function computeAnalyticalSplit(
  total: Decimal | string | number,
  parts: number,
  _period?: Period,
): Decimal[] {
  const totalDec = d(total);
  const totalCents = totalDec.times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const baseCents = Decimal.floor(totalCents.div(parts));
  const remainderCents = totalCents.mod(parts).toNumber();

  const result: Decimal[] = [];
  for (let i = 0; i < parts; i++) {
    const amountCents = i < remainderCents ? baseCents.plus(1) : baseCents;
    result.push(amountCents.div(100));
  }
  return result;
}

/**
 * Computes a full plan rollup from buckets and their lines.
 *
 * Returns:
 *   grandTotal      - sum of all bucket totals
 *   bucketTotals    - map of bucketId -> total for that bucket
 *   analyticalMonths - 12 monthly amounts derived from bucket totals
 *                       (for monthly period, these equal bucket totals;
 *                        for others, totals are evenly split)
 */
export function computePlanRollup(
  plan: { period: Period },
  buckets: { id: number }[],
  linesByBucket: Record<number, { amount: string | number | Decimal }[]>,
): {
  grandTotal: Decimal;
  bucketTotals: Record<number, Decimal>;
  analyticalMonths: Decimal[];
} {
  const bucketTotals: Record<number, Decimal> = {};
  let grandTotal = d(0);

  for (const bucket of buckets) {
    const bucketLines = linesByBucket[bucket.id] ?? [];
    const total = computeBucketTotal(bucketLines);
    bucketTotals[bucket.id] = total;
    grandTotal = grandTotal.plus(total);
  }

  let analyticalMonths: Decimal[];

  switch (plan.period) {
    case "monthly": {
      // Each bucket is one tracked month. Analytical months = bucket totals
      // ordered by bucketIndex (buckets are already in fiscal order).
      analyticalMonths = buckets.map((b) => bucketTotals[b.id] ?? d(0));
      break;
    }
    case "quarterly": {
      // Each bucket covers 3 months. Split each quarter total into 3 monthly parts.
      analyticalMonths = [];
      for (const bucket of buckets) {
        const total = bucketTotals[bucket.id] ?? d(0);
        const split = computeAnalyticalSplit(total, 3, plan.period);
        analyticalMonths.push(...split);
      }
      break;
    }
    case "half-yearly": {
      // Each bucket covers 6 months. Split each half total into 6 monthly parts.
      analyticalMonths = [];
      for (const bucket of buckets) {
        const total = bucketTotals[bucket.id] ?? d(0);
        const split = computeAnalyticalSplit(total, 6, plan.period);
        analyticalMonths.push(...split);
      }
      break;
    }
    case "annual": {
      // Single bucket covers 12 months. Split total into 12 monthly parts.
      analyticalMonths = computeAnalyticalSplit(grandTotal, 12, plan.period);
      break;
    }
  }

  return { grandTotal, bucketTotals, analyticalMonths };
}
