// ABOUTME: Centralizes plan limits, trial state, reminders, and downgrade behavior for business subscriptions.
// ABOUTME: Reuses the same subscription rules across routers, dashboard reads, and background lifecycle processing.
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { businesses, customerAccounts, notifications, paymentMethods, userBusinesses, users } from "@db/schema";
import type { InferSelectModel } from "drizzle-orm";
import { sendEmail } from "./email";

export const DEFAULT_TRIAL_DAYS = 7;
export const TRIAL_EXTENSION_DAYS = 14;
export const TRIAL_JOB_INTERVAL_MS = 5 * 60 * 1000;
const UNLIMITED_QUOTA = 999999;

export const PLAN_MATRIX = {
  free: {
    label: "Free",
    priceLabel: "KES 0/mo",
    maxBusinesses: 1,
    maxBranches: 1,
    maxUsers: 1,
    transactionQuota: 100,
    payrollEnabled: false,
    supportTier: "Community",
  },
  starter: {
    label: "Starter",
    priceLabel: "KES 500/mo",
    maxBusinesses: 1,
    maxBranches: 1,
    maxUsers: 3,
    transactionQuota: 5000,
    payrollEnabled: false,
    supportTier: "Email",
  },
  growth: {
    label: "Growth",
    priceLabel: "KES 1,500/mo",
    maxBusinesses: 3,
    maxBranches: 5,
    maxUsers: 5,
    transactionQuota: 20000,
    payrollEnabled: true,
    supportTier: "Priority",
  },
  pro: {
    label: "Pro",
    priceLabel: "KES 3,000/mo",
    maxBusinesses: 10,
    maxBranches: 99,
    maxUsers: 99,
    transactionQuota: UNLIMITED_QUOTA,
    payrollEnabled: true,
    supportTier: "Dedicated",
  },
  partner: {
    label: "Partner",
    priceLabel: "Custom",
    maxBusinesses: 99,
    maxBranches: 99,
    maxUsers: 99,
    transactionQuota: UNLIMITED_QUOTA,
    payrollEnabled: true,
    supportTier: "Dedicated",
  },
} as const;

type PlanName = keyof typeof PLAN_MATRIX;
type BusinessRow = InferSelectModel<typeof businesses>;
type CustomerAccountRow = InferSelectModel<typeof customerAccounts>;
type SubscriptionFeatureState = {
  trialExtendedAt?: string | null;
  trialReminderSentAt?: string | null;
  trialDowngradedAt?: string | null;
};

type TrialTarget = {
  business: BusinessRow;
  account: CustomerAccountRow | null;
  effectiveBusiness: BusinessRow;
};

function toObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

export function getSubscriptionState(features: unknown): SubscriptionFeatureState {
  const value = toObject(features);
  return {
    trialExtendedAt: typeof value.trialExtendedAt === "string" ? value.trialExtendedAt : null,
    trialReminderSentAt: typeof value.trialReminderSentAt === "string" ? value.trialReminderSentAt : null,
    trialDowngradedAt: typeof value.trialDowngradedAt === "string" ? value.trialDowngradedAt : null,
  };
}

export function mergeSubscriptionState(features: unknown, patch: Partial<SubscriptionFeatureState>): Record<string, unknown> {
  return {
    ...toObject(features),
    ...patch,
  };
}

export function getPlanConfig(plan?: string | null) {
  return PLAN_MATRIX[(plan ?? "free") as PlanName] ?? PLAN_MATRIX.free;
}

export function quotaLabel(value: number | null | undefined): string {
  if (!value || value >= UNLIMITED_QUOTA) return "Unlimited";
  return `${value.toLocaleString()} / month`;
}

