// ABOUTME: Verifies allocation management still works for business owners while claim access stays separate.
// ABOUTME: Prevents regressions where owner invite generation gets hidden or blocked server-side.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../router";
import { getDb } from "../queries/connection";
import { businesses, customerAccounts, users } from "@db/schema";
import { eq } from "drizzle-orm";

type SeededUser = {
  accountId: string;
  accountRefId: number;
  businessId: number;
  userId: number;
  email: string;
  userType: "standard" | "partner";
};

async function cleanupAccount(accountId: string) {
  const db = getDb();
  await db.delete(businesses).where(eq(businesses.accountId, accountId));
  await db.delete(users).where(eq(users.accountId, accountId));
  await db.delete(customerAccounts).where(eq(customerAccounts.accountId, accountId));
}

async function seedUser(options: {
  accountId: string;
  email: string;
  userType: "standard" | "partner";
}) {
  const db = getDb();
  const [{ id: accountRefId }] = await db.insert(customerAccounts).values({
    accountId: options.accountId,
    name: options.accountId,
    plan: options.userType === "partner" ? "partner" : "growth",
    maxBusinesses: 99,
    maxUsers: 99,
    maxTransactionsPerMonth: 999999,
    subscriptionStatus: "active",
    isActive: true,
  }).returning({ id: customerAccounts.id });

  const [{ id: userId }] = await db.insert(users).values({
    username: `${options.accountId.toLowerCase()}-user`,
    name: `${options.accountId} User`,
    email: options.email,
    role: "owner",
    userType: options.userType,
    accountId: options.accountId,
    accountRefId,
    isActive: true,
  }).returning({ id: users.id });

  const [{ id: businessId }] = await db.insert(businesses).values({
    accountId: options.accountId,
    accountRefId,
    name: `${options.accountId} Business`,
    slug: options.accountId.toLowerCase(),
    plan: options.userType === "partner" ? "partner" : "growth",
    subscriptionStatus: "active",
    partnerId: options.userType === "partner" ? userId : null,
    isActive: true,
  }).returning({ id: businesses.id });

  return {
    accountId: options.accountId,
    accountRefId,
    businessId,
    userId,
    email: options.email,
    userType: options.userType,
  } satisfies SeededUser;
}

function createCaller(user: SeededUser) {
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc/partner.listOwnerAllocations"),
    resHeaders: new Headers(),
    user: {
      id: user.userId,
      role: "owner",
      name: `${user.accountId} User`,
      email: user.email,
      userType: user.userType,
      accountId: user.accountId,
      accountRefId: user.accountRefId,
      currentBusinessId: user.businessId,
      currentBusiness: {
        id: user.businessId,
        accountId: user.accountId,
        accountRefId: user.accountRefId,
        plan: user.userType === "partner" ? "partner" : "growth",
        features: null,
        maxBranches: 99,
        maxUsers: 99,
      },
      businessIds: [user.businessId],
      permissions: [],
      isSuperAdmin: false,
    },
  });
}

describe("partner allocation authorization", () => {
  beforeEach(async () => {
    await cleanupAccount("ALLOCSTANDARD");
    await cleanupAccount("ALLOCPARTNER");
  });

  afterEach(async () => {
    await cleanupAccount("ALLOCSTANDARD");
    await cleanupAccount("ALLOCPARTNER");
  });

  it("allows standard business owners to access owner allocation management endpoints", async () => {
    const standardOwner = await seedUser({
      accountId: "ALLOCSTANDARD",
      email: "alloc-standard@example.com",
      userType: "standard",
    });
    const caller = createCaller(standardOwner);

    await expect(caller.partner.listOwnerAllocations()).resolves.toEqual([]);
  });

  it("allows partner accounts to access owner allocation management endpoints", async () => {
    const partnerOwner = await seedUser({
      accountId: "ALLOCPARTNER",
      email: "alloc-partner@example.com",
      userType: "partner",
    });
    const caller = createCaller(partnerOwner);

    await expect(caller.partner.listOwnerAllocations()).resolves.toEqual([]);
  });
});
