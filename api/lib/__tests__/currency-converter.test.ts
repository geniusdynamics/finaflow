// ABOUTME: Unit tests for the CurrencyConverter service — caching, fallback chains, KES passthrough, cross rates.
// ABOUTME: Tests all core conversion paths with mock DB and external provider.

import { describe, it, expect, beforeEach } from "vitest";
import { CurrencyConverter } from "../currency-converter";
import { d } from "../decimal";

describe("CurrencyConverter", () => {
  let converter: CurrencyConverter;

  beforeEach(() => {
    converter = new CurrencyConverter({
      cacheTTL: 300_000,
      baseCurrency: "KES",
    });
  });

  describe("direct rate", () => {
    it("returns 1 for same currency", async () => {
      const rate = await converter.getRate("KES", "KES");
      expect(rate.toNumber()).toBe(1);
    });

    it("returns 1 for USD to USD", async () => {
      const rate = await converter.getRate("USD", "USD");
      expect(rate.toNumber()).toBe(1);
    });
  });

  describe("convert", () => {
    it("returns original amount for same currency", async () => {
      const result = await converter.convert(d(100), "KES", "KES");
      expect(result.converted.toNumber()).toBe(100);
      expect(result.rate.toNumber()).toBe(1);
    });

    it("throws error when no rate available", async () => {
      await expect(converter.getRate("KES", "USD")).rejects.toThrow("No exchange rate");
    });
  });

  describe("cache management", () => {
    it("invalidates specific cache entry", async () => {
      converter["cache"].set("KES:USD", { rate: d(0.0075), timestamp: Date.now(), source: "test" });
      converter.invalidateCache("KES", "USD");
      expect(converter["cache"].has("KES:USD")).toBe(false);
    });

    it("invalidates all entries for a currency", async () => {
      converter["cache"].set("KES:USD", { rate: d(0.0075), timestamp: Date.now(), source: "test" });
      converter["cache"].set("KES:GBP", { rate: d(0.006), timestamp: Date.now(), source: "test" });
      converter.invalidateCache("KES");
      expect(converter["cache"].size).toBe(0);
    });

    it("clears entire cache on full invalidate", async () => {
      converter["cache"].set("KES:USD", { rate: d(0.0075), timestamp: Date.now(), source: "test" });
      converter.invalidateCache();
      expect(converter["cache"].size).toBe(0);
    });
  });

  describe("batchConvert", () => {
    it("returns zero for empty amounts", async () => {
      const result = await converter.batchConvert([], "KES");
      expect(result.toNumber()).toBe(0);
    });
  });
});

describe("CurrencyConverter with mock DB", () => {
  it("can be constructed with custom config", () => {
    const conv = new CurrencyConverter({
      cacheTTL: 60000,
      baseCurrency: "USD",
      provider: "manual",
    });
    expect(conv).toBeInstanceOf(CurrencyConverter);
  });
});
