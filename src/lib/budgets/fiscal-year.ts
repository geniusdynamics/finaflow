// ABOUTME: Defines the Period and BudgetStatus union types and helpers for fiscal-year-aware budget plans.
// ABOUTME: Supports configurable fiscal year start month (1=Jan, 12=Dec). Default is 4 (April, Kenyan FY).

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

/**
 * Returns the month names offset by the fiscal year start month.
 * E.g., if startMonth is 4 (April), returns:
 * ["April", "May", "June", "July", "August", "September",
 *  "October", "November", "December", "January", "February", "March"]
 */
export function fiscalYearMonthNames(startMonth: number): string[] {
  const allMonths = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const offset = startMonth - 1;
  return [...allMonths.slice(offset), ...allMonths.slice(0, offset)];
}

/**
 * Maps a calendar month number (1-12) to its display name based on fiscal year offset.
 * The first month of the fiscal year is at index 0.
 */
export function calendarMonthToFiscalLabel(
  calendarMonth: number,
  startMonth: number,
): string {
  const names = fiscalYearMonthNames(startMonth);
  const fiscalIndex = ((calendarMonth - startMonth + 12) % 12);
  return names[fiscalIndex];
}
