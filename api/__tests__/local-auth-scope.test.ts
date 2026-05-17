import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../router";
import { getDb } from "../queries/connection";
import { accounts, businesses, customerAccounts, expenseCategories, locations, refreshTokens, userBusinesses, users } from "@db/schema";
import { and, eq, isNull, or } from "drizzle-orm";

function createCaller(cookieHeader = "") {
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc", {
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    }),
    resHeaders: new Headers(),
  });
}

function getLoginCaller() {
  const ctx = {
    req: new Request("http://localhost/api/trpc/localAuth.login"),
    resHeaders: new Headers(),
  };
  return { caller: appRouter.createCaller(ctx), ctx };
}

function getRegisterCaller() {
  const ctx = {
    req: new Request("http://localhost/api/trpc/localAuth.register"),
    resHeaders: new Headers(),
  };
  return { caller: appRouter.createCaller(ctx), ctx };
}

async function cleanupAccount(accountId: string, email?: string, username?: string) {
  const db = getDb();

  const matchingUsers = await db.select().from(users).where(
    and(
      or(
        eq(users.accountId, accountId),
        eq(users.accountRefId, (await db.select({ id: customerAccounts.id })
          .from(customerAccounts)
          .where(eq(customerAccounts.accountId, accountId))
          .limit(1))[0]?.id ?? -1),
      ),
      isNull(users.deletedAt),
    ),
  );

  for (const user of matchingUsers) {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, user.id));
    await db.delete(userBusinesses).where(eq(userBusinesses.userId, user.id));
  }

  const matchingBusinesses = await db.select().from(businesses)
    .where(or(
      eq(businesses.accountId, accountId),
      eq(businesses.accountRefId, (await db.select({ id: customerAccounts.id })
        .from(customerAccounts)
        .where(eq(customerAccounts.accountId, accountId))
        .limit(1))[0]?.id ?? -1),
    ));
  for (const business of matchingBusinesses) {
    await db.delete(expenseCategories).where(eq(expenseCategories.businessId, business.id));
    const businessLocations = await db.select().from(locations).where(eq(locations.businessId, business.id));
    for (const location of businessLocations) {
      await db.delete(accounts).where(eq(accounts.locationId, location.id));
    }
    await db.delete(locations).where(eq(locations.businessId, business.id));
  }

  await db.delete(businesses).where(or(
    eq(businesses.accountId, accountId),
    eq(businesses.accountRefId, (await db.select({ id: customerAccounts.id })
      .from(customerAccounts)
      .where(eq(customerAccounts.accountId, accountId))
      .limit(1))[0]?.id ?? -1),
  ));
  await db.delete(users).where(or(
    eq(users.accountId, accountId),
    eq(users.accountRefId, (await db.select({ id: customerAccounts.id })
      .from(customerAccounts)
      .where(eq(customerAccounts.accountId, accountId))
      .limit(1))[0]?.id ?? -1),
  ));
  await db.delete(customerAccounts).where(eq(customerAccounts.accountId, accountId));

  if (email) {
    await db.delete(users).where(eq(users.email, email));
  }
  if (username) {
    await db.delete(users).where(eq(users.username, username));
  }
}

const testAccountId = "SCOPETEST1";

const baseSignup = {
  name: "Scope Test User",
  username: "scopetest-user",
  email: "scopetest@example.com",
  password: "password123",
  accountName: testAccountId,
  businessName: "Scope Test Business",
  phone: "+254700000010",
  referralCode: undefined,
  createDemo: false,
  userType: "standard" as const,
};

