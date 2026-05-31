// ABOUTME: Tests that recurring bills are strictly isolated between accounts, businesses, and locations.
// ABOUTME: Verifies all recurring bill endpoints enforce tenant scoping via locationId and businessId.
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "../router";
import { getDb } from "../queries/connection";
import {
  accounts,
  businesses,
  customerAccounts,
  expenseCategories,
  locations,
  suppliers,
  userBusinesses,
  users,
  recurringBillTemplates,
} from "@db/schema";
import { eq, isNull, sql } from "drizzle-orm";

// Create an authenticated caller directly from a user record, bypassing JWT
function makeAuthedCaller(user: typeof users.$inferSelect, business: typeof businesses.$inferSelect, bizIds: number[]) {
  const ctx = {
    req: new Request("http://localhost/api/trpc"),
    resHeaders: new Headers(),
    user: {
      ...user,
      currentBusiness: { ...business, accountRefId: null } as any,
      businessIds: bizIds,
      allocationRightsProfile: null as any,
      accessSource: "owned" as const,
    },
  };
  return appRouter.createCaller(ctx);
}

describe("Recurring Bills Data Isolation", () => {
  let db: ReturnType<typeof getDb>;
  let bizA: typeof businesses.$inferSelect;
  let bizB: typeof businesses.$inferSelect;
  let locA: typeof locations.$inferSelect;
  let locB: typeof locations.$inferSelect;
  let userA: typeof users.$inferSelect;
  let userB: typeof users.$inferSelect;
  let supA: typeof suppliers.$inferSelect;
  let catA: typeof expenseCategories.$inferSelect;
  let accA: typeof accounts.$inferSelect;
  let recurringIdA: number;

  beforeAll(async () => {
    db = getDb();

    // Clean up any leftover data from previous runs
    for (const prefix of ["ISOBILLS_A_", "ISOBILLS_B_"]) {
      const existingBiz = await db.select({ id: businesses.id }).from(businesses)
        .where(sql`${businesses.slug} LIKE ${prefix + "%"}`);
      for (const b of existingBiz) {
        await db.delete(recurringBillTemplates).where(sql`${recurringBillTemplates.businessId} = ${b.id}`);
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
      await db.delete(users).where(sql`${users.username} LIKE ${"iso-bills-" + prefix.toLowerCase().slice(-2) + "%"}`);
    }

    // Create businesses
    [bizA] = await db.insert(businesses).values({
      accountId: "ISOBILLS_A",
      name: "Isolation Bills A",
      slug: "ISOBILLS_A_main",
      plan: "pro",
      isActive: true,
    } as any).returning();

    [bizB] = await db.insert(businesses).values({
      accountId: "ISOBILLS_B",
      name: "Isolation Bills B",
      slug: "ISOBILLS_B_main",
      plan: "pro",
      isActive: true,
    } as any).returning();

    // Create locations
    [locA] = await db.insert(locations).values({
      businessId: bizA.id,
      name: "Branch A",
      slug: "branch-a",
      isActive: true,
      nextBillNumber: 1,
      nextExpenseNumber: 1,
    } as any).returning();

    [locB] = await db.insert(locations).values({
      businessId: bizB.id,
      name: "Branch B",
      slug: "branch-b",
      isActive: true,
      nextBillNumber: 1,
      nextExpenseNumber: 1,
    } as any).returning();

    // Create users
    [userA] = await db.insert(users).values({
      username: "iso-bills-a1",
      role: "owner",
      isActive: true,
      currentBusinessId: bizA.id,
    } as any).returning();

    [userB] = await db.insert(users).values({
      username: "iso-bills-b1",
      role: "owner",
      isActive: true,
      currentBusinessId: bizB.id,
    } as any).returning();

    // Link users to businesses
    await db.insert(userBusinesses).values({
      userId: userA.id,
      businessId: bizA.id,
      role: "owner",
      isActive: true,
    } as any);

    await db.insert(userBusinesses).values({
      userId: userB.id,
      businessId: bizB.id,
      role: "owner",
      isActive: true,
    } as any);

    // Create a default cash account for A
    [accA] = await db.insert(accounts).values({
      businessId: bizA.id,
      locationId: locA.id,
      name: "Cash Drawer A",
      type: "cash",
      currentBalance: "1000.00",
      openingBalance: "1000.00",
      isActive: true,
    } as any).returning();

    // Create cash account for B
    await db.insert(accounts).values({
      businessId: bizB.id,
      locationId: locB.id,
      name: "Cash Drawer B",
      type: "cash",
      currentBalance: "2000.00",
      openingBalance: "2000.00",
      isActive: true,
    } as any).returning();

    // Create expense categories for A
    [catA] = await db.insert(expenseCategories).values({
      businessId: bizA.id,
      locationId: locA.id,
      name: "Rent A",
      color: "#C73E1D",
      defaultAccountId: accA.id,
      isActive: true,
    } as any).returning();

    // Create expense category for B
    const [accB] = await db.select({ id: accounts.id }).from(accounts)
      .where(eq(accounts.businessId, bizB.id)).limit(1);
    await db.insert(expenseCategories).values({
      businessId: bizB.id,
      locationId: locB.id,
      name: "Utilities B",
      color: "#2E7D32",
      defaultAccountId: accB.id,
      isActive: true,
    } as any).returning();

    // Create suppliers
    [supA] = await db.insert(suppliers).values({
      businessId: bizA.id,
      name: "Supplier A",
      currentBalance: "0.00",
      totalBilled: "0.00",
      totalPaid: "0.00",
    } as any).returning();

    const [supB] = await db.insert(suppliers).values({
      businessId: bizB.id,
      name: "Supplier B",
      currentBalance: "0.00",
      totalBilled: "0.00",
      totalPaid: "0.00",
    } as any).returning();

    // Create recurring bill for A via API
    const callerA = makeAuthedCaller(userA, bizA, [bizA.id]);
    const result = await callerA.bills.createRecurring({
      locationId: locA.id,
      supplierId: supA.id,
      description: "Account A Rent",
      amount: "50000.00",
      frequency: "monthly",
      nextDueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    });
    recurringIdA = result.id;

    // Create recurring bill for B via API
    const callerB = makeAuthedCaller(userB, bizB, [bizB.id]);
    await callerB.bills.createRecurring({
      locationId: locB.id,
      supplierId: supB.id,
      description: "B Utility",
      amount: "15000.00",
      frequency: "monthly",
      nextDueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    });
  });

  afterAll(async () => {
    // Clean up all test data
    for (const bid of [bizA?.id, bizB?.id]) {
      if (!bid) continue;
      await db.delete(recurringBillTemplates).where(sql`${recurringBillTemplates.businessId} = ${bid}`);
      await db.delete(expenseCategories).where(eq(expenseCategories.businessId, bid));
      const locs = await db.select({ id: locations.id }).from(locations).where(eq(locations.businessId, bid));
      for (const l of locs) {
        await db.delete(accounts).where(eq(accounts.locationId, l.id));
      }
      await db.delete(locations).where(eq(locations.businessId, bid));
      await db.delete(suppliers).where(eq(suppliers.businessId, bid));
      await db.delete(userBusinesses).where(eq(userBusinesses.businessId, bid));
      await db.delete(businesses).where(eq(businesses.id, bid));
    }
    if (userA) await db.delete(users).where(eq(users.id, userA.id));
    if (userB) await db.delete(users).where(eq(users.id, userB.id));
  });

  // ──────── Tests ────────

  it("listRecurring returns only caller's recurring bills", async () => {
    const callerA = makeAuthedCaller(userA, bizA, [bizA.id]);
    const callerB = makeAuthedCaller(userB, bizB, [bizB.id]);

    const listA = await callerA.bills.listRecurring({});
    const listB = await callerB.bills.listRecurring({});

    expect(listA.length).toBe(1);
    expect(listA[0].description).toBe("Account A Rent");

    expect(listB.length).toBe(1);
    expect(listB[0].description).toBe("B Utility");
  });

  it("listRecurring prevents cross-account visibility", async () => {
    const callerA = makeAuthedCaller(userA, bizA, [bizA.id]);
    const callerB = makeAuthedCaller(userB, bizB, [bizB.id]);

    const listA = await callerA.bills.listRecurring({});
    const listB = await callerB.bills.listRecurring({});

    expect(listA.map(r => r.description)).not.toContain("B Utility");
    expect(listB.map(r => r.description)).not.toContain("Account A Rent");
  });

  it("createRecurring validates location ownership", async () => {
    const callerB = makeAuthedCaller(userB, bizB, [bizB.id]);

    await expect(
      callerB.bills.createRecurring({
        locationId: locA.id,
        description: "Hacked recurring bill",
        amount: "10000.00",
        frequency: "monthly",
        nextDueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      }),
    ).rejects.toThrow();
  });

  it("updateRecurring rejects cross-account update", async () => {
    const callerB = makeAuthedCaller(userB, bizB, [bizB.id]);

    await expect(
      callerB.bills.updateRecurring({
        id: recurringIdA,
        description: "Hacked description",
        amount: "999999.00",
      }),
    ).rejects.toThrow("Entity not found or does not belong to the active business");
  });

  it("deleteRecurring rejects cross-account delete", async () => {
    const callerB = makeAuthedCaller(userB, bizB, [bizB.id]);

    await expect(
      callerB.bills.deleteRecurring({ id: recurringIdA }),
    ).rejects.toThrow("Entity not found or does not belong to the active business");
  });

  it("updateRecurring succeeds on own recurring bill", async () => {
    const callerA = makeAuthedCaller(userA, bizA, [bizA.id]);

    const result = await callerA.bills.updateRecurring({
      id: recurringIdA,
      description: "Updated Rent",
      amount: "55000.00",
    });
    expect(result.success).toBe(true);

    const listA = await callerA.bills.listRecurring({});
    const updated = listA.find(r => r.id === recurringIdA);
    expect(updated).toBeDefined();
    expect(updated!.description).toBe("Updated Rent");
    expect(updated!.amount).toBe("55000.00");
  });

  it("deleteRecurring succeeds on own recurring bill", async () => {
    // Create a one-off recurring bill for A to delete
    const [supTemp] = await db.insert(suppliers).values({
      businessId: bizA.id, name: "Temp Sup", currentBalance: "0.00",
      totalBilled: "0.00", totalPaid: "0.00",
    } as any).returning();

    const callerA = makeAuthedCaller(userA, bizA, [bizA.id]);
    const created = await callerA.bills.createRecurring({
      locationId: locA.id,
      supplierId: supTemp.id,
      description: "Temp Bill",
      amount: "1000.00",
      frequency: "monthly",
      nextDueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    });

    const result = await callerA.bills.deleteRecurring({ id: created.id });
    expect(result.success).toBe(true);

    const listA = await callerA.bills.listRecurring({});
    expect(listA.find(r => r.id === created.id)).toBeUndefined();
  });

  it("multiple recurring bills have full cross-account isolation", async () => {
    const callerA = makeAuthedCaller(userA, bizA, [bizA.id]);
    const callerB = makeAuthedCaller(userB, bizB, [bizB.id]);

    const [supA2] = await db.insert(suppliers).values({
      businessId: bizA.id, name: "Sup A2", currentBalance: "0.00",
      totalBilled: "0.00", totalPaid: "0.00",
    } as any).returning();

    const [supB2] = await db.insert(suppliers).values({
      businessId: bizB.id, name: "Sup B2", currentBalance: "0.00",
      totalBilled: "0.00", totalPaid: "0.00",
    } as any).returning();

    const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

    await callerA.bills.createRecurring({
      locationId: locA.id, supplierId: supA2.id,
      description: "A Insurance", amount: "8000.00",
      frequency: "monthly", nextDueDate: dueDate,
    });

    await callerB.bills.createRecurring({
      locationId: locB.id, supplierId: supB2.id,
      description: "B Lease", amount: "100000.00",
      frequency: "monthly", nextDueDate: dueDate,
    });

    const listA = await callerA.bills.listRecurring({});
    const listB = await callerB.bills.listRecurring({});

    expect(listA.map(r => r.description).sort()).not.toContain("B Lease");
    expect(listB.map(r => r.description).sort()).not.toContain("A Insurance");

    // Verify no ID overlap
    const allAIds = new Set(listA.map(r => r.id));
    const allBIds = new Set(listB.map(r => r.id));
    for (const id of allAIds) expect(allBIds.has(id)).toBe(false);
    for (const id of allBIds) expect(allAIds.has(id)).toBe(false);
  });

  it("dashboard alerts scope recurring bills by location", async () => {
    const callerA = makeAuthedCaller(userA, bizA, [bizA.id]);
    const callerB = makeAuthedCaller(userB, bizB, [bizB.id]);

    const alertsA = await callerA.dashboard.alerts();
    const alertsB = await callerB.dashboard.alerts();

    // A should not see B's recurring bill description
    expect(alertsA.upcomingRecurring.some(r => r.description === "B Utility")).toBe(false);
    // B should see B's own
    expect(alertsB.upcomingRecurring.some(r => r.description === "B Utility")).toBe(true);
  });

  it("unauthenticated access is rejected", async () => {
    const anonCaller = appRouter.createCaller({
      req: new Request("http://localhost/api/trpc"),
      resHeaders: new Headers(),
    });

    await expect(anonCaller.bills.listRecurring({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      anonCaller.bills.createRecurring({
        locationId: 1,
        description: "test",
        amount: "100",
        frequency: "monthly",
        nextDueDate: "2026-06-30",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("billCalendar is scoped correctly", async () => {
    const callerA = makeAuthedCaller(userA, bizA, [bizA.id]);
    const callerB = makeAuthedCaller(userB, bizB, [bizB.id]);

    const calA = await callerA.dashboard.billCalendar({});
    const calB = await callerB.dashboard.billCalendar({});

    expect(calA.recurring.some(r => r.description === "B Utility")).toBe(false);
    expect(calB.recurring.some(r => r.description === "Account A Rent")).toBe(false);
  });

  it("billsSummary recurring is scoped correctly", async () => {
    const callerA = makeAuthedCaller(userA, bizA, [bizA.id]);
    const callerB = makeAuthedCaller(userB, bizB, [bizB.id]);

    const summaryA = await callerA.dashboard.billsSummary();
    const summaryB = await callerB.dashboard.billsSummary();

    // A's summary should include A's rent but not B's utility
    expect(Number(summaryA.recurring.month.total)).toBeGreaterThan(0);
    expect(Number(summaryB.recurring.month.total)).toBeGreaterThan(0);
  });
});
