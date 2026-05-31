// ABOUTME: Tests that user data is strictly isolated between accounts.
// ABOUTME: Verifies all user management endpoints enforce accountId scoping.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../router";
import { getDb } from "../queries/connection";
import { businesses, customerAccounts, expenseCategories, locations, refreshTokens, userBusinesses, users, accounts } from "@db/schema";
import { and, eq, isNull, or } from "drizzle-orm";
import { verifyLocalToken } from "../local-auth-router";

// Creates a tRPC caller with a fully resolved context (incl. user from JWT)
// This mimics what fetchRequestHandler + createContext does at the HTTP layer
async function createAuthedCaller(token: string) {
  const claim = await verifyLocalToken(token);
  if (!claim) throw new Error("Invalid token for createAuthedCaller");

  const db = getDb();
  const rows = await db.select().from(users)
    .where(eq(users.id, claim.userId)).limit(1);
  const userRecord = rows[0];
  if (!userRecord || !userRecord.isActive) throw new Error("User not found or inactive");

  const junctions = await db.select().from(userBusinesses)
    .where(and(eq(userBusinesses.userId, userRecord.id), eq(userBusinesses.isActive, true)));
  const bizIds = junctions.map(j => j.businessId);

  let currentBusiness: typeof businesses.$inferSelect | null = null;
  if (userRecord.currentBusinessId) {
    const biz = await db.select().from(businesses)
      .where(and(eq(businesses.id, userRecord.currentBusinessId), isNull(businesses.deletedAt))).limit(1);
    currentBusiness = biz[0] ?? null;
  } else if (bizIds.length > 0) {
    const biz = await db.select().from(businesses)
      .where(and(eq(businesses.id, bizIds[0]), isNull(businesses.deletedAt))).limit(1);
    currentBusiness = biz[0] ?? null;
  }

  const ctx = {
    req: new Request("http://localhost/api/trpc", {
      headers: { cookie: `finaflow_token=${token}` },
    }),
    resHeaders: new Headers(),
    user: {
      ...userRecord,
      currentBusiness,
      businessIds: bizIds,
      allocationRightsProfile: null as any,
      accessSource: "owned" as const,
    },
  };

  return appRouter.createCaller(ctx);
}

function getRegisterCaller() {
  const ctx = {
    req: new Request("http://localhost/api/trpc/localAuth.register"),
    resHeaders: new Headers(),
  };
  return { caller: appRouter.createCaller(ctx), ctx };
}

async function cleanupAccount(accountId: string) {
  const db = getDb();
  const ca = await db.select({ id: customerAccounts.id }).from(customerAccounts)
    .where(eq(customerAccounts.accountId, accountId)).limit(1);
  if (!ca[0]) return;
  const caId = ca[0].id;

  const bizRows = await db.select({ id: businesses.id }).from(businesses)
    .where(or(eq(businesses.accountId, accountId), eq(businesses.accountRefId, caId)));
  for (const biz of bizRows) {
    await db.delete(expenseCategories).where(eq(expenseCategories.businessId, biz.id));
    const locRows = await db.select({ id: locations.id }).from(locations).where(eq(locations.businessId, biz.id));
    for (const loc of locRows) {
      await db.delete(accounts).where(eq(accounts.locationId, loc.id));
    }
    await db.delete(locations).where(eq(locations.businessId, biz.id));
    await db.delete(userBusinesses).where(eq(userBusinesses.businessId, biz.id));
  }
  await db.delete(businesses).where(or(eq(businesses.accountId, accountId), eq(businesses.accountRefId, caId)));

  const userRows = await db.select({ id: users.id }).from(users)
    .where(or(eq(users.accountId, accountId), eq(users.accountRefId, caId)));
  for (const u of userRows) {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, u.id));
  }
  await db.delete(users).where(or(eq(users.accountId, accountId), eq(users.accountRefId, caId)));
  await db.delete(customerAccounts).where(eq(customerAccounts.id, caId));
}

const ACCT_A = "ISOACCTA";
const ACCT_B = "ISOACCTB";

