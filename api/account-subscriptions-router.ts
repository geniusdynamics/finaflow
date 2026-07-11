// ABOUTME: Exposes account-scoped subscription reads so plan details stay stable across business switching.
// ABOUTME: Prefers customer_accounts data while preserving legacy business fallback during the migration window.
import { z } from "zod";
import { and, eq, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { authedQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";
import { businesses, locations, customerAccounts } from "@db/schema";
import {
  extendBusinessTrial,
  getPlanConfig,
  getSubscriptionState,
  hasPaymentMethodOnFile,
  quotaLabel,
  syncTrialState,
} from "./lib/subscriptions";
import { getAccountSubscription, getAccountUsage } from "./lib/account-subscriptions";
import { logAudit } from "./lib/audit";
import {
  applyAccountReferral,
  getAccountReferralSummary,
  getCurrentUserLeadContact,
  markLeadConverted,
} from "./lib/leads";

async function getCurrentBusiness(
  db: ReturnType<typeof import("./queries/connection").getDb>,
  businessId: number,
) {
  const [business] = await db.select().from(businesses)
    .where(and(eq(businesses.id, businessId), isNull(businesses.deletedAt)))
    .limit(1);
  return business ?? null;
}

export const accountSubscriptionsRouter = createRouter({
  mySubscription: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
    if (!businessId) return null;

    const syncedBusiness = await syncTrialState(db, businessId);
    if (!syncedBusiness) return null;

    const resolved = await getAccountSubscription(db, {
      accountRefId: ctx.user?.accountRefId ?? ctx.user?.currentBusiness?.accountRefId ?? syncedBusiness.accountRefId ?? null,
      accountId: ctx.user?.accountId ?? ctx.user?.currentBusiness?.accountId ?? syncedBusiness.accountId ?? null,
      fallbackBusinessId: businessId,
    });

    const accountId = resolved.source === "account" ? resolved.account.accountId : syncedBusiness.accountId;
    const plan = resolved.source === "account" ? resolved.account.plan : syncedBusiness.plan;
    const planInfo = getPlanConfig(plan);
    const usage = await getAccountUsage(db, accountId);
    const [branchCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(locations)
      .where(and(eq(locations.businessId, businessId), isNull(locations.deletedAt)));
    const paymentMethodOnFile = await hasPaymentMethodOnFile(
      db,
      resolved.source === "account" ? resolved.account.id : syncedBusiness.accountRefId ?? null,
      businessId,
    );
    const subscriptionState = getSubscriptionState(
      resolved.source === "account" ? resolved.account.features : syncedBusiness.features,
    );

    const referralSummary = await getAccountReferralSummary(db, {
      accountRefId: resolved.source === "account" ? resolved.account.id : syncedBusiness.accountRefId ?? null,
      accountId,
      currentBusinessId: businessId,
    });

    const maxBusinesses = resolved.source === "account" ? resolved.account.maxBusinesses : planInfo.maxBusinesses;
    const maxUsers = resolved.source === "account"
      ? resolved.account.maxUsers
      : syncedBusiness.maxUsers ?? planInfo.maxUsers;
    const transactionQuota = resolved.source === "account"
      ? resolved.account.maxTransactionsPerMonth
      : syncedBusiness.maxTransactionsPerMonth ?? planInfo.transactionQuota;
    const subscriptionStatus = resolved.source === "account"
      ? resolved.account.subscriptionStatus
      : syncedBusiness.subscriptionStatus;
    const subscriptionExpiry = resolved.source === "account"
      ? resolved.account.subscriptionExpiry
      : syncedBusiness.subscriptionExpiry;

    return {
      accountId,
      plan,
      planLabel: planInfo.label,
      maxBusinesses,
      maxUsers,
      maxBranches: planInfo.maxBranches,
      maxTransactionsPerMonth: transactionQuota,
      transactionQuota: transactionQuota,
      transactionQuotaLabel: quotaLabel(transactionQuota),
      currentBusinesses: usage.businessCount,
      currentBranches: Number(branchCount?.count ?? 0),
      currentUsers: usage.userCount,
      payrollAvailable: planInfo.payrollEnabled,
      supportTier: planInfo.supportTier,
      priceLabel: planInfo.priceLabel,
      isDemo: syncedBusiness.isDemo,
      subscriptionStatus,
      subscriptionExpiry,
      features: resolved.source === "account" ? resolved.account.features : syncedBusiness.features,
      referralCode: syncedBusiness.referralCode,
      firstMonthDiscountApplied: syncedBusiness.firstMonthDiscountApplied,
      referredBy: referralSummary?.referredBy ?? null,
      canSetReferredBy: referralSummary?.canSetReferredBy ?? true,
      referralCommissionEligible: referralSummary?.referralCommissionEligible ?? false,
      referralSource: referralSummary?.referralSource ?? null,
      isTrial: subscriptionStatus === "trial",
      trialDaysRemaining: subscriptionStatus === "trial" && subscriptionExpiry
        ? Math.max(0, Math.ceil((new Date(subscriptionExpiry).getTime() - Date.now()) / 86400000))
        : 0,
      trialExtensionUsedAt: subscriptionState.trialExtendedAt,
      canExtendTrial: subscriptionStatus === "trial" && !subscriptionState.trialExtendedAt,
      trialReminderSentAt: subscriptionState.trialReminderSentAt,
      trialDowngradedAt: subscriptionState.trialDowngradedAt,
      hasPaymentMethodOnFile: paymentMethodOnFile,
      source: resolved.source,
    };
  }),

  setReferredBy: authedQuery
    .input(z.object({ code: z.string().min(4).max(50) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
      if (!businessId) throw new TRPCError({ code: "BAD_REQUEST", message: "No active business selected" });

      const syncedBusiness = await syncTrialState(db, businessId);
      if (!syncedBusiness) throw new TRPCError({ code: "NOT_FOUND", message: "Business not found" });

      const resolved = await getAccountSubscription(db, {
        accountRefId: ctx.user?.accountRefId ?? syncedBusiness.accountRefId ?? null,
        accountId: ctx.user?.accountId ?? syncedBusiness.accountId,
        fallbackBusinessId: businessId,
      });
      const accountId = resolved.source === "account" ? resolved.account.accountId : syncedBusiness.accountId;
      const accountRefId = resolved.source === "account" ? resolved.account.id : syncedBusiness.accountRefId ?? null;

      const accountBusinesses = await db
        .select({
          id: businesses.id,
          referredByBusinessId: businesses.referredByBusinessId,
        })
        .from(businesses)
        .where(
          accountRefId
            ? and(eq(businesses.accountRefId, accountRefId), isNull(businesses.deletedAt))
            : and(eq(businesses.accountId, accountId), isNull(businesses.deletedAt))
        );

      if (accountBusinesses.some((business) => business.referredByBusinessId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Referred By has already been set for this account" });
      }

      const [referrer] = await db
        .select({
          id: businesses.id,
          name: businesses.name,
          accountId: businesses.accountId,
          partnerId: businesses.partnerId,
          referralCode: businesses.referralCode,
        })
        .from(businesses)
        .where(and(eq(businesses.referralCode, input.code.trim().toUpperCase()), isNull(businesses.deletedAt)))
        .limit(1);

      if (!referrer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Referral code not found" });
      }
      if (referrer.accountId === accountId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot refer your own account" });
      }

      await applyAccountReferral(db, {
        accountRefId,
        accountId,
        referredByBusinessId: referrer.id,
        referredByUserId: referrer.partnerId ?? null,
      });

      const contact = await getCurrentUserLeadContact(db, ctx.user!.id);
      const lead = await markLeadConverted(db, {
        email: contact.email,
        phone: contact.phone,
        matchedUserId: ctx.user!.id,
        matchedAccountRefId: accountRefId,
        matchedBusinessId: businessId,
        referredByBusinessId: referrer.id,
        referredByUserId: referrer.partnerId ?? null,
        referralCodeUsed: referrer.referralCode,
      });

      await logAudit({
        userId: ctx.user!.id,
        businessId,
        action: "UPDATE",
        resource: "businesses",
        resourceId: businessId,
        details: {
          operation: "set_referred_by",
          referredByBusinessId: referrer.id,
          commissionEligible: lead?.commissionEligible ?? false,
        },
      });

      return {
        success: true,
        referredBy: { name: referrer.name, accountId: referrer.accountId },
        commissionEligible: lead?.commissionEligible ?? false,
      };
    }),

  changePlan: authedQuery
    .input(z.object({ plan: z.enum(["free", "starter", "growth", "pro"]) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
      if (!businessId) throw new Error("No active business selected");

      const business = await getCurrentBusiness(db, businessId);
      if (!business) throw new Error("Business not found");

      const resolved = await getAccountSubscription(db, {
        accountRefId: ctx.user?.accountRefId ?? business.accountRefId ?? null,
        accountId: ctx.user?.accountId ?? business.accountId,
        fallbackBusinessId: businessId,
      });
      const targetPlan = getPlanConfig(input.plan);

      if (input.plan === "free" || input.plan === "starter") {
        const [branchCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(locations)
          .where(and(eq(locations.businessId, businessId), isNull(locations.deletedAt)));
        if (Number(branchCount?.count ?? 0) > targetPlan.maxBranches) {
          throw new Error(
            `Cannot downgrade to ${targetPlan.label}: you have ${branchCount?.count} active branches (limit: ${targetPlan.maxBranches}). Delete excess branches first, or choose a higher plan.`,
          );
        }

        const usage = await getAccountUsage(db, business.accountId);
        if (usage.businessCount > targetPlan.maxBusinesses) {
          throw new Error(
            `Cannot downgrade to ${targetPlan.label}: this account has ${usage.businessCount} active businesses (limit: ${targetPlan.maxBusinesses}). Remove excess businesses first, or choose a higher plan.`,
          );
        }
        if (usage.userCount > targetPlan.maxUsers) {
          throw new Error(
            `Cannot downgrade to ${targetPlan.label}: this account has ${usage.userCount} active users (limit: ${targetPlan.maxUsers}). Remove excess users first, or choose a higher plan.`,
          );
        }
      }

      if (resolved.source === "account") {
        await db.update(customerAccounts).set({
          plan: input.plan,
          maxBusinesses: targetPlan.maxBusinesses,
          maxUsers: targetPlan.maxUsers,
          maxTransactionsPerMonth: targetPlan.transactionQuota,
          subscriptionStatus: "active",
          subscriptionExpiry: null,
        }).where(eq(customerAccounts.id, resolved.account.id));

        await db.update(businesses).set({
          plan: input.plan,
          maxBranches: targetPlan.maxBranches,
          maxUsers: targetPlan.maxUsers,
          maxTransactionsPerMonth: targetPlan.transactionQuota,
          subscriptionStatus: "active",
          subscriptionExpiry: null,
          accountRefId: resolved.account.id,
        }).where(and(eq(businesses.accountId, resolved.account.accountId), isNull(businesses.deletedAt)));
      } else {
        await db.update(businesses).set({
          plan: input.plan,
          maxBranches: targetPlan.maxBranches,
          maxUsers: targetPlan.maxUsers,
          maxTransactionsPerMonth: targetPlan.transactionQuota,
          subscriptionStatus: "active",
          subscriptionExpiry: null,
        }).where(eq(businesses.id, businessId));
      }

      await logAudit({
        userId: ctx.user!.id,
        businessId,
        action: "UPDATE",
        resource: "businesses",
        resourceId: businessId,
        details: {
          action: "plan_change",
          from: resolved.source === "account" ? resolved.account.plan : business.plan,
          to: input.plan,
          scope: resolved.source,
        },
      });

      return { success: true, plan: input.plan, message: `Plan changed to ${targetPlan.label}` };
    }),

  extendTrial: authedQuery
    .mutation(async ({ ctx }) => {
      const db = getDb();
      const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
      if (!businessId) throw new Error("No active business selected");

      const result = await extendBusinessTrial(db, businessId);
      await logAudit({
        userId: ctx.user!.id,
        businessId,
        action: "UPDATE",
        resource: "businesses",
        resourceId: businessId,
        details: { action: "extend_trial", subscriptionExpiry: result.subscriptionExpiry, scope: "account" },
      });

      return {
        success: true,
        message: `Trial extended to ${result.subscriptionExpiry}`,
        ...result,
      };
    }),
});
