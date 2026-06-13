// ABOUTME: Budget Plan router -- period-aware budget CRUD with monthly/quarterly/half-yearly/annual support.
// ABOUTME: All procedures require budget:manage permission and are scoped to the active business locations.
import { z } from "zod";
import { createRouter, budgetManage, getCurrentBusinessLocationIds } from "./middleware";
import { getDb } from "./queries/connection";
import { budgetPlans, budgetPlanBuckets, budgetBucketLines, expenseCategories, type InsertBudgetPlan } from "@db/schema";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { d } from "./lib/decimal";
import { generateTrackedBuckets } from "@/lib/budgets/period";
import { validatePeriod, validateBudgetLines } from "@/lib/budgets/validation";
import { getFiscalYearStart } from "@/lib/budgets/fiscal-year";
import type { Period } from "@/lib/budgets/fiscal-year";
import { TRPCError } from "@trpc/server";

async function resolveLocationFilter(ctx: object, inputLocationId?: number): Promise<number[]> {
  const locIds = await getCurrentBusinessLocationIds(ctx);
  if (inputLocationId !== undefined) {
    if (!locIds.includes(inputLocationId)) { throw new TRPCError({ code: "FORBIDDEN", message: "Invalid location for the current business" }); }
    return [inputLocationId];
  }
  return locIds;
}

async function requirePlanAccess(ctx: object, planId: number) {
  const db = getDb();
  const locIds = await getCurrentBusinessLocationIds(ctx);
  if (locIds.length === 0) { throw new TRPCError({ code: "FORBIDDEN", message: "No active business locations" }); }
  const locIdSql = sql.join(locIds.map((id) => sql`${id}`), sql`, `);
  const [plan] = await db.select().from(budgetPlans).where(and(eq(budgetPlans.id, planId), sql`${budgetPlans.locationId} IN (${locIdSql})`, isNull(budgetPlans.deletedAt))).limit(1);
  if (!plan) { throw new TRPCError({ code: "NOT_FOUND", message: "Budget plan not found or access denied" }); }
  return plan;
}

