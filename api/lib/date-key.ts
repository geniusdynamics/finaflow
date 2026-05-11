// ABOUTME: Normalizes values into stable local YYYY-MM-DD keys.
// ABOUTME: Used for date-bounded reporting windows and chart aggregation buckets.

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function toLocalDateKey(dateValue: Date | string): string {
  if (typeof dateValue === "string" && DATE_ONLY_REGEX.test(dateValue)) {
    return dateValue;
  }

  const dt = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(dt.getTime())) {
    throw new Error("Invalid date value");
  }

  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}
