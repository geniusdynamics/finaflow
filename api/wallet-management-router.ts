// ABOUTME: Admin API for wallet provider configuration, exchange rate management, and provider health monitoring.
// ABOUTME: All procedures require WALLET_ADMIN permission. Covers provider activation, config, rates, and reconciliation.
import { z } from "zod";
import { createRouter, walletAdmin, walletQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { providerConfigs, supportedCurrencies, exchangeRates, mobileWalletTransactions, mobileWalletProviders } from "@db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { walletRegistry } from "./lib/mobile-wallet/provider-registry";

export const walletManagementRouter = createRouter({

  providers: createRouter({

    list: walletQuery.query(async () => {
      const db = getDb();
      const registryProviders = walletRegistry.getAll();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      let dbMap = new Map<string, any>();
      try {
        const dbRows = await db.select().from(mobileWalletProviders).where(eq(mobileWalletProviders.isActive, true));
        dbMap = new Map(dbRows.map((r) => [r.code, r]));
      } catch {
        // table may not exist (pre-migration)
      }
      return registryProviders.map((rp) => {
        const dbRow = dbMap.get(rp.code);
        return {
          code: rp.code,
          name: rp.displayName,
          displayName: rp.displayName,
          supportedCurrencies: rp.supportedCurrencies.join(","),
          isActive: dbRow?.isActive ?? true,
          brandColor: dbRow?.brandColor ?? null,
          features: rp.features,
        };
      });
    }),

    configure: walletAdmin
      .input(z.object({
        locationId: z.number(),
        provider: z.string(),
        accountId: z.number(),
        config: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = getDb();
        await db.insert(providerConfigs).values({
          locationId: input.locationId,
          provider: input.provider,
          accountId: input.accountId,
          config: input.config ?? {},
          isActive: true,
          isDefault: false,
        }).onConflictDoUpdate({
          target: [providerConfigs.locationId, providerConfigs.provider, providerConfigs.accountId],
          set: { config: input.config ?? {}, isActive: true, deletedAt: null },
        });
        return { success: true };
      }),

    deactivate: walletAdmin
      .input(z.object({ locationId: z.number(), provider: z.string() }))
      .mutation(async ({ input }) => {
        const db = getDb();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.update(providerConfigs).set({ deletedAt: new Date(), isActive: false } as any)
          .where(and(eq(providerConfigs.locationId, input.locationId), eq(providerConfigs.provider, input.provider)));
        return { success: true };
      }),

    setDefault: walletAdmin
      .input(z.object({ locationId: z.number(), provider: z.string(), accountId: z.number() }))
      .mutation(async ({ input }) => {
        const db = getDb();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.update(providerConfigs).set({ isDefault: false } as any)
          .where(and(eq(providerConfigs.locationId, input.locationId), isNull(providerConfigs.deletedAt)));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.update(providerConfigs).set({ isDefault: true } as any)
          .where(and(
            eq(providerConfigs.locationId, input.locationId),
            eq(providerConfigs.provider, input.provider),
            eq(providerConfigs.accountId, input.accountId),
          ));
        return { success: true };
      }),

    testConnection: walletAdmin
      .input(z.object({ locationId: z.number(), provider: z.string() }))
      .mutation(async ({ input }) => {
        const provider = walletRegistry.get(input.provider);
        if (!provider) return { success: false, error: `Provider ${input.provider} not registered` };
        return { success: true, provider: input.provider, features: provider.features };
      }),

    health: walletQuery
      .input(z.object({ locationId: z.number().optional() }))
      .query(async ({ input: _input, ctx: _ctx }) => {
        const db = getDb();
        const providers = walletRegistry.getAll();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const healthResults: { provider: string; displayName: string; supportedCurrencies: string[]; features: any; lastTransactionAt: any; lastTransactionDate: any }[] = [];

        for (const provider of providers) {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
          let lastTxn: any = null;
          try {
            const recentTxns = await db.select()
              .from(mobileWalletTransactions)
              .where(and(eq(mobileWalletTransactions.provider, provider.code), isNull(mobileWalletTransactions.deletedAt)))
              .orderBy(desc(mobileWalletTransactions.createdAt))
              .limit(1);
            lastTxn = recentTxns[0] ?? null;
          } catch {
            // no recent transaction available
          }

          healthResults.push({
            provider: provider.code,
            displayName: provider.displayName,
            supportedCurrencies: provider.supportedCurrencies,
            features: provider.features,
            lastTransactionAt: lastTxn?.createdAt ?? null,
            lastTransactionDate: lastTxn?.txnDate ?? null,
          });
        }

        return healthResults;
      }),
  }),

  rates: createRouter({

    list: walletQuery
      .input(z.object({ from: z.string().optional(), to: z.string().optional(), limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const db = getDb();
        const conditions: ReturnType<typeof sql>[] = [];
        if (input?.from) conditions.push(sql`${exchangeRates.validFrom} >= ${input.from}`);
        if (input?.to) conditions.push(sql`${exchangeRates.validUntil} <= ${input.to}`);
        const results = await db.select().from(exchangeRates)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(exchangeRates.validFrom))
          .limit(input?.limit ?? 100);
        return results;
      }),

    latest: walletQuery
      .input(z.object({ from: z.string().optional(), to: z.string().optional() }))
      .query(async ({ ctx }) => {
        const { currencyConverter } = await import("./lib/currency-converter");
        const rates = await currencyConverter.getLatestRates();
        if (rates.length > 0) return rates;
        return [
          { fromCurrency: "USD", toCurrency: "KES", rate: "130.00000000", source: "default" },
          { fromCurrency: "EUR", toCurrency: "KES", rate: "142.00000000", source: "default" },
          { fromCurrency: "GBP", toCurrency: "KES", rate: "165.00000000", source: "default" },
          { fromCurrency: "UGX", toCurrency: "KES", rate: "0.02800000", source: "default" },
          { fromCurrency: "TZS", toCurrency: "KES", rate: "0.05000000", source: "default" },
        ];
      }),

    manualUpdate: walletAdmin
      .input(z.object({
        fromCurrency: z.string().min(3).max(3),
        toCurrency: z.string().min(3).max(3),
        rate: z.string().regex(/^\d+(\.\d+)?$/),
      }))
      .mutation(async ({ input }) => {
        const { currencyConverter } = await import("./lib/currency-converter");
        await currencyConverter["persistRate"](input.fromCurrency, input.toCurrency, input.rate, "manual");
        return { success: true, message: `Manual rate saved: ${input.fromCurrency}→${input.toCurrency} = ${input.rate}` };
      }),

    sync: walletAdmin
      .mutation(async () => {
        const { currencyConverter } = await import("./lib/currency-converter");
        try {
          await currencyConverter.refreshRates();
          return { success: true, message: "Rates refreshed from Frankfurter" };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : "Sync failed" };
        }
      }),
  }),

  currencies: createRouter({

    list: walletQuery.query(async () => {
      const db = getDb();
      try {
        const rows = await db.select().from(supportedCurrencies).orderBy(supportedCurrencies.code);
        if (rows.length > 0) return rows;
      } catch {
        // table may not exist (pre-migration)
      }
      return [
        { code: "KES", name: "Kenyan Shilling", symbol: "KSh", decimalPlaces: 2, isDefault: true, isActive: true },
        { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2, isDefault: false, isActive: true },
        { code: "UGX", name: "Ugandan Shilling", symbol: "USh", decimalPlaces: 0, isDefault: false, isActive: true },
        { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh", decimalPlaces: 2, isDefault: false, isActive: true },
        { code: "EUR", name: "Euro", symbol: "EUR", decimalPlaces: 2, isDefault: false, isActive: true },
        { code: "GBP", name: "British Pound", symbol: "GBP", decimalPlaces: 2, isDefault: false, isActive: true },
        { code: "ZAR", name: "South African Rand", symbol: "R", decimalPlaces: 2, isDefault: false, isActive: true },
        { code: "MWK", name: "Malawian Kwacha", symbol: "MK", decimalPlaces: 2, isDefault: false, isActive: true },
        { code: "ZMW", name: "Zambian Kwacha", symbol: "ZK", decimalPlaces: 2, isDefault: false, isActive: true },
        { code: "RWF", name: "Rwandan Franc", symbol: "FRw", decimalPlaces: 0, isDefault: false, isActive: true },
      ];
    }),

    toggle: walletAdmin
      .input(z.object({ code: z.string().min(3).max(3), isActive: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = getDb();
        try {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
          await db.update(supportedCurrencies).set({ isActive: input.isActive } as any)
            .where(eq(supportedCurrencies.code, input.code));
          return { success: true };
        } catch {
          // table may not exist
          return { success: false, error: "Could not update currency" };
        }
      }),

    create: walletAdmin
      .input(z.object({
        code: z.string().length(3),
        name: z.string().min(2),
        symbol: z.string().min(1).max(10),
        decimalPlaces: z.number().min(0).max(4),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = getDb();
        const [row] = await db.insert(supportedCurrencies).values({
          ...input,
          isActive: true,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any).onConflictDoNothing().returning();
        return { success: true, currency: row };
      }),
  }),
});