async function getCustomerAccountForBusiness(
  db: ReturnType<typeof import("../queries/connection").getDb>,
  business: BusinessRow,
) {
  if (business.accountRefId) {
    const [account] = await db.select().from(customerAccounts)
      .where(and(eq(customerAccounts.id, business.accountRefId), isNull(customerAccounts.deletedAt)))
      .limit(1);
    if (account) return account;
  }

  const [account] = await db.select().from(customerAccounts)
    .where(and(eq(customerAccounts.accountId, business.accountId), isNull(customerAccounts.deletedAt)))
    .limit(1);
  return account ?? null;
}

function applyAccountStateToBusiness(business: BusinessRow, account: CustomerAccountRow): BusinessRow {
  const planConfig = getPlanConfig(account.plan);
  return {
    ...business,
    accountRefId: account.id,
    plan: account.plan,
    maxBranches: planConfig.maxBranches,
    maxUsers: account.maxUsers,
    maxTransactionsPerMonth: account.maxTransactionsPerMonth,
    subscriptionStatus: account.subscriptionStatus,
    subscriptionExpiry: account.subscriptionExpiry,
    features: account.features ?? business.features,
  };
}

async function getTrialTarget(
  db: ReturnType<typeof import("../queries/connection").getDb>,
  business: BusinessRow,
): Promise<TrialTarget> {
  const account = await getCustomerAccountForBusiness(db, business);
  const effectiveBusiness = account ? applyAccountStateToBusiness(business, account) : business;
  return { business, account, effectiveBusiness };
}

async function syncBusinessesForAccount(
  db: ReturnType<typeof import("../queries/connection").getDb>,
  accountId: string,
  values: Partial<typeof businesses.$inferInsert>,
) {
  await db.update(businesses).set(values)
    .where(and(eq(businesses.accountId, accountId), isNull(businesses.deletedAt)));
}

function getTrialKey(target: TrialTarget) {
  return target.account ? `account:${target.account.id}` : `business:${target.business.id}`;
}

function buildBusinessSubscriptionPatch(
  plan: string,
  maxUsers: number,
  maxTransactionsPerMonth: number,
  subscriptionStatus: string,
  subscriptionExpiry: string | null,
  features?: unknown,
) {
  const planConfig = getPlanConfig(plan);
  return {
    plan,
    maxBranches: planConfig.maxBranches,
    maxUsers,
    maxTransactionsPerMonth,
    subscriptionStatus,
    subscriptionExpiry,
    ...(features !== undefined ? { features } : {}),
  };
}

export async function hasPaymentMethodOnFile(
  db: ReturnType<typeof import("../queries/connection").getDb>,
  accountRefId: number | null,
  fallbackBusinessId?: number | null,
): Promise<boolean> {
  if (accountRefId) {
    const accountRows = await db.select({ id: paymentMethods.id }).from(paymentMethods)
      .where(and(eq(paymentMethods.accountRefId, accountRefId), eq(paymentMethods.isActive, true), isNull(paymentMethods.deletedAt)))
      .limit(1);
    if (accountRows.length > 0) return true;
  }

  if (fallbackBusinessId) {
    const businessRows = await db.select({ id: paymentMethods.id }).from(paymentMethods)
      .where(and(eq(paymentMethods.businessId, fallbackBusinessId), eq(paymentMethods.isActive, true), isNull(paymentMethods.deletedAt)))
      .limit(1);
    return businessRows.length > 0;
  }

  return false;
}

async function getBusinessUsers(db: ReturnType<typeof import("../queries/connection").getDb>, businessId: number) {
  const linkedUsers = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
  }).from(userBusinesses)
    .innerJoin(users, eq(users.id, userBusinesses.userId))
    .where(and(
      eq(userBusinesses.businessId, businessId),
      eq(userBusinesses.isActive, true),
      isNull(users.deletedAt),
      eq(users.isActive, true),
    ));

  return linkedUsers;
}

