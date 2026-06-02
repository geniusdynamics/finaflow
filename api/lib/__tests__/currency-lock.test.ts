// ABOUTME: Unit tests for currency lock validation — M-PESA KES-only enforcement, conversion disclosures.
// ABOUTME: Validates that provider currency constraints are correctly enforced.

import { describe, it, expect } from "vitest";
import { validateProviderCurrency } from "../mobile-wallet/currency-lock";

describe("validateProviderCurrency", () => {
  const mpesaCurrencies = ["KES"];

  it("passes for supported currency", () => {
    const result = validateProviderCurrency("M-PESA", "KES", mpesaCurrencies);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("fails for unsupported currency", () => {
    const result = validateProviderCurrency("M-PESA", "USD", mpesaCurrencies);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("only supports");
    expect(result.error).toContain("KES");
    expect(result.suggestedAction).toContain("Convert");
  });

  it("fails for UGX on M-PESA", () => {
    const result = validateProviderCurrency("M-PESA", "UGX", mpesaCurrencies);
    expect(result.valid).toBe(false);
    expect(result.suggestedAction).toContain("KES");
  });

  it("passes for multiple supported currencies", () => {
    const multiCurrencies = ["KES", "UGX", "TZS"];
    const result = validateProviderCurrency("Airtel Money", "UGX", multiCurrencies);
    expect(result.valid).toBe(true);
  });

  it("fails for currency not in multi-currency list", () => {
    const multiCurrencies = ["KES", "UGX", "TZS"];
    const result = validateProviderCurrency("Airtel Money", "USD", multiCurrencies);
    expect(result.valid).toBe(false);
  });
});
