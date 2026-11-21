// ABOUTME: Serves the machine-to-machine instance control operations used by FinaBill.
// ABOUTME: Reuses the audited admin support primitives while writing instance_control audit rows.
import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { businesses, customerAccounts, users } from "@db/schema";
import { getPlanConfig } from "./subscriptions";
import {
  audit,
  entitlementPatch,
  lockedAccount,
} from "../admin-support-router";

/** Version reported by GET /api/v1/instance/health (kept in step with package.json). */
export const FINAFLOW_VERSION = "1.4.0";

export const INSTANCE_PLANS = ["free", "starter", "growth", "pro"] as const;
export type InstancePlan = (typeof INSTANCE_PLANS)[number];

type AccountRow = typeof customerAccounts.$inferSelect;

function fail(
  message: string,
  code: "BAD_REQUEST" | "NOT_FOUND" | "CONFLICT" | "FORBIDDEN" = "BAD_REQUEST"
): never {
  throw new TRPCError({ code, message });
}

function accountState(account: AccountRow) {
  return {
    accountId: account.accountId,
    name: account.name,
    plan: account.plan,
    subscriptionStatus: account.subscriptionStatus,
    isActive: account.isActive,
    billingHoldAt: account.billingHoldAt,
    subscriptionExpiry: account.subscriptionExpiry,
    createdAt: account.createdAt,
  };
}

async function countsByAccount(
  tx: ReturnType<typeof getDb>,
  accountIds: string[]
) {
  const businessCounts = new Map<string, number>();
  const userCounts = new Map<string, number>();
  if (!accountIds.length) return { businessCounts, userCounts };

  const businessRows = await tx
    .select({
      accountId: businesses.accountId,
      value: sql<number>`count(*)::int`,
    })
    .from(businesses)
    .where(
      and(
        inArray(businesses.accountId, accountIds),
        isNull(businesses.deletedAt)
      )
    )
    .groupBy(businesses.accountId);
  for (const row of businessRows) {
    businessCounts.set(row.accountId, Number(row.value));
  }

  const userRows = await tx
    .select({
      accountId: users.accountId,
      value: sql<number>`count(*)::int`,
    })
    .from(users)
    .where(and(inArray(users.accountId, accountIds), isNull(users.deletedAt)))
    .groupBy(users.accountId);
  for (const row of userRows) {
    if (row.accountId) userCounts.set(row.accountId, Number(row.value));
  }

  return { businessCounts, userCounts };
}

export async function listAccounts(input: {
  search?: string;
  plan?: string;
  access?: "all" | "held" | "active";
  limit: number;
  offset: number;
}) {
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

  const rows = await db
    .select()
    .from(customerAccounts)
    .where(where)
    .orderBy(desc(customerAccounts.id))
    .limit(input.limit)
    .offset(input.offset);

  const { businessCounts, userCounts } = await countsByAccount(
    db,
    rows.map(row => row.accountId)
  );

  return {
    data: rows.map(row => ({
      ...accountState(row),
      businessCount: businessCounts.get(row.accountId) ?? 0,
      userCount: userCounts.get(row.accountId) ?? 0,
    })),
    total: Number(count?.total ?? 0),
  };
}

export async function getAccount(accountId: string) {
  const db = getDb();
  const [account] = await db
    .select()
    .from(customerAccounts)
    .where(
      and(
        eq(customerAccounts.accountId, accountId),
        isNull(customerAccounts.deletedAt)
      )
    )
    .limit(1);

  if (!account) fail("Account not found", "NOT_FOUND");

  const accountBusinesses = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      slug: businesses.slug,
      plan: businesses.plan,
      subscriptionStatus: businesses.subscriptionStatus,
      subscriptionExpiry: businesses.subscriptionExpiry,
      isActive: businesses.isActive,
      createdAt: businesses.createdAt,
    })
    .from(businesses)
    .where(
      and(
        eq(businesses.accountId, account.accountId),
        isNull(businesses.deletedAt)
      )
    )
    .orderBy(desc(businesses.id));

  const accountUsers = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.accountId, account.accountId), isNull(users.deletedAt)))
    .orderBy(desc(users.id));

  return {
    account: {
      ...accountState(account),
      maxBusinesses: account.maxBusinesses,
      maxUsers: account.maxUsers,
      maxTransactionsPerMonth: account.maxTransactionsPerMonth,
      updatedAt: account.updatedAt,
    },
    businesses: accountBusinesses,
    users: accountUsers,
  };
}

