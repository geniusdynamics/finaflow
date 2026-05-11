// ABOUTME: Serves business membership, subscription, document, and lifecycle mutations for the active account and business context.
// ABOUTME: Keeps business creation, plan changes, and access switching aligned with shared subscription and audit rules.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { createRouter, publicQuery, authedQuery, businessManage } from "./middleware";
import { getDb } from "./queries/connection";
import { businesses, userBusinesses, users, locations, dailySales, expenses, bills, accounts, businessDocuments, businessLogos, customerAccounts, type InsertCustomerAccount } from "@db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { logAudit } from "./lib/audit";
import { base64SizeBytes, resolveMimeType, sanitizeDownloadFileName } from "./lib/business-documents";
import { assertAllowedLogoMimeType, assertLogoMaxSize } from "./lib/logo-validation";
import { assertCanCreateBusiness } from "./lib/subscription-enforcement";
import {
  countBusinessesForAccount,
  extendBusinessTrial,
  getPlanConfig,
  getSubscriptionState,
  hasPaymentMethodOnFile,
  quotaLabel,
  syncTrialState,
} from "./lib/subscriptions";

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return `FINA${code}`;
}

function generateAccountId(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().substring(0, 20);
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${base}${suffix}`;
}

export const getDocumentsDetailedInputSchema = z.object({
  businessId: z.number().int().positive(),
});

export const downloadDocumentInputSchema = z.object({
  documentId: z.number().int().positive(),
});

export const uploadLogoInputSchema = z.object({
  businessId: z.number().int().positive(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  fileData: z.string().min(1),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  sizeBytes: z.number().int().positive(),
});

export const getActiveLogoInputSchema = z.object({
  businessId: z.number().int().positive(),
});

export const deleteLogoInputSchema = z.object({
  businessId: z.number().int().positive(),
});

export function mapDownloadPayload(row: {
  fileName: string;
  mimeType?: string | null;
  fileData: string;
}) {
  return {
    fileName: sanitizeDownloadFileName(row.fileName),
    mimeType: resolveMimeType(row.mimeType),
    fileData: row.fileData,
  };
}

async function assertBusinessMembership(params: {
  userId: number;
  businessId: number;
}): Promise<void> {
  const db = getDb();
  const access = await db.select({ id: userBusinesses.id }).from(userBusinesses).where(and(
    eq(userBusinesses.userId, params.userId),
    eq(userBusinesses.businessId, params.businessId),
    eq(userBusinesses.isActive, true),
  )).limit(1);

  if (access.length === 0) {
    throw new Error("You do not have access to this business");
  }
}

export const businessesRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user!.id;
    const junctions = await db.select().from(userBusinesses)
      .where(and(eq(userBusinesses.userId, userId), eq(userBusinesses.isActive, true)));
    if (junctions.length === 0) return [];
    const bizIds = junctions.map(j => j.businessId);
    const idSql = sql.join(bizIds.map(id => sql`${id}`), sql`, `);
    const rows = await db.select().from(businesses)
      .where(and(sql`${businesses.id} IN (${idSql})`, isNull(businesses.deletedAt)));
    // Batch-load location counts for all businesses
    const locCounts = await db.select({
      businessId: locations.businessId,
      count: sql<number>`COUNT(*)`,
    }).from(locations).where(and(sql`${locations.businessId} IN (${idSql})`, isNull(locations.deletedAt)))
      .groupBy(locations.businessId);
    const locCountMap = new Map(locCounts.map(l => [l.businessId, l.count]));
    return rows.map(b => ({
      ...b,
      branchCount: locCountMap.get(b.id) ?? 0,
    }));
  }),

  get: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const row = await db.select().from(businesses).where(and(eq(businesses.id, input.id), isNull(businesses.deletedAt))).limit(1);
      return row[0] ?? null;
    }),

  getByAccountId: authedQuery
    .input(z.object({ accountId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const row = await db.select().from(businesses)
        .where(and(eq(businesses.accountId, input.accountId.toUpperCase()), isNull(businesses.deletedAt)))
        .limit(1);
      return row[0] ?? null;
    }),

  myTier: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
    if (!businessId) return null;
    const biz = await syncTrialState(db, businessId);
    if (!biz) return null;

    const branchCount = await db.select({ count: sql<number>`COUNT(*)` }).from(locations).where(and(eq(locations.businessId, businessId), isNull(locations.deletedAt)));
    const userCount = await db.select({ count: sql<number>`COUNT(*)` }).from(userBusinesses).where(and(eq(userBusinesses.businessId, businessId), eq(userBusinesses.isActive, true)));
    const businessesCount = await countBusinessesForAccount(db, biz.accountId);
    const paymentMethodOnFile = await hasPaymentMethodOnFile(
      db,
      biz.accountRefId ?? ctx.user?.accountRefId ?? ctx.user?.currentBusiness?.accountRefId ?? null,
      businessId,
    );
    const subscriptionState = getSubscriptionState(biz.features);

    let referredBy: { name: string; accountId: string } | null = null;
    if (biz.referredByBusinessId) {
      const [ref] = await db.select({ name: businesses.name, accountId: businesses.accountId }).from(businesses).where(eq(businesses.id, biz.referredByBusinessId)).limit(1);
      referredBy = ref ?? null;
    }

    const planInfo = getPlanConfig(biz.plan ?? "free");
    const transactionQuota = biz.maxTransactionsPerMonth ?? planInfo.transactionQuota;

    return {
      plan: biz.plan,
      planLabel: planInfo.label,
      maxBranches: biz.maxBranches ?? planInfo.maxBranches,
      maxUsers: biz.maxUsers ?? planInfo.maxUsers,
      maxBusinesses: planInfo.maxBusinesses,
      currentBusinesses: businessesCount,
      transactionQuota,
      transactionQuotaLabel: quotaLabel(transactionQuota),
      payrollAvailable: planInfo.payrollEnabled,
      supportTier: planInfo.supportTier,
      priceLabel: planInfo.priceLabel,
      currentBranches: branchCount[0]?.count ?? 0,
      currentUsers: userCount[0]?.count ?? 0,
      isDemo: biz.isDemo,
      subscriptionStatus: biz.subscriptionStatus,
      subscriptionExpiry: biz.subscriptionExpiry,
      features: biz.features,
      accountId: biz.accountId,
      referralCode: biz.referralCode,
      firstMonthDiscountApplied: biz.firstMonthDiscountApplied,
      referredBy,
      isTrial: biz.subscriptionStatus === "trial",
      trialDaysRemaining: biz.subscriptionStatus === "trial" && biz.subscriptionExpiry
        ? Math.max(0, Math.ceil((new Date(biz.subscriptionExpiry).getTime() - Date.now()) / 86400000))
        : 0,
      trialExtensionUsedAt: subscriptionState.trialExtendedAt,
      canExtendTrial: biz.subscriptionStatus === "trial" && !subscriptionState.trialExtendedAt,
      trialReminderSentAt: subscriptionState.trialReminderSentAt,
      trialDowngradedAt: subscriptionState.trialDowngradedAt,
      hasPaymentMethodOnFile: paymentMethodOnFile,
    };
  }),

  changePlan: authedQuery
    .input(z.object({ plan: z.enum(["free", "starter", "growth", "pro"]) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
      if (!businessId) throw new Error("No active business selected");

      const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
      if (!biz) throw new Error("Business not found");

      const targetTier = getPlanConfig(input.plan);
      if (!targetTier) throw new Error("Invalid plan");

      // When downgrading, enforce limits
      if (input.plan === "free" || input.plan === "starter") {
        // Check current counts exceed new limits
        const branchCount = await db.select({ count: sql<number>`COUNT(*)` }).from(locations)
          .where(and(eq(locations.businessId, businessId), isNull(locations.deletedAt)));
        const userCount = await db.select({ count: sql<number>`COUNT(*)` }).from(userBusinesses)
          .where(and(eq(userBusinesses.businessId, businessId), eq(userBusinesses.isActive, true)));

        if ((branchCount[0]?.count ?? 0) > targetTier.maxBranches) {
          throw new Error(
            `Cannot downgrade to ${targetTier.label}: you have ${branchCount[0]?.count} active branches (limit: ${targetTier.maxBranches}). ` +
            `Delete excess branches first, or choose a higher plan.`
          );
        }
        if ((userCount[0]?.count ?? 0) > targetTier.maxUsers) {
          throw new Error(
            `Cannot downgrade to ${targetTier.label}: you have ${userCount[0]?.count} active users (limit: ${targetTier.maxUsers}). ` +
            `Remove excess users first, or choose a higher plan.`
          );
        }
      }

      await db.update(businesses).set({
        plan: input.plan,
        maxBranches: targetTier.maxBranches,
        maxUsers: targetTier.maxUsers,
        maxTransactionsPerMonth: targetTier.transactionQuota,
        subscriptionStatus: "active",
        subscriptionExpiry: null,
      }).where(eq(businesses.id, businessId));

      await logAudit({
        userId: ctx.user!.id,
        businessId,
        action: "UPDATE",
        resource: "businesses",
        resourceId: businessId,
        details: { action: "plan_change", from: biz.plan, to: input.plan },
      });

      return { success: true, plan: input.plan, message: `Plan changed to ${targetTier.label}` };
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
        details: { action: "extend_trial", subscriptionExpiry: result.subscriptionExpiry },
      });

      return {
        success: true,
        message: `Trial extended to ${result.subscriptionExpiry}`,
        ...result,
      };
    }),

  create: businessManage
    .input(z.object({
      name: z.string().min(1).max(255),
      slug: z.string().min(1).max(100),
      accountId: z.string().max(100).optional(),
      businessType: z.string().max(50).optional(),
      country: z.string().max(100).optional(),
      county: z.string().max(100).optional(),
      subCounty: z.string().max(100).optional(),
      address: z.string().optional(),
      businessRegNumber: z.string().max(100).optional(),
      phone: z.string().optional(),
      natureOfBusiness: z.string().max(255).optional(),
      kraPin: z.string().max(20).optional(),
      email: z.string().optional(),
      plan: z.string().default("free"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const accountId = ctx.user?.accountId ?? ctx.user?.currentBusiness?.accountId;
      const accountRefId = ctx.user?.accountRefId ?? ctx.user?.currentBusiness?.accountRefId ?? null;
      if (!accountId) {
        throw new Error("No active account selected");
      }

      await assertCanCreateBusiness(db, accountId, accountRefId);

      const planConfig = getPlanConfig(input.plan);
      let businessId = 0;
      await db.transaction(async (tx) => {
        const [result] = await tx.insert(businesses).values({
          ...input,
          accountId,
          accountRefId,
          referralCode: generateReferralCode(),
          maxBranches: planConfig.maxBranches,
          maxUsers: planConfig.maxUsers,
        } as any).returning();
        businessId = result.id;
        
        await tx.insert(userBusinesses).values({ userId: ctx.user!.id, businessId, role: "owner", isActive: true } as any);
        await tx.update(users).set({ currentBusinessId: businessId }).where(eq(users.id, ctx.user!.id));

        // Create default location with a more unique slug to avoid global unique constraint conflicts
        const locationSlug = `main-${businessId}`;
        const [locResult] = await tx.insert(locations).values({
          businessId,
          name: "Main Branch",
          slug: locationSlug,
          isActive: true,
        } as any).returning();
        const locationId = locResult.id;

        // Create default accounts for this location
        await tx.insert(accounts).values([
          { name: "Cash Drawer", type: "cash", locationId, openingBalance: "0.00", currentBalance: "0.00", isActive: true } as any,
          { name: "M-PESA Till", type: "mpesa", locationId, openingBalance: "0.00", currentBalance: "0.00", isActive: true } as any,
          { name: "Bank Account", type: "bank_account", locationId, openingBalance: "0.00", currentBalance: "0.00", isActive: true } as any,
        ]);
      });

      return { id: businessId, accountId, success: true };
    }),

  createDemo: authedQuery
    .mutation(async ({ ctx }) => {
      const db = getDb();
      const existing = await db.select().from(businesses)
        .where(and(eq(businesses.isDemo, true), isNull(businesses.deletedAt))).limit(1);
      if (existing.length > 0) return { id: existing[0].id, accountId: existing[0].accountId, success: true, message: "Demo already exists" };

      const accountId = generateAccountId("Demo");
      const planConfig = getPlanConfig("pro");
      const accountValues: InsertCustomerAccount = {
        accountId,
        name: "Demo Business",
        plan: "pro",
        maxBusinesses: planConfig.maxBusinesses,
        maxUsers: 99,
        maxTransactionsPerMonth: planConfig.transactionQuota,
        subscriptionStatus: "active",
        subscriptionExpiry: null,
        features: {},
        isActive: true,
      };
      const [accountRow] = await db.insert(customerAccounts)
        .values(accountValues)
        .returning({ id: customerAccounts.id });
      
      let businessId = 0;
      await db.transaction(async (tx) => {
        const [result] = await tx.insert(businesses).values({
          accountId,
          accountRefId: accountRow.id,
          name: "Demo Business",
          slug: `demo-${ctx.user!.id}-${Date.now()}`,
          plan: "pro",
          maxBranches: 99,
          maxUsers: 99,
          isDemo: true,
          isActive: true,
          referralCode: generateReferralCode(),
        } as any).returning();
        businessId = result.id;
        
        await tx.insert(userBusinesses).values({ userId: ctx.user!.id, businessId, role: "owner", isActive: true } as any);
        await tx.update(users).set({ currentBusinessId: businessId }).where(eq(users.id, ctx.user!.id));

        // Create default location
        const [locResult] = await tx.insert(locations).values({
          businessId,
          name: "Main Branch",
          slug: `demo-main-${businessId}`,
          isActive: true,
        } as any).returning();
        const locationId = locResult.id;

        // Create default accounts
        await tx.insert(accounts).values([
          { name: "Cash Drawer", type: "cash", locationId, openingBalance: "50000.00", currentBalance: "50000.00", isActive: true } as any,
          { name: "M-PESA Till", type: "mpesa", locationId, openingBalance: "75000.00", currentBalance: "75000.00", isActive: true } as any,
          { name: "Bank Account", type: "bank_account", locationId, openingBalance: "200000.00", currentBalance: "200000.00", isActive: true } as any,
        ]);
      });

      return { id: businessId, accountId, success: true, message: "Demo created" };
    }),

  update: businessManage
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      businessType: z.string().max(50).optional(),
      country: z.string().max(100).optional(),
      county: z.string().max(100).optional(),
      subCounty: z.string().max(100).optional(),
      address: z.string().optional(),
      businessRegNumber: z.string().max(100).optional(),
      phone: z.string().optional(),
      natureOfBusiness: z.string().max(255).optional(),
      kraPin: z.string().max(20).optional(),
      email: z.string().optional(),
      plan: z.string().optional(),
      isActive: z.boolean().optional(),
      isWhiteLabel: z.boolean().optional(),
      whiteLabelDomain: z.string().optional(),
      partnerId: z.number().optional(),
      revSharePercent: z.string().optional(),
      accountId: z.string().max(100).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      if (updates.accountId) {
        const existing = await db.select().from(businesses)
          .where(and(eq(businesses.accountId, updates.accountId), sql`${businesses.id} <> ${id}`))
          .limit(1);
        if (existing.length > 0) throw new Error("Account ID already taken");
      }
      await db.update(businesses).set(updates as any).where(eq(businesses.id, id));
      return { success: true };
    }),

  delete: businessManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [biz] = await db.select().from(businesses).where(eq(businesses.id, input.id)).limit(1);
      if (!biz) throw new Error("Business not found");

      const bizLocations = await db.select().from(locations)
        .where(and(eq(locations.businessId, input.id), isNull(locations.deletedAt)));
      const locationIds = bizLocations.map(l => l.id);

      let hasTransactions = false;
      if (locationIds.length > 0) {
        const locIdSql = sql.join(locationIds.map(id => sql`${id}`), sql`, `);
        const salesCount = await db.select({ count: sql<number>`COUNT(*)` }).from(dailySales)
          .where(and(sql`${dailySales.locationId} IN (${locIdSql})`, isNull(dailySales.deletedAt)));
        const expCount = await db.select({ count: sql<number>`COUNT(*)` }).from(expenses)
          .where(and(sql`${expenses.locationId} IN (${locIdSql})`, isNull(expenses.deletedAt)));
        const billCount = await db.select({ count: sql<number>`COUNT(*)` }).from(bills)
          .where(and(sql`${bills.locationId} IN (${locIdSql})`, isNull(bills.deletedAt)));
        const acctCount = await db.select({ count: sql<number>`COUNT(*)` }).from(accounts)
          .where(and(sql`${accounts.locationId} IN (${locIdSql})`, isNull(accounts.deletedAt)));
        hasTransactions = (salesCount[0]?.count ?? 0) + (expCount[0]?.count ?? 0) + (billCount[0]?.count ?? 0) + (acctCount[0]?.count ?? 0) > 0;
      }

      for (const loc of bizLocations) {
        await db.update(locations).set({ deletedAt: new Date() }).where(eq(locations.id, loc.id));
      }

      if (locationIds.length > 0) {
        const locIdSql = sql.join(locationIds.map(id => sql`${id}`), sql`, `);
        await db.update(accounts).set({ deletedAt: new Date() })
          .where(and(sql`${accounts.locationId} IN (${locIdSql})`, isNull(accounts.deletedAt)));
      }

      if (biz.isDemo || !hasTransactions) {
        await db.update(businesses).set({ deletedAt: new Date() }).where(eq(businesses.id, input.id));
        return { success: true, action: "deleted" };
      }

      await db.update(businesses).set({ isActive: false, deletedAt: new Date() }).where(eq(businesses.id, input.id));
      return { success: true, action: "disabled", message: "Business has transaction history. It and all its locations have been disabled." };
    }),

  switch: authedQuery
    .input(z.object({ businessId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const junction = await db.select().from(userBusinesses)
        .where(and(eq(userBusinesses.userId, ctx.user!.id), eq(userBusinesses.businessId, input.businessId), eq(userBusinesses.isActive, true))).limit(1);
      if (junction.length === 0) throw new Error("You do not have access to this business");
      const [business] = await db.select().from(businesses)
        .where(and(eq(businesses.id, input.businessId), isNull(businesses.deletedAt)))
        .limit(1);
      if (!business) throw new Error("Business not found");
      await db.update(users).set({
        currentBusinessId: input.businessId,
        accountRefId: business.accountRefId ?? ctx.user?.accountRefId ?? null,
      }).where(eq(users.id, ctx.user!.id));
      return {
        success: true,
        accountId: business.accountId,
        accountRefId: business.accountRefId ?? ctx.user?.accountRefId ?? null,
      };
    }),

  addMember: businessManage
    .input(z.object({ businessId: z.number(), userId: z.number(), role: z.string().default("admin") }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [biz] = await db.select().from(businesses).where(eq(businesses.id, input.businessId)).limit(1);
      const maxUsers = biz?.maxUsers ?? 1;
      const currentUsers = await db.select({ count: sql<number>`COUNT(*)` }).from(userBusinesses)
        .where(and(eq(userBusinesses.businessId, input.businessId), eq(userBusinesses.isActive, true)));
      if ((currentUsers[0]?.count ?? 0) >= maxUsers) {
        throw new Error(`User limit reached (${maxUsers}). Upgrade plan to add more users.`);
      }
      const existingMember = await db.select({ id: userBusinesses.id }).from(userBusinesses)
        .where(and(eq(userBusinesses.userId, input.userId), eq(userBusinesses.businessId, input.businessId)))
        .limit(1);
      if (existingMember[0]) {
        await db.update(userBusinesses)
          .set({ role: input.role, isActive: true })
          .where(eq(userBusinesses.id, existingMember[0].id));
      } else {
        await db.insert(userBusinesses).values({
          userId: input.userId,
          businessId: input.businessId,
          role: input.role,
          isActive: true,
        } as typeof userBusinesses.$inferInsert);
      }
      return { success: true };
    }),

  removeMember: businessManage
    .input(z.object({ businessId: z.number(), userId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(userBusinesses).set({ isActive: false }).where(and(eq(userBusinesses.userId, input.userId), eq(userBusinesses.businessId, input.businessId)));
      return { success: true };
    }),

  members: businessManage
    .input(z.object({ businessId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const junctions = await db.select().from(userBusinesses).where(and(eq(userBusinesses.businessId, input.businessId), eq(userBusinesses.isActive, true)));
      if (junctions.length === 0) return [];
      const userIds = junctions.map(j => j.userId);
      const rows = await db.select().from(users).where(sql`${users.id} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);
      return rows.map(u => ({ ...u, businessRole: junctions.find(jx => jx.userId === u.id)?.role ?? "admin" }));
    }),

  // Partner / Referral tracking
  myReferrals: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user!.id;
    const myBizs = await db.select().from(businesses)
      .where(and(
        sql`(${eq(businesses.partnerId, userId)} OR ${eq(businesses.referredByUserId, userId)})`,
        isNull(businesses.deletedAt)
      ));
    if (myBizs.length === 0) return { referralCode: null, referrals: [] };

    const bizIds = myBizs.map(b => b.id);
    const idSql = sql.join(bizIds.map(id => sql`${id}`), sql`, `);
    const referrals = await db.select().from(businesses)
      .where(and(
        sql`${businesses.referredByBusinessId} IN (${idSql})`,
        isNull(businesses.deletedAt),
      ));

    return {
      referralCode: myBizs[0]?.referralCode ?? null,
      referrals: referrals.map(r => ({
        id: r.id,
        name: r.name,
        accountId: r.accountId,
        plan: r.plan,
        createdAt: r.createdAt,
        firstMonthDiscountApplied: r.firstMonthDiscountApplied,
      })),
    };
  }),

  generateReferralCode: authedQuery
    .input(z.object({ businessId: z.number().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = input.businessId ?? ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
      if (!businessId) throw new Error("No business found to generate code for");

      const junction = await db.select().from(userBusinesses)
        .where(and(eq(userBusinesses.userId, ctx.user!.id), eq(userBusinesses.businessId, businessId), eq(userBusinesses.isActive, true)))
        .limit(1);
      if (junction.length === 0) throw new Error("You do not have access to this business");

      const code = generateReferralCode();
      await db.update(businesses).set({ referralCode: code }).where(eq(businesses.id, businessId));
      return { code, success: true };
    }),

  validateReferralCode: publicQuery
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const row = await db.select().from(businesses)
        .where(and(eq(businesses.referralCode, input.code.toUpperCase()), isNull(businesses.deletedAt)))
        .limit(1);
      if (!row[0]) return { valid: false };
      return {
        valid: true,
        businessName: row[0].name,
        accountId: row[0].accountId,
        discount: "10% off first month",
      };
    }),

  uploadDocument: businessManage
    .input(z.object({
      businessId: z.number(),
      documentType: z.string().max(50),
      fileName: z.string().max(255),
      fileData: z.string(),
      mimeType: z.string().max(50).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [doc] = await db.insert(businessDocuments).values({
        businessId: input.businessId,
        documentType: input.documentType,
        fileName: input.fileName,
        fileData: input.fileData,
        mimeType: input.mimeType || null,
        notes: input.notes || null,
        uploadedBy: ctx.user!.id,
      } as any).returning();
      return { success: true, id: doc.id };
    }),

  getDocuments: businessManage
    .input(z.object({ businessId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select({
        id: businessDocuments.id,
        documentType: businessDocuments.documentType,
        fileName: businessDocuments.fileName,
        mimeType: businessDocuments.mimeType,
        notes: businessDocuments.notes,
        uploadedBy: businessDocuments.uploadedBy,
        createdAt: businessDocuments.createdAt,
      }).from(businessDocuments)
        .where(and(eq(businessDocuments.businessId, input.businessId), isNull(businessDocuments.deletedAt)));
    }),

  getDocumentsDetailed: businessManage
    .input(getDocumentsDetailedInputSchema)
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.user!.id;
      const access = await db.select().from(userBusinesses).where(and(
        eq(userBusinesses.userId, userId),
        eq(userBusinesses.businessId, input.businessId),
        eq(userBusinesses.isActive, true),
      )).limit(1);

      if (access.length === 0) {
        throw new Error("You do not have access to this business");
      }

      const rows = await db.select({
        id: businessDocuments.id,
        fileName: businessDocuments.fileName,
        documentType: businessDocuments.documentType,
        mimeType: businessDocuments.mimeType,
        uploadedBy: businessDocuments.uploadedBy,
        createdAt: businessDocuments.createdAt,
        fileData: businessDocuments.fileData,
      }).from(businessDocuments).where(and(
        eq(businessDocuments.businessId, input.businessId),
        isNull(businessDocuments.deletedAt),
      ));

      return rows.map((row) => ({
        id: row.id,
        fileName: row.fileName,
        documentType: row.documentType,
        mimeType: resolveMimeType(row.mimeType),
        uploadedBy: row.uploadedBy,
        createdAt: row.createdAt,
        fileSizeBytes: base64SizeBytes(row.fileData),
      }));
    }),

  downloadDocument: businessManage
    .input(downloadDocumentInputSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.user!.id;
      const [doc] = await db.select().from(businessDocuments).where(and(
        eq(businessDocuments.id, input.documentId),
        isNull(businessDocuments.deletedAt),
      )).limit(1);

      if (!doc) {
        throw new Error("Document not found");
      }

      const access = await db.select().from(userBusinesses).where(and(
        eq(userBusinesses.userId, userId),
        eq(userBusinesses.businessId, doc.businessId),
        eq(userBusinesses.isActive, true),
      )).limit(1);

      if (access.length === 0) {
        throw new Error("You do not have access to this business");
      }

      await logAudit({
        userId,
        businessId: doc.businessId,
        action: "DOWNLOAD",
        resource: "business_documents",
        resourceId: doc.id,
        details: { fileName: doc.fileName, mimeType: doc.mimeType },
      });

      return mapDownloadPayload(doc);
    }),

  deleteDocument: businessManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(businessDocuments).set({ deletedAt: new Date() })
        .where(eq(businessDocuments.id, input.id));
      return { success: true };
    }),

  uploadLogo: businessManage
    .input(uploadLogoInputSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.user!.id;
      await assertBusinessMembership({ userId, businessId: input.businessId });
      assertAllowedLogoMimeType(input.mimeType);
      assertLogoMaxSize(input.sizeBytes);

      const uploadedLogo = await db.transaction(async (tx) => {
        await tx.update(businessLogos).set({
          isActive: false,
          updatedAt: new Date(),
        }).where(and(
          eq(businessLogos.businessId, input.businessId),
          eq(businessLogos.isActive, true),
          isNull(businessLogos.deletedAt),
        ));

        const [logo] = await tx.insert(businessLogos).values({
          businessId: input.businessId,
          fileName: input.fileName,
          mimeType: input.mimeType,
          fileData: input.fileData,
          width: input.width ?? null,
          height: input.height ?? null,
          sizeBytes: input.sizeBytes,
          isActive: true,
          uploadedBy: userId,
        } as any).returning();

        await logAudit({
          userId,
          businessId: input.businessId,
          action: "CREATE",
          resource: "business_logos",
          resourceId: logo.id,
          details: {
            operation: "upload_logo",
            fileName: input.fileName,
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
          },
        });

        return logo;
      });

      return { success: true, id: uploadedLogo.id };
    }),

  getActiveLogo: businessManage
    .input(getActiveLogoInputSchema)
    .query(async ({ input, ctx }) => {
      const db = getDb();
      await assertBusinessMembership({ userId: ctx.user!.id, businessId: input.businessId });

      const [row] = await db.select().from(businessLogos).where(and(
        eq(businessLogos.businessId, input.businessId),
        eq(businessLogos.isActive, true),
        isNull(businessLogos.deletedAt),
      )).limit(1);

      return row ?? null;
    }),

  deleteLogo: businessManage
    .input(deleteLogoInputSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.user!.id;
      await assertBusinessMembership({ userId, businessId: input.businessId });

      await db.transaction(async (tx) => {
        const [activeLogo] = await tx.select().from(businessLogos).where(and(
          eq(businessLogos.businessId, input.businessId),
          eq(businessLogos.isActive, true),
          isNull(businessLogos.deletedAt),
        )).limit(1);

        if (!activeLogo) {
          throw new Error("Active logo not found");
        }

        await tx.update(businessLogos).set({
          isActive: false,
          deletedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(businessLogos.id, activeLogo.id));

        await logAudit({
          userId,
          businessId: input.businessId,
          action: "DELETE",
          resource: "business_logos",
          resourceId: activeLogo.id,
          details: {
            operation: "delete_logo",
            fileName: activeLogo.fileName,
            mimeType: activeLogo.mimeType,
            sizeBytes: activeLogo.sizeBytes,
          },
        });
      });

      return { success: true };
    }),
});