export const budgetsRouter = createRouter({
  create: budgetManage
    .input(z.object({
      locationId: z.number(),
      fiscalYearStart: z.number().int(),
      period: z.string(),
      name: z.string().optional(),
      notes: z.string().optional(),
      lines: z.array(z.object({ categoryId: z.number(), amount: z.string() })),
      saveAs: z.enum(["draft", "active"]).default("draft"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const locIds = await resolveLocationFilter(ctx, input.locationId);
      validatePeriod(input.period);
      validateBudgetLines(input.lines);
      const fiscalStartMonth = getFiscalYearStart();
      const buckets = generateTrackedBuckets(input.period as Period, fiscalStartMonth);
      return await db.transaction(async (tx) => {
        const [plan] = await tx.insert(budgetPlans).values({
          locationId: locIds[0],
          fiscalYearStart: input.fiscalYearStart,
          period: input.period as Period,
          name: input.name ?? null,
          notes: input.notes ?? null,
          status: input.saveAs === "active" ? "active" : "draft",
          createdById: (ctx as { user?: { id: number } }).user?.id ?? null,
        } satisfies InsertBudgetPlan).returning();
        for (const bucket of buckets) {
          const [insertedBucket] = await tx.insert(budgetPlanBuckets).values({
            planId: plan.id, bucketType: bucket.bucketType, bucketIndex: bucket.bucketIndex,
            startMonth: bucket.startMonth, endMonth: bucket.endMonth, label: bucket.label,
          }).returning();
          for (const line of input.lines) {
            await tx.insert(budgetBucketLines).values({ bucketId: insertedBucket.id, categoryId: line.categoryId, amount: line.amount });
          }
        }
        return { planId: plan.id };
      });
    }),

  listByYear: budgetManage
    .input(z.object({ year: z.number().int(), statuses: z.array(z.string()).optional() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const locIds = await getCurrentBusinessLocationIds(ctx);
      if (locIds.length === 0) return [];
      const locIdSql = sql.join(locIds.map((id) => sql`${id}`), sql`, `);
      const conditions = [eq(budgetPlans.fiscalYearStart, input.year), sql`${budgetPlans.locationId} IN (${locIdSql})`, isNull(budgetPlans.deletedAt)];
      if (input.statuses && input.statuses.length > 0) {
        const validStatuses = input.statuses.filter((s) => ["draft", "active", "locked", "archived"].includes(s));
        if (validStatuses.length > 0) {
          conditions.push(sql`${budgetPlans.status} IN (${sql.join(validStatuses.map((s) => sql`${s}`), sql`, `)})`);
        }
      }
      const plans = await db.select({
        id: budgetPlans.id, locationId: budgetPlans.locationId, fiscalYearStart: budgetPlans.fiscalYearStart,
        period: budgetPlans.period, name: budgetPlans.name, notes: budgetPlans.notes,
        status: budgetPlans.status, createdAt: budgetPlans.createdAt, updatedAt: budgetPlans.updatedAt,
        bucketCount: sql<number>`(SELECT COUNT(*)::int FROM ${budgetPlanBuckets} WHERE ${budgetPlanBuckets.planId} = ${budgetPlans.id})`,
      }).from(budgetPlans).where(and(...conditions)).orderBy(budgetPlans.createdAt);
      return plans;
    }),

  get: budgetManage
    .input(z.object({ planId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const plan = await requirePlanAccess(ctx, input.planId);
      const buckets = await db.select().from(budgetPlanBuckets).where(eq(budgetPlanBuckets.planId, plan.id)).orderBy(budgetPlanBuckets.bucketIndex);
      const bucketIds = buckets.map((b) => b.id);
      const lines = bucketIds.length > 0 ? await db.select().from(budgetBucketLines).where(inArray(budgetBucketLines.bucketId, bucketIds)).orderBy(budgetBucketLines.categoryId) : [];
      const linesByBucket: Record<number, typeof lines> = {};
      for (const line of lines) { if (!linesByBucket[line.bucketId]) linesByBucket[line.bucketId] = []; linesByBucket[line.bucketId].push(line); }
      const categoryIds = [...new Set(lines.map((l) => l.categoryId))];
      const categories = categoryIds.length > 0 ? await db.select({ id: expenseCategories.id, name: expenseCategories.name, color: expenseCategories.color }).from(expenseCategories).where(inArray(expenseCategories.id, categoryIds)) : [];
      const categoryMap = new Map(categories.map((c) => [c.id, c]));
      const enrichedBuckets = buckets.map((bucket) => ({
        ...bucket,
        lines: (linesByBucket[bucket.id] ?? []).map((line) => ({
          ...line, categoryName: categoryMap.get(line.categoryId)?.name ?? null, categoryColor: categoryMap.get(line.categoryId)?.color ?? null,
        })),
      }));
      return { ...plan, buckets: enrichedBuckets };
    }),

  updateLines: budgetManage
    .input(z.object({ planId: z.number(), bucketId: z.number(), lines: z.array(z.object({ categoryId: z.number(), amount: z.string() })) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const plan = await requirePlanAccess(ctx, input.planId);
      validateBudgetLines(input.lines);
      const [bucket] = await db.select().from(budgetPlanBuckets).where(and(eq(budgetPlanBuckets.id, input.bucketId), eq(budgetPlanBuckets.planId, plan.id))).limit(1);
      if (!bucket) { throw new TRPCError({ code: "NOT_FOUND", message: "Bucket not found for this plan" }); }
      await db.transaction(async (tx) => {
        await tx.delete(budgetBucketLines).where(eq(budgetBucketLines.bucketId, input.bucketId));
        for (const line of input.lines) { await tx.insert(budgetBucketLines).values({ bucketId: input.bucketId, categoryId: line.categoryId, amount: line.amount }); }
      });
      return { success: true };
    }),

  copyMonthlyBucket: budgetManage
    .input(z.object({ planId: z.number(), sourceBucketId: z.number(), targetBucketIds: z.array(z.number()).min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const plan = await requirePlanAccess(ctx, input.planId);
      if (input.targetBucketIds.includes(input.sourceBucketId)) { throw new TRPCError({ code: "BAD_REQUEST", message: "Source bucket cannot be included in target bucket list" }); }
      const allBucketIds = [input.sourceBucketId, ...input.targetBucketIds];
      const ownedBuckets = await db.select({ id: budgetPlanBuckets.id }).from(budgetPlanBuckets).where(and(eq(budgetPlanBuckets.planId, plan.id), inArray(budgetPlanBuckets.id, allBucketIds)));
      const ownedIds = new Set(ownedBuckets.map((b) => b.id));
      const missing = allBucketIds.filter((id) => !ownedIds.has(id));
      if (missing.length > 0) { throw new TRPCError({ code: "NOT_FOUND", message: `Buckets not found: ${missing.join(", ")}` }); }
      const sourceLines = await db.select().from(budgetBucketLines).where(eq(budgetBucketLines.bucketId, input.sourceBucketId));
      if (sourceLines.length === 0) { throw new TRPCError({ code: "BAD_REQUEST", message: "Source bucket has no lines to copy" }); }
      return await db.transaction(async (tx) => {
        for (const targetId of input.targetBucketIds) {
          await tx.delete(budgetBucketLines).where(eq(budgetBucketLines.bucketId, targetId));
          for (const line of sourceLines) { await tx.insert(budgetBucketLines).values({ bucketId: targetId, categoryId: line.categoryId, amount: line.amount }); }
        }
        return { success: true, copiedTo: input.targetBucketIds };
      });
    }),

  lock: budgetManage.input(z.object({ planId: z.number() })).mutation(async ({ input, ctx }) => {
    const db = getDb();
    const plan = await requirePlanAccess(ctx, input.planId);
    const userId = (ctx as { user?: { id: number } }).user?.id ?? null;
    await db.update(budgetPlans).set({ status: "locked", lockedAt: new Date(), lockedById: userId, updatedAt: new Date() }).where(eq(budgetPlans.id, plan.id));
    return { success: true };
  }),

  activate: budgetManage.input(z.object({ planId: z.number() })).mutation(async ({ input, ctx }) => {
    const db = getDb();
    const plan = await requirePlanAccess(ctx, input.planId);
    await db.update(budgetPlans).set({ status: "active", updatedAt: new Date() }).where(eq(budgetPlans.id, plan.id));
    return { success: true };
  }),

  archive: budgetManage.input(z.object({ planId: z.number() })).mutation(async ({ input, ctx }) => {
    const db = getDb();
    const plan = await requirePlanAccess(ctx, input.planId);
    const userId = (ctx as { user?: { id: number } }).user?.id ?? null;
    await db.update(budgetPlans).set({ status: "archived", archivedAt: new Date(), archivedById: userId, updatedAt: new Date() }).where(eq(budgetPlans.id, plan.id));
    return { success: true };
  }),
});
