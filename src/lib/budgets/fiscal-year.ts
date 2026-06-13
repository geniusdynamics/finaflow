// ABOUTME: Defines the Period and BudgetStatus union types and helpers for fiscal-year-aware budget plans.
// ABOUTME: Used by period, rollup, and validation modules to share common type and calendar constants.

export type Period = "monthly" | "quarterly" | "half-yearly" | "annual";
export type BudgetStatus = "draft" | "active" | "locked" | "archived";

const DEFAULT_FISCAL_YEAR_START = 4; // April

/**
 * Returns the default fiscal year start month.
 * Default is April (4), the start of the Kenyan financial year.
 */
export function getFiscalYearStart(): number {
  return DEFAULT_FISCAL_YEAR_START;
}

/**
 * Produces a human-readable fiscal year label.
 *
 * Examples:
 *   fiscalYearLabel(2025, 4) => "FY 2025/26"
 *   fiscalYearLabel(2025, 1) => "FY 2025"
 */
export function fiscalYearLabel(year: number, startMonth: number): string {
  if (startMonth > 1) {
    const shortYear = String(year + 1).slice(-2);
    return `FY ${year}/${shortYear}`;
  }
  return `FY ${year}`;
}
