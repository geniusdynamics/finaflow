import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../router";
import { getDb } from "../queries/connection";
import { accounts, businesses, customerAccounts, expenseCategories, locations, refreshTokens, userBusinesses, users } from "@db/schema";
import { and, eq, isNull } from "drizzle-orm";

const baseInput = {
  name: "Alice Owner",
  username: "alice-owner",
  email: "alice@example.com",
  password: "secret123",
  userType: "standard" as const,
  businessName: "Alice Ventures",
  accountName: "Alice Ventures",
  phone: "+254700000001",
  referralCode: undefined,
  createDemo: false,
};

function createCaller(cookieHeader = "") {
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc", {
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    }),
    resHeaders: new Headers(),
  });
}

async function cleanupAccount(accountId: string, email?: string, username?: string) {
  const db = getDb();

  const matchingUsers = await db.select().from(users).where(
    and(
      eq(users.accountId, accountId),
      isNull(users.deletedAt),
    ),
  );

  for (const user of matchingUsers) {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, user.id));
    await db.delete(userBusinesses).where(eq(userBusinesses.userId, user.id));
  }

  const matchingBusinesses = await db.select().from(businesses).where(eq(businesses.accountId, accountId));
  for (const business of matchingBusinesses) {
    await db.delete(expenseCategories).where(eq(expenseCategories.businessId, business.id));
    const businessLocations = await db.select().from(locations).where(eq(locations.businessId, business.id));
    for (const location of businessLocations) {
      await db.delete(accounts).where(eq(accounts.locationId, location.id));
    }
    await db.delete(locations).where(eq(locations.businessId, business.id));
  }

  await db.delete(businesses).where(eq(businesses.accountId, accountId));
  await db.delete(users).where(eq(users.accountId, accountId));
  await db.delete(customerAccounts).where(eq(customerAccounts.accountId, accountId));

  if (email) {
    await db.delete(users).where(eq(users.email, email));
  }
  if (username) {
    await db.delete(users).where(eq(users.username, username));
  }
}

