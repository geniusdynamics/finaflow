// ABOUTME: Integration tests for the budgets router covering CRUD, lifecycle, and period-aware bucket generation.
// ABOUTME: Tests use the same makeAuthedCaller pattern as other api/__tests__ files.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appRouter } from "../router";
import { getDb } from "../queries/connection";
import {
  accounts, businesses, expenseCategories, locations, userBusinesses, users,
  budgetPlans as bp, budgetPlanBuckets as bpb, budgetBucketLines as bbl,
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
      currentBusiness: { ...business, accountRefId: null } as any,
      businessIds: bizIds,
      allocationRightsProfile: null as any,
      accessSource: "owned" as const,
    },
  };
  return appRouter.createCaller(ctx);
}

describe("Budgets Router", () => {
  let db: ReturnType<typeof getDb>;
  let biz: typeof businesses.$inferSelect;
  let loc: typeof locations.$inferSelect;
  let user: typeof users.$inferSelect;
  let cat1: typeof expenseCategories.$inferSelect;
  let cat2: typeof expenseCategories.$inferSelect;
  let cashAcct: typeof accounts.$inferSelect;

  const slugPrefix = "BGT_";

  beforeAll(async () => {
    db = getDb();

    // Clean up any leftover data from previous runs
    const existingBiz = await db.select({ id: businesses.id }).from(businesses)
      .where(sql`${businesses.slug} LIKE ${slugPrefix + "%"}`);
    for (const b of existingBiz) {
      await db.delete(bbl).where(sql`${bbl.bucketId} IN (SELECT id FROM ${bpb} WHERE ${bpb.planId} IN (SELECT id FROM ${bp} WHERE ${bp.locationId} IN (SELECT id FROM ${locations} WHERE ${locations.businessId} = ${b.id})))`);
      await db.delete(bpb).where(sql`${bpb.planId} IN (SELECT id FROM ${bp} WHERE ${bp.locationId} IN (SELECT id FROM ${locations} WHERE ${locations.businessId} = ${b.id}))`);
      await db.delete(bp).where(sql`${bp.locationId} IN (SELECT id FROM ${locations} WHERE ${locations.businessId} = ${b.id})`);
      await db.delete(expenseCategories).where(eq(expenseCategories.businessId, b.id));
      const locs = await db.select({ id: locations.id }).from(locations).where(eq(locations.businessId, b.id));
      for (const l of locs) {
        await db.delete(accounts).where(eq(accounts.locationId, l.id));
      }
      await db.delete(locations).where(eq(locations.businessId, b.id));
      await db.delete(accounts).where(eq(accounts.businessId, b.id));
      await db.delete(userBusinesses).where(eq(userBusinesses.businessId, b.id));
      await db.delete(businesses).where(eq(businesses.id, b.id));
    }
    await db.delete(users).where(sql`${users.username} LIKE 'bgt-%'`);

    const [business] = await db.insert(businesses).values({
      accountId: "BGTEST",
      name: "Budget Test Biz",
      slug: slugPrefix + "main",
      plan: "pro",
      isActive: true,
    } as any).returning();
    biz = business;

    const [location] = await db.insert(locations).values({
      businessId: biz.id,
      name: "Main",
      slug: slugPrefix + "loc",
      isActive: true,
      nextBillNumber: 1,
      nextExpenseNumber: 1,
    } as any).returning();
    loc = location;

    const [usr] = await db.insert(users).values({
      username: "bgt-owner",
      role: "owner",
      isActive: true,
      currentBusinessId: biz.id,
    } as any).returning();
    user = usr;

    await db.insert(userBusinesses).values({
      userId: user.id,
      businessId: biz.id,
      role: "owner",
      isActive: true,
    } as any);

    const [acct] = await db.insert(accounts).values({
      businessId: biz.id,
      locationId: loc.id,
      name: "Petty Cash",
      type: "cash",
      currentBalance: "50000.00",
      openingBalance: "50000.00",
      isActive: true,
    } as any).returning() as any;
    cashAcct = acct;

    const [c1] = await db.insert(expenseCategories).values({
      businessId: biz.id,
      locationId: loc.id,
      name: "Office Supplies",
      color: "#FF0000",
      defaultAccountId: cashAcct.id,
      isActive: true,
    } as any).returning() as any;
    cat1 = c1;

    const [c2] = await db.insert(expenseCategories).values({
      businessId: biz.id,
      locationId: loc.id,
      name: "Utilities",
      color: "#00FF00",
      defaultAccountId: cashAcct.id,
      isActive: true,
    } as any).returning() as any;
    cat2 = c2;
  });

  afterAll(async () => {
    if (!biz) return;
    await db.delete(bbl).where(sql`${bbl.bucketId} IN (SELECT id FROM ${bpb} WHERE ${bpb.planId} IN (SELECT id FROM ${bp} WHERE ${bp.locationId} IN (SELECT id FROM ${locations} WHERE ${locations.businessId} = ${biz.id})))`);
    await db.delete(bpb).where(sql`${bpb.planId} IN (SELECT id FROM ${bp} WHERE ${bp.locationId} IN (SELECT id FROM ${locations} WHERE ${locations.businessId} = ${biz.id}))`);
    await db.delete(bp).where(sql`${bp.locationId} IN (SELECT id FROM ${locations} WHERE ${locations.businessId} = ${biz.id})`);
    await db.delete(expenseCategories).where(eq(expenseCategories.businessId, biz.id));
    await db.delete(accounts).where(eq(accounts.locationId, loc.id));
    await db.delete(locations).where(eq(locations.id, loc.id));
    await db.delete(userBusinesses).where(eq(userBusinesses.businessId, biz.id));
    await db.delete(businesses).where(eq(businesses.id, biz.id));
    if (user) await db.delete(users).where(eq(users.id, user.id));
  });

  // Helper: create a monthly draft plan with 2 category lines
  async function createMonthlyPlan(opts?: { fiscalYearStart?: number; saveAs?: string; name?: string }) {
    const caller = makeAuthedCaller(user, biz, [biz.id]);
    return caller.budgets.create({
      locationId: loc.id,
      fiscalYearStart: opts?.fiscalYearStart ?? 2025,
      period: "monthly",
      name: opts?.name ?? "FY 2025 Monthly",
      lines: [
        { categoryId: cat1.id, amount: "1000.00" },
        { categoryId: cat2.id, amount: "2000.00" },
      ],
      saveAs: (opts?.saveAs ?? "draft") as "draft" | "active",
    });
  }

  // ── Test 1: Create monthly budget ──────────────────────────────────────

  it("creates a monthly budget with 12 buckets", async () => {
    const result = await createMonthlyPlan();
    expect(result.planId).toBeGreaterThan(0);

    const buckets = await db.select().from(bpb).where(eq(bpb.planId, result.planId));
    expect(buckets).toHaveLength(12);
    expect(buckets[0].bucketType).toBe("month");
    expect(buckets[0].bucketIndex).toBe(0);
    expect(buckets[11].bucketIndex).toBe(11);

    const allLines = await db.select().from(bbl).where(
      sql`${bbl.bucketId} IN (${sql.join(buckets.map((b) => sql`${b.id}`), sql`, `)})`,
    );
    expect(allLines).toHaveLength(24);

    // Clean up
    await db.delete(bbl).where(sql`${bbl.bucketId} IN (SELECT id FROM ${bpb} WHERE ${bpb.planId} = ${result.planId})`);
    await db.delete(bpb).where(eq(bpb.planId, result.planId));
    await db.delete(bp).where(eq(bp.id, result.planId));
  });

  // ── Test 2: Create quarterly budget ─────────────────────────────────────

  it("creates a quarterly budget with 4 buckets", async () => {
    const caller = makeAuthedCaller(user, biz, [biz.id]);
    const result = await caller.budgets.create({
      locationId: loc.id,
      fiscalYearStart: 2025,
      period: "quarterly",
      name: "FY 2025 Quarterly",
      lines: [{ categoryId: cat1.id, amount: "6000.00" }],
      saveAs: "active",
    });
    expect(result.planId).toBeGreaterThan(0);

    const buckets = await db.select().from(bpb).where(eq(bpb.planId, result.planId));
    expect(buckets).toHaveLength(4);
    expect(buckets.map((b) => b.bucketType)).toEqual(["quarter", "quarter", "quarter", "quarter"]);
    expect(buckets.map((b) => b.bucketIndex)).toEqual([0, 1, 2, 3]);

    await db.delete(bbl).where(sql`${bbl.bucketId} IN (SELECT id FROM ${bpb} WHERE ${bpb.planId} = ${result.planId})`);
    await db.delete(bpb).where(eq(bpb.planId, result.planId));
    await db.delete(bp).where(eq(bp.id, result.planId));
  });

  // ── Test 3: Create half-yearly / annual budgets ─────────────────────────

  it("creates half-yearly (2) and annual (1) budgets", async () => {
    const caller = makeAuthedCaller(user, biz, [biz.id]);

    const halfResult = await caller.budgets.create({
      locationId: loc.id, fiscalYearStart: 2025, period: "half-yearly",
      name: "Half-Yearly Test", lines: [{ categoryId: cat1.id, amount: "12000.00" }],
    });
    const halfBuckets = await db.select().from(bpb).where(eq(bpb.planId, halfResult.planId));
    expect(halfBuckets).toHaveLength(2);
    expect(halfBuckets[0].bucketType).toBe("half");

    const annualResult = await caller.budgets.create({
      locationId: loc.id, fiscalYearStart: 2025, period: "annual",
      name: "Annual Test", lines: [{ categoryId: cat1.id, amount: "24000.00" }],
    });
    const annualBuckets = await db.select().from(bpb).where(eq(bpb.planId, annualResult.planId));
    expect(annualBuckets).toHaveLength(1);
    expect(annualBuckets[0].bucketType).toBe("annual");

    for (const id of [halfResult.planId, annualResult.planId]) {
      await db.delete(bbl).where(sql`${bbl.bucketId} IN (SELECT id FROM ${bpb} WHERE ${bpb.planId} = ${id})`);
      await db.delete(bpb).where(eq(bpb.planId, id));
      await db.delete(bp).where(eq(bp.id, id));
    }
  });

  // ── Test 4: Create a shared plan for tests 5-12 ─────────────────────────
  let sharedPlanId: number;

  it("(setup) creates a monthly draft plan for shared use", async () => {
    const result = await createMonthlyPlan();
    expect(result.planId).toBeGreaterThan(0);
    sharedPlanId = result.planId;
  });

  // ── Test 5: List by year ────────────────────────────────────────────────

  it("lists plans by year and filters by status", async () => {
    const caller = makeAuthedCaller(user, biz, [biz.id]);

    const listAll = await caller.budgets.listByYear({ year: 2025 });
    expect(listAll.length).toBeGreaterThanOrEqual(1);
    expect(listAll.some((p) => p.id === sharedPlanId)).toBe(true);

    const listDraft = await caller.budgets.listByYear({ year: 2025, statuses: ["draft"] });
    expect(listDraft.every((p) => p.status === "draft")).toBe(true);

    const listActive = await caller.budgets.listByYear({ year: 2025, statuses: ["active"] });
    expect(listActive.every((p) => p.status === "active")).toBe(true);

    const monthlyPlan = listAll.find((p) => p.id === sharedPlanId);
    expect(monthlyPlan).toBeDefined();
    expect(monthlyPlan!.bucketCount).toBe(12);
  });

  // ── Test 6: Get single plan ─────────────────────────────────────────────

  it("gets a single plan with buckets and enriched lines", async () => {
    const caller = makeAuthedCaller(user, biz, [biz.id]);
    const plan = await caller.budgets.get({ planId: sharedPlanId });
    expect(plan.id).toBe(sharedPlanId);
    expect(plan.name).toBe("FY 2025 Monthly");
    expect(plan.buckets).toHaveLength(12);
    for (const bucket of plan.buckets) {
      expect(bucket.lines).toHaveLength(2);
      expect(bucket.lines[0].categoryName).toBeTruthy();
    }
  });

  // ── Test 7: UpdateLines on one bucket ───────────────────────────────────

  it("updateLines replaces lines on one bucket and leaves others unchanged", async () => {
    const caller = makeAuthedCaller(user, biz, [biz.id]);
    const { planId } = await createMonthlyPlan({ name: "Update Lines Test" });
    const plan = await caller.budgets.get({ planId });
    const firstBucket = plan.buckets[0];

    await caller.budgets.updateLines({
      planId,
      bucketId: firstBucket.id,
      lines: [{ categoryId: cat1.id, amount: "9999.99" }],
    });

    const updated = await caller.budgets.get({ planId });
    expect(updated.buckets[0].lines).toHaveLength(1);
    expect(updated.buckets[0].lines[0].amount).toBe("9999.99");
    expect(updated.buckets[1].lines).toHaveLength(2);
    expect(updated.buckets[1].lines[0].amount).toBe("1000.00");
    expect(updated.buckets[1].lines[1].amount).toBe("2000.00");
  });

  // ── Test 8: UpdateLines preserves plan status ──────────────────────────

  it("updateLines does not change plan status", async () => {
    const caller = makeAuthedCaller(user, biz, [biz.id]);
    const { planId } = await createMonthlyPlan({ name: "Status Preserve Test" });
    const before = await caller.budgets.get({ planId });
    expect(before.status).toBe("draft");

    await caller.budgets.updateLines({
      planId,
      bucketId: before.buckets[2].id,
      lines: [{ categoryId: cat1.id, amount: "500.00" }],
    });

    const after = await caller.budgets.get({ planId });
    expect(after.status).toBe("draft");
  });

  // ── Test 9: CopyMonthlyBucket ──────────────────────────────────────────

  it("copyMonthlyBucket copies lines to target buckets", async () => {
    const caller = makeAuthedCaller(user, biz, [biz.id]);
    const { planId } = await createMonthlyPlan({ name: "Copy Bucket Test" });
    const plan = await caller.budgets.get({ planId });
    expect(plan.buckets).toHaveLength(12);
    const sourceBucket = plan.buckets[0];
    const target1 = plan.buckets[5];
    const target2 = plan.buckets[10];

    // Make source bucket have a distinct value
    await caller.budgets.updateLines({
      planId,
      bucketId: sourceBucket.id,
      lines: [{ categoryId: cat1.id, amount: "7777.00" }],
    });

    const result = await caller.budgets.copyMonthlyBucket({
      planId,
      sourceBucketId: sourceBucket.id,
      targetBucketIds: [target1.id, target2.id],
    });

    expect(result.success).toBe(true);
    expect(result.copiedTo).toHaveLength(2);

    const updated = await caller.budgets.get({ planId });
    expect(updated.buckets[5].lines).toHaveLength(updated.buckets[0].lines.length);
    expect(updated.buckets[5].lines[0].amount).toBe(updated.buckets[0].lines[0].amount);
    expect(updated.buckets[10].lines[0].amount).toBe(updated.buckets[0].lines[0].amount);
  });

  // ── Test 10: CopyMonthlyBucket rejects source in targets ───────────────

  it("copyMonthlyBucket rejects source bucket in targets", async () => {
    const caller = makeAuthedCaller(user, biz, [biz.id]);
    const { planId } = await createMonthlyPlan({ name: "Copy Reject Test" });
    const plan = await caller.budgets.get({ planId });
    expect(plan.buckets).toHaveLength(12);

    await expect(
      caller.budgets.copyMonthlyBucket({
        planId,
        sourceBucketId: plan.buckets[0].id,
        targetBucketIds: [plan.buckets[0].id, plan.buckets[3].id],
      }),
    ).rejects.toThrow("Source bucket cannot be included");
  });

  // ── Test 11: Lifecycle transitions ─────────────────────────────────────

  it("activates, locks, and archives a plan in sequence", async () => {
    const caller = makeAuthedCaller(user, biz, [biz.id]);
    const result = await createMonthlyPlan({ name: "Lifecycle Test" });
    const lifecyclePlanId = result.planId;

    await caller.budgets.activate({ planId: lifecyclePlanId });
    let plan = await caller.budgets.get({ planId: lifecyclePlanId });
    expect(plan.status).toBe("active");

    await caller.budgets.lock({ planId: lifecyclePlanId });
    plan = await caller.budgets.get({ planId: lifecyclePlanId });
    expect(plan.status).toBe("locked");
    expect(plan.lockedAt).toBeTruthy();

    await caller.budgets.archive({ planId: lifecyclePlanId });
    plan = await caller.budgets.get({ planId: lifecyclePlanId });
    expect(plan.status).toBe("archived");
    expect(plan.archivedAt).toBeTruthy();

    await db.delete(bbl).where(sql`${bbl.bucketId} IN (SELECT id FROM ${bpb} WHERE ${bpb.planId} = ${lifecyclePlanId})`);
    await db.delete(bpb).where(eq(bpb.planId, lifecyclePlanId));
    await db.delete(bp).where(eq(bp.id, lifecyclePlanId));
  });

  // ── Test 12: NOT_FOUND errors ─────────────────────────────────────────

  it("throws NOT_FOUND when updating lines on a non-existent plan", async () => {
    const caller = makeAuthedCaller(user, biz, [biz.id]);
    await expect(
      caller.budgets.updateLines({ planId: 99999999, bucketId: 1, lines: [{ categoryId: cat1.id, amount: "100.00" }] }),
    ).rejects.toThrow("Budget plan not found");
  });

  it("throws NOT_FOUND when getting a non-existent plan", async () => {
    const caller = makeAuthedCaller(user, biz, [biz.id]);
    await expect(caller.budgets.get({ planId: 99999999 })).rejects.toThrow("Budget plan not found");
  });

  it("throws NOT_FOUND when activating a non-existent plan", async () => {
    const caller = makeAuthedCaller(user, biz, [biz.id]);
    await expect(caller.budgets.activate({ planId: 99999999 })).rejects.toThrow("Budget plan not found");
  });

  it("throws NOT_FOUND when locking a non-existent plan", async () => {
    const caller = makeAuthedCaller(user, biz, [biz.id]);
    await expect(caller.budgets.lock({ planId: 99999999 })).rejects.toThrow("Budget plan not found");
  });

  it("throws NOT_FOUND when archiving a non-existent plan", async () => {
    const caller = makeAuthedCaller(user, biz, [biz.id]);
    await expect(caller.budgets.archive({ planId: 99999999 })).rejects.toThrow("Budget plan not found");
  });

  // ── Cleanup: remove the shared plan ──────────────────────────────────

  it("(cleanup) removes the shared plan", async () => {
    if (sharedPlanId) {
      await db.delete(bbl).where(sql`${bbl.bucketId} IN (SELECT id FROM ${bpb} WHERE ${bpb.planId} = ${sharedPlanId})`);
      await db.delete(bpb).where(eq(bpb.planId, sharedPlanId));
      await db.delete(bp).where(eq(bp.id, sharedPlanId));
    }
  });
});
