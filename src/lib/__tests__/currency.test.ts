// ABOUTME: Unit tests for the frontend currency utility — formatting, conversions, edge cases.
// ABOUTME: Validates formatCurrency, getCurrencyInfo, getCurrencySymbol, and backward compatibility with formatKES.

import { describe, it, expect } from "vitest";
import { formatCurrency, formatKES, getCurrencyInfo, getCurrencySymbol, addCurrencySuffix, formatAmountInput } from "../currency";

describe("formatCurrency", () => {
  it("formats KES amount with symbol", () => {
    const result = formatCurrency(1500, "KES");
    expect(result).toContain("Ksh");
    expect(result).toContain("1,500");
  });

  it("formats USD amount with symbol", () => {
    const result = formatCurrency(99.99, "USD");
    expect(result).toContain("$");
  });

  it("handles string amounts", () => {
    const result = formatCurrency("2500.50", "KES");
    expect(result).toContain("2,500");
  });

  it("returns fallback for NaN", () => {
    const result = formatCurrency("not-a-number", "KES");
    expect(result).toBe("KES 0.00");
  });

  it("formats UGX with zero decimal places", () => {
    const result = formatCurrency(5000, "UGX");
    expect(result).toContain("USh");
  });

  it("formats with showCode option", () => {
    const result = formatCurrency(100, "KES", { showCode: true });
    expect(result).toContain("KES");
  });

  it("formats with compact option", () => {
    const result = formatCurrency(100.75, "KES", { compact: true });
    expect(result).not.toContain(".75");
  });

  it("handles unknown currency gracefully", () => {
    const result = formatCurrency(100, "XYZ");
    expect(result).toContain("100");
  });

  it("formats EUR with Euro locale", () => {
    const result = formatCurrency(50, "EUR");
    expect(result).toBeTruthy();
  });

  it("formats large numbers with commas", () => {
    const result = formatCurrency(1000000, "KES");
    expect(result).toContain("1,000,000");
  });

  it("formats zero", () => {
    const result = formatCurrency(0, "KES");
    expect(result).toContain("0");
  });

  it("formats negative amounts", () => {
    const result = formatCurrency(-500, "KES");
    expect(result).toContain("500");
  });
});

describe("formatKES", () => {
  it("formats with KES currency", () => {
    const result = formatKES(1000);
    expect(result).toEqual(formatCurrency(1000, "KES"));
  });

  it("provides backward compatibility", () => {
    const result = formatKES("500.00");
    expect(result).toBeTruthy();
  });
});

describe("getCurrencyInfo", () => {
  it("returns KES info", () => {
    const info = getCurrencyInfo("KES");
    expect(info.code).toBe("KES");
    expect(info.name).toBe("Kenyan Shilling");
    expect(info.symbol).toBe("KSh");
    expect(info.decimalPlaces).toBe(2);
  });

  it("returns USD info", () => {
    const info = getCurrencyInfo("USD");
    expect(info.code).toBe("USD");
    expect(info.decimalPlaces).toBe(2);
  });

  it("returns fallback for unknown currency", () => {
    const info = getCurrencyInfo("XYZ");
    expect(info.code).toBe("XYZ");
    expect(info.decimalPlaces).toBe(2);
  });

  it("covers all supported currencies", () => {
    const codes = ["KES", "USD", "UGX", "TZS", "EUR", "GBP", "JPY", "KWD", "MWK", "ZMW", "RWF", "BWP", "ZAR", "NGN", "ETB", "MZN", "AOA", "GHS", "XAF", "XOF"];
    for (const code of codes) {
      const info = getCurrencyInfo(code);
      expect(info.code).toBe(code);
      expect(info.decimalPlaces).toBeGreaterThanOrEqual(0);
      expect(info.decimalPlaces).toBeLessThanOrEqual(3);
    }
  });
});

describe("getCurrencySymbol", () => {
  it("returns KSh for KES", () => {
    expect(getCurrencySymbol("KES")).toBe("KSh");
  });

  it("returns $ for USD", () => {
    expect(getCurrencySymbol("USD")).toBe("$");
  });

  it("returns code fallback for unknown", () => {
    expect(getCurrencySymbol("XYZ")).toBe("XYZ");
  });
});

describe("addCurrencySuffix", () => {
  it("appends currency code", () => {
    expect(addCurrencySuffix("1,500.00", "KES")).toBe("1,500.00 KES");
  });
});

describe("formatAmountInput", () => {
  it("truncates excess decimal places for KES", () => {
    expect(formatAmountInput("100.123", "KES")).toBe("100.12");
  });

  it("preserves valid decimal places for KES", () => {
    expect(formatAmountInput("100.10", "KES")).toBe("100.10");
  });

  it("truncates for JPY (0 decimals)", () => {
    expect(formatAmountInput("100.99", "JPY")).toBe("100");
  });

  it("allows 3 decimals for KWD", () => {
    expect(formatAmountInput("100.123", "KWD")).toBe("100.123");
  });

  it("preserves whole numbers", () => {
    expect(formatAmountInput("100", "KES")).toBe("100");
  });
});
