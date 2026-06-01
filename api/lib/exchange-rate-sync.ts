// ABOUTME: Background job that synchronizes exchange rates from external providers into the database.
// ABOUTME: Runs on configurable interval, logs sync results to console, falls back gracefully on errors.

import { currencyConverter } from "./currency-converter";

export interface SyncResult {
  success: boolean;
  currenciesUpdated: number;
  errors: string[];
  timestamp: Date;
}

export async function syncExchangeRates(): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    currenciesUpdated: 0,
    errors: [],
    timestamp: new Date(),
  };

  try {
    await currencyConverter.refreshRates();
    result.success = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown sync error";
    result.errors.push(msg);
    result.success = false;
  }

  return result;
}

export function startExchangeRateSync(intervalMs: number = 3_600_000): ReturnType<typeof setInterval> {
  console.log(`[ExchangeRateSync] Starting sync every ${Math.round(intervalMs / 60000)} minutes`);

  syncExchangeRates().then((result) => {
    console.log(`[ExchangeRateSync] Initial sync: ${result.success ? "OK" : "FAILED"}`);
  });

  return setInterval(async () => {
    try {
      const result = await syncExchangeRates();
      if (result.success) {
        console.log(`[ExchangeRateSync] Sync completed at ${result.timestamp.toISOString()}`);
      } else {
        console.error(`[ExchangeRateSync] Sync failed: ${result.errors.join(", ")}`);
      }
    } catch (err) {
      console.error(`[ExchangeRateSync] Sync error:`, err);
    }
  }, intervalMs);
}

export function validateEnvConfig(): boolean {
  const provider = process.env.EXCHANGE_RATE_PROVIDER;
  if (provider && provider !== "manual" && provider !== "frankfurter" && !process.env.EXCHANGE_RATE_API_KEY) {
    console.warn(`[ExchangeRateSync] Provider "${provider}" configured but EXCHANGE_RATE_API_KEY is missing. Using manual mode.`);
    return false;
  }
  return true;
}
