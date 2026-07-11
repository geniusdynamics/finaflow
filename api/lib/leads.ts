// ABOUTME: Shared lead normalization, attribution, and account-referral helpers for partner lead tracking.
// ABOUTME: Keeps signup matching, settings referral updates, and lead router behavior consistent across the app.
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { businesses, customerAccounts, leads, users } from "@db/schema";
import type { DbClient } from "./account-subscriptions";

export function normalizeLeadEmail(email?: string | null): string | null {
  const normalized = email?.trim().toLowerCase() ?? "";
  return normalized.length > 0 ? normalized : null;
}

export function normalizeLeadPhone(phone?: string | null): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith("7")) return `254${digits}`;
  return digits;
}

export type LeadCommissionEvaluation = {
  commissionEligible: boolean;
  commissionStatus: "pending" | "eligible" | "info_only" | "ineligible";
};

type LeadMatchContext = {
  creatorUserId: number | null;
  creatorBusinessId: number | null;
  creatorAccountRefId: number | null;
  referredByUserId?: number | null;
  referredByBusinessId?: number | null;
};

export function evaluateLeadCommissionEligibility(context: LeadMatchContext): LeadCommissionEvaluation {
  if (!context.referredByUserId && !context.referredByBusinessId) {
    return { commissionEligible: false, commissionStatus: "info_only" };
  }

  const matchesUser = Boolean(context.creatorUserId && context.creatorUserId === context.referredByUserId);
  const matchesBusiness = Boolean(context.creatorBusinessId && context.creatorBusinessId === context.referredByBusinessId);

  if (matchesUser || matchesBusiness) {
    return { commissionEligible: true, commissionStatus: "eligible" };
  }

  return { commissionEligible: false, commissionStatus: "info_only" };
}

export async function findLatestMatchingLead(
  db: DbClient,
  contact: { email?: string | null; phone?: string | null },
) {
  const normalizedEmail = normalizeLeadEmail(contact.email);
  const normalizedPhone = normalizeLeadPhone(contact.phone);

  if (!normalizedEmail && !normalizedPhone) {
    return null;
  }

  const matchCondition = normalizedEmail && normalizedPhone
    ? or(
      eq(leads.normalizedEmail, normalizedEmail),
      eq(leads.normalizedPhone, normalizedPhone),
    )
    : normalizedEmail
      ? eq(leads.normalizedEmail, normalizedEmail)
      : eq(leads.normalizedPhone, normalizedPhone!);

  const [lead] = await db
    .select()
    .from(leads)
    .where(and(isNull(leads.deletedAt), matchCondition))
    .orderBy(desc(leads.createdAt), desc(leads.id))
    .limit(1);

  return lead ?? null;
}

export async function markLeadConverted(
  db: DbClient,
  params: {
    email?: string | null;
    phone?: string | null;
    matchedUserId: number;
    matchedAccountRefId: number | null;
    matchedBusinessId: number;
    referredByBusinessId?: number | null;
    referredByUserId?: number | null;
    referralCodeUsed?: string | null;
  },
) {
  const lead = await findLatestMatchingLead(db, params);
  if (!lead) return null;

  const evaluation = evaluateLeadCommissionEligibility({
    creatorUserId: lead.creatorUserId ?? null,
    creatorBusinessId: lead.creatorBusinessId ?? null,
    creatorAccountRefId: lead.creatorAccountRefId ?? null,
    referredByBusinessId: params.referredByBusinessId ?? null,
    referredByUserId: params.referredByUserId ?? null,
  });

  const [updated] = await db
    .update(leads)
    .set({
      status: "converted",
      matchedUserId: params.matchedUserId,
      matchedAccountRefId: params.matchedAccountRefId ?? null,
      matchedBusinessId: params.matchedBusinessId,
      joinedAt: new Date(),
      joinedViaReferral: Boolean(params.referredByBusinessId || params.referredByUserId),
      referralCodeUsed: params.referralCodeUsed ?? null,
      referredByBusinessId: params.referredByBusinessId ?? null,
      referredByUserId: params.referredByUserId ?? null,
      commissionEligible: evaluation.commissionEligible,
      commissionStatus: evaluation.commissionStatus,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, lead.id))
    .returning();

  return updated ?? null;
}

