// ABOUTME: Integration tests for the daily subscription sweep — notification fan-out, idempotent upserts,
// ABOUTME: overdue severity escalation, auto-renew pending payments, trial expiry, and clearance on payment.
import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "../router";
import { getDb } from "../queries/connection";
import { runSubscriptionSweep } from "../lib/subscription-sweep";
import {
  appSettings,
  businesses,
  expenseCategories,
  locations,
  notifications,
  subscriptionPayments,
  subscriptions,
  userBusinesses,
  userLocations,
  users,
} from "@db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

type UserRow = typeof users.$inferSelect;
type BusinessRow = typeof businesses.$inferSelect;

function makeAuthedCaller(user: UserRow, business: BusinessRow, bizIds: number[], assignedLocationIds?: number[]) {
  const ctx = {
    req: new Request("http://localhost/api/trpc"),
    resHeaders: new Headers(),
    user: {
      ...user,
      currentBusiness: { ...business, accountRefId: null },
      businessIds: bizIds,
      assignedLocationIds,
      enforceUserLocation: true,
      allocationRightsProfile: null,
      accessSource: "owned" as const,
    },
  };
  return appRouter.createCaller(ctx);
}

describe("Subscription sweep", () => {
  let db: ReturnType<typeof getDb>;
  let bizA: BusinessRow;
  let bizB: BusinessRow;
  let locA1: typeof locations.$inferSelect;
  let locA2: typeof locations.$inferSelect;
  let ownerA: UserRow;
  let viewerA1: UserRow;
  let viewerA2: UserRow;
  let employeeA: UserRow;
  let ownerB: UserRow;
  let catA: typeof expenseCategories.$inferSelect;

  const sweepDay = (offsetDays: number): Date => {
    const base = new Date("2027-06-10T12:00:00");
    base.setDate(base.getDate() + offsetDays);
    return base;
  };

  beforeAll(async () => {
    db = getDb();

    for (const prefix of ["SUBSWEEP_A", "SUBSWEEP_B"]) {
      const existingBiz = await db.select({ id: businesses.id }).from(businesses).where(sql`${businesses.slug} LIKE ${prefix + "%"}`);
      for (const b of existingBiz) {
        await db.delete(subscriptionPayments).where(eq(subscriptionPayments.businessId, b.id));
        await db.delete(subscriptions).where(eq(subscriptions.businessId, b.id));
        await db.delete(notifications).where(sql`${notifications.entityType} = 'subscription'`);
        await db.delete(expenseCategories).where(eq(expenseCategories.businessId, b.id));
        await db.delete(appSettings).where(eq(appSettings.businessId, b.id));
        await db.delete(locations).where(eq(locations.businessId, b.id));
        await db.delete(userBusinesses).where(eq(userBusinesses.businessId, b.id));
        await db.delete(businesses).where(eq(businesses.id, b.id));
      }
      await db.delete(users).where(sql`${users.username} LIKE ${"sub-sweep-" + prefix.toLowerCase().slice(-2) + "%"}`);
    }

    [bizA] = await db.insert(businesses).values({ accountId: "SUBSWEEP_A", name: "Subs Sweep A", slug: "SUBSWEEP_A_main", plan: "pro", isActive: true } as never).returning();
    [bizB] = await db.insert(businesses).values({ accountId: "SUBSWEEP_B", name: "Subs Sweep B", slug: "SUBSWEEP_B_main", plan: "pro", isActive: true } as never).returning();

    [locA1] = await db.insert(locations).values({ businessId: bizA.id, name: "Sweep A Branch 1", slug: "subsweep-a-b1", isActive: true } as never).returning();
    [locA2] = await db.insert(locations).values({ businessId: bizA.id, name: "Sweep A Branch 2", slug: "subsweep-a-b2", isActive: true } as never).returning();

    [ownerA] = await db.insert(users).values({ username: "sub-sweep-a-owner", name: "Sweep Owner A", role: "owner", isActive: true, currentBusinessId: bizA.id } as never).returning();
    [viewerA1] = await db.insert(users).values({ username: "sub-sweep-a-viewer1", name: "Sweep Viewer A1", role: "viewer", isActive: true, currentBusinessId: bizA.id } as never).returning();
    [viewerA2] = await db.insert(users).values({ username: "sub-sweep-a-viewer2", name: "Sweep Viewer A2", role: "viewer", isActive: true, currentBusinessId: bizA.id } as never).returning();
    [employeeA] = await db.insert(users).values({ username: "sub-sweep-a-employee", name: "Sweep Employee A", role: "employee", isActive: true, currentBusinessId: bizA.id } as never).returning();
    [ownerB] = await db.insert(users).values({ username: "sub-sweep-b-owner", name: "Sweep Owner B", role: "owner", isActive: true, currentBusinessId: bizB.id } as never).returning();

    for (const [u, b] of [[ownerA, bizA], [viewerA1, bizA], [viewerA2, bizA], [employeeA, bizA], [ownerB, bizB]] as const) {
      await db.insert(userBusinesses).values({ userId: u.id, businessId: b.id, role: u.role, isActive: true } as never);
    }
    await db.insert(userLocations).values({ userId: viewerA1.id, locationId: locA1.id, isActive: true } as never);
    await db.insert(userLocations).values({ userId: viewerA2.id, locationId: locA2.id, isActive: true } as never);

    // Enforce location assignment so the fan-out has a real branch dimension to respect.
    await db.insert(appSettings).values({ businessId: bizA.id, key: "enforceLocationAssignment", value: "true" } as never);
    await db.insert(appSettings).values({ businessId: bizA.id, key: "subscriptions_default_notify_days", value: "7" } as never);

    [catA] = await db.insert(expenseCategories).values({ businessId: bizA.id, name: "Sweep Cat A" } as never).returning();
  });

  async function insertSub(overrides: Record<string, unknown>) {
    const [row] = await db
      .insert(subscriptions)
      .values({
        businessId: bizA.id,
        name: "Sweep Sub",
        amount: "100.00",
        currency: "KES",
        cycleUnit: "month",
        cycleCount: 1,
        isOneTime: false,
        startDate: "2027-01-01",
        nextDueDate: "2027-06-15",
        autoRenew: false,
        status: "active",
        postingMode: "none",
        notifyEnabled: true,
        createdBy: ownerA.id,
        categoryId: catA.id,
        ...overrides,
      } as never)
      .returning();
    return row;
  }

  async function notificationsFor(userId: number, type: string, entityId: number) {
    return db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.type, type),
          eq(notifications.entityType, "subscription"),
          eq(notifications.entityId, entityId),
        ),
      );
  }

  it("creates exactly one due-soon notification per user per cycle across repeated runs", async () => {
    const sub = await insertSub({ name: "Due Soon Idempotent", nextDueDate: "2027-06-13", locationId: locA1.id });

    const first = await runSubscriptionSweep(db, sweepDay(0));
    expect(first.dueSoonCreated).toBeGreaterThan(0);

    const second = await runSubscriptionSweep(db, sweepDay(0));
    expect(second.dueSoonCreated).toBe(0);

    const rows = await notificationsFor(viewerA1.id, "subscription_due_soon", sub.id);
    expect(rows).toHaveLength(1);
  });

  it("fans out only to eligible users (branch assignment, permissions, tenant)", async () => {
    const wide = await insertSub({ name: "Fanout Wide", nextDueDate: "2027-06-12", locationId: null });
    const branchSub = await insertSub({ name: "Fanout Branch", nextDueDate: "2027-06-12", locationId: locA2.id });

    await runSubscriptionSweep(db, sweepDay(0));

    // Business-wide: both branch-restricted viewers see it.
    expect(await notificationsFor(viewerA1.id, "subscription_due_soon", wide.id)).toHaveLength(1);
    expect(await notificationsFor(viewerA2.id, "subscription_due_soon", wide.id)).toHaveLength(1);

    // Branch-pinned: only the locA2 viewer sees it.
    expect(await notificationsFor(viewerA2.id, "subscription_due_soon", branchSub.id)).toHaveLength(1);
    expect(await notificationsFor(viewerA1.id, "subscription_due_soon", branchSub.id)).toHaveLength(0);

    // Employee without subscriptions:view gets nothing; neither does the other business's owner.
    expect(await notificationsFor(employeeA.id, "subscription_due_soon", wide.id)).toHaveLength(0);
    expect(await notificationsFor(ownerB.id, "subscription_due_soon", wide.id)).toHaveLength(0);
  });

  it("re-highlights the same row on the due day instead of duplicating", async () => {
    const sub = await insertSub({ name: "Due Today", nextDueDate: "2027-06-10", locationId: locA1.id });

    await runSubscriptionSweep(db, sweepDay(0));
    const second = await runSubscriptionSweep(db, sweepDay(0));
    expect(second.dueTodayReHighlighted).toBeGreaterThan(0);

    const rows = await notificationsFor(viewerA1.id, "subscription_due", sub.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].highlightState).toBe("highlighted");
  });

  it("escalates overdue notifications from warning to critical at 3 days without duplicates", async () => {
    const sub = await insertSub({ name: "Overdue Escalation", nextDueDate: "2027-06-09", locationId: locA1.id });

    await runSubscriptionSweep(db, sweepDay(0)); // 1 day overdue -> warning
    const early = await notificationsFor(viewerA1.id, "subscription_overdue", sub.id);
    expect(early).toHaveLength(1);
    expect(early[0].severity).toBe("warning");

    await runSubscriptionSweep(db, sweepDay(2)); // 3 days overdue -> critical
    const later = await notificationsFor(viewerA1.id, "subscription_overdue", sub.id);
    expect(later).toHaveLength(1);
    expect(later[0].severity).toBe("critical");
  });

  it("auto-advances auto-renew subs with a pending payment row, replay-safe", async () => {
    const sub = await insertSub({ name: "Auto Renew Sweep", nextDueDate: "2027-06-10", autoRenew: true, locationId: locA1.id });

    const first = await runSubscriptionSweep(db, sweepDay(0));
    expect(first.autoAdvanced).toBeGreaterThan(0);
    expect(first.pendingPaymentsCreated).toBeGreaterThan(0);

    const payments = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.subscriptionId, sub.id));
    expect(payments).toHaveLength(1);
    expect(payments[0].confirmed).toBe(false);
    expect(payments[0].paidDate).toBeNull();
    expect(payments[0].cycleDueDate).toBe("2027-06-10");

    const [after] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id));
    expect(after.nextDueDate).toBe("2027-07-10");

    await runSubscriptionSweep(db, sweepDay(0)); // replay: no duplicate payment
    const replay = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.subscriptionId, sub.id));
    expect(replay).toHaveLength(1);

    const pendingNotes = await notificationsFor(viewerA1.id, "subscription_pending_payment", sub.id);
    expect(pendingNotes).toHaveLength(1);
  });

  it("creates trial-expiry notifications inside the 3-day window", async () => {
    const sub = await insertSub({ name: "Trial Ending", nextDueDate: "2027-07-01", trialEndsAt: "2027-06-12", locationId: locA1.id });
    await runSubscriptionSweep(db, sweepDay(0));
    const rows = await notificationsFor(viewerA1.id, "subscription_trial_ending", sub.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].severity).toBe("info");
  });

  it("clears subscription notifications for all users when a payment is recorded", async () => {
    const sub = await insertSub({ name: "Clear On Pay", nextDueDate: "2027-06-11", locationId: locA1.id });
    await runSubscriptionSweep(db, sweepDay(0));
    expect(await notificationsFor(viewerA1.id, "subscription_due_soon", sub.id)).toHaveLength(1);

    const caller = makeAuthedCaller(ownerA, bizA, [bizA.id]);
    await caller.subscriptions.recordPayment({ subscriptionId: sub.id, cycleDueDate: "2027-06-11", paymentMethod: "cash", paidDate: "2027-06-10" });

    const cleared = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.entityId, sub.id), eq(notifications.entityType, "subscription"), isNull(notifications.clearedAt)));
    expect(cleared).toHaveLength(0);

    const [row] = await db.select().from(notifications).where(and(eq(notifications.entityId, sub.id), eq(notifications.type, "subscription_due_soon")));
    expect(row.clearedReason).toBe("subscription_paid");
  });
});
