// ABOUTME: Human-readable institution names for statement providers.
// ABOUTME: Used by coverage tables and report headers for both bank and mobile-money statements.

import type { StatementProvider } from "./types";

const LABELS: Record<StatementProvider, string> = {
  mpesa: "M-PESA",
  airtel_money: "Airtel Money",
  sasapay: "SasaPay",
  bank: "Bank",
};

export function providerDisplayName(provider: StatementProvider): string {
  return LABELS[provider] ?? provider.toUpperCase();
}
