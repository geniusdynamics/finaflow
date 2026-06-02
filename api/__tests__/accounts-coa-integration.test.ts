// ABOUTME: Verifies operational account creation stays simple while enforcing valid chart-account behavior.
// ABOUTME: Protects location-scoped payment method links from crossing business and branch boundaries.
import { afterEach, describe, expect, it } from "vitest";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { appRouter } from "../router";
import {
  accounts,
  businesses,
  locations,
  locationPaymentMethods,
  paymentMethods,
  userBusinesses,
  users,
} from "@db/schema";
import { getTestDb } from "../test/db";

type SeededContext = {
  accountId: string;
  business: { id: number; accountId: string; accountRefId: number | null; plan: string; maxBranches: number | null; maxUsers: number | null; features: unknown };
  user: { id: number; role: string; currentBusinessId: number; accountId: string; accountRefId: number | null };
  location: { id: number };
  secondLocation: { id: number };
};

interface CallerUser {
  id: number;
  role: string;
  currentBusinessId: number;
  accountId: string;
  accountRefId: number | null;
  currentBusiness: { id: number; accountId: string; accountRefId: number | null; plan: string; maxBranches: number | null; maxUsers: number | null; features: unknown };
  businessIds: number[];
}

interface CallerContext {
  req: Request;
  resHeaders: Headers;
  user: CallerUser;
}

async function seedAccountingContext(seed: string): Promise<SeededContext> {
  const db = getTestDb();
  const accountId = `ACCT-${seed}`;

  const [business] = await db.insert(businesses).values({
    accountId,
    name: `Accounting ${seed}`,
    slug: `accounting-${seed.toLowerCase()}`,
    plan: "pro",
    maxBranches: 5,
    maxUsers: 10,
    isActive: true,
  } satisfies typeof businesses.$inferInsert).returning();

  const [user] = await db.insert(users).values({
    username: `owner-${seed.toLowerCase()}`,
    name: `Owner ${seed}`,
    role: "owner",
    isActive: true,
    currentBusinessId: business.id,
    accountId,
  } satisfies typeof users.$inferInsert).returning();

  await db.insert(userBusinesses).values({
    userId: user.id,
    businessId: business.id,
    role: "owner",
    isActive: true,
  } satisfies typeof userBusinesses.$inferInsert);

  const [location] = await db.insert(locations).values({
    businessId: business.id,
    name: `Main ${seed}`,
    slug: `main-${seed.toLowerCase()}`,
    isActive: true,
  } satisfies typeof locations.$inferInsert).returning();

  const [secondLocation] = await db.insert(locations).values({
    businessId: business.id,
    name: `Secondary ${seed}`,
    slug: `secondary-${seed.toLowerCase()}`,
    isActive: true,
  } satisfies typeof locations.$inferInsert).returning();

  return {
    accountId,
    business,
    user: {
      id: user.id,
      role: user.role,
      currentBusinessId: business.id,
      accountId,
      accountRefId: user.accountRefId,
    },
    location,
    secondLocation,
  };
}

async function cleanupAccountingContext(accountId: string) {
  const db = getTestDb();
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.accountId, accountId))
    .limit(1);

  if (!business) {
    return;
  }

  const businessLocations = await db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.businessId, business.id));
  const locationIds = businessLocations.map((location) => location.id);

  if (locationIds.length > 0) {
    await db
      .delete(locationPaymentMethods)
      .where(inArray(locationPaymentMethods.locationId, locationIds));
  }

  await db.delete(paymentMethods).where(eq(paymentMethods.businessId, business.id));
  await db.delete(accounts).where(eq(accounts.businessId, business.id));
  await db.delete(locations).where(eq(locations.businessId, business.id));
  await db.delete(userBusinesses).where(eq(userBusinesses.businessId, business.id));
  await db.delete(users).where(eq(users.accountId, accountId));
  await db.delete(businesses).where(eq(businesses.id, business.id));
}

function createCaller(ctx: SeededContext) {
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc/accounts.create"),
    resHeaders: new Headers(),
    user: {
      ...ctx.user,
      currentBusiness: ctx.business,
      businessIds: [ctx.business.id],
    },
  } as CallerContext);
}

describe("operational accounts and payment-method linking", () => {
  const seededAccountIds: string[] = [];

  afterEach(async () => {
    while (seededAccountIds.length > 0) {
      const accountId = seededAccountIds.pop();
      if (accountId) {
        await cleanupAccountingContext(accountId);
      }
    }
  });

  it("derives business scope and valid asset classification for operational accounts", async () => {
    const seed = `AUTO-${Date.now()}`;
    const ctx = await seedAccountingContext(seed);
    seededAccountIds.push(ctx.accountId);
    const caller = createCaller(ctx);

    const created = await caller.accounts.create({
      locationId: ctx.location.id,
      name: "Cash Drawer",
      type: "cash",
      openingBalance: "1200.00",
    });

    const db = getTestDb();
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, created.id))
      .limit(1);

    expect(account).toMatchObject({
      locationId: ctx.location.id,
      businessId: ctx.business.id,
      type: "cash",
    });

    expect(account.accountType).toBeNull();
    expect(account.accountSubType).toBeNull();

    const sysAccounts = await db
      .select()
      .from(accounts)
      .where(and(
        eq(accounts.businessId, ctx.business.id),
        eq(accounts.systemKey, "asset:cash"),
        isNull(accounts.deletedAt),
      )).limit(1);

    expect(sysAccounts.length).toBeGreaterThan(0);
    expect(sysAccounts[0]).toMatchObject({
      accountType: "asset",
      accountSubType: "cash",
      isSystemGenerated: true,
    });
  });

  it("rejects non-asset chart classifications in the operational accounts module", async () => {
    const seed = `INVALID-${Date.now()}`;
    const ctx = await seedAccountingContext(seed);
    seededAccountIds.push(ctx.accountId);
    const caller = createCaller(ctx);

    await expect(
      caller.accounts.create({
        locationId: ctx.location.id,
        name: "Bad Cash Drawer",
        type: "cash",
        accountType: "liability",
        accountSubType: "accounts_payable",
      }),
    ).rejects.toThrow(/asset|cash|bank/i);
  });

  it("rejects payment-method links to accounts from another location", async () => {
    const seed = `LINK-${Date.now()}`;
    const ctx = await seedAccountingContext(seed);
    seededAccountIds.push(ctx.accountId);
    const caller = createCaller(ctx);

    const linkedAccount = await caller.accounts.create({
      locationId: ctx.secondLocation.id,
      name: "Secondary Bank",
      type: "bank_account",
      openingBalance: "0.00",
    });

    const paymentMethod = await caller.paymentMethods.create({
      name: "Card",
      code: `CARD-${seed}`,
      color: "#111111",
      sortOrder: 1,
    });

    await expect(
      caller.paymentMethods.assignToLocation({
        locationId: ctx.location.id,
        paymentMethodId: paymentMethod.id,
        linkedAccountId: linkedAccount.id,
      }),
    ).rejects.toThrow(/location|linked account/i);
  });
});
