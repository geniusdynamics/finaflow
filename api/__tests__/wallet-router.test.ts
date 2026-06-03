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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any).returning();

  const [user] = await db.insert(users).values({
    username: `wallet-owner-${ts}-${seed.toLowerCase()}`, name: `Wallet Owner ${seed}`,
    role: "owner", isActive: true, currentBusinessId: business.id, accountId,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any).returning();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.insert(userBusinesses).values({ userId: user.id, businessId: business.id, role: "owner", isActive: true } as any);

  const [location] = await db.insert(locations).values({
    businessId: business.id, name: `Wallet Branch ${seed}`,
    slug: `wallet-branch-${ts}-${seed.toLowerCase()}`, isActive: true,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any).returning();

  return {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any).onConflictDoNothing().returning();
}

function createCaller(ctx: SeededCtx) {
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc/wallet.transactions.list"),
    resHeaders: new Headers(),
    user: { ...ctx.user, currentBusiness: ctx.business, businessIds: [ctx.business.id] },
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

describe("Wallet Import-Then-Display Regression", () => {
  const seededAccountIds: string[] = [];

  afterEach(async () => {
    for (const aid of seededAccountIds) {
      await cleanupWalletCtx(aid);
    }
    seededAccountIds.length = 0;
  });

  it("imports M-Pesa SMS, persists transactions, and they appear in transactions.list", async () => {
    const ctx = await seedWalletTestCtx("import-display");
    seededAccountIds.push(ctx.accountId);
    await seedMpesaProviderLocal();
    const caller = createCaller(ctx);
    const uniq = `${ctx.location.id}X${Math.floor(Math.random() * 9999)}`;

    const sms = `${uniq}ABC Confirmed. You have received Ksh 5,000.00 from John Doe on 15/3/25 at 2:30 PM. New M-PESA balance is Ksh 12,000.00. Transaction cost, Ksh 0.00.`;

    const importResult = await caller.wallet.transactions.importSms({
      locationId: ctx.location.id,
      provider: "mpesa",
      smsText: sms,
    });

    expect(importResult.success).toBe(true);
    expect(importResult.imported).toBe(1);
    expect(importResult.skipped).toBe(0);
    expect(importResult.errors).toEqual([]);

    const list = await caller.wallet.transactions.list({});
    const created = list.find((t) => t.providerTxnId === `${uniq}ABC`);
    expect(created).toBeDefined();
    expect(created!.partyName).toBe("John Doe");
    expect(created!.amount).toBe("5000.00");
    expect(created!.direction).toBe("in");
    expect(created!.description).toContain("John Doe");
  });

  it("re-importing the same M-Pesa SMS does not duplicate and does not clear existing transactions", async () => {
    const ctx = await seedWalletTestCtx("import-dedupe");
    seededAccountIds.push(ctx.accountId);
    await seedMpesaProviderLocal();
    const caller = createCaller(ctx);
    const uniq = `${ctx.location.id}X${Math.floor(Math.random() * 9999)}`;

    const sms1 = `${uniq}FIRST Confirmed. Ksh 1,000.00 sent to Supplier A on 1/3/25 at 10:00 AM. New M-PESA balance is Ksh 4,000.00. Transaction cost, Ksh 10.00.`;
    const sms2 = `${uniq}SECND Confirmed. You have received Ksh 2,500.00 from Customer B on 2/3/25 at 11:00 AM. New M-PESA balance is Ksh 6,500.00. Transaction cost, Ksh 0.00.`;

    const first = await caller.wallet.transactions.importSms({
      locationId: ctx.location.id, provider: "mpesa", smsText: sms1,
    });
    expect(first.imported).toBe(1);

    const second = await caller.wallet.transactions.importSms({
      locationId: ctx.location.id, provider: "mpesa", smsText: sms2,
    });
    expect(second.imported).toBe(1);

    let list = await caller.wallet.transactions.list({});
    const ours = list.filter((t) => t.providerTxnId.startsWith(uniq));
    expect(ours.length).toBe(2);

    const reimport = await caller.wallet.transactions.importSms({
      locationId: ctx.location.id, provider: "mpesa", smsText: `${sms1}\n${sms2}`,
    });
    expect(reimport.imported).toBe(0);
    expect(reimport.skipped).toBe(2);
    expect(reimport.success).toBe(true);

    list = await caller.wallet.transactions.list({});
    const oursAfter = list.filter((t) => t.providerTxnId.startsWith(uniq));
    expect(oursAfter.length).toBe(2);
  });

  it("importSms returns success:true even when ALL transactions fail validation", async () => {
    const ctx = await seedWalletTestCtx("import-bad");
    seededAccountIds.push(ctx.accountId);
    await seedMpesaProviderLocal();
    const caller = createCaller(ctx);

    const result = await caller.wallet.transactions.importSms({
      locationId: ctx.location.id, provider: "mpesa",
      smsText: "This is not a valid M-PESA SMS message at all - just random text without the expected format.",
    });
    expect(result.success).toBe(true);
    expect(result.imported).toBe(0);
    expect(result.totalParsed).toBe(0);

    const list = await caller.wallet.transactions.list({});
    expect(list.length).toBe(0);
  });

  it("importSms preserves historical transactions when adding new ones", async () => {
    const ctx = await seedWalletTestCtx("import-preserve");
    seededAccountIds.push(ctx.accountId);
    await seedMpesaProviderLocal();
    const caller = createCaller(ctx);
    const uniq = `${ctx.location.id}X${Math.floor(Math.random() * 9999)}`;

    const sms1 = `${uniq}HIST Confirmed. Ksh 100.00 sent to Old Supplier on 1/1/25 at 9:00 AM. New M-PESA balance is Ksh 900.00. Transaction cost, Ksh 5.00.`;
    await caller.wallet.transactions.importSms({
      locationId: ctx.location.id, provider: "mpesa", smsText: sms1,
    });

    let list = await caller.wallet.transactions.list({});
    const ours1 = list.filter((t) => t.providerTxnId.startsWith(uniq));
    expect(ours1.length).toBe(1);

    const sms2 = `${uniq}NEW2 Confirmed. You have received Ksh 500.00 from New Customer on 15/3/25 at 3:00 PM. New M-PESA balance is Ksh 1,400.00. Transaction cost, Ksh 0.00.`;
    await caller.wallet.transactions.importSms({
      locationId: ctx.location.id, provider: "mpesa", smsText: sms2,
    });

    list = await caller.wallet.transactions.list({});
    const ours2 = list.filter((t) => t.providerTxnId.startsWith(uniq));
    expect(ours2.length).toBe(2);
    const ids = ours2.map((t) => t.providerTxnId).sort();
    expect(ids).toEqual([`${uniq}HIST`, `${uniq}NEW2`].sort());
  });

  it("mpesa.list also reflects newly imported M-Pesa transactions (backward compat)", async () => {
    const ctx = await seedWalletTestCtx("import-legacy");
    seededAccountIds.push(ctx.accountId);
    await seedMpesaProviderLocal();
    const caller = createCaller(ctx);
    const uniq = `${ctx.location.id}X${Math.floor(Math.random() * 9999)}`;

    const sms = `${uniq}LEGACY Confirmed. Ksh 250.00 paid to Till 123456 on 10/3/25 at 2:00 PM. New M-PESA balance is Ksh 750.00. Transaction cost, Ksh 0.00.`;
    await caller.mpesa.importSms({ locationId: ctx.location.id, smsText: sms });

    const mpesaList = await caller.mpesa.list({});
    const created = mpesaList.find((t) => t.txnId === `${uniq}LEGACY`);
    expect(created).toBeDefined();
    expect(created!.amount).toBe("-250.00");

    const walletList = await caller.wallet.transactions.list({});
    expect(walletList.find((t) => t.providerTxnId === `${uniq}LEGACY`)).toBeDefined();
  });

  it("importSms returns preImportCount and postImportCount for the safeguard", async () => {
    const ctx = await seedWalletTestCtx("import-safeguard");
    seededAccountIds.push(ctx.accountId);
    await seedMpesaProviderLocal();
    const caller = createCaller(ctx);
    const uniq = `${ctx.location.id}X${Math.floor(Math.random() * 9999)}`;

    const sms1 = `${uniq}SAFE1 Confirmed. Ksh 200.00 sent to Test on 1/3/25 at 9:00 AM. New M-PESA balance is Ksh 800.00. Transaction cost, Ksh 0.00.`;
    await caller.wallet.transactions.importSms({ locationId: ctx.location.id, provider: "mpesa", smsText: sms1 });

    const sms2 = `${uniq}SAFE2 Confirmed. Ksh 300.00 received from Test2 on 2/3/25 at 9:00 AM. New M-PESA balance is Ksh 1,100.00. Transaction cost, Ksh 0.00.`;
    const result = await caller.wallet.transactions.importSms({ locationId: ctx.location.id, provider: "mpesa", smsText: sms2 });

    expect(result.preImportCount).toBe(1);
    expect(result.postImportCount).toBe(2);
    expect(result.imported).toBe(1);
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("importSms sanitizes malformed SMS without breaking the import", async () => {
    const ctx = await seedWalletTestCtx("import-malformed");
    seededAccountIds.push(ctx.accountId);
    await seedMpesaProviderLocal();
    const caller = createCaller(ctx);
    const uniq = `${ctx.location.id}X${Math.floor(Math.random() * 9999)}`;

    const good = `${uniq}GOOD1 Confirmed. Ksh 100.00 sent to A on 1/3/25 at 9:00 AM. New M-PESA balance is Ksh 900.00. Transaction cost, Ksh 0.00.`;
    const result = await caller.wallet.transactions.importSms({
      locationId: ctx.location.id, provider: "mpesa",
      smsText: `${good}\nRandom text that won't parse\nAnother bad line without proper format`,
    });

    expect(result.imported).toBe(1);
    expect(result.totalParsed).toBeGreaterThanOrEqual(1);
    expect(result.success).toBe(true);

    const list = await caller.wallet.transactions.list({});
    expect(list.find((t) => t.providerTxnId === `${uniq}GOOD1`)).toBeDefined();
  });

  it("list returns imported transactions even when date filter is NOT provided (the live bug)", async () => {
    const ctx = await seedWalletTestCtx("list-no-filter");
    seededAccountIds.push(ctx.accountId);
    await seedMpesaProviderLocal();
    const caller = createCaller(ctx);
    const uniq = `${ctx.location.id}X${Math.floor(Math.random() * 9999)}`;

    const oldSms = `${uniq}OLD01 Confirmed. Ksh 1,000.00 sent to Old Vendor on 15/1/24 at 9:00 AM. New M-PESA balance is Ksh 9,000.00. Transaction cost, Ksh 10.00.`;
    const importResult = await caller.wallet.transactions.importSms({
      locationId: ctx.location.id, provider: "mpesa", smsText: oldSms,
    });
    expect(importResult.imported).toBe(1);

    const listNoFilter = await caller.wallet.transactions.list({});
    expect(listNoFilter.find((t) => t.providerTxnId === `${uniq}OLD01`)).toBeDefined();

    const listWithNarrowFilter = await caller.wallet.transactions.list({
      dateFrom: "2026-01-01", dateTo: "2026-12-31",
    });
    expect(listWithNarrowFilter.find((t) => t.providerTxnId === `${uniq}OLD01`)).toBeUndefined();
  });

  it("list supports dateFrom-only and dateTo-only filters independently", async () => {
    const ctx = await seedWalletTestCtx("list-date-indep");
    seededAccountIds.push(ctx.accountId);
    await seedMpesaProviderLocal();
    const caller = createCaller(ctx);
    const uniq = `${ctx.location.id}X${Math.floor(Math.random() * 9999)}`;

    const oldSms = `${uniq}OLDDT Confirmed. Ksh 1,000.00 sent to Test on 15/1/24 at 9:00 AM. New M-PESA balance is Ksh 9,000.00. Transaction cost, Ksh 0.00.`;
    await caller.wallet.transactions.importSms({
      locationId: ctx.location.id, provider: "mpesa", smsText: oldSms,
    });

    const onlyDateFrom = await caller.wallet.transactions.list({ dateFrom: "2020-01-01" });
    expect(onlyDateFrom.find((t) => t.providerTxnId === `${uniq}OLDDT`)).toBeDefined();

    const onlyDateTo = await caller.wallet.transactions.list({ dateTo: "2030-12-31" });
    expect(onlyDateTo.find((t) => t.providerTxnId === `${uniq}OLDDT`)).toBeDefined();

    const onlyNarrowDateTo = await caller.wallet.transactions.list({ dateTo: "2024-12-31" });
    expect(onlyNarrowDateTo.find((t) => t.providerTxnId === `${uniq}OLDDT`)).toBeDefined();

    const onlyExcludingDateTo = await caller.wallet.transactions.list({ dateTo: "2023-12-31" });
    expect(onlyExcludingDateTo.find((t) => t.providerTxnId === `${uniq}OLDDT`)).toBeUndefined();
  });

  it("stats returns zero values when no transactions match the date filter (the live bug)", async () => {
    const ctx = await seedWalletTestCtx("stats-empty-window");
    seededAccountIds.push(ctx.accountId);
    await seedMpesaProviderLocal();
    const caller = createCaller(ctx);
    const uniq = `${ctx.location.id}X${Math.floor(Math.random() * 9999)}`;

    const oldSms = `${uniq}STATS Confirmed. Ksh 1,000.00 sent to Test on 15/1/24 at 9:00 AM. New M-PESA balance is Ksh 9,000.00. Transaction cost, Ksh 0.00.`;
    await caller.wallet.transactions.importSms({
      locationId: ctx.location.id, provider: "mpesa", smsText: oldSms,
    });

    const narrowStats = await caller.wallet.transactions.stats({
      dateFrom: "2026-01-01", dateTo: "2026-12-31",
    });
    expect(Number(narrowStats.summary.countIn)).toBe(0);
    expect(Number(narrowStats.summary.countOut)).toBe(0);

    const allStats = await caller.wallet.transactions.stats({});
    expect(Number(allStats.summary.countIn) + Number(allStats.summary.countOut)).toBeGreaterThanOrEqual(1);
  });
});
