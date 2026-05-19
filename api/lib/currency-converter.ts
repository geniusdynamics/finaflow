// ABOUTME: Provides centralized currency conversion with caching, fallback chains, and exchange rate management.
// ABOUTME: Supports KES→KES passthrough, in-memory TTL cache, DB fallback, and external provider sync.

import { d, Decimal } from "./decimal";
import { getDb } from "../queries/connection";
import { exchangeRates, supportedCurrencies } from "@db/schema";
import { eq, and, desc, isNull, sql } from "drizzle-orm";

export interface ConversionResult {
  converted: Decimal;
  rate: Decimal;
  fee?: Decimal;
}

export interface ExchangeRateData {
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  source: string;
  validFrom: Date;
  validUntil: Date | null;
}

interface CacheEntry {
  rate: Decimal;
  timestamp: number;
  source: string;
}

const DEFAULT_CACHE_TTL = 300_000; // 5 minutes
const STALE_AGE_WARNING = 86_400_000; // 24 hours
const DEFAULT_BASE_CURRENCY = "KES";

export class CurrencyConverter {
  private cache = new Map<string, CacheEntry>();
  private cacheTTL: number;
  private baseCurrency: string;
  private apiKey?: string;
  private provider: string;

  constructor(config?: {
    cacheTTL?: number;
    baseCurrency?: string;
    apiKey?: string;
    provider?: string;
  }) {
    this.cacheTTL = config?.cacheTTL ?? DEFAULT_CACHE_TTL;
    this.baseCurrency = config?.baseCurrency ?? DEFAULT_BASE_CURRENCY;
    this.apiKey = config?.apiKey;
    this.provider = config?.provider ?? "manual";
  }

  private cacheKey(from: string, to: string): string {
    return `${from}:${to}`;
  }

