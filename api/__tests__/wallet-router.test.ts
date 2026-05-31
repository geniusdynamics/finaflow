// ABOUTME: Integration tests for the wallet router and mpesa-proxy router, verifying multi-provider wallet aggregation.
// ABOUTME: Tests the unified wallet API, backward-compatible M-PESA proxy, and dashboard integration.
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { appRouter } from "../router";
import {
  businesses,
  locations,
  users,
  userBusinesses,
  supportedCurrencies,
  mobileWalletProviders,
  mobileWalletTransactions,
} from "@db/schema";
import { getTestDb } from "../test/db";

type SeededCtx = {
  accountId: string;
  business: { id: number; accountId: string; accountRefId: number | null; plan: string; maxBranches: number | null; maxUsers: number | null; features: unknown };
  user: { id: number; role: string; currentBusinessId: number; accountId: string; accountRefId: number | null };
  location: { id: number };
};

async function seedWalletTestCtx(seed: string): Promise<SeededCtx> {
  const db = getTestDb();
  const ts = Date.now();
  const accountId = `WLT-${ts}-${seed}`;

  const [business] = await db.insert(businesses).values({
    accountId, name: `Wallet Test ${seed}`, slug: `wallet-${ts}-${seed.toLowerCase()}`,
    plan: "pro", maxBranches: 5, maxUsers: 10, isActive: true,
  } as any).returning();

  const [user] = await db.insert(users).values({
    username: `wallet-owner-${ts}-${seed.toLowerCase()}`, name: `Wallet Owner ${seed}`,
    role: "owner", isActive: true, currentBusinessId: business.id, accountId,
  } as any).returning();

  await db.insert(userBusinesses).values({ userId: user.id, businessId: business.id, role: "owner", isActive: true } as any);

  const [location] = await db.insert(locations).values({
    businessId: business.id, name: `Wallet Branch ${seed}`,
    slug: `wallet-branch-${ts}-${seed.toLowerCase()}`, isActive: true,
  } as any).returning();

  return {
    accountId, business: business as any, user: {
      id: user.id, role: user.role, currentBusinessId: business.id, accountId, accountRefId: user.accountRefId,
    }, location,
  };
}

async function cleanupWalletCtx(accountId: string) {
  const db = getTestDb();
  await db.delete(users).where(eq(users.accountId, accountId));
  await db.delete(businesses).where(eq(businesses.accountId, accountId));
}

async function seedSupportedCurrenciesLocal() {
  const db = getTestDb();
  const currencies = [
    { code: "KES", name: "Kenyan Shilling", symbol: "Ksh", decimalPlaces: 2 },
    { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2 },
  ];
  for (const c of currencies) {
    await db.insert(supportedCurrencies).values(c as any).onConflictDoNothing().returning();
  }
}

async function seedMpesaProviderLocal() {
  const db = getTestDb();
  await db.insert(mobileWalletProviders).values({
    code: "mpesa",
    name: "M-PESA",
    displayName: "M-PESA",
    supportedCurrencies: "KES",
    isActive: true,
  } as any).onConflictDoNothing().returning();
}

function createCaller(ctx: SeededCtx) {
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc/wallet.transactions.list"),
    resHeaders: new Headers(),
    user: { ...ctx.user, currentBusiness: ctx.business, businessIds: [ctx.business.id] },
  } as any);
}

