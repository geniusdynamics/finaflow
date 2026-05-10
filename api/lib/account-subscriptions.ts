// ABOUTME: Resolves canonical account-level subscription data with fallback to legacy business rows during migration.
// ABOUTME: Centralizes account-scoped usage counting so auth, settings, and enforcement stay consistent.
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { businesses, customerAccounts, users } from "@db/schema";
import type { getDb } from "../queries/connection";

export type DbClient = ReturnType<typeof getDb>;

export type ResolvedAccountSubscription =
  | { source: "account"; account: typeof customerAccounts.$inferSelect }
  | { source: "business"; business: typeof businesses.$inferSelect };

async function getAccountByRefId(db: DbClient, accountRefId: number) {
  const [account] = await db.select().from(customerAccounts)
    .where(and(eq(customerAccounts.id, accountRefId), isNull(customerAccounts.deletedAt)))
    .limit(1);
  return account ?? null;
}

async function getAccountByAccountId(db: DbClient, accountId: string) {
  const [account] = await db.select().from(customerAccounts)
    .where(and(eq(customerAccounts.accountId, accountId), isNull(customerAccounts.deletedAt)))
    .limit(1);
  return account ?? null;
}

async function getBusinessById(db: DbClient, businessId: number) {
  const [business] = await db.select().from(businesses)
    .where(and(eq(businesses.id, businessId), isNull(businesses.deletedAt)))
    .limit(1);
  return business ?? null;
}

async function getBusinessByAccountId(db: DbClient, accountId: string) {
  const [business] = await db.select().from(businesses)
    .where(and(eq(businesses.accountId, accountId), isNull(businesses.deletedAt)))
    .orderBy(desc(businesses.updatedAt), desc(businesses.id))
    .limit(1);
  return business ?? null;
}

export async function getAccountSubscription(
  db: DbClient,
  options: { accountRefId?: number | null; accountId?: string | null; fallbackBusinessId?: number | null },
): Promise<ResolvedAccountSubscription> {
  if (options.accountRefId) {
    const account = await getAccountByRefId(db, options.accountRefId);
    if (account) return { source: "account", account };
  }

  if (options.accountId) {
    const account = await getAccountByAccountId(db, options.accountId);
    if (account) return { source: "account", account };

    const business = await getBusinessByAccountId(db, options.accountId);
    if (business) return { source: "business", business };
  }

  if (options.fallbackBusinessId) {
    const business = await getBusinessById(db, options.fallbackBusinessId);
    if (business) return { source: "business", business };
  }

  throw new Error("Account subscription not found");
}

export async function getAccountUsage(db: DbClient, accountId: string) {
  const [businessCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(businesses)
    .where(and(eq(businesses.accountId, accountId), isNull(businesses.deletedAt)));
  const [userCount] = await db.select({ count: sql<number>`COUNT(DISTINCT ${users.id})` }).from(users)
    .where(and(eq(users.accountId, accountId), isNull(users.deletedAt), eq(users.isActive, true)));

  return {
    businessCount: Number(businessCount?.count ?? 0),
    userCount: Number(userCount?.count ?? 0),
  };
}
