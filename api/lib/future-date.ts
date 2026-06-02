// ABOUTME: Shared utilities to block future-dated financial transactions.
// ABOUTME: Exposes reusable predicates and zod builders for consistent validation.
import { z } from "zod";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function getTodayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
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