describe("Local Auth Registration", () => {
  beforeEach(async () => {
    await cleanupAccount("ALICEVENTURES", baseInput.email, baseInput.username);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanupAccount("ALICEVENTURES", baseInput.email, baseInput.username);
    await cleanupAccount("ROLLBACKCO", "rollback@example.com", "rollback-user");
    await cleanupAccount("DUPLICATECO", "duplicate@example.com", "duplicate-user");
  });

  it("registers, creates linked rows, and issues auth cookies", async () => {
    const ctx = {
      req: new Request("http://localhost/api/trpc/localAuth.register"),
      resHeaders: new Headers(),
    };
    const caller = appRouter.createCaller(ctx);

    const result = await caller.localAuth.register(baseInput);

    expect(result.user.username).toBe(baseInput.username);
    expect(result.user.accountId).toBe("ALICEVENTURES");
    expect(result.user.currentBusinessId).toBeTruthy();
    expect(result.token).toBeTruthy();
    expect(result.csrfToken).toBeTruthy();

    const setCookie = ctx.resHeaders.getSetCookie?.() ?? ctx.resHeaders.get("set-cookie")?.split(",") ?? [];
    expect(setCookie.join(";")).toContain("finaflow_token=");
    expect(setCookie.join(";")).toContain("csrf_token=");

    const db = getDb();
    const userRows = await db.select().from(users).where(and(eq(users.username, baseInput.username), eq(users.accountId, "ALICEVENTURES")));
    expect(userRows).toHaveLength(1);

    const businessRows = await db.select().from(businesses).where(eq(businesses.accountId, "ALICEVENTURES"));
    expect(businessRows).toHaveLength(1);

    const customerAccountRows = await db.select().from(customerAccounts).where(eq(customerAccounts.accountId, "ALICEVENTURES"));
    expect(customerAccountRows).toHaveLength(1);
    expect(customerAccountRows[0].plan).toBe("pro");

    const junctionRows = await db.select().from(userBusinesses).where(eq(userBusinesses.userId, userRows[0].id));
    expect(junctionRows).toHaveLength(1);
    expect(junctionRows[0].businessId).toBe(businessRows[0].id);

    const locationRows = await db.select().from(locations).where(eq(locations.businessId, businessRows[0].id));
    expect(locationRows).toHaveLength(1);

    const accountRows = await db.select().from(accounts).where(eq(accounts.locationId, locationRows[0].id));
    expect(accountRows.length).toBeGreaterThanOrEqual(3);
  });

  it("logs in successfully after registration and issues fresh auth cookies", async () => {
    const registerCtx = {
      req: new Request("http://localhost/api/trpc/localAuth.register"),
      resHeaders: new Headers(),
    };
    const registerCaller = appRouter.createCaller(registerCtx);
    await registerCaller.localAuth.register(baseInput);

    const loginCtx = {
      req: new Request("http://localhost/api/trpc/localAuth.login"),
      resHeaders: new Headers(),
    };
    const loginCaller = appRouter.createCaller(loginCtx);
    const result = await loginCaller.localAuth.login({
      accountId: "ALICEVENTURES",
      username: baseInput.username,
      password: baseInput.password,
    });

    expect(result.user.username).toBe(baseInput.username);
    expect(result.user.accountId).toBe("ALICEVENTURES");
    expect(result.token).toBeTruthy();
    expect(result.csrfToken).toBeTruthy();

    const setCookie = loginCtx.resHeaders.getSetCookie?.() ?? loginCtx.resHeaders.get("set-cookie")?.split(",") ?? [];
    expect(setCookie.join(";")).toContain("finaflow_token=");
    expect(setCookie.join(";")).toContain("csrf_token=");
  });

  it("treats an exact retry as success instead of creating duplicates", async () => {
    const firstCtx = {
      req: new Request("http://localhost/api/trpc/localAuth.register"),
      resHeaders: new Headers(),
    };
    const firstCaller = appRouter.createCaller(firstCtx);
    const first = await firstCaller.localAuth.register(baseInput);

    const secondCtx = {
      req: new Request("http://localhost/api/trpc/localAuth.register"),
      resHeaders: new Headers(),
    };
    const secondCaller = appRouter.createCaller(secondCtx);
    const second = await secondCaller.localAuth.register(baseInput);

    expect(second.user.id).toBe(first.user.id);
    expect(second.user.currentBusinessId).toBe(first.user.currentBusinessId);

    const db = getDb();
    const userRows = await db.select().from(users).where(and(eq(users.username, baseInput.username), eq(users.accountId, "ALICEVENTURES")));
    const businessRows = await db.select().from(businesses).where(eq(businesses.accountId, "ALICEVENTURES"));
    expect(userRows).toHaveLength(1);
    expect(businessRows).toHaveLength(1);
  });

  it("rejects duplicate username and duplicate email for a different signup", async () => {
    const caller = createCaller();
    await caller.localAuth.register({
      ...baseInput,
      username: "duplicate-user",
      email: "duplicate@example.com",
      accountName: "Duplicate Co",
      businessName: "Duplicate Co",
    });

    await expect(caller.localAuth.register({
      ...baseInput,
      username: "duplicate-user",
      email: "another@example.com",
      accountName: "Duplicate Co",
      businessName: "Duplicate Co",
    })).rejects.toMatchObject({ message: "Account ID already taken. Choose another." });

    await expect(caller.localAuth.register({
      ...baseInput,
      username: "duplicate-user-2",
      email: "duplicate@example.com",
      accountName: "Duplicate Co 2",
      businessName: "Duplicate Co 2",
    })).rejects.toMatchObject({ message: "Email address already in use" });
  });

  it("rolls back user creation when downstream account creation fails", async () => {
    const db = getDb();
    const caller = appRouter.createCaller({
      req: new Request("http://localhost/api/trpc/localAuth.register", {
        headers: {
          "x-test-fail-registration-step": "before-default-accounts",
        },
      }),
      resHeaders: new Headers(),
    });

    await expect(caller.localAuth.register({
      ...baseInput,
      username: "rollback-user",
      email: "rollback@example.com",
      accountName: "Rollback Co",
      businessName: "Rollback Co",
    })).rejects.toMatchObject({ message: "We could not complete sign up right now. Please try again." });

    const rollbackAccountId = "ROLLBACKCO";
    const rolledBackUsers = await db.select().from(users).where(eq(users.accountId, rollbackAccountId));
    const rolledBackBusinesses = await db.select().from(businesses).where(eq(businesses.accountId, rollbackAccountId));

    expect(rolledBackUsers).toHaveLength(0);
    expect(rolledBackBusinesses).toHaveLength(0);
  });
});