const baseSignupA = {
  name: "Isolation A Owner",
  username: "iso-owner-a",
  email: "iso-owner-a@test.com",
  password: "password123",
  accountName: ACCT_A,
  businessName: "Isolation A Business",
  phone: "+254700000101",
  referralCode: undefined,
  createDemo: false,
  userType: "standard" as const,
};

const baseSignupB = {
  name: "Isolation B Owner",
  username: "iso-owner-b",
  email: "iso-owner-b@test.com",
  password: "password123",
  accountName: ACCT_B,
  businessName: "Isolation B Business",
  phone: "+254700000102",
  referralCode: undefined,
  createDemo: false,
  userType: "standard" as const,
};

describe("Cross-Account Data Isolation", () => {
  let tokenA: string;
  let tokenB: string;

  beforeEach(async () => {
    await cleanupAccount(ACCT_A);
    await cleanupAccount(ACCT_B);

    const { caller: regA } = getRegisterCaller();
    const regAResult = await regA.localAuth.register(baseSignupA);
    tokenA = regAResult.token;

    const { caller: regB } = getRegisterCaller();
    const regBResult = await regB.localAuth.register(baseSignupB);
    tokenB = regBResult.token;

    // Create a second user (admin) in account A
    const aCaller = await createAuthedCaller(tokenA);
    await aCaller.users.create({
      username: "iso-admin-a",
      password: "password123",
      name: "Admin A",
      email: "iso-admin-a@test.com",
      role: "admin",
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanupAccount(ACCT_A);
    await cleanupAccount(ACCT_B);
  });

  // ── permissions.listUsers ───────────────────────────────────────
  it("permissions.listUsers returns only users from caller's account", async () => {
    const aCaller = await createAuthedCaller(tokenA);
    const bCaller = await createAuthedCaller(tokenB);

    const usersA = await aCaller.permissions.listUsers();
    const usersB = await bCaller.permissions.listUsers();

    expect(usersA.length).toBe(2);
    expect(usersA.map(u => u.username).sort()).toEqual(["iso-admin-a", baseSignupA.username]);
    expect(usersB.length).toBe(1);
    expect(usersB[0].username).toBe(baseSignupB.username);
  });

  it("permissions.listUsers prevents cross-account visibility", async () => {
    const usersA = await (await createAuthedCaller(tokenA)).permissions.listUsers();
    expect(usersA.map(u => u.username)).not.toContain(baseSignupB.username);
  });

  // ── users.list ──────────────────────────────────────────────────
  it("users.list returns only users from caller's account", async () => {
    expect((await (await createAuthedCaller(tokenA)).users.list()).length).toBe(2);
    expect((await (await createAuthedCaller(tokenB)).users.list()).length).toBe(1);
  });

  // ── users.get ───────────────────────────────────────────────────
  it("users.get returns null for user from another account", async () => {
    const aCaller = await createAuthedCaller(tokenA);
    const bCaller = await createAuthedCaller(tokenB);
    const usersA = await aCaller.users.list();
    const result = await bCaller.users.get({ id: usersA[0].id });
    expect(result).toBeNull();
  });

  it("users.get returns user from own account", async () => {
    const aCaller = await createAuthedCaller(tokenA);
    const usersA = await aCaller.users.list();
    const result = await aCaller.users.get({ id: usersA[0].id });
    expect(result).not.toBeNull();
    expect(result!.id).toBe(usersA[0].id);
  });

  // ── users.update ────────────────────────────────────────────────
  it("users.update rejects cross-account update", async () => {
    const aCaller = await createAuthedCaller(tokenA);
    const bCaller = await createAuthedCaller(tokenB);
    const usersA = await aCaller.users.list();
    await expect(bCaller.users.update({ id: usersA[0].id, name: "Hacked" }))
      .rejects.toThrow("User not found in this account");
  });

  // ── users.delete ────────────────────────────────────────────────
  it("users.delete rejects cross-account delete", async () => {
    const aCaller = await createAuthedCaller(tokenA);
    const bCaller = await createAuthedCaller(tokenB);
    const usersA = await aCaller.users.list();
    await expect(bCaller.users.delete({ id: usersA[0].id }))
      .rejects.toThrow("User not found in this account");
  });

  // ── users.changePassword ────────────────────────────────────────
  it("users.changePassword rejects cross-account change", async () => {
    const aCaller = await createAuthedCaller(tokenA);
    const bCaller = await createAuthedCaller(tokenB);
    const usersA = await aCaller.users.list();
    await expect(bCaller.users.changePassword({ userId: usersA[0].id, newPassword: "hacked" }))
      .rejects.toThrow("User not found in this account");
  });

  // ── permissions.updateUserRole ──────────────────────────────────
  it("permissions.updateUserRole rejects cross-account role update", async () => {
    const aCaller = await createAuthedCaller(tokenA);
    const bCaller = await createAuthedCaller(tokenB);
    const usersA = await aCaller.users.list();
    await expect(bCaller.permissions.updateUserRole({ userId: usersA[0].id, role: "admin" }))
      .rejects.toThrow("User not found in this account");
  });

  // ── businesses.get ──────────────────────────────────────────────
  it("businesses.get returns null for business from another account", async () => {
    const aCaller = await createAuthedCaller(tokenA);
    const bCaller = await createAuthedCaller(tokenB);
    const bizA = await aCaller.businesses.list();
    expect(await bCaller.businesses.get({ id: bizA[0].id })).toBeNull();
  });

  // ── businesses.members ──────────────────────────────────────────
  it("businesses.members rejects cross-account access", async () => {
    const aCaller = await createAuthedCaller(tokenA);
    const bCaller = await createAuthedCaller(tokenB);
    const bizA = await aCaller.businesses.list();
    await expect(bCaller.businesses.members({ businessId: bizA[0].id }))
      .rejects.toThrow("Business not found in this account");
  });

  // ── businesses.addMember ────────────────────────────────────────
  it("businesses.addMember rejects cross-account user addition", async () => {
    const aCaller = await createAuthedCaller(tokenA);
    const bCaller = await createAuthedCaller(tokenB);
    const bizA = await aCaller.businesses.list();
    const usersB = await bCaller.users.list();
    await expect(aCaller.businesses.addMember({ businessId: bizA[0].id, userId: usersB[0].id, role: "employee" }))
      .rejects.toThrow("User not found in this account");
  });

  // ── businesses.removeMember ─────────────────────────────────────
  it("businesses.removeMember rejects cross-account access", async () => {
    const aCaller = await createAuthedCaller(tokenA);
    const bCaller = await createAuthedCaller(tokenB);
    const bizA = await aCaller.businesses.list();
    await expect(bCaller.businesses.removeMember({ businessId: bizA[0].id, userId: 1 }))
      .rejects.toThrow("Business not found in this account");
  });

  // ── Full end-to-end isolation ───────────────────────────────────
  it("new account can only access its own user data", async () => {
    const ACCT_D = "ISOACCTD";
    const signupD = {
      name: "Isolation D Owner",
      username: "iso-owner-d",
      email: "iso-owner-d@test.com",
      password: "password123",
      accountName: ACCT_D,
      businessName: "Isolation D Business",
      phone: "+254700000104",
      referralCode: undefined,
      createDemo: false,
      userType: "standard" as const,
    };
    try {
      const { caller: regD } = getRegisterCaller();
      const { token } = await regD.localAuth.register(signupD);
      const dCaller = await createAuthedCaller(token);

      const usersD = await dCaller.permissions.listUsers();
      expect(usersD.length).toBe(1);
      expect(usersD[0].username).toBe(signupD.username);

      const usersA = await (await createAuthedCaller(tokenA)).permissions.listUsers();
      expect(usersA.map(u => u.username)).not.toContain(signupD.username);
    } finally {
      await cleanupAccount(ACCT_D);
    }
  });

  // ── Permission enforcement ──────────────────────────────────────
  it("rejects unauthenticated access to user endpoints", async () => {
    const anonCaller = appRouter.createCaller({
      req: new Request("http://localhost/api/trpc"),
      resHeaders: new Headers(),
    });
    await expect(anonCaller.permissions.listUsers()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonCaller.users.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
