// ABOUTME: Verifies account-level referred-by mutations keep referral eligibility and source reporting correct.
// ABOUTME: Covers the post-signup referral workflow where pre-added leads decide whether commission applies.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../router";
import { getDb } from "../queries/connection";
import { businesses, customerAccounts, leads, users } from "@db/schema";
import { eq } from "drizzle-orm";

type SeededAccount = {
  accountId: string;
  accountRefId: number;
  userId: number;
  businessId: number;
  email: string;
  phone: string | null;
  userType: "standard" | "partner";
  businessName: string;
};

async function cleanupAccount(accountId: string) {
  const db = getDb();
  const matchingUsers = await db.select({ id: users.id }).from(users).where(eq(users.accountId, accountId));
  for (const user of matchingUsers) {
    await db.delete(leads).where(eq(leads.creatorUserId, user.id));
    await db.delete(leads).where(eq(leads.matchedUserId, user.id));
  }
  await db.delete(businesses).where(eq(businesses.accountId, accountId));
  await db.delete(users).where(eq(users.accountId, accountId));
  await db.delete(customerAccounts).where(eq(customerAccounts.accountId, accountId));
}

async function seedAccount(options: {
  accountId: string;
  businessName: string;
  email: string;
  phone?: string | null;
  userType?: "standard" | "partner";
  referralCode?: string | null;
}) {
  const db = getDb();
  const userType = options.userType ?? "standard";

  const [{ id: accountRefId }] = await db.insert(customerAccounts).values({
    accountId: options.accountId,
    name: options.businessName,
    plan: userType === "partner" ? "partner" : "growth",
    maxBusinesses: 99,
    maxUsers: 99,
    maxTransactionsPerMonth: 999999,
    subscriptionStatus: "active",
    isActive: true,
  }).returning({ id: customerAccounts.id });

  const [{ id: userId }] = await db.insert(users).values({
    username: `${options.accountId.toLowerCase()}-user`,
    name: `${options.businessName} User`,
    email: options.email,
    phone: options.phone ?? null,
    role: "owner",
    userType,
    accountId: options.accountId,
    accountRefId,
    isActive: true,
  }).returning({ id: users.id });

  const [{ id: businessId }] = await db.insert(businesses).values({
    accountId: options.accountId,
    accountRefId,
    name: options.businessName,
    slug: options.accountId.toLowerCase(),
    plan: userType === "partner" ? "partner" : "growth",
    subscriptionStatus: "active",
    referralCode: options.referralCode ?? null,
    partnerId: userType === "partner" ? userId : null,
    isActive: true,
  }).returning({ id: businesses.id });

  return {
    accountId: options.accountId,
    accountRefId,
    userId,
    businessId,
    email: options.email,
    phone: options.phone ?? null,
    userType,
    businessName: options.businessName,
  } satisfies SeededAccount;
}

function createCaller(account: SeededAccount) {
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc/accountSubscriptions.setReferredBy"),
    resHeaders: new Headers(),
    user: {
      id: account.userId,
      role: "owner",
      name: `${account.businessName} User`,
      email: account.email,
      phone: account.phone,
      userType: account.userType,
      accountId: account.accountId,
      accountRefId: account.accountRefId,
      currentBusinessId: account.businessId,
      currentBusiness: {
        id: account.businessId,
        accountId: account.accountId,
        accountRefId: account.accountRefId,
        plan: account.userType === "partner" ? "partner" : "growth",
        features: null,
        maxBranches: 99,
        maxUsers: 99,
      },
      businessIds: [account.businessId],
      permissions: [],
      isSuperAdmin: false,
    },
  });
}

describe("account subscription referred by flow", () => {
  beforeEach(async () => {
    await cleanupAccount("REFPARTNER1");
    await cleanupAccount("REFTARGET1");
    await cleanupAccount("REFTARGET2");
  });

  afterEach(async () => {
    await cleanupAccount("REFPARTNER1");
    await cleanupAccount("REFTARGET1");
    await cleanupAccount("REFTARGET2");
  });

  it("marks a settings referral as commission eligible only when a matching lead already existed", async () => {
    const partner = await seedAccount({
      accountId: "REFPARTNER1",
      businessName: "Referral Partner",
      email: "partner@example.com",
      userType: "partner",
      referralCode: "FINAPART1",
    });
    const target = await seedAccount({
      accountId: "REFTARGET1",
      businessName: "Referral Target",
      email: "target-one@example.com",
      phone: "+254733333333",
      userType: "standard",
    });

    await getDb().insert(leads).values({
      creatorUserId: partner.userId,
      creatorAccountRefId: partner.accountRefId,
      creatorBusinessId: partner.businessId,
      businessName: "Referral Target",
      contactName: "Referral Target User",
      email: target.email,
      normalizedEmail: target.email,
      phone: target.phone,
      normalizedPhone: "254733333333",
      status: "contacted",
    });

    const caller = createCaller(target);
    const result = await caller.accountSubscriptions.setReferredBy({ code: "FINAPART1" });

    expect(result.commissionEligible).toBe(true);

    const subscription = await caller.accountSubscriptions.mySubscription();
    expect(subscription?.referredBy?.name).toBe("Referral Partner");
    expect(subscription?.referralCommissionEligible).toBe(true);
    expect(subscription?.referralSource).toBe("settings");
  });

  it("stores a settings referral as information only when no matching lead exists", async () => {
    const partner = await seedAccount({
      accountId: "REFPARTNER1",
      businessName: "Referral Partner",
      email: "partner@example.com",
      userType: "partner",
      referralCode: "FINAPART1",
    });
    const target = await seedAccount({
      accountId: "REFTARGET2",
      businessName: "Referral Target Two",
      email: "target-two@example.com",
      userType: "standard",
    });

    const caller = createCaller(target);
    const result = await caller.accountSubscriptions.setReferredBy({ code: "FINAPART1" });

    expect(result.commissionEligible).toBe(false);

    const subscription = await caller.accountSubscriptions.mySubscription();
    expect(subscription?.referredBy?.name).toBe(partner.businessName);
    expect(subscription?.referralCommissionEligible).toBe(false);
    expect(subscription?.referralSource).toBe("settings");
  });

  it("does not allow referred by to be reassigned once it has been set", async () => {
    await seedAccount({
      accountId: "REFPARTNER1",
      businessName: "Referral Partner",
      email: "partner@example.com",
      userType: "partner",
      referralCode: "FINAPART1",
    });
    const target = await seedAccount({
      accountId: "REFTARGET2",
      businessName: "Referral Target Two",
      email: "target-two@example.com",
      userType: "standard",
    });

    const caller = createCaller(target);
    await caller.accountSubscriptions.setReferredBy({ code: "FINAPART1" });

    await expect(
      caller.accountSubscriptions.setReferredBy({ code: "FINAPART1" }),
    ).rejects.toMatchObject({ message: "Referred By has already been set for this account" });
  });
});