describe("Local Auth - Account/Business Scope Separation", () => {
  beforeEach(async () => {
    await cleanupAccount(testAccountId, baseSignup.email, baseSignup.username);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanupAccount(testAccountId, baseSignup.email, baseSignup.username);
    await cleanupAccount("DEMO");
  });

  it("registers and creates both customer_accounts and accountRefId on user/business", async () => {
    const { caller } = getRegisterCaller();
    const result = await caller.localAuth.register(baseSignup);

    expect(result.user.accountId).toBe(testAccountId);
    expect(result.user.accountRefId).toBeTruthy();

    const db = getDb();

    const caRows = await db.select().from(customerAccounts)
      .where(and(eq(customerAccounts.accountId, testAccountId), isNull(customerAccounts.deletedAt)));
    expect(caRows).toHaveLength(1);

    const userRows = await db.select().from(users).where(and(
      eq(users.username, baseSignup.username),
      isNull(users.deletedAt),
    ));
    expect(userRows).toHaveLength(1);
    expect(userRows[0].accountId).toBe(testAccountId);
    expect(userRows[0].accountRefId).toBe(caRows[0].id);

    const bizRows = await db.select().from(businesses).where(eq(businesses.accountId, testAccountId));
    expect(bizRows).toHaveLength(1);
    expect(bizRows[0].accountRefId).toBe(caRows[0].id);
  });

  it("logs in using accountId on user row (new-style)", async () => {
    const { caller: regCaller } = getRegisterCaller();
    await regCaller.localAuth.register(baseSignup);

    const { caller: loginCaller } = getLoginCaller();
    const result = await loginCaller.localAuth.login({
      accountId: testAccountId,
      username: baseSignup.username,
      password: baseSignup.password,
    });

    expect(result.user.username).toBe(baseSignup.username);
    expect(result.user.accountId).toBe(testAccountId);
    expect(result.user.accountRefId).toBeTruthy();
    expect(result.token).toBeTruthy();
  });

  it("logs in using accountRefId on user row (legacy-style, no accountId)", async () => {
    const { caller: regCaller } = getRegisterCaller();
    await regCaller.localAuth.register(baseSignup);

    const db = getDb();

    const caRows = await db.select({ id: customerAccounts.id }).from(customerAccounts)
      .where(eq(customerAccounts.accountId, testAccountId)).limit(1);
    const caId = caRows[0].id;

    // Simulate legacy user — clear accountId, keep only accountRefId
    await db.update(users).set({ accountId: null }).where(
      and(eq(users.username, baseSignup.username), isNull(users.deletedAt)),
    );

    const userAfter = await db.select().from(users)
      .where(and(eq(users.username, baseSignup.username), isNull(users.deletedAt))).limit(1);
    expect(userAfter[0].accountId).toBeNull();
    expect(userAfter[0].accountRefId).toBe(caId);

    // Login via account name — should find user by accountRefId
    const { caller: loginCaller } = getLoginCaller();
    const result = await loginCaller.localAuth.login({
      accountId: testAccountId,
      username: baseSignup.username,
      password: baseSignup.password,
    });

    expect(result.user.username).toBe(baseSignup.username);
    expect(result.token).toBeTruthy();
  });

  it("rejects login with wrong password", async () => {
    const { caller: regCaller } = getRegisterCaller();
    await regCaller.localAuth.register(baseSignup);

    const { caller: loginCaller } = getLoginCaller();
    await expect(loginCaller.localAuth.login({
      accountId: testAccountId,
      username: baseSignup.username,
      password: "wrongpassword",
    })).rejects.toMatchObject({ message: "Invalid username or password" });
  });

  it("rejects login for non-existent account", async () => {
    const { caller: loginCaller } = getLoginCaller();
    await expect(loginCaller.localAuth.login({
      accountId: "NONEXISTENT999",
      username: "nobody",
      password: "anything",
    })).rejects.toMatchObject({ message: "Invalid account ID or credentials" });
  });

  it("checks account availability correctly", async () => {
    const { caller: regCaller } = getRegisterCaller();
    await regCaller.localAuth.register(baseSignup);

    const caller = createCaller();

    const takenResult = await caller.localAuth.checkAccountAvailability({
      accountName: testAccountId,
    });
    expect(takenResult.available).toBe(false);
    expect(takenResult.message).toContain("already taken");

    const availableResult = await caller.localAuth.checkAccountAvailability({
      accountName: "AVAILABLETEST999",
    });
    expect(availableResult.available).toBe(true);
    expect(availableResult.message).toContain("available");
  });

  it("rejects short account names in availability check", async () => {
    const caller = createCaller();
    const result = await caller.localAuth.checkAccountAvailability({ accountName: "A" });
    expect(result.available).toBe(false);
    expect(result.message).toContain("at least 2 characters");
  });

  it("looks up account and returns associated users", async () => {
    const { caller: regCaller } = getRegisterCaller();
    await regCaller.localAuth.register(baseSignup);

    const caller = createCaller();
    const result = await caller.localAuth.lookupAccount({ accountId: testAccountId });

    expect(result.business).toBeTruthy();
    expect(result.business.accountId).toBe(testAccountId);
    expect(result.users.length).toBeGreaterThanOrEqual(1);
    expect(result.users[0].username).toBe(baseSignup.username);
  });

  it("fails lookup for non-existent account", async () => {
    const caller = createCaller();
    await expect(caller.localAuth.lookupAccount({ accountId: "NOTEXIST" }))
      .rejects.toMatchObject({ message: "Account not found" });
  });

  it("sets currentBusinessId and accountRefId on login", async () => {
    const { caller: regCaller } = getRegisterCaller();
    await regCaller.localAuth.register(baseSignup);

    const { caller: loginCaller } = getLoginCaller();
    await loginCaller.localAuth.login({
      accountId: testAccountId,
      username: baseSignup.username,
      password: baseSignup.password,
    });

    const db = getDb();
    const userRows = await db.select().from(users)
      .where(and(eq(users.username, baseSignup.username), isNull(users.deletedAt)))
      .limit(1);

    expect(userRows[0].currentBusinessId).toBeTruthy();
    expect(userRows[0].accountRefId).toBeTruthy();
    expect(userRows[0].lastSignInAt).toBeTruthy();
  });

  it("me endpoint returns authenticated user with correct scope", async () => {
    const { caller: regCaller } = getRegisterCaller();
    await regCaller.localAuth.register(baseSignup);

    const { caller: loginCaller, ctx } = getLoginCaller();
    await loginCaller.localAuth.login({
      accountId: testAccountId,
      username: baseSignup.username,
      password: baseSignup.password,
    });

    const setCookieHeaders = ctx.resHeaders.getSetCookie?.() ?? [];
    const tokenCookie = setCookieHeaders.find(h => h.startsWith("finaflow_token="));
    expect(tokenCookie).toBeTruthy();

    const tokenValue = tokenCookie!.split(";")[0].replace("finaflow_token=", "");

    const meCaller = createCaller(`finaflow_token=${tokenValue}`);
    const meResult = await meCaller.localAuth.me();

    expect(meResult).not.toBeNull();
    expect(meResult!.username).toBe(baseSignup.username);
    expect(meResult!.accountId).toBe(testAccountId);
    expect(meResult!.accountRefId).toBeTruthy();
    expect(meResult!.currentBusinessId).toBeTruthy();
    expect(meResult!.businessIds.length).toBeGreaterThanOrEqual(1);
  });

  it("seedDefaults creates working demo account with accountRefId", async () => {
    const caller = createCaller();
    const result = await caller.localAuth.seedDefaults();
    expect(result.customerAccount).toBeTruthy();
    expect(result.demoBusiness).toBeTruthy();
    expect(result.users).toBeTruthy();
    expect(result.message).toContain("Demo ready");

    const db = getDb();

    const caRows = await db.select().from(customerAccounts)
      .where(and(eq(customerAccounts.accountId, "DEMO"), isNull(customerAccounts.deletedAt)));
    expect(caRows.length).toBeGreaterThanOrEqual(1);

    const bizRows = await db.select().from(businesses)
      .where(and(eq(businesses.accountId, "DEMO"), isNull(businesses.deletedAt)));
    expect(bizRows.length).toBeGreaterThanOrEqual(1);
    expect(bizRows[0].accountRefId).toBe(caRows[0].id);

    const demoUsers = await db.select().from(users)
      .where(and(eq(users.accountId, "DEMO"), isNull(users.deletedAt)));
    expect(demoUsers.length).toBeGreaterThanOrEqual(5);

    for (const u of demoUsers) {
      expect(u.accountRefId).toBe(caRows[0].id);
    }

    const { caller: loginCaller } = getLoginCaller();
    const loginResult = await loginCaller.localAuth.login({
      accountId: "DEMO",
      username: "owner",
      password: "finaflow2024",
    });
    expect(loginResult.user.accountId).toBe("DEMO");
    expect(loginResult.user.accountRefId).toBe(caRows[0].id);
    expect(loginResult.token).toBeTruthy();
  });
});
