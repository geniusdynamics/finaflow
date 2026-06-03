import { eq } from "drizzle-orm";
import { accounts, businesses, locations, users, userBusinesses } from "@db/schema";
import { getAccountSubscription, type DbClient } from "./account-subscriptions";

export interface ProvisionBusinessInput {
  db: DbClient;
  accountId: string;
  accountRefId: number | null;
  name: string;
  slug: string;
  userId: number;
  isDemo?: boolean;
  partnerId?: number | null;
  revSharePercent?: string | null;
  referralCode: string;
  referredByBusinessId?: number | null;
  referredByUserId?: number | null;
  firstMonthDiscountApplied?: boolean | null;
  subscriptionStatus?: string | null;
  subscriptionExpiry?: Date | null;
  phone?: string | null;
  defaultAccountOpeningBalance?: string;
  testFailPoint?: string | null;
}

export interface ProvisionBusinessResult {
  businessId: number;
  locationId: number;
  accountRefId: number | null;
}

export async function provisionBusiness(input: ProvisionBusinessInput): Promise<ProvisionBusinessResult> {
  const { db: tx, accountId, accountRefId, name, slug, userId, isDemo, partnerId, revSharePercent, referralCode, referredByBusinessId, referredByUserId, firstMonthDiscountApplied, subscriptionStatus, subscriptionExpiry, phone, defaultAccountOpeningBalance, testFailPoint } = input;

  const resolved = await getAccountSubscription(tx, { accountId, accountRefId });
  const plan = resolved.source === "account" ? resolved.account.plan : resolved.business.plan;
  const maxUsers = resolved.source === "account"
    ? resolved.account.maxUsers
    : (resolved.business.maxUsers ?? 1);
  const maxBranches = resolved.source === "account"
    ? 1
    : (resolved.business.maxBranches ?? 1);

  const [businessRow] = await tx.insert(businesses).values({
    accountId,
    accountRefId,
    name,
    slug,
    plan,
    maxUsers,
    maxBranches,
    isActive: true,
    isDemo: isDemo ?? false,
    partnerId: partnerId ?? null,
    revSharePercent: revSharePercent ?? null,
    referralCode,
    referredByBusinessId: referredByBusinessId ?? null,
    referredByUserId: referredByUserId ?? null,
    firstMonthDiscountApplied: firstMonthDiscountApplied ?? undefined,
    subscriptionStatus: subscriptionStatus ?? null,
    subscriptionExpiry: subscriptionExpiry ? subscriptionExpiry.toISOString().slice(0, 10) : null,
    phone: phone ?? null,
  } satisfies typeof businesses.$inferInsert).returning();
  const businessId = businessRow.id;

  await tx.insert(userBusinesses).values({
    userId,
    businessId,
    role: "owner",
    isActive: true,
  } satisfies typeof userBusinesses.$inferInsert);

  const resolvedAccountRefId = accountRefId ?? businessRow.accountRefId ?? null;
  await tx.update(users).set({
    currentBusinessId: businessId,
    accountRefId: resolvedAccountRefId,
  }).where(eq(users.id, userId));

  const [locResult] = await tx.insert(locations).values({
    businessId,
    name: "Main Branch",
    slug: `main-${businessId}`,
    isActive: true,
  } satisfies typeof locations.$inferInsert).returning();
  const locationId = locResult.id;

  if (testFailPoint === "before-default-accounts") {
    throw new Error("Simulated registration failure before default account creation");
  }

  const openingBal = defaultAccountOpeningBalance ?? "0.00";
  await tx.insert(accounts).values([
    { name: "Cash Drawer", type: "cash" as "cash" | "mpesa" | "bank_account", locationId, openingBalance: openingBal, currentBalance: openingBal, isActive: true } satisfies typeof accounts.$inferInsert,
    { name: "Wallet", type: "wallet" as "cash" | "mpesa" | "bank_account", locationId, openingBalance: openingBal, currentBalance: openingBal, isActive: true } satisfies typeof accounts.$inferInsert,
    { name: "Bank Account", type: "bank_account", locationId, openingBalance: openingBal, currentBalance: openingBal, isActive: true } satisfies typeof accounts.$inferInsert,
  ]);

  return { businessId, locationId, accountRefId: resolvedAccountRefId };
}

export async function seedBusinessAccounting(businessId: number, locationId: number): Promise<void> {
  const { seedAccountingData } = await import("../../db/seed-accounting");
  await seedAccountingData(businessId, locationId);
}