async function notifyBusinessUsers(
  db: ReturnType<typeof import("../queries/connection").getDb>,
  business: BusinessRow,
  payload: { type: string; title: string; message: string; subject: string; html: string; text: string },
) {
  const linkedUsers = await getBusinessUsers(db, business.id);

  for (const user of linkedUsers) {
    await db.insert(notifications).values({
      userId: user.id,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      severity: "warning",
      entityType: "business",
      entityId: business.id,
    } satisfies typeof notifications.$inferInsert);

    if (user.email) {
      await sendEmail({
        to: user.email,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
    }
  }
}

export async function extendBusinessTrial(db: ReturnType<typeof import("../queries/connection").getDb>, businessId: number) {
  const [business] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!business) {
    throw new Error("Business not found");
  }

  const account = await getCustomerAccountForBusiness(db, business);
  const effectiveBusiness = account ? applyAccountStateToBusiness(business, account) : business;
  if (effectiveBusiness.subscriptionStatus !== "trial" || !effectiveBusiness.subscriptionExpiry) {
    throw new Error("Trial extension is only available during an active trial");
  }

  const state = getSubscriptionState(effectiveBusiness.features);
  if (state.trialExtendedAt) {
    throw new Error("Trial extension has already been used");
  }

  const nextExpiry = new Date(
    Math.max(new Date(effectiveBusiness.subscriptionExpiry).getTime(), Date.now()) + TRIAL_EXTENSION_DAYS * 86400000,
  );
  const trialExtendedAt = new Date().toISOString();
  const subscriptionExpiry = nextExpiry.toISOString().slice(0, 10);
  const features = mergeSubscriptionState(effectiveBusiness.features, { trialExtendedAt });

  if (account) {
    await db.update(customerAccounts).set({
      subscriptionExpiry,
      features,
    }).where(eq(customerAccounts.id, account.id));

    await syncBusinessesForAccount(db, business.accountId, {
      ...buildBusinessSubscriptionPatch(
        account.plan,
        account.maxUsers,
        account.maxTransactionsPerMonth,
        "trial",
        subscriptionExpiry,
        features,
      ),
      accountRefId: account.id,
    });
  } else {
    await db.update(businesses).set({
      subscriptionExpiry,
      features,
    }).where(eq(businesses.id, businessId));
  }

  return {
    trialExtendedAt,
    subscriptionExpiry,
  };
}

export async function syncTrialState(db: ReturnType<typeof import("../queries/connection").getDb>, businessId: number) {
  const [business] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!business) {
    return null;
  }

  const account = await getCustomerAccountForBusiness(db, business);
  const effectiveBusiness = account ? applyAccountStateToBusiness(business, account) : business;
  if (effectiveBusiness.subscriptionStatus !== "trial" || !effectiveBusiness.subscriptionExpiry) {
    return effectiveBusiness;
  }

  const expiryTime = new Date(effectiveBusiness.subscriptionExpiry).getTime();
  if (Date.now() < expiryTime) {
    return effectiveBusiness;
  }

  const paid = await hasPaymentMethodOnFile(db, account?.id ?? business.accountRefId ?? null, businessId);
  if (paid) {
    const currentPlan = effectiveBusiness.plan ?? "free";
    const currentPlanConfig = getPlanConfig(currentPlan);

    if (account) {
      await db.update(customerAccounts).set({
        subscriptionStatus: "active",
        subscriptionExpiry: null,
        maxTransactionsPerMonth: currentPlanConfig.transactionQuota,
      }).where(eq(customerAccounts.id, account.id));

      await syncBusinessesForAccount(db, business.accountId, {
        ...buildBusinessSubscriptionPatch(
          currentPlan,
          account.maxUsers,
          currentPlanConfig.transactionQuota,
          "active",
          null,
          account.features,
        ),
        accountRefId: account.id,
      });
    } else {
      await db.update(businesses).set({
        subscriptionStatus: "active",
        subscriptionExpiry: null,
        maxTransactionsPerMonth: currentPlanConfig.transactionQuota,
      }).where(eq(businesses.id, businessId));
    }

    return {
      ...effectiveBusiness,
      subscriptionStatus: "active",
      subscriptionExpiry: null,
      maxTransactionsPerMonth: currentPlanConfig.transactionQuota,
    };
  }

  const freePlan = getPlanConfig("free");
  const features = mergeSubscriptionState(effectiveBusiness.features, { trialDowngradedAt: new Date().toISOString() });
  if (account) {
    await db.update(customerAccounts).set({
      plan: "free",
      maxBusinesses: freePlan.maxBusinesses,
      maxUsers: freePlan.maxUsers,
      maxTransactionsPerMonth: freePlan.transactionQuota,
      subscriptionStatus: "expired",
      subscriptionExpiry: null,
      features,
    }).where(eq(customerAccounts.id, account.id));

    await syncBusinessesForAccount(db, business.accountId, {
      ...buildBusinessSubscriptionPatch("free", freePlan.maxUsers, freePlan.transactionQuota, "expired", null, features),
      accountRefId: account.id,
    });
  } else {
    await db.update(businesses).set({
      plan: "free",
      maxBranches: freePlan.maxBranches,
      maxUsers: freePlan.maxUsers,
      maxTransactionsPerMonth: freePlan.transactionQuota,
      subscriptionStatus: "expired",
      subscriptionExpiry: null,
      features,
    }).where(eq(businesses.id, businessId));
  }

  return {
    ...effectiveBusiness,
    plan: "free",
    maxBranches: freePlan.maxBranches,
    maxUsers: freePlan.maxUsers,
    maxTransactionsPerMonth: freePlan.transactionQuota,
    subscriptionStatus: "expired",
    subscriptionExpiry: null,
    features,
  };
}

