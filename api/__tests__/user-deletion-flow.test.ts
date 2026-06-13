// ABOUTME: Integration tests for the user-deletion reference checker against the real test database.
// ABOUTME: Verifies that linked history blocks deletion while soft-session data stays informational.
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb } from "../test/db";
import { businesses, dailySales, locations, refreshTokens, userBusinesses, users } from "@db/schema";
import { findLinkedRecordsForUser } from "../lib/user-references";

async function seedUserDeletionContext(seed: string) {
  const db = getTestDb();
  const ts = Date.now();
  const accountId = `USRDEL-${ts}-${seed}`;

  const [business] = await db.insert(businesses).values({
    accountId,
    name: `User Delete ${seed}`,
    slug: `user-delete-${ts}-${seed.toLowerCase()}`,
    plan: "pro",
    maxBranches: 5,
    maxUsers: 10,
    isActive: true,
  } as typeof businesses.$inferInsert).returning();

  const [location] = await db.insert(locations).values({
    businessId: business.id,
    name: `Main ${seed}`,
    slug: `user-delete-loc-${ts}-${seed.toLowerCase()}`,
    isActive: true,
  } as typeof locations.$inferInsert).returning();

  const [user] = await db.insert(users).values({
    username: `user-delete-${ts}-${seed.toLowerCase()}`,
    name: `User Delete ${seed}`,
    role: "employee",
    isActive: true,
    accountId,
    currentBusinessId: business.id,
    locationId: location.id,
  } as typeof users.$inferInsert).returning();

  return { accountId, business, location, user };
}

async function cleanupUserDeletionContext(accountId: string) {
  const db = getTestDb();
  await db.delete(users).where(eq(users.accountId, accountId));
  await db.delete(businesses).where(eq(businesses.accountId, accountId));
}

describe("findLinkedRecordsForUser", () => {
  const seededAccountIds: string[] = [];

  afterEach(async () => {
    for (const accountId of seededAccountIds) {
      await cleanupUserDeletionContext(accountId);
    }
    seededAccountIds.length = 0;
  });

  it("returns an empty summary when a user has no linked records", async () => {
    const ctx = await seedUserDeletionContext("empty");
    seededAccountIds.push(ctx.accountId);

    const result = await findLinkedRecordsForUser(ctx.user.id);

    expect(result.userId).toBe(ctx.user.id);
    expect(result.totalCount).toBe(0);
    expect(result.hasAnyRecords).toBe(false);
    expect(result.hasBlockingRecords).toBe(false);
  });

  it("treats business memberships as informational instead of blocking", async () => {
    const db = getTestDb();
    const ctx = await seedUserDeletionContext("biz");
    seededAccountIds.push(ctx.accountId);

    await db.insert(userBusinesses).values({
      userId: ctx.user.id,
      businessId: ctx.business.id,
      role: "employee",
      isActive: true,
    } as typeof userBusinesses.$inferInsert);

    const result = await findLinkedRecordsForUser(ctx.user.id);

    expect(result.totalCount).toBeGreaterThanOrEqual(1);
    expect(result.hasAnyRecords).toBe(true);
    expect(result.hasBlockingRecords).toBe(false);
    expect(result.informationalGroups.some((group) => group.resource === "user_businesses")).toBe(true);
  });

  it("treats entered sales as blocking records", async () => {
    const db = getTestDb();
    const ctx = await seedUserDeletionContext("sales");
    seededAccountIds.push(ctx.accountId);

    await db.insert(dailySales).values({
      locationId: ctx.location.id,
      saleDate: "2026-06-10",
      cashTotal: "1200.00",
      netSales: "1200.00",
      enteredBy: ctx.user.id,
    } as typeof dailySales.$inferInsert);

    const result = await findLinkedRecordsForUser(ctx.user.id);

    expect(result.hasBlockingRecords).toBe(true);
    expect(result.blockingCount).toBeGreaterThanOrEqual(1);
    expect(result.blockingGroups.some((group) => group.resource === "daily_sales")).toBe(true);
  });

  it("keeps refresh tokens informational even when they exist", async () => {
    const db = getTestDb();
    const ctx = await seedUserDeletionContext("refresh");
    seededAccountIds.push(ctx.accountId);

    await db.insert(refreshTokens).values({
      userId: ctx.user.id,
      tokenHash: `hash-${ctx.user.id}`,
      expiresAt: new Date(Date.now() + 86_400_000),
      isRevoked: false,
    } as typeof refreshTokens.$inferInsert);

    const result = await findLinkedRecordsForUser(ctx.user.id);

    expect(result.hasAnyRecords).toBe(true);
    expect(result.hasBlockingRecords).toBe(false);
    expect(result.informationalGroups.some((group) => group.resource === "refresh_tokens")).toBe(true);
  });
});
