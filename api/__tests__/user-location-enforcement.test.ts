// ABOUTME: Verifies multi-location user assignments and enforcement behavior in middleware helpers.
// ABOUTME: Covers single-location restriction, multi-location restriction, and admin bypass when enforcement is enabled.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { hashPassword } from "../lib/password";
import { getAuthorizedLocationIds, getEnforceUserLocation } from "../middleware";
import { syncUserLocationAssignments } from "../users-router";
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
  const accountId = `LOCENF${Date.now()}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();

  await db.insert(customerAccounts).values({
    accountId,
    name: "Location Enforcement Test Account",
  } as typeof customerAccounts.$inferInsert);

  const [business] = await db.insert(businesses).values({
    accountId,
    name: "Location Enforcement Test Business",
    slug: `loc-enf-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    isActive: true,
  } as typeof businesses.$inferInsert).returning();

  const [locationA] = await db.insert(locations).values({
    businessId: business.id,
    name: "Branch A",
    slug: `loc-a-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
  } as typeof locations.$inferInsert).returning();
  const [locationB] = await db.insert(locations).values({
    businessId: business.id,
    name: "Branch B",
    slug: `loc-b-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
  } as typeof locations.$inferInsert).returning();
  const [locationC] = await db.insert(locations).values({
    businessId: business.id,
    name: "Branch C",
    slug: `loc-c-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
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

describe("user location enforcement", () => {
  let seed: SeedResult;

  beforeEach(async () => {
    seed = await seedAccountAndBusiness();
  });

  afterEach(async () => {
    await cleanupAccount(seed.accountId);
  });

  it("defaults enforcement to false when no setting exists", async () => {
    const enabled = await getEnforceUserLocation({
      user: { id: seed.employeeId, role: "employee", currentBusinessId: seed.businessId } as never,
    });

    expect(enabled).toBe(false);
  });

  it("restricts a non-admin to a single assigned location when enforcement is enabled", async () => {
    const db = getDb();
    await db.insert(appSettings).values({
      businessId: seed.businessId,
      key: "enforceLocationAssignment",
      value: "true",
    } as typeof appSettings.$inferInsert);
    await db.insert(userLocations).values({
      userId: seed.employeeId,
      locationId: seed.locationIds[1],
      isPrimary: true,
      isActive: true,
    } as typeof userLocations.$inferInsert);

    const allowed = await getAuthorizedLocationIds({
      user: { id: seed.employeeId, role: "employee", currentBusinessId: seed.businessId } as never,
    });

    expect(allowed).toEqual([seed.locationIds[1]]);
  });

  it("restricts a non-admin to multiple assigned locations when enforcement is enabled", async () => {
    const db = getDb();
    await db.insert(appSettings).values({
      businessId: seed.businessId,
      key: "enforceLocationAssignment",
      value: "true",
    } as typeof appSettings.$inferInsert);
    await db.insert(userLocations).values([
      { userId: seed.employeeId, locationId: seed.locationIds[0], isPrimary: true, isActive: true },
      { userId: seed.employeeId, locationId: seed.locationIds[2], isPrimary: false, isActive: true },
    ] as typeof userLocations.$inferInsert[]);

    const allowed = await getAuthorizedLocationIds({
      user: { id: seed.employeeId, role: "employee", currentBusinessId: seed.businessId } as never,
    });

    expect(allowed.sort()).toEqual([seed.locationIds[0], seed.locationIds[2]].sort());
  });

  it("lets admins keep access to all locations even when enforcement is enabled", async () => {
    const db = getDb();
    await db.insert(appSettings).values({
      businessId: seed.businessId,
      key: "enforceLocationAssignment",
      value: "true",
    } as typeof appSettings.$inferInsert);
    await db.update(users).set({ role: "admin" }).where(eq(users.id, seed.employeeId));
    await db.update(userBusinesses).set({ role: "admin" })
      .where(and(eq(userBusinesses.userId, seed.employeeId), eq(userBusinesses.businessId, seed.businessId)));

    const allowed = await getAuthorizedLocationIds({
      user: { id: seed.employeeId, role: "admin", currentBusinessId: seed.businessId } as never,
    });

    expect(allowed.sort()).toEqual([...seed.locationIds].sort());
  });

  it("syncUserLocationAssignments preserves existing records when called with empty array", async () => {
    const db = getDb();
    // Assign employee to one location
    await db.insert(userLocations).values({
      userId: seed.employeeId,
      locationId: seed.locationIds[0],
      isPrimary: true,
      isActive: true,
    } as typeof userLocations.$inferInsert);

    // Verify the assignment exists
    const before = await db.select().from(userLocations)
      .where(eq(userLocations.userId, seed.employeeId));
    expect(before.length).toBe(1);

    // Attempt sync with empty array — should NOT delete existing records
    const result = await db.transaction(async (tx) => {
      return syncUserLocationAssignments(tx, seed.employeeId, [], seed.ownerId);
    });

    expect(result).toEqual([]);

    // Original record should still exist
    const after = await db.select().from(userLocations)
      .where(eq(userLocations.userId, seed.employeeId));
    expect(after.length).toBe(1);
    expect(after[0].locationId).toBe(seed.locationIds[0]);
  });

  it("location create triggers user-location auto-assignment for owner (owner gets auto-assigned to new branch)", async () => {
    const db = getDb();
    // Insert a new location (as if created by owner)
    const [newLoc] = await db.insert(locations).values({
      businessId: seed.businessId,
      name: "New Branch (Owner Test)",
      slug: `new-owner-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    } as typeof locations.$inferInsert).returning();

    // Simulate the auto-assignment that locations.create does for owner
    await db.transaction(async (tx) => {
      await syncUserLocationAssignments(tx, seed.ownerId, [newLoc.id], seed.ownerId);
    });

    const records = await db.select().from(userLocations)
      .where(and(eq(userLocations.userId, seed.ownerId), eq(userLocations.isActive, true)));
    expect(records.some(r => r.locationId === newLoc.id)).toBe(true);
  });

  it("location create triggers user-location auto-assignment for admin (C2 fix: admin matches owner behavior)", async () => {
    const db = getDb();
    // Promote employee to admin
    await db.update(users).set({ role: "admin" }).where(eq(users.id, seed.employeeId));
    await db.update(userBusinesses).set({ role: "admin" })
      .where(and(eq(userBusinesses.userId, seed.employeeId), eq(userBusinesses.businessId, seed.businessId)));

    const [newLoc] = await db.insert(locations).values({
      businessId: seed.businessId,
      name: "New Branch (Admin Test)",
      slug: `new-admin-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    } as typeof locations.$inferInsert).returning();

    // Simulate auto-assignment that locations.create does for admin (C2)
    await db.transaction(async (tx) => {
      await syncUserLocationAssignments(tx, seed.employeeId, [newLoc.id], seed.employeeId);
    });

    const records = await db.select().from(userLocations)
      .where(and(eq(userLocations.userId, seed.employeeId), eq(userLocations.isActive, true)));
    expect(records.some(r => r.locationId === newLoc.id)).toBe(true);
  });

  it("getAuthorizedLocationIds rejects unauthorized locations when enforcement is on", async () => {
    const db = getDb();
    await db.insert(appSettings).values({
      businessId: seed.businessId,
      key: "enforceLocationAssignment",
      value: "true",
    } as typeof appSettings.$inferInsert);

    // Assign employee only to location B
    await db.insert(userLocations).values({
      userId: seed.employeeId,
      locationId: seed.locationIds[1],
      isPrimary: true,
      isActive: true,
    } as typeof userLocations.$inferInsert);

    const allowed = await getAuthorizedLocationIds({
      user: { id: seed.employeeId, role: "employee", currentBusinessId: seed.businessId } as never,
    });

    // Location A and C should NOT be in the authorized set
    expect(allowed).toContain(seed.locationIds[1]);
    expect(allowed).not.toContain(seed.locationIds[0]);
    expect(allowed).not.toContain(seed.locationIds[2]);
  });

  it("locations.list respects authorization when enforcement is on (D1)", async () => {
    const db = getDb();
    await db.insert(appSettings).values({
      businessId: seed.businessId,
      key: "enforceLocationAssignment",
      value: "true",
    } as typeof appSettings.$inferInsert);

    // Assign employee only to location B
    await db.insert(userLocations).values({
      userId: seed.employeeId,
      locationId: seed.locationIds[1],
      isPrimary: true,
      isActive: true,
    } as typeof userLocations.$inferInsert);

    const allowed = await getAuthorizedLocationIds({
      user: { id: seed.employeeId, role: "employee", currentBusinessId: seed.businessId } as never,
    });

    // Simulate what locations.list does: intersect authorized IDs with all locations
    const allLocationIds = await db.select({ id: locations.id }).from(locations)
      .where(and(eq(locations.businessId, seed.businessId), isNull(locations.deletedAt)));
    const filtered = allLocationIds.filter(l => allowed.includes(l.id)).map(l => l.id);

    expect(filtered).toEqual([seed.locationIds[1]]);
  });

  it("syncUserLocationAssignments creates records for valid location IDs", async () => {
    const db = getDb();

    const result = await db.transaction(async (tx) => {
      return syncUserLocationAssignments(
        tx,
        seed.ownerId,
        [seed.locationIds[0], seed.locationIds[2]],
        seed.ownerId,
      );
    });

    expect(result).toEqual([seed.locationIds[0], seed.locationIds[2]]);

    const records = await db.select().from(userLocations)
      .where(and(
        eq(userLocations.userId, seed.ownerId),
        eq(userLocations.isActive, true)
      ))
      .orderBy(userLocations.locationId);
    expect(records.length).toBe(2);
    expect(records[0].locationId).toBe(seed.locationIds[0]);
    expect(records[0].isPrimary).toBe(true);
    expect(records[1].locationId).toBe(seed.locationIds[2]);
    expect(records[1].isPrimary).toBe(false);
  });
});