export async function applyAccountReferral(
  db: DbClient,
  params: {
    accountRefId?: number | null;
    accountId?: string | null;
    referredByBusinessId: number;
    referredByUserId?: number | null;
  },
) {
  let targetAccountRefId = params.accountRefId ?? null;
  let targetAccountId = params.accountId ?? null;

  if (!targetAccountRefId && targetAccountId) {
    const [account] = await db
      .select({ id: customerAccounts.id })
      .from(customerAccounts)
      .where(and(eq(customerAccounts.accountId, targetAccountId), isNull(customerAccounts.deletedAt)))
      .limit(1);
    targetAccountRefId = account?.id ?? null;
  }

  if (!targetAccountId && targetAccountRefId) {
    const [business] = await db
      .select({ accountId: businesses.accountId })
      .from(businesses)
      .where(and(eq(businesses.accountRefId, targetAccountRefId), isNull(businesses.deletedAt)))
      .limit(1);
    targetAccountId = business?.accountId ?? null;
  }

  if (targetAccountRefId) {
    await db
      .update(businesses)
      .set({
        accountRefId: targetAccountRefId,
        referredByBusinessId: params.referredByBusinessId,
        referredByUserId: params.referredByUserId ?? null,
      })
      .where(and(eq(businesses.accountRefId, targetAccountRefId), isNull(businesses.deletedAt)));
    return;
  }

  if (targetAccountId) {
    await db
      .update(businesses)
      .set({
        referredByBusinessId: params.referredByBusinessId,
        referredByUserId: params.referredByUserId ?? null,
      })
      .where(and(eq(businesses.accountId, targetAccountId), isNull(businesses.deletedAt)));
  }
}

export async function getAccountReferralSummary(
  db: DbClient,
  options: { accountRefId?: number | null; accountId?: string | null; currentBusinessId?: number | null },
) {
  const businessQuery = db
    .select({
      id: businesses.id,
      accountId: businesses.accountId,
      accountRefId: businesses.accountRefId,
      referredByBusinessId: businesses.referredByBusinessId,
      referredByUserId: businesses.referredByUserId,
      firstMonthDiscountApplied: businesses.firstMonthDiscountApplied,
    })
    .from(businesses);

  const where =
    options.accountRefId
      ? and(eq(businesses.accountRefId, options.accountRefId), isNull(businesses.deletedAt))
      : options.accountId
        ? and(eq(businesses.accountId, options.accountId), isNull(businesses.deletedAt))
        : options.currentBusinessId
          ? and(eq(businesses.id, options.currentBusinessId), isNull(businesses.deletedAt))
          : undefined;

  if (!where) return null;

  const businessRows = await businessQuery.where(where).orderBy(desc(businesses.id));
  const activeReferral = businessRows.find((row) => row.referredByBusinessId) ?? null;
  if (!activeReferral?.referredByBusinessId) {
    return {
      referredBy: null,
      canSetReferredBy: true,
      referralCommissionEligible: false,
      referralSource: null,
    };
  }

  const [referrer] = await db
    .select({ name: businesses.name, accountId: businesses.accountId })
    .from(businesses)
    .where(eq(businesses.id, activeReferral.referredByBusinessId))
    .limit(1);

  const [convertedLead] = await db
    .select({
      commissionEligible: leads.commissionEligible,
      joinedViaReferral: leads.joinedViaReferral,
    })
    .from(leads)
    .where(
      and(
        eq(leads.matchedAccountRefId, activeReferral.accountRefId ?? -1),
        isNull(leads.deletedAt),
      ),
    )
    .orderBy(desc(leads.createdAt), desc(leads.id))
    .limit(1);

  return {
    referredBy: referrer ?? null,
    canSetReferredBy: false,
    referralCommissionEligible: Boolean(convertedLead?.commissionEligible),
    referralSource: activeReferral.firstMonthDiscountApplied ? "signup" : "settings",
  };
}

export async function getCurrentUserLeadContact(
  db: DbClient,
  userId: number,
) {
  const [user] = await db
    .select({ email: users.email, phone: users.phone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user ?? { email: null, phone: null };
}
