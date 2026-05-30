// ABOUTME: Shared utilities to block future-dated financial transactions.
// ABOUTME: Exposes reusable predicates and zod builders for consistent validation.
import { z } from "zod";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function getTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isFutureDateString(value: string): boolean {
  if (!DATE_ONLY_REGEX.test(value)) return true;
  return value > getTodayDateKey();
}

export function notFutureDateString(fieldLabel: string) {
  return z
    .string()
    .regex(DATE_ONLY_REGEX, `${fieldLabel} must be in YYYY-MM-DD format`)
    .refine((value) => !isFutureDateString(value), `${fieldLabel} cannot be in the future`);
}

export function optionalNotFutureDateString(fieldLabel: string) {
  return z
    .string()
    .regex(DATE_ONLY_REGEX, `${fieldLabel} must be in YYYY-MM-DD format`)
    .optional()
    .refine((value) => value === undefined || !isFutureDateString(value), `${fieldLabel} cannot be in the future`);
}
