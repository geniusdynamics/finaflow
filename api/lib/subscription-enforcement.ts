// ABOUTME: Enforces account-scoped business limits and per-business branch limits with one shared error contract.
// ABOUTME: Keeps business creation, location creation, and future member invites aligned on subscription rules.
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { locations } from "@db/schema";
import { getAccountSubscription, getAccountUsage, type DbClient } from "./account-subscriptions";
import { getPlanConfig } from "./subscriptions";

type EnforcedEntity = "business" | "location";

function buildUpgradeOptions(entity: EnforcedEntity, currentLimit: number) {
  if (entity === "business" && currentLimit < 3) return ["growth", "pro"] as const;
  if (entity === "business" && currentLimit < 10) return ["pro"] as const;
  if (entity === "location" && currentLimit < 5) return ["growth", "pro"] as const;
  if (entity === "location" && currentLimit < 99) return ["pro"] as const;
  return [] as const;
}

function buildLimitError(params: {
  entity: EnforcedEntity;
  message: string;
  currentPlan: string;
  currentUsage: number;
  currentLimit: number;
  upgradeOptions: readonly string[];
}) {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: params.message,
    cause: {
      code: "SUBSCRIPTION_LIMIT_EXCEEDED",
      entity: params.entity,
      currentPlan: params.currentPlan,
      currentUsage: params.currentUsage,
      currentLimit: params.currentLimit,
      upgradeOptions: [...params.upgradeOptions],
    },
  });
}

export async function assertCanCreateBusiness(db: DbClient, accountId: string, accountRefId?: number | null) {
  const resolved = await getAccountSubscription(db, {
    accountId,
    accountRefId: accountRefId ?? null,
  });
  const usage = await getAccountUsage(db, accountId);
  const currentPlan = resolved.source === "account" ? resolved.account.plan : resolved.business.plan;
  const currentLimit = resolved.source === "account"
    ? resolved.account.maxBusinesses
    : getPlanConfig(resolved.business.plan).maxBusinesses;

  if (usage.businessCount >= currentLimit) {
    buildLimitError({
      entity: "business",
      message: `Your current plan allows ${currentLimit} business. Upgrade to Growth or Pro to add another business.`,
      currentPlan,
      currentUsage: usage.businessCount,
      currentLimit,
      upgradeOptions: buildUpgradeOptions("business", currentLimit),
    });
  }

  return resolved;
}

export async function assertCanCreateLocation(
  db: DbClient,
  businessId: number,
  accountId: string,
  accountRefId?: number | null,
) {
  const resolved = await getAccountSubscription(db, {
    accountId,
    accountRefId: accountRefId ?? null,
    fallbackBusinessId: businessId,
  });
  const currentPlan = resolved.source === "account" ? resolved.account.plan : resolved.business.plan;
  const currentLimit = getPlanConfig(currentPlan).maxBranches;
  const [locationCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(locations)
    .where(and(eq(locations.businessId, businessId), isNull(locations.deletedAt)));
  const currentUsage = Number(locationCount?.count ?? 0);

  if (currentUsage >= currentLimit) {
    buildLimitError({
      entity: "location",
      message: `Your current plan allows ${currentLimit} branch for this business. Upgrade to Growth or Pro to add another location.`,
      currentPlan,
      currentUsage,
      currentLimit,
      upgradeOptions: buildUpgradeOptions("location", currentLimit),
    });
  }

  return resolved;
}