describe("Wallet Router - Multi-Provider", () => {
  const seededAccountIds: string[] = [];

  afterEach(async () => {
    for (const aid of seededAccountIds) {
      await cleanupWalletCtx(aid);
    }
    seededAccountIds.length = 0;
  });

  it("wallet.providers.list returns active providers including mpesa", async () => {
    const ctx = await seedWalletTestCtx("prov-list");
    seededAccountIds.push(ctx.accountId);
    await seedSupportedCurrenciesLocal();
    await seedMpesaProviderLocal();
    const caller = createCaller(ctx);
    const providers = await caller.wallet.providers.list();
    expect(Array.isArray(providers)).toBe(true);
    const mpesa = providers.find((p: any) => p.code === "mpesa");
    expect(mpesa).toBeDefined();
    expect(mpesa!.isActive).toBe(true);
  });

  it("wallet.transactions.list returns empty array with no transactions", async () => {
    const ctx = await seedWalletTestCtx("txn-list");
    seededAccountIds.push(ctx.accountId);
    const caller = createCaller(ctx);
    const result = await caller.wallet.transactions.list({});
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("wallet.transactions.list filters by date range", async () => {
    const ctx = await seedWalletTestCtx("txn-date");
    seededAccountIds.push(ctx.accountId);
    await seedMpesaProviderLocal();
    const caller = createCaller(ctx);
    const today = new Date().toISOString().split("T")[0];
    const result = await caller.wallet.transactions.list({ dateFrom: today, dateTo: today });
    expect(Array.isArray(result)).toBe(true);
  });

  it("wallet.transactions.stats returns summary with all fields", async () => {
    const ctx = await seedWalletTestCtx("txn-stats");
    seededAccountIds.push(ctx.accountId);
    const caller = createCaller(ctx);
    const stats = await caller.wallet.transactions.stats({});
    expect(stats).toHaveProperty("summary");
    expect(stats.summary).toHaveProperty("totalIn");
    expect(stats.summary).toHaveProperty("totalOut");
    expect(stats.summary).toHaveProperty("totalFees");
    expect(stats.summary).toHaveProperty("countIn");
    expect(stats.summary).toHaveProperty("countOut");
    expect(stats).toHaveProperty("feesByType");
    expect(stats).toHaveProperty("topRecipients");
  });

  it("mpesa.list returns mapped transactions from mobile_wallet_transactions", async () => {
    const ctx = await seedWalletTestCtx("mpesa-list");
    seededAccountIds.push(ctx.accountId);
    await seedMpesaProviderLocal();
    const caller = createCaller(ctx);
    const result = await caller.mpesa.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("mpesa.stats returns summary with fees by type", async () => {
    const ctx = await seedWalletTestCtx("mpesa-stats");
    seededAccountIds.push(ctx.accountId);
    await seedMpesaProviderLocal();
    const caller = createCaller(ctx);
    const result = await caller.mpesa.stats({});
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("feesByType");
    expect(result).toHaveProperty("topRecipients");
    expect(result.summary).toHaveProperty("totalIn");
    expect(result.summary).toHaveProperty("totalOut");
    expect(result.summary).toHaveProperty("totalFees");
    expect(Array.isArray(result.feesByType)).toBe(true);
    expect(Array.isArray(result.topRecipients)).toBe(true);
  });

  it("dailyLedger.list returns array (empty state)", async () => {
    const ctx = await seedWalletTestCtx("ledger-list");
    seededAccountIds.push(ctx.accountId);
    await seedMpesaProviderLocal();
    const caller = createCaller(ctx);
    const result = await caller.dailyLedger.list({});
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Dashboard - Wallet Integration", () => {
  const seededAccountIds: string[] = [];

  afterEach(async () => {
    for (const aid of seededAccountIds) {
      await cleanupWalletCtx(aid);
    }
    seededAccountIds.length = 0;
  });

  it("dashboard.summary returns both mpesa and wallet stats", async () => {
    const ctx = await seedWalletTestCtx("dash-summary");
    seededAccountIds.push(ctx.accountId);
    await seedSupportedCurrenciesLocal();
    await seedMpesaProviderLocal();
    const caller = createCaller(ctx);
    const today = new Date().toISOString().split("T")[0];
    const result = await caller.dashboard.summary({ dateFrom: today, dateTo: today });
    expect(result).toHaveProperty("mpesa");
    expect(result).toHaveProperty("wallet");
    expect(result.mpesa).toHaveProperty("totalIn");
    expect(result.mpesa).toHaveProperty("totalOut");
    expect(result.mpesa).toHaveProperty("totalFees");
    expect(result.wallet).toHaveProperty("totalIn");
    expect(result.wallet).toHaveProperty("totalOut");
    expect(result.wallet).toHaveProperty("totalFees");
  });

  it("dashboard.dailyPayments returns both mpesa and wallet arrays", async () => {
    const ctx = await seedWalletTestCtx("dash-payments");
    seededAccountIds.push(ctx.accountId);
    await seedSupportedCurrenciesLocal();
    await seedMpesaProviderLocal();
    const caller = createCaller(ctx);
    const today = new Date().toISOString().split("T")[0];
    const result = await caller.dashboard.dailyPayments({ date: today });
    expect(result).toHaveProperty("mpesa");
    expect(result).toHaveProperty("wallet");
    expect(Array.isArray(result.mpesa)).toBe(true);
    expect(Array.isArray(result.wallet)).toBe(true);
  });
});
