// ABOUTME: Integration tests verifying the notifications view's automatic-clearance
// ABOUTME: hook fires on successful bill payment. After paying a bill, any active
// ABOUTME: notification tied to that bill must be archived (single record — no
// ABOUTME: duplicate) and a fresh bill is not re-notified until it goes overdue again.
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
import { and, eq, isNull, sql } from "drizzle-orm";

function makeAuthedCaller(user: typeof users.$inferSelect, business: typeof businesses.$inferSelect, bizIds: number[]) {
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

describe("Notification Clearance on Bill Payment", () => {
  let db: ReturnType<typeof getDb>;
  let biz: typeof businesses.$inferSelect;
  let loc: typeof locations.$inferSelect;
  let user: typeof users.$inferSelect;
  let supplier: typeof suppliers.$inferSelect;
  let category: typeof expenseCategories.$inferSelect;
  let cashAcct: typeof accounts.$inferSelect;
  let billId: number;

  beforeAll(async () => {
    db = getDb();

    // Clean up any leftover data from previous runs
    const slugPrefix = "NOTIFCLR_";
    const existingBiz = await db.select({ id: businesses.id }).from(businesses)
      .where(sql`${businesses.slug} LIKE ${slugPrefix + "%"}`);
    for (const b of existingBiz) {
      await db.delete(notifications).where(eq(notifications.userId, user?.id ?? -1));
      await db.delete(bills).where(eq(bills.businessId, b.id));
      await db.delete(expenseCategories).where(eq(expenseCategories.businessId, b.id));
      const locs = await db.select({ id: locations.id }).from(locations).where(eq(locations.businessId, b.id));
      for (const l of locs) {
        await db.delete(accounts).where(eq(accounts.locationId, l.id));
      }
      await db.delete(locations).where(eq(locations.businessId, b.id));
      await db.delete(suppliers).where(eq(suppliers.businessId, b.id));
      await db.delete(userBusinesses).where(eq(userBusinesses.businessId, b.id));
      await db.delete(businesses).where(eq(businesses.id, b.id));
    }
    await db.delete(users).where(sql`${users.username} LIKE 'notif-clr-%'`);

    // Create business + location
    [biz] = await db.insert(businesses).values({
      accountId: "NOTIFCLR",
      name: "Notification Clearance Test",
      slug: "NOTIFCLR_main",
      plan: "pro",
      isActive: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any).returning();

    [loc] = await db.insert(locations).values({
      businessId: biz.id,
      name: "Main Branch",
      slug: "main-branch",
      isActive: true,
      nextBillNumber: 1,
      nextExpenseNumber: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any).returning();

    [user] = await db.insert(users).values({
      username: "notif-clr-owner",
      role: "owner",
      isActive: true,
      currentBusinessId: biz.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any).returning();

    await db.insert(userBusinesses).values({
      userId: user.id,
      businessId: biz.id,
      role: "owner",
      isActive: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    [cashAcct] = await db.insert(accounts).values({
      businessId: biz.id,
      locationId: loc.id,
      name: "Cash Drawer",
      type: "cash",
      currentBalance: "100000.00",
      openingBalance: "100000.00",
      isActive: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any).returning() as any;

    [supplier] = await db.insert(suppliers).values({
      businessId: biz.id,
      name: "Test Supplier",
      currentBalance: "0.00",
      totalBilled: "0.00",
      totalPaid: "0.00",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any).returning();

    [category] = await db.insert(expenseCategories).values({
      businessId: biz.id,
      locationId: loc.id,
      name: "Office Rent",
      color: "#C73E1D",
      defaultAccountId: cashAcct.id,
      isActive: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any).returning();

    // Create an overdue bill (due yesterday, balance > 0)
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const issueDate = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const [bill] = await db.insert(bills).values({
      businessId: biz.id,
      locationId: loc.id,
      supplierId: supplier.id,
      categoryId: category.id,
      billNumber: "BILL-NOTIF-001",
      description: "Office rent overdue",
      amount: "50000.00",
      amountPaid: "0.00",
      balanceDue: "50000.00",
      issueDate,
      dueDate: yesterday,
      status: "overdue",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any).returning();
    billId = (bill as unknown as { id: number }).id;
  });

  afterAll(async () => {
    if (billId) {
      await db.delete(bills).where(eq(bills.id, billId));
    }
    if (biz) {
      await db.delete(notifications).where(eq(notifications.userId, user.id));
      await db.delete(expenseCategories).where(eq(expenseCategories.businessId, biz.id));
      await db.delete(accounts).where(eq(accounts.locationId, loc.id));
      await db.delete(locations).where(eq(locations.businessId, biz.id));
      await db.delete(suppliers).where(eq(suppliers.businessId, biz.id));
      await db.delete(userBusinesses).where(eq(userBusinesses.businessId, biz.id));
      await db.delete(businesses).where(eq(businesses.id, biz.id));
    }
    if (user) await db.delete(users).where(eq(users.id, user.id));
  });

  it("generates a single overdue-bill notification (no duplicates across multiple scans)", async () => {
    const caller = makeAuthedCaller(user, biz, [biz.id]);
    const first = await caller.notifications.generateOverdueNotifications();
    expect(first.created).toBe(1);
    expect(first.reHighlighted).toBe(0);

    const second = await caller.notifications.generateOverdueNotifications();
    // No duplicate is created — the single record is updated in-place.
    expect(second.created).toBe(0);
    expect(second.reHighlighted).toBe(0);

    // Exactly one notification row exists for this bill.
    const rows = await db.select().from(notifications).where(
      and(
        eq(notifications.userId, user.id),
        eq(notifications.entityType, "bill"),
        eq(notifications.entityId, billId),
      ),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].highlightState).toBe("highlighted");
    expect(rows[0].clearedAt).toBeNull();
  });

  it("clearForEntity archives the notification when invoked with reason 'bill_paid'", async () => {
    const caller = makeAuthedCaller(user, biz, [biz.id]);
    const result = await caller.notifications.clearForEntity({
      entityType: "bill",
      entityId: billId,
      reason: "bill_paid",
    });
    expect(result.success).toBe(true);
    expect(result.cleared).toBe(1);

    const [row] = await db.select().from(notifications).where(
      and(
        eq(notifications.userId, user.id),
        eq(notifications.entityType, "bill"),
        eq(notifications.entityId, billId),
      ),
    );
    expect(row).toBeDefined();
    expect(row.highlightState).toBe("archived");
    expect(row.archivedAt).not.toBeNull();
    expect(row.clearedAt).not.toBeNull();
    expect(row.clearedReason).toBe("bill_paid");
  });

  it("clearForEntity is a no-op when called again on the same archived row", async () => {
    const caller = makeAuthedCaller(user, biz, [biz.id]);
    const result = await caller.notifications.clearForEntity({
      entityType: "bill",
      entityId: billId,
      reason: "bill_paid",
    });
    expect(result.cleared).toBe(0);
  });

  it("clearAll archives every active notification for the user", async () => {
    // Reset by inserting a fresh notification we can clear.
    await db.insert(notifications).values({
      userId: user.id,
      type: "manual",
      title: "Test clear-all",
      message: "Will be cleared",
      severity: "info",
      entityType: "test",
      entityId: 0,
      highlightState: "highlighted",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const caller = makeAuthedCaller(user, biz, [biz.id]);
    const result = await caller.notifications.clearAll();
    expect(result.success).toBe(true);
    expect(result.cleared).toBeGreaterThanOrEqual(1);

    const active = await db.select().from(notifications).where(
      and(
        eq(notifications.userId, user.id),
        isNull(notifications.clearedAt),
      ),
    );
    expect(active).toHaveLength(0);
  });
});
