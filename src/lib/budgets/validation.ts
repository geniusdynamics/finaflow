// ABOUTME: Provides type guards, constant arrays, and validation functions for budget periods and statuses.
// ABOUTME: Used to validate user input before creating or updating budget plans.

import type { Period, BudgetStatus } from "./fiscal-year";

export const ALL_PERIODS: Period[] = ["monthly", "quarterly", "half-yearly", "annual"];

export const ALL_STATUSES: BudgetStatus[] = ["draft", "active", "locked", "archived"];

/**
 * Type guard that checks whether a value is a valid Period.
 */
export function isPeriod(val: unknown): val is Period {
  return ALL_PERIODS.includes(val as Period);
}

/**
 * Type guard that checks whether a value is a valid BudgetStatus.
 */
export function isStatus(val: unknown): val is BudgetStatus {
  return ALL_STATUSES.includes(val as BudgetStatus);
}

/**
 * Validates a period value. Throws an error if invalid.
 */
export function validatePeriod(period: unknown): asserts period is Period {
  if (!isPeriod(period)) {
    throw new Error(
      `Invalid period: "${String(period)}". Expected one of: ${ALL_PERIODS.join(", ")}`,
    );
  }
}

/**
 * Validates budget bucket lines. Throws an error if:
 * - lines array is empty
 * - any line has a non-positive amount
 */
export function validateBudgetLines(
  lines: { amount: string | number }[],
): void {
  if (!lines.length) {
    throw new Error("Budget lines must contain at least one entry.");
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const amount = Number(line.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      throw new Error(
        `Line ${i + 1} has an invalid amount: "${String(line.amount)}". Amount must be a positive number.`,
      );
    }
  }
}