export async function processTrialLifecycle(db: ReturnType<typeof import("../queries/connection").getDb>, now = new Date()) {
  const reminderStart = now.toISOString().slice(0, 10);
  const reminderEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const trialBusinesses = await db.select().from(businesses).where(and(
    isNull(businesses.deletedAt),
    eq(businesses.subscriptionStatus, "trial"),
    gte(businesses.subscriptionExpiry, reminderStart),
    lte(businesses.subscriptionExpiry, reminderEnd),
  ));

  const expiredTrials = await db.select().from(businesses).where(and(
    isNull(businesses.deletedAt),
    eq(businesses.subscriptionStatus, "trial"),
    lte(businesses.subscriptionExpiry, today),
  ));

  let remindersSent = 0;
  let downgraded = 0;
  let activated = 0;
  const reminderKeys = new Set<string>();
  const expiredKeys = new Set<string>();

  for (const business of trialBusinesses) {
    const target = await getTrialTarget(db, business);
    const trialKey = getTrialKey(target);
    if (reminderKeys.has(trialKey)) continue;
    if (target.effectiveBusiness.subscriptionStatus !== "trial" || !target.effectiveBusiness.subscriptionExpiry) continue;

    const state = getSubscriptionState(target.effectiveBusiness.features);
    if (state.trialReminderSentAt) continue;

    const expiry = target.effectiveBusiness.subscriptionExpiry;
    if (expiry < reminderStart || expiry > reminderEnd) continue;

    await notifyBusinessUsers(db, target.business, {
      type: "trial_expiring",
      title: "Trial ending soon",
      message: `${target.business.name} will be downgraded when the ${getPlanConfig(target.effectiveBusiness.plan).label} trial expires unless a payment method is added.`,
      subject: `${target.business.name} trial expires soon`,
      text: `${target.business.name} is nearing the end of its trial. Add a payment method to keep the current plan active.`,
      html: `<p><strong>${target.business.name}</strong> is nearing the end of its trial.</p><p>Add a payment method to keep the current plan active when the trial expires.</p>`,
    });

    const features = mergeSubscriptionState(target.effectiveBusiness.features, { trialReminderSentAt: now.toISOString() });
    if (target.account) {
      await db.update(customerAccounts).set({ features }).where(eq(customerAccounts.id, target.account.id));
      await syncBusinessesForAccount(db, target.business.accountId, { features, accountRefId: target.account.id });
    } else {
      await db.update(businesses).set({ features }).where(eq(businesses.id, target.business.id));
    }

    reminderKeys.add(trialKey);
    remindersSent++;
  }

  for (const business of expiredTrials) {
    const target = await getTrialTarget(db, business);
    const trialKey = getTrialKey(target);
    if (expiredKeys.has(trialKey)) continue;
    if (target.effectiveBusiness.subscriptionStatus !== "trial" || !target.effectiveBusiness.subscriptionExpiry) continue;
    if (target.effectiveBusiness.subscriptionExpiry > today) continue;

    const paid = await hasPaymentMethodOnFile(db, target.account?.id ?? target.business.accountRefId ?? null, target.business.id);
    if (paid) {
      const currentPlan = target.effectiveBusiness.plan ?? "free";
      const currentPlanConfig = getPlanConfig(currentPlan);

      if (target.account) {
        await db.update(customerAccounts).set({
          subscriptionStatus: "active",
          subscriptionExpiry: null,
          maxTransactionsPerMonth: currentPlanConfig.transactionQuota,
        }).where(eq(customerAccounts.id, target.account.id));

        await syncBusinessesForAccount(db, target.business.accountId, {
          ...buildBusinessSubscriptionPatch(
            currentPlan,
            target.account.maxUsers,
            currentPlanConfig.transactionQuota,
            "active",
            null,
            target.account.features,
          ),
          accountRefId: target.account.id,
        });
      } else {
        await db.update(businesses).set({
          subscriptionStatus: "active",
          subscriptionExpiry: null,
          maxTransactionsPerMonth: currentPlanConfig.transactionQuota,
        }).where(eq(businesses.id, target.business.id));
      }

      activated++;
      expiredKeys.add(trialKey);
      continue;
    }

    const freePlan = getPlanConfig("free");
    const features = mergeSubscriptionState(target.effectiveBusiness.features, { trialDowngradedAt: now.toISOString() });
    if (target.account) {
      await db.update(customerAccounts).set({
        plan: "free",
        maxBusinesses: freePlan.maxBusinesses,
        maxUsers: freePlan.maxUsers,
        maxTransactionsPerMonth: freePlan.transactionQuota,
        subscriptionStatus: "expired",
        subscriptionExpiry: null,
        features,
      }).where(eq(customerAccounts.id, target.account.id));

      await syncBusinessesForAccount(db, target.business.accountId, {
        ...buildBusinessSubscriptionPatch("free", freePlan.maxUsers, freePlan.transactionQuota, "expired", null, features),
        accountRefId: target.account.id,
      });
    } else {
      await db.update(businesses).set({
        plan: "free",
        maxBranches: freePlan.maxBranches,
        maxUsers: freePlan.maxUsers,
        maxTransactionsPerMonth: freePlan.transactionQuota,
        subscriptionStatus: "expired",
        subscriptionExpiry: null,
        features,
      }).where(eq(businesses.id, target.business.id));
    }

    await notifyBusinessUsers(db, target.business, {
      type: "trial_downgraded",
      title: "Trial expired",
      message: `${target.business.name} has been downgraded to the Free plan because no payment method was on file.`,
      subject: `${target.business.name} has been downgraded to Free`,
      text: `${target.business.name} has been downgraded to the Free plan because no payment method was on file when the trial ended.`,
      html: `<p><strong>${target.business.name}</strong> has been downgraded to the Free plan because no payment method was on file when the trial ended.</p>`,
    });

    downgraded++;
    expiredKeys.add(trialKey);
  }

  return { remindersSent, downgraded, activated };
}

export async function countBusinessesForAccount(db: ReturnType<typeof import("../queries/connection").getDb>, accountId: string) {
  const [result] = await db.select({ count: sql<number>`COUNT(*)` }).from(businesses)
    .where(and(eq(businesses.accountId, accountId), isNull(businesses.deletedAt)));
  return result?.count ?? 0;
}
