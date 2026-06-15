import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../router";
import { getDb } from "../queries/connection";
import { businesses, customerAccounts, notifications, paymentMethods, userBusinesses, users } from "@db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { processTrialLifecycle } from "../lib/subscriptions";

async function cleanupAccount(accountId: string) {
  const db = getDb();
  const accountRows = await db.select().from(customerAccounts).where(eq(customerAccounts.accountId, accountId));
  const businessRows = await db.select().from(businesses).where(eq(businesses.accountId, accountId));

  for (const account of accountRows) {
    await db.delete(paymentMethods).where(eq(paymentMethods.accountRefId, account.id));
  }

  for (const business of businessRows) {
    await db.delete(paymentMethods).where(eq(paymentMethods.businessId, business.id));
    await db.delete(notifications).where(eq(notifications.entityId, business.id));
  }

  const userRows = await db.select().from(users).where(and(eq(users.accountId, accountId), isNull(users.deletedAt)));
  for (const user of userRows) {
    await db.delete(userBusinesses).where(eq(userBusinesses.userId, user.id));
    await db.delete(notifications).where(eq(notifications.userId, user.id));
  }

  await db.delete(users).where(eq(users.accountId, accountId));
  await db.delete(businesses).where(eq(businesses.accountId, accountId));
  await db.delete(customerAccounts).where(eq(customerAccounts.accountId, accountId));
}

async function seedBusiness(accountId: string, overrides?: Partial<typeof businesses.$inferInsert>) {
  const db = getDb();
  const plan = overrides?.plan ?? "pro";
  const subscriptionStatus = overrides?.subscriptionStatus ?? "trial";
  const subscriptionExpiry = overrides?.subscriptionExpiry ?? new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

  const [account] = await db.insert(customerAccounts).values({
    accountId,
    name: `${accountId} Account`,
    plan,
    maxBusinesses: 10,
    maxUsers: 99,
    maxTransactionsPerMonth: 999999,
    subscriptionStatus,
    subscriptionExpiry,
    isActive: true,
  } satisfies typeof customerAccounts.$inferInsert).returning();

  const [business] = await db.insert(businesses).values({
    accountId,
    accountRefId: account.id,
    name: `${accountId} Business`,
    slug: `${accountId.toLowerCase()}-business`,
    plan,
    maxBranches: 99,
    maxUsers: 99,
    maxTransactionsPerMonth: 999999,
    subscriptionStatus,
    subscriptionExpiry,
    isActive: true,
    ...overrides,
  } satisfies typeof businesses.$inferInsert).returning();

  const [user] = await db.insert(users).values({
    name: `${accountId} Owner`,
    username: `${accountId.toLowerCase()}-owner`,
    email: `${accountId.toLowerCase()}@example.com`,
    role: "owner",
    isActive: true,
    currentBusinessId: business.id!,
    accountId,
    accountRefId: account.id,
  } satisfies typeof users.$inferInsert).returning();

  await db.insert(userBusinesses).values({
    userId: user.id,
    businessId: business.id,
    role: "owner",
    isActive: true,
  } satisfies typeof userBusinesses.$inferInsert);

  return { account, business, user };
}

interface CallerUser {
  id: number;
  role: string;
  currentBusinessId: number;
  accountId: string;
  accountRefId: number | null;
  currentBusiness: typeof businesses.$inferSelect;
  businessIds: number[];
}


function createAuthedCaller(
  user: { id: number; role: string; currentBusinessId: number; accountId: string; accountRefId: number | null },
  business: typeof businesses.$inferSelect,
) {
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc/businesses.myTier"),
    resHeaders: new Headers(),
    user: {
      ...user,
      currentBusiness: business,
      businessIds: [business.id],
    },
  } as any);
}

describe("Subscription lifecycle", () => {
  beforeEach(async () => {
    await cleanupAccount("TIERCO");
    await cleanupAccount("EXPIRECO");
    await cleanupAccount("PAIDCO");
  });

  afterEach(async () => {
    await cleanupAccount("TIERCO");
    await cleanupAccount("EXPIRECO");
    await cleanupAccount("PAIDCO");
  });

  it("returns the full subscription matrix for the current business", async () => {
    const { business, user } = await seedBusiness("TIERCO");
    const caller = createAuthedCaller({ ...user, accountId: user.accountId!, currentBusinessId: user.currentBusinessId! }, business);

    const tier = await caller.businesses.myTier();

    expect(tier?.plan).toBe("pro");
    expect(tier?.maxBusinesses).toBe(10);
    expect(tier?.maxBranches).toBe(99);
    expect(tier?.maxUsers).toBe(99);
    expect(tier?.transactionQuotaLabel).toBe("Unlimited");
    expect(tier?.payrollAvailable).toBe(true);
    expect(tier?.supportTier).toBe("Dedicated");
    expect(tier?.canExtendTrial).toBe(true);
  });

  it("extends a trial once and blocks a second extension", async () => {
    const { account, business, user } = await seedBusiness("TIERCO");
    const caller = createAuthedCaller({ ...user, accountId: user.accountId!, currentBusinessId: user.currentBusinessId! }, business);

    const first = await caller.businesses.extendTrial();
    expect(first.success).toBe(true);

    const [updatedAccount] = await getDb().select().from(customerAccounts).where(eq(customerAccounts.id, account.id)).limit(1);
    expect(updatedAccount.subscriptionExpiry).toBe(first.subscriptionExpiry);
    expect(updatedAccount.features).toMatchObject({ trialExtendedAt: expect.any(String) });

    await expect(caller.businesses.extendTrial()).rejects.toMatchObject({
      message: "Trial extension has already been used",
    });
  });

  it("downgrades expired trials without a payment method and creates notifications", async () => {
    const { account, business, user } = await seedBusiness("EXPIRECO", {
      subscriptionExpiry: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    });
    const db = getDb();

    const result = await processTrialLifecycle(db, new Date());
    expect(result.downgraded).toBe(1);

    const [updated] = await db.select().from(businesses).where(eq(businesses.id, business.id)).limit(1);
    expect(updated.plan).toBe("free");
    expect(updated.subscriptionStatus).toBe("expired");

    const [updatedAccount] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, account.id)).limit(1);
    expect(updatedAccount.plan).toBe("free");
    expect(updatedAccount.subscriptionStatus).toBe("expired");

    const createdNotifications = await db.select().from(notifications).where(eq(notifications.userId, user.id));
    expect(createdNotifications.length).toBeGreaterThan(0);
  });

  it("converts expired paid trials into active subscriptions", async () => {
    const { account, business } = await seedBusiness("PAIDCO", {
      subscriptionExpiry: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    });
    const db = getDb();

    await db.insert(paymentMethods).values({
      accountRefId: account.id,
      businessId: business.id,
      name: "Visa Card",
      code: "CARD",
      isActive: true,
    } satisfies typeof paymentMethods.$inferInsert);

    const result = await processTrialLifecycle(db, new Date());
    expect(result.activated).toBe(1);

    const [updated] = await db.select().from(businesses).where(eq(businesses.id, business.id)).limit(1);
    expect(updated.plan).toBe("pro");
    expect(updated.subscriptionStatus).toBe("active");
    expect(updated.subscriptionExpiry).toBeNull();

    const [updatedAccount] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, account.id)).limit(1);
    expect(updatedAccount.plan).toBe("pro");
    expect(updatedAccount.subscriptionStatus).toBe("active");
    expect(updatedAccount.subscriptionExpiry).toBeNull();
  });
});
