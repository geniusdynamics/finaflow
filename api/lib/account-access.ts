// ABOUTME: Resolves manual account billing holds independently of plan expiry and user activation.
// ABOUTME: Provides shared recovery eligibility and tenant enforcement for sessions and integrations.
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { businesses, customerAccounts, users } from "@db/schema";
import { getDb } from "../queries/connection";

export function billingAccessMode(active: boolean, role: string, held: boolean): "full" | "billing_only" | "blocked" {
  if (!active) return "blocked";
  if (!held) return "full";
  return role === "owner" || role === "admin" ? "billing_only" : "blocked";
}

export function billingHoldError() {
  return new TRPCError({ code: "FORBIDDEN", message: "This account is on billing hold. Contact the account owner to renew access.", cause: { reason: "ACCOUNT_BILLING_HOLD" } });
}

export function isBillingHoldError(error: unknown): boolean {
  return error instanceof TRPCError && error.code === "FORBIDDEN" &&
    (error.cause as { reason?: string } | undefined)?.reason === "ACCOUNT_BILLING_HOLD";
}

type AccessPrincipal = { accountId?: string | null; role: string; isActive?: boolean; deletedAt?: Date | null };

export async function getAccountAccess(user: AccessPrincipal) {
  const db = getDb();
  // accountId is the stable owning account; accountRefId changes on business switching.
  const [account] = user.accountId ? await db.select({ accountId: customerAccounts.accountId, billingHoldAt: customerAccounts.billingHoldAt })
    .from(customerAccounts).where(and(eq(customerAccounts.accountId, user.accountId), isNull(customerAccounts.deletedAt))).limit(1) : [];
  const active = user.isActive !== false && !user.deletedAt;
  const mode = billingAccessMode(active, user.role, Boolean(account?.billingHoldAt));
  return { mode, accountId: account?.accountId ?? user.accountId ?? null, canManageBilling: active && Boolean(account) && (user.role === "owner" || user.role === "admin"), billingHoldAt: account?.billingHoldAt ?? null };
}

export async function assertUserCanAuthenticate(user: AccessPrincipal) {
  if (!user.isActive || user.deletedAt) throw new TRPCError({ code: "UNAUTHORIZED", message: "Account is disabled" });
  const access = await getAccountAccess(user);
  if (access.mode === "blocked") throw billingHoldError();
  return access;
}

export async function assertPrincipalCanAuthenticate(userId: number) {
  const [user] = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
  return assertUserCanAuthenticate(user);
}

export async function assertBusinessOperational(businessId: number) {
  const db = getDb();
  const [business] = await db.select({ accountId: businesses.accountId }).from(businesses)
    .where(and(eq(businesses.id, businessId), isNull(businesses.deletedAt))).limit(1);
  if (!business) throw new TRPCError({ code: "NOT_FOUND", message: "Business not found" });
  const [account] = await db.select({ billingHoldAt: customerAccounts.billingHoldAt }).from(customerAccounts)
    .where(and(eq(customerAccounts.accountId, business.accountId), isNull(customerAccounts.deletedAt))).limit(1);
  if (account?.billingHoldAt) throw billingHoldError();
}
