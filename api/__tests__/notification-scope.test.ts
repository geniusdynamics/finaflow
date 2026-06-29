// ABOUTME: Regression tests verifying overdue-bill notifications are scoped to
// ABOUTME: the caller's business — NOT leaked across tenants.
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "../router";
import { getDb } from "../queries/connection";
import {
  accounts,
  bills,
  businesses,
  expenseCategories,
  locations,
  notifications,
  suppliers,
  userBusinesses,
  users,
} from "@db/schema";
import { and, eq, sql } from "drizzle-orm";

function makeAuthedCaller(
  user: typeof users.$inferSelect,
  business: typeof businesses.$inferSelect,
  bizIds: number[],
) {
  const ctx = {
    req: new Request("http://localhost/api/trpc"),
    resHeaders: new Headers(),
    user: {
      ...user,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      currentBusiness: { ...business, accountRefId: null } as any,
      businessIds: bizIds,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allocationRightsProfile: null as any,
      accessSource: "owned" as const,
    },
  };
  return appRouter.createCaller(ctx);
}

describe("Notification Business Isolation", () => {
  let db: ReturnType<typeof getDb>;
  let bizA: typeof businesses.$inferSelect;
  let bizB: typeof businesses.$inferSelect;
  let locA: typeof locations.$inferSelect;
  let locB: typeof locations.$inferSelect;
  let userA: typeof users.$inferSelect;
  let supplierB: typeof suppliers.$inferSelect;
  let categoryB: typeof expenseCategories.$inferSelect;
  let cashAcctB: typeof accounts.$inferSelect;

  beforeAll(async () => {
    db = getDb();

    // ── Clean previous runs ──────────────────────────────────────
    const prefix = "NOTIFSCOPE_";
    const existing = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(sql`${businesses.slug} LIKE ${prefix + "%"}`);
    for (const b of existing) {
      await db.delete(notifications).where(sql`1=1`);
      await db.delete(bills).where(eq(bills.businessId, b.id));
      await db.delete(expenseCategories).where(eq(expenseCategories.businessId, b.id));
      await db.delete(accounts).where(eq(accounts.businessId, b.id));
      const ll = await db
        .select({ id: locations.id })
        .from(locations)
        .where(eq(locations.businessId, b.id));
      for (const l of ll) await db.delete(locations).where(eq(locations.id, l.id));
      await db.delete(suppliers).where(eq(suppliers.businessId, b.id));
      await db.delete(userBusinesses).where(eq(userBusinesses.businessId, b.id));
      await db.delete(businesses).where(eq(businesses.id, b.id));
    }
    await db.delete(users).where(sql`${users.username} LIKE 'notif-scope-%'`);

    // ── Business A — user's legit business ────────────────────────
    [bizA] = await db
      .insert(businesses)
      .values({
        accountId: "NOTIFSCOPE_A",
        name: "Notification Scope A",
        slug: "NOTIFSCOPE_A",
        plan: "pro",
        isActive: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .returning();

    [locA] = await db
      .insert(locations)
      .values({
        businessId: bizA.id,
        name: "Branch A",
        slug: "notifscope-branch-a",
        isActive: true,
        nextBillNumber: 1,
        nextExpenseNumber: 1,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .returning();

    [userA] = await db
      .insert(users)
      .values({
        username: "notif-scope-owner",
        role: "owner",
        isActive: true,
        currentBusinessId: bizA.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .returning();

    await db
      .insert(userBusinesses)
      .values({
        userId: userA.id,
        businessId: bizA.id,
        role: "owner",
        isActive: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

    // ── Business B — separate business that userA should NOT see ──
    [bizB] = await db
      .insert(businesses)
      .values({
        accountId: "NOTIFSCOPE_B",
        name: "Notification Scope B",
        slug: "NOTIFSCOPE_B",
        plan: "pro",
        isActive: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .returning();

    [locB] = await db
      .insert(locations)
      .values({
        businessId: bizB.id,
        name: "Branch B",
        slug: "notifscope-branch-b",
        isActive: true,
        nextBillNumber: 1,
        nextExpenseNumber: 1,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .returning();

    [cashAcctB] = await db
      .insert(accounts)
      .values({
        businessId: bizB.id,
        locationId: locB.id,
        name: "Cash B",
        type: "cash",
        currentBalance: "50000.00",
        openingBalance: "50000.00",
        isActive: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .returning() as any;

    [supplierB] = await db
      .insert(suppliers)
      .values({
        businessId: bizB.id,
        name: "Supplier B",
        currentBalance: "25000.00",
        totalBilled: "25000.00",
        totalPaid: "0.00",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .returning() as any;

    [categoryB] = await db
      .insert(expenseCategories)
      .values({
        businessId: bizB.id,
        locationId: locB.id,
        name: "Services B",
        color: "#1E88E5",
        defaultAccountId: cashAcctB.id,
        isActive: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .returning();
  });

  afterAll(async () => {
    await db.delete(notifications).where(sql`1=1`);
    for (const id of [bizA?.id, bizB?.id].filter(Boolean)) {
      await db.delete(bills).where(eq(bills.businessId, id));
      await db.delete(expenseCategories).where(eq(expenseCategories.businessId, id));
      await db.delete(accounts).where(eq(accounts.businessId, id));
      const ll = await db
        .select({ id: locations.id })
        .from(locations)
        .where(eq(locations.businessId, id));
      for (const l of ll) await db.delete(locations).where(eq(locations.id, l.id));
      await db.delete(suppliers).where(eq(suppliers.businessId, id));
      await db.delete(userBusinesses).where(eq(userBusinesses.businessId, id));
      await db.delete(businesses).where(eq(businesses.id, id));
    }
    if (userA) await db.delete(users).where(eq(users.id, userA.id));
  });

  it("generateOverdueNotifications does NOT leak bills from other businesses", async () => {
    // ── Create an overdue bill in Business B (which userA has no access to) ──
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const issueDate = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

    const [bizBBill] = await db
      .insert(bills)
      .values({
        businessId: bizB.id,
        locationId: locB.id,
        supplierId: supplierB.id,
        categoryId: categoryB.id,
        billNumber: "BILL-LEAK-001",
        description: "Business B overdue invoice — should not leak",
        amount: "15000.00",
        amountPaid: "0.00",
        balanceDue: "15000.00",
        issueDate,
        dueDate: yesterday,
        status: "overdue",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .returning();

    // ── User A calls generateOverdueNotifications ──────────────────
    const callerA = makeAuthedCaller(userA, bizA, [bizA.id]);
    const result = await callerA.notifications.generateOverdueNotifications();

    // User A should NOT see Business B's bill.
    // If the query leaks, created > 0 and a notification row will exist.
    // If properly scoped, created === 0 because Business A has no overdue bills.
    expect(result.created).toBe(0);
    expect(result.reHighlighted).toBe(0);

    // Double-check no notification was created for Business B's bill
    const rows = await db
      .select()
      .from(notifications)
      .where(
        and(eq(notifications.entityType, "bill"), eq(notifications.entityId, bizBBill.id)),
      )
      .limit(1);
    expect(rows).toHaveLength(0);

    // Cleanup
    await db.delete(bills).where(eq(bills.id, bizBBill.id));
  });
});