export async function listUsers(input: {
  accountId?: string;
  search?: string;
  limit: number;
  offset: number;
}) {
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

  return { data, total: Number(count?.total ?? 0) };
}

export async function holdAccount(accountId: string, reason: string) {
  return getDb().transaction(async tx => {
    const account = await lockedAccount(tx, accountId);
    if (account.billingHoldAt) return accountState(account);

    const [updated] = await tx
      .update(customerAccounts)
      .set({ billingHoldAt: new Date() })
      .where(eq(customerAccounts.id, account.id))
      .returning();

    await audit(
      tx,
      null,
      account.accountId,
      account.id,
      "billing_hold",
      reason,
      { billingHoldAt: null },
      { billingHoldAt: updated.billingHoldAt },
      "instance_control"
    );

    return accountState(updated);
  });
}

export async function resumeAccount(accountId: string, reason: string) {
  return getDb().transaction(async tx => {
    const account = await lockedAccount(tx, accountId);
    if (!account.billingHoldAt) return accountState(account);

    const [updated] = await tx
      .update(customerAccounts)
      .set({ billingHoldAt: null })
      .where(eq(customerAccounts.id, account.id))
      .returning();

    await audit(
      tx,
      null,
      account.accountId,
      account.id,
      "restore_access",
      reason,
      { billingHoldAt: account.billingHoldAt },
      { billingHoldAt: null },
      "instance_control"
    );

    return accountState(updated);
  });
}

export async function setAccountPlan(
  accountId: string,
  plan: InstancePlan,
  expiresOn: string | undefined,
  reason: string
) {
  if (expiresOn) {
    const date = new Date(`${expiresOn}T00:00:00.000Z`);
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== expiresOn
    ) {
      fail("Choose a valid expiry date");
    }
  }

  return getDb().transaction(async tx => {
    const account = await lockedAccount(tx, accountId);
    const updated = await entitlementPatch(
      tx,
      account,
      plan,
      expiresOn ?? null
    );

    await audit(
      tx,
      null,
      account.accountId,
      account.id,
      "plan_change",
      reason,
      { plan: account.plan, expiresOn: account.subscriptionExpiry },
      { plan: updated.plan, expiresOn: updated.subscriptionExpiry },
      "instance_control"
    );

    return accountState(updated);
  });
}

export async function setUserStatus(
  accountId: string,
  userId: number,
  isActive: boolean,
  reason: string
) {
  return getDb().transaction(async tx => {
    const account = await lockedAccount(tx, accountId);
    const [user] = await tx
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.accountId, account.accountId),
          isNull(users.deletedAt)
        )
      )
      .for("update");

    if (!user) fail("User not found", "NOT_FOUND");
    if (user.isActive === isActive)
      return { id: user.id, isActive: user.isActive };

    if (user.role === "owner" && !isActive) {
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

    await tx.update(users).set({ isActive }).where(eq(users.id, user.id));

    await audit(
      tx,
      null,
      account.accountId,
      user.id,
      "user_status",
      reason,
      { isActive: user.isActive },
      { isActive },
      "instance_control"
    );

    return { id: user.id, isActive };
  });
}

export function listPlans() {
  return INSTANCE_PLANS.map(plan => {
    const config = getPlanConfig(plan);
    return {
      plan,
      name: config.label,
      priceLabel: config.priceLabel,
      maxBusinesses: config.maxBusinesses,
      maxBranches: config.maxBranches,
      maxUsers: config.maxUsers,
      transactionQuota: config.transactionQuota,
      payrollEnabled: config.payrollEnabled,
      supportTier: config.supportTier,
    };
  });
}

export async function instanceHealth() {
  const db = getDb();
  const [accountCount] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(customerAccounts)
    .where(isNull(customerAccounts.deletedAt));
  const [userCount] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .where(isNull(users.deletedAt));

  return {
    product: "finaflow",
    version: FINAFLOW_VERSION,
    accountCount: Number(accountCount?.total ?? 0),
    userCount: Number(userCount?.total ?? 0),
    serverTime: new Date().toISOString(),
  };
}