  private isCacheValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < this.cacheTTL;
  }

  private isStale(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > STALE_AGE_WARNING;
  }

  async getRate(from: string, to: string): Promise<Decimal> {
    if (from === to) return d(1);

    const key = this.cacheKey(from, to);
    const cached = this.cache.get(key);

    if (cached && this.isCacheValid(cached)) {
      if (this.isStale(cached)) {
        console.warn(`[CurrencyConverter] Stale rate: ${from}→${to} (cached ${Math.floor((Date.now() - cached.timestamp) / 1000)}s ago)`);
      }
      return cached.rate;
    }

    const dbRate = await this.fetchRateFromDb(from, to);
    if (dbRate) {
      this.cache.set(key, { rate: d(dbRate.rate), timestamp: Date.now(), source: dbRate.source });
      return d(dbRate.rate);
    }

    if (this.provider !== "manual" && this.apiKey) {
      const externalRate = await this.fetchRateFromProvider(from, to);
      if (externalRate) {
        const rate = d(externalRate);
        this.cache.set(key, { rate, timestamp: Date.now(), source: this.provider });
        await this.persistRate(from, to, externalRate, this.provider);
        return rate;
      }
    }

    // If cannot find direct rate, try via base currency
    if (from !== this.baseCurrency && to !== this.baseCurrency) {
      const fromBase = await this.getRate(from, this.baseCurrency);
      const toBase = await this.getRate(this.baseCurrency, to);
      const crossRate = fromBase.mul(toBase);
      this.cache.set(key, { rate: crossRate, timestamp: Date.now(), source: "cross" });
      return crossRate;
    }

    throw new Error(`No exchange rate available for ${from}→${to}`);
  }

  async convert(
    amount: Decimal,
    from: string,
    to: string,
    options?: { round?: boolean; decimalPlaces?: number }
  ): Promise<ConversionResult> {
    if (from === to) {
      return { converted: amount, rate: d(1) };
    }

    const rate = await this.getRate(from, to);
    let converted = amount.mul(rate);

    if (options?.round !== false) {
      const places = options?.decimalPlaces ?? 2;
      converted = converted.toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
    }

    return { converted, rate };
  }

  async batchConvert(
    amounts: Array<{ amount: Decimal; currency: string }>,
    toCurrency: string
  ): Promise<Decimal> {
    if (amounts.length === 0) return d(0);

    let total = d(0);
    for (const { amount, currency } of amounts) {
      const { converted } = await this.convert(amount, currency, toCurrency);
      total = total.plus(converted);
    }
    return total;
  }

  async refreshRates(): Promise<void> {
    this.cache.clear();

    if (this.provider !== "manual" && this.apiKey) {
      const currencies = await this.getActiveCurrencies();
      for (const currency of currencies) {
        if (currency.code === this.baseCurrency) continue;
        try {
          const rate = await this.fetchRateFromProvider(currency.code, this.baseCurrency);
          if (rate) {
            await this.persistRate(currency.code, this.baseCurrency, rate, this.provider);
            const inverse = d(1).div(d(rate));
            await this.persistRate(this.baseCurrency, currency.code, inverse.toFixed(8), this.provider);
          }
        } catch (err) {
          console.error(`[CurrencyConverter] Failed to refresh rate for ${currency.code}:`, err);
        }
      }
    }
  }

  async getLatestRates(): Promise<ExchangeRateData[]> {
    const rows = await getDb()
      .select()
      .from(exchangeRates)
      .where(isNull(exchangeRates.validUntil))
      .orderBy(desc(exchangeRates.createdAt));

    return rows.map((r) => ({
      fromCurrency: r.fromCurrency,
      toCurrency: r.toCurrency,
      rate: r.rate,
      source: r.source ?? "manual",
      validFrom: r.validFrom,
      validUntil: r.validUntil,
    }));
  }

  invalidateCache(from?: string, to?: string): void {
    if (from && to) {
      this.cache.delete(this.cacheKey(from, to));
    } else if (from) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${from}:`)) this.cache.delete(key);
      }
    } else {
      this.cache.clear();
    }
  }

  private async fetchRateFromDb(from: string, to: string): Promise<{ rate: string; source: string } | null> {
    const row = await getDb()
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.fromCurrency, from),
          eq(exchangeRates.toCurrency, to),
          isNull(exchangeRates.validUntil)
        )
      )
      .limit(1);

    if (row.length > 0) {
      return { rate: row[0].rate, source: row[0].source ?? "database" };
    }

    // Try inverse rate
    const inverseRow = await getDb()
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.fromCurrency, to),
          eq(exchangeRates.toCurrency, from),
          isNull(exchangeRates.validUntil)
        )
      )
      .limit(1);

    if (inverseRow.length > 0) {
      const inverseRate = d(inverseRow[0].rate);
      if (inverseRate.isZero()) return null;
      return { rate: d(1).div(inverseRate).toFixed(8), source: `${inverseRow[0].source ?? "database"} (inverse)` };
    }

    return null;
  }

  private async fetchRateFromProvider(from: string, to: string): Promise<string | null> {
    try {
      const url = `https://v6.exchangerate-api.com/v6/${this.apiKey}/pair/${from}/${to}`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json() as { conversion_rate: number };
      return data.conversion_rate?.toString() ?? null;
    } catch (err) {
      console.error(`[CurrencyConverter] External provider error:`, err);
      return null;
    }
  }

  private async persistRate(from: string, to: string, rate: string, source: string): Promise<void> {
    await getDb()
      .insert(exchangeRates)
      .values({
        fromCurrency: from,
        toCurrency: to,
        rate,
        source,
        validFrom: new Date(),
      });
  }

  private async getActiveCurrencies(): Promise<Array<{ code: string }>> {
    const rows = await getDb()
      .select({ code: supportedCurrencies.code })
      .from(supportedCurrencies)
      .where(eq(supportedCurrencies.isActive, true));
    return rows;
  }
}

export const currencyConverter = new CurrencyConverter({
  provider: process.env.EXCHANGE_RATE_PROVIDER ?? "manual",
  apiKey: process.env.EXCHANGE_RATE_API_KEY,
  baseCurrency: process.env.EXCHANGE_RATE_BASE_CURRENCY ?? "KES",
});
