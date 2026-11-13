// ABOUTME: Provides audited platform support controls, directories, and manual renewal review.
// ABOUTME: Keeps account holds independent of entitlements and preserves customer resources.
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, desc, sql, or, ilike, inArray, getTableColumns } from "drizzle-orm";
import { createRouter, adminProcedure, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  customerAccounts,
  users,
  businesses,
  locations,
  auditLog,
  accountRenewalRequests,
} from "@db/schema";
import { getPlanConfig } from "./lib/subscriptions";
import { env } from "./lib/env";
import { getAccountAccess } from "./lib/account-access";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
const page = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
});
const reason = z.string().trim().min(1).max(2000);
const target = z.object({ accountId: z.string().trim().min(1), reason });
const plan = z.enum(["free", "starter", "growth", "pro"]);
function fail(
  message: string,
  code: "BAD_REQUEST" | "NOT_FOUND" | "CONFLICT" | "FORBIDDEN" = "BAD_REQUEST"
): never {
  throw new TRPCError({ code, message });
}
async function lockedAccount(tx: Tx, accountId: string) {
  const [account] = await tx
    .select()
    .from(customerAccounts)
    .where(
      and(
        eq(customerAccounts.accountId, accountId),
        isNull(customerAccounts.deletedAt)
      )
    )
    .for("update");
  if (!account) return fail("Account not found", "NOT_FOUND");
  if (account.accountId === env.superAdminAccount)
    return fail("The platform account is protected", "FORBIDDEN");
  return account;
}
async function audit(
  tx: Tx,
  actor: number,
  accountId: string,
  recordId: number,
  operation: string,
  supportReason: string,
  before: unknown,
  after: unknown
) {
  await tx.insert(auditLog).values({
    tableName: "admin_support",
    recordId,
    action: "UPDATE",
    changedBy: actor,
    oldValues: before,
    newValues: {
      accountId,
      operation,
      reason: supportReason,
      outcome: "success",
      value: after,
    },
  });
}
function sameHold(actual: Date | null, expected: string) {
  if (!actual || actual.toISOString() !== expected)
    fail("Billing hold changed; refresh before reviewing", "CONFLICT");
}
async function entitlementPatch(
  tx: Tx,
  account: typeof customerAccounts.$inferSelect,
  selectedPlan: z.infer<typeof plan>,
  expiry: string | null
) {
  if (account.plan === "partner")
    fail(
      "Partner entitlements require the partner management workflow",
      "FORBIDDEN"
    );
  const config = getPlanConfig(selectedPlan);
  const ownedBusinesses = await tx
    .select({ id: businesses.id })
    .from(businesses)
    .where(
      and(
        eq(businesses.accountId, account.accountId),
        isNull(businesses.deletedAt)
      )
    );
  const [count] = await tx
    .select({ value: sql<number>`count(*)::int` })
    .from(users)
    .where(
      and(
        eq(users.accountId, account.accountId),
        eq(users.isActive, true),
        isNull(users.deletedAt)
      )
    );
  if (
    ownedBusinesses.length > config.maxBusinesses ||
    Number(count.value) > config.maxUsers
  )
    fail("Current businesses or users exceed the selected plan limits");
  if (ownedBusinesses.length) {
    const branchCounts = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(locations)
      .where(
        and(
          inArray(
            locations.businessId,
            ownedBusinesses.map(b => b.id)
          ),
          isNull(locations.deletedAt)
        )
      )
      .groupBy(locations.businessId);
    if (branchCounts.some(row => Number(row.count) > config.maxBranches))
      fail("Current branches exceed the selected plan limits");
  }
  const features = expiry
    ? {
        ...(account.features && typeof account.features === "object"
          ? account.features
          : {}),
        trialReminderSentAt: null,
        trialDowngradedAt: null,
      }
    : account.features;
  const values = {
    plan: selectedPlan,
    maxUsers: config.maxUsers,
    maxTransactionsPerMonth: config.transactionQuota,
    subscriptionStatus: expiry ? "trial" : "active",
    subscriptionExpiry: expiry,
    features,
  };
  const [updated] = await tx
    .update(customerAccounts)
    .set({ ...values, maxBusinesses: config.maxBusinesses })
    .where(eq(customerAccounts.id, account.id))
    .returning();
  await tx
    .update(businesses)
    .set({
      ...values,
      maxBranches: config.maxBranches,
      accountRefId: account.id,
    })
    .where(
      and(
        eq(businesses.accountId, account.accountId),
        isNull(businesses.deletedAt)
      )
    );
  return updated;
}
export const adminSupportRouter = createRouter({
  listAccounts: adminProcedure
    .input(
      page.extend({
        search: z.string().optional(),
        plan: z.string().optional(),
        access: z.enum(["all", "held", "active"]).optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const where = and(
        isNull(customerAccounts.deletedAt),
        input.search
          ? or(
              ilike(customerAccounts.name, `%${input.search}%`),
              ilike(customerAccounts.accountId, `%${input.search}%`)
            )
          : undefined,
        input.plan ? eq(customerAccounts.plan, input.plan) : undefined,
        input.access === "held"
          ? sql`${customerAccounts.billingHoldAt} is not null`
          : input.access === "active"
            ? isNull(customerAccounts.billingHoldAt)
            : undefined
      );
      const [count] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(customerAccounts)
        .where(where);
      const data = await db
        .select()
        .from(customerAccounts)
        .where(where)
        .orderBy(desc(customerAccounts.id))
        .limit(input.limit)
        .offset(input.offset);
      return {
        data,
        total: Number(count.total),
        limit: input.limit,
        offset: input.offset,
      };
    }),
  listUsers: adminProcedure
    .input(
      page.extend({
        search: z.string().optional(),
        accountId: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const where = and(
        isNull(users.deletedAt),
        input.accountId ? eq(users.accountId, input.accountId) : undefined,
        input.search
          ? or(
              ilike(users.name, `%${input.search}%`),
              ilike(users.username, `%${input.search}%`),
              ilike(users.email, `%${input.search}%`)
            )
          : undefined
      );
      const [count] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(users)
        .where(where);
      const data = await db
        .select({
          id: users.id,
          name: users.name,
          username: users.username,
          email: users.email,
          role: users.role,
          accountId: users.accountId,
          isActive: users.isActive,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.id))
        .limit(input.limit)
        .offset(input.offset);
      return {
        data,
        total: Number(count.total),
        limit: input.limit,
        offset: input.offset,
      };
    }),
  listAuditEvents: adminProcedure
    .input(page.extend({ accountId: z.string().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      const where = and(
        eq(auditLog.tableName, "admin_support"),
        input.accountId
          ? sql`${auditLog.newValues}->>'accountId' = ${input.accountId}`
          : undefined
      );
      const [count] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(auditLog)
        .where(where);
      const data = await db
        .select()
        .from(auditLog)
        .where(where)
        .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
        .limit(input.limit)
        .offset(input.offset);
      return {
        data,
        total: Number(count.total),
        limit: input.limit,
        offset: input.offset,
      };
    }),
  listRenewalRequests: adminProcedure
    .input(
      page.extend({
        accountId: z.string().optional(),
        status: z.enum(["pending", "approved", "declined"]).optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const where = and(
        input.accountId
          ? sql`${accountRenewalRequests.accountRefId} in (select id from customer_accounts where "accountId" = ${input.accountId})`
          : undefined,
        input.status
          ? eq(accountRenewalRequests.status, input.status)
          : undefined
      );
      const [count] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(accountRenewalRequests)
        .where(where);
      const data = await db
        .select({ ...getTableColumns(accountRenewalRequests), accountId: customerAccounts.accountId, accountName: customerAccounts.name })
        .from(accountRenewalRequests)
        .innerJoin(customerAccounts, eq(customerAccounts.id, accountRenewalRequests.accountRefId))
        .where(where)
        .orderBy(desc(accountRenewalRequests.id))
        .limit(input.limit)
        .offset(input.offset);
      return {
        data,
        total: Number(count.total),
        limit: input.limit,
        offset: input.offset,
      };
    }),
  setAccountBillingHold: adminProcedure
    .input(target)
    .mutation(({ input, ctx }) =>
      getDb().transaction(async tx => {
        const account = await lockedAccount(tx, input.accountId);
        if (account.billingHoldAt) return account;
        const [updated] = await tx
          .update(customerAccounts)
          .set({ billingHoldAt: new Date() })
          .where(eq(customerAccounts.id, account.id))
          .returning();
        await audit(
          tx,
          ctx.user!.id,
          account.accountId,
          account.id,
          "billing_hold",
          input.reason,
          { billingHoldAt: null },
          { billingHoldAt: updated.billingHoldAt }
        );
        return updated;
      })
    ),
  restoreAccountAccess: adminProcedure
    .input(target.extend({ holdAt: z.string().datetime() }))
    .mutation(({ input, ctx }) =>
      getDb().transaction(async tx => {
        const account = await lockedAccount(tx, input.accountId);
        if (!account.billingHoldAt) return account;
        sameHold(account.billingHoldAt, input.holdAt);
        const [updated] = await tx
          .update(customerAccounts)
          .set({ billingHoldAt: null })
          .where(eq(customerAccounts.id, account.id))
          .returning();
        await tx
          .update(accountRenewalRequests)
          .set({
            status: "approved",
            reviewedBy: ctx.user!.id,
            reviewReason: input.reason,
            reviewedAt: new Date(),
          })
          .where(
            and(
              eq(accountRenewalRequests.accountRefId, account.id),
              eq(accountRenewalRequests.status, "pending"),
              eq(accountRenewalRequests.holdAt, account.billingHoldAt!)
            )
          );
        await audit(
          tx,
          ctx.user!.id,
          account.accountId,
          account.id,
          "restore_access",
          input.reason,
          { billingHoldAt: account.billingHoldAt },
          { billingHoldAt: null }
        );
        return updated;
      })
    ),
  setUserStatus: adminProcedure
    .input(
      target.extend({
        userId: z.number().int().positive(),
        isActive: z.boolean(),
      })
    )
    .mutation(({ input, ctx }) =>
      getDb().transaction(async tx => {
        const account = await lockedAccount(tx, input.accountId);
        const [user] = await tx
          .select()
          .from(users)
          .where(
            and(
              eq(users.id, input.userId),
              eq(users.accountId, account.accountId),
              isNull(users.deletedAt)
            )
          )
          .for("update");
        if (!user) return fail("User not found", "NOT_FOUND");
        if (user.id === ctx.user!.id && !input.isActive)
          fail("Cannot disable your own identity", "FORBIDDEN");
        if (user.isActive === input.isActive)
          return { id: user.id, isActive: user.isActive };
        if (user.role === "owner" && !input.isActive) {
          const [count] = await tx
            .select({ value: sql<number>`count(*)::int` })
            .from(users)
            .where(
              and(
                eq(users.accountId, account.accountId),
                eq(users.role, "owner"),
                eq(users.isActive, true),
                isNull(users.deletedAt)
              )
            );
          if (Number(count.value) <= 1)
            fail("Cannot disable the last active owner");
        }
        await tx
          .update(users)
          .set({ isActive: input.isActive })
          .where(eq(users.id, user.id));
        await audit(
          tx,
          ctx.user!.id,
          account.accountId,
          user.id,
          "user_status",
          input.reason,
          { isActive: user.isActive },
          { isActive: input.isActive }
        );
        return { id: user.id, isActive: input.isActive };
      })
    ),
  changeAccountPlan: adminProcedure
    .input(target.extend({ plan }))
    .mutation(({ input, ctx }) =>
      getDb().transaction(async tx => {
        const account = await lockedAccount(tx, input.accountId);
        const updated = await entitlementPatch(tx, account, input.plan, null);
        await audit(
          tx,
          ctx.user!.id,
          account.accountId,
          account.id,
          "plan_change",
          input.reason,
          { plan: account.plan },
          { plan: updated.plan }
        );
        return updated;
      })
    ),
  adjustAccountTrial: adminProcedure
    .input(
      target.extend({
        plan: z.enum(["starter", "growth", "pro"]),
        expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .mutation(({ input, ctx }) =>
      getDb().transaction(async tx => {
        const date = new Date(input.expiresOn);
        if (
          !Number.isFinite(date.getTime()) ||
          date.toISOString().slice(0, 10) !== input.expiresOn ||
          input.expiresOn <= new Date().toISOString().slice(0, 10)
        )
          fail("Choose a valid future expiry date");
        const account = await lockedAccount(tx, input.accountId);
        const updated = await entitlementPatch(
          tx,
          account,
          input.plan,
          input.expiresOn
        );
        await audit(
          tx,
          ctx.user!.id,
          account.accountId,
          account.id,
          "trial_adjustment",
          input.reason,
          { plan: account.plan, expiresOn: account.subscriptionExpiry },
          { plan: updated.plan, expiresOn: input.expiresOn }
        );
        return updated;
      })
    ),
  declineRenewalRequest: adminProcedure
    .input(
      z.object({
        requestId: z.number().int().positive(),
        holdAt: z.string().datetime(),
        reason,
      })
    )
    .mutation(({ input, ctx }) =>
      getDb().transaction(async tx => {
        const [request] = await tx
          .select()
          .from(accountRenewalRequests)
          .where(eq(accountRenewalRequests.id, input.requestId));
        if (!request) return fail("Request not found", "NOT_FOUND");
        const [a] = await tx
          .select()
          .from(customerAccounts)
          .where(eq(customerAccounts.id, request.accountRefId));
        if (!a) return fail("Account not found", "NOT_FOUND");
        const account = await lockedAccount(tx, a.accountId);
        sameHold(account.billingHoldAt, input.holdAt);
        sameHold(request.holdAt, input.holdAt);
        if (request.status !== "pending")
          fail("Request already reviewed", "CONFLICT");
        await tx
          .update(accountRenewalRequests)
          .set({
            status: "declined",
            reviewedBy: ctx.user!.id,
            reviewReason: input.reason,
            reviewedAt: new Date(),
          })
          .where(eq(accountRenewalRequests.id, request.id));
        await audit(
          tx,
          ctx.user!.id,
          account.accountId,
          request.id,
          "renewal_declined",
          input.reason,
          { status: "pending" },
          { status: "declined" }
        );
        return { success: true };
      })
    ),
});
async function billingAccount(identity: { id: number }) {
  const [user] = await getDb()
    .select()
    .from(users)
    .where(eq(users.id, identity.id))
    .limit(1);
  if (!user) return fail("Authentication required", "FORBIDDEN");
  const access = await getAccountAccess(user);
  if (!access.canManageBilling || !user.isActive)
    fail("Account holder access required", "FORBIDDEN");
  const [account] = await getDb()
    .select()
    .from(customerAccounts)
    .where(
      and(
        eq(customerAccounts.accountId, user.accountId!),
        isNull(customerAccounts.deletedAt)
      )
    );
  if (!account) return fail("Account not found", "NOT_FOUND");
  return account;
}
export const billingRouter = createRouter({
  summary: authedQuery.query(async ({ ctx }) => {
    const a = await billingAccount(ctx.user!);
    const [request] = await getDb()
      .select()
      .from(accountRenewalRequests)
      .where(eq(accountRenewalRequests.accountRefId, a.id))
      .orderBy(desc(accountRenewalRequests.id))
      .limit(1);
    return {
      account: {
        id: a.id,
        accountId: a.accountId,
        name: a.name,
        plan: a.plan,
        subscriptionStatus: a.subscriptionStatus,
        subscriptionExpiry: a.subscriptionExpiry,
        billingHoldAt: a.billingHoldAt,
      },
      request: request ?? null,
    };
  }),
  requestRenewal: authedQuery
    .input(
      z.object({
        paymentReference: z.string().trim().max(255).optional(),
        note: z.string().trim().max(2000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const a = await billingAccount(ctx.user!);
      return getDb().transaction(async tx => {
        const [account] = await tx
          .select()
          .from(customerAccounts)
          .where(eq(customerAccounts.id, a.id))
          .for("update");
        if (!account.billingHoldAt)
          fail("The account is not on billing hold", "CONFLICT");
        const [existing] = await tx
          .select()
          .from(accountRenewalRequests)
          .where(
            and(
              eq(accountRenewalRequests.accountRefId, a.id),
              eq(accountRenewalRequests.status, "pending")
            )
          );
        if (existing) return existing;
        const [request] = await tx
          .insert(accountRenewalRequests)
          .values({
            accountRefId: a.id,
            holdAt: account.billingHoldAt,
            requestedBy: ctx.user!.id,
            paymentReference: input.paymentReference || null,
            note: input.note || null,
          })
          .returning();
        await audit(
          tx,
          ctx.user!.id,
          a.accountId,
          request.id,
          "renewal_requested",
          "Account holder renewal request",
          null,
          { status: "pending" }
        );
        return request;
      });
    }),
});
