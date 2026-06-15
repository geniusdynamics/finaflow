// ABOUTME: Exercises the multi-location assignment flow across helper entry points used by the SAM module.
// ABOUTME: Confirms assignments can move from single to multi and that enforcement resolves the allowed locations correctly.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../../api/queries/connection";
import { hashPassword } from "../../api/lib/password";
import { getAuthorizedLocationIds } from "../../api/middleware";
import { getUserLocationIds, syncUserLocationAssignments } from "../../api/users-router";
import {
  appSettings,
  businesses,
  customerAccounts,
  expenseCategories,
  locations,
  refreshTokens,
  userBusinesses,
  userLocations,
  users,
} from "@db/schema";

type SeedResult = {
  accountId: string;
  businessId: number;
  ownerId: number;
  employeeId: number;
  locationIds: [number, number, number];
};

async function seedAccountAndBusiness(): Promise<SeedResult> {
  const db = getDb();
  const accountId = `E2ELOC${Date.now()}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();

  await db.insert(customerAccounts).values({
    accountId,
    name: "E2E Location Account",
  } as typeof customerAccounts.$inferInsert);

  const [business] = await db.insert(businesses).values({
    accountId,
    name: "E2E Location Business",
    slug: `e2e-loc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    isActive: true,
  } as typeof businesses.$inferInsert).returning();

  const [locationA] = await db.insert(locations).values({
    businessId: business.id,
    name: "North Branch",
    slug: `north-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
  } as typeof locations.$inferInsert).returning();
  const [locationB] = await db.insert(locations).values({
    businessId: business.id,
    name: "East Branch",
    slug: `east-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
  } as typeof locations.$inferInsert).returning();
  const [locationC] = await db.insert(locations).values({
    businessId: business.id,
    name: "West Branch",
    slug: `west-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
  } as typeof locations.$inferInsert).returning();

  const passwordHash = await hashPassword("secret123");
  const [owner] = await db.insert(users).values({
    username: `owner-${accountId.toLowerCase()}`,
    passwordHash,
    name: "Owner User",
    role: "owner",
    accountId,
    currentBusinessId: business.id,
    isActive: true,
  } as typeof users.$inferInsert).returning();

  const [employee] = await db.insert(users).values({
    username: `employee-${accountId.toLowerCase()}`,
    passwordHash,
    name: "Employee User",
    role: "employee",
    accountId,
    currentBusinessId: business.id,
    isActive: true,
  } as typeof users.$inferInsert).returning();

  await db.insert(userBusinesses).values([
    { userId: owner.id, businessId: business.id, role: "owner", isActive: true },
    { userId: employee.id, businessId: business.id, role: "employee", isActive: true },
  ] as typeof userBusinesses.$inferInsert[]);

  return {
    accountId,
    businessId: business.id,
    ownerId: owner.id,
    employeeId: employee.id,
    locationIds: [locationA.id, locationB.id, locationC.id],
  };
}

async function cleanupAccount(accountId: string) {
  const db = getDb();
  const usersInAccount = await db.select().from(users).where(and(eq(users.accountId, accountId), isNull(users.deletedAt)));
  const businessesInAccount = await db.select().from(businesses).where(and(eq(businesses.accountId, accountId), isNull(businesses.deletedAt)));

  for (const user of usersInAccount) {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, user.id));
    await db.delete(userLocations).where(eq(userLocations.userId, user.id));
    await db.delete(userBusinesses).where(eq(userBusinesses.userId, user.id));
  }

  for (const business of businessesInAccount) {
    await db.delete(appSettings).where(eq(appSettings.businessId, business.id));
    await db.delete(expenseCategories).where(eq(expenseCategories.businessId, business.id));
    const branchRows = await db.select().from(locations).where(eq(locations.businessId, business.id));
    for (const branch of branchRows) {
      await db.delete(userLocations).where(eq(userLocations.locationId, branch.id));
      await db.delete(locations).where(eq(locations.id, branch.id));
    }
    await db.delete(businesses).where(eq(businesses.id, business.id));
  }

  for (const user of usersInAccount) {
    await db.delete(users).where(eq(users.id, user.id));
  }

  await db.delete(customerAccounts).where(eq(customerAccounts.accountId, accountId));
}

describe("user multi-location flow", () => {
  let seed: SeedResult;

  beforeEach(async () => {
    seed = await seedAccountAndBusiness();
  });

  afterEach(async () => {
    await cleanupAccount(seed.accountId);
  });

  it("moves from single assignment to multi assignment and enforces the final set", async () => {
    const db = getDb();

    await db.transaction(async (tx) => {
      await syncUserLocationAssignments(tx as never, seed.employeeId, [seed.locationIds[0]], seed.ownerId);
    });
    expect(await getUserLocationIds(seed.employeeId)).toEqual([seed.locationIds[0]]);

    await db.transaction(async (tx) => {
      await syncUserLocationAssignments(tx as never, seed.employeeId, [seed.locationIds[0], seed.locationIds[2]], seed.ownerId);
    });
    expect((await getUserLocationIds(seed.employeeId)).sort()).toEqual([seed.locationIds[0], seed.locationIds[2]].sort());

    await db.insert(appSettings).values({
      businessId: seed.businessId,
      key: "enforceLocationAssignment",
      value: "true",
    } as typeof appSettings.$inferInsert);

    const allowed = await getAuthorizedLocationIds({
      user: { id: seed.employeeId, role: "employee", currentBusinessId: seed.businessId } as never,
    });

    expect(allowed.sort()).toEqual([seed.locationIds[0], seed.locationIds[2]].sort());
  });
});
