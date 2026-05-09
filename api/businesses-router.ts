import { z } from "zod";
import { createRouter, publicQuery, authedQuery, businessManage, ownerQuery, checkBranchLimit, checkUserLimit } from "./middleware";
import { getDb } from "./queries/connection";
import { businesses, userBusinesses, users, locations, dailySales, expenses, bills, accounts } from "@db/schema";
import { eq, and, isNull, sql, count, inArray } from "drizzle-orm";
import { logAudit } from "./lib/audit";

const PLAN_TIERS: Record<string, { maxBranches: number; maxUsers: number; label: string }> = {
  free: { maxBranches: 1, maxUsers: 1, label: "Free" },
  starter: { maxBranches: 1, maxUsers: 3, label: "Starter" },
  growth: { maxBranches: 5, maxUsers: 5, label: "Growth" },
  pro: { maxBranches: 99, maxUsers: 99, label: "Pro" },
  partner: { maxBranches: 99, maxUsers: 99, label: "Partner" },
};

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
    const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
    if (!biz) return null;

    // Auto-downgrade expired trials
    if (biz.subscriptionStatus === "trial" && biz.subscriptionExpiry && new Date() > new Date(biz.subscriptionExpiry)) {
      await db.update(businesses).set({
        plan: "free",
        maxBranches: 1,
        maxUsers: 1,
        subscriptionStatus: "expired",
        subscriptionExpiry: null,
      }).where(eq(businesses.id, businessId));
      biz.plan = "free";
      biz.subscriptionStatus = "expired";
    }

    const branchCount = await db.select({ count: sql<number>`COUNT(*)` }).from(locations).where(and(eq(locations.businessId, businessId), isNull(locations.deletedAt)));
    const userCount = await db.select({ count: sql<number>`COUNT(*)` }).from(userBusinesses).where(and(eq(userBusinesses.businessId, businessId), eq(userBusinesses.isActive, true)));

    // Get referrer info
    let referredBy: { name: string; accountId: string } | null = null;
    if (biz.referredByBusinessId) {
      const [ref] = await db.select({ name: businesses.name, accountId: businesses.accountId }).from(businesses).where(eq(businesses.id, biz.referredByBusinessId)).limit(1);
      referredBy = ref ?? null;
    }

    // Get plan label
    const planInfo = PLAN_TIERS[biz.plan ?? "free"] ?? PLAN_TIERS.free;

    return {
      plan: biz.plan,
      planLabel: planInfo.label,
      maxBranches: biz.maxBranches ?? planInfo.maxBranches,
      maxUsers: biz.maxUsers ?? planInfo.maxUsers,
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

      const targetTier = PLAN_TIERS[input.plan];
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
        subscriptionStatus: input.plan === "free" ? "active" : "active",
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

  create: businessManage
    .input(z.object({
      name: z.string().min(1).max(255),
      slug: z.string().min(1).max(100),
      accountId: z.string().max(100).optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      plan: z.string().default("free"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userBiz = await db.select().from(userBusinesses).where(and(eq(userBusinesses.userId, ctx.user!.id), eq(userBusinesses.isActive, true)));
      if (userBiz.length >= 1 && input.plan === "free") {
        throw new Error("Free tier allows only 1 business. Upgrade to create more.");
      }

      let accountId = input.accountId?.toUpperCase().trim();
      if (accountId) {
        const existing = await db.select().from(businesses).where(eq(businesses.accountId, accountId)).limit(1);
        if (existing.length > 0) throw new Error("Account ID already taken. Choose another.");
      } else {
        accountId = generateAccountId(input.name);
        let attempts = 0;
        while (attempts < 5) {
          const check = await db.select().from(businesses).where(eq(businesses.accountId, accountId)).limit(1);
          if (check.length === 0) break;
          accountId = generateAccountId(input.name);
          attempts++;
        }
      }

      const [result] = await db.insert(businesses).values({
        ...input,
        accountId,
        referralCode: generateReferralCode(),
        maxBranches: input.plan === "free" ? 1 : input.plan === "starter" ? 1 : input.plan === "growth" ? 5 : 99,
        maxUsers: input.plan === "free" ? 1 : input.plan === "starter" ? 3 : input.plan === "growth" ? 5 : 99,
      } as any);
      const businessId = Number(result.insertId);
      await db.insert(userBusinesses).values({ userId: ctx.user!.id, businessId, role: "owner", isActive: true } as any);
      await db.update(users).set({ currentBusinessId: businessId }).where(eq(users.id, ctx.user!.id));

      // Create default location
      const [locResult] = await db.insert(locations).values({
        businessId,
        name: "Main Branch",
        slug: "main",
        isActive: true,
      } as any);
      const locationId = Number(locResult.insertId);

      // Create default accounts for this location
      await db.insert(accounts).values([
        { name: "Cash Drawer", type: "cash", locationId, openingBalance: "0.00", currentBalance: "0.00", isActive: true } as any,
        { name: "M-PESA Till", type: "mpesa", locationId, openingBalance: "0.00", currentBalance: "0.00", isActive: true } as any,
        { name: "Bank Account", type: "bank_account", locationId, openingBalance: "0.00", currentBalance: "0.00", isActive: true } as any,
      ]);

      return { id: businessId, accountId, success: true };
    }),

  createDemo: authedQuery
    .mutation(async ({ ctx }) => {
      const db = getDb();
      const existing = await db.select().from(businesses)
        .where(and(eq(businesses.isDemo, true), isNull(businesses.deletedAt))).limit(1);
      if (existing.length > 0) return { id: existing[0].id, accountId: existing[0].accountId, success: true, message: "Demo already exists" };

      const accountId = generateAccountId("Demo");
      const [result] = await db.insert(businesses).values({
        accountId,
        name: "Demo Business",
        slug: `demo-${ctx.user!.id}-${Date.now()}`,
        plan: "pro",
        maxBranches: 99,
        maxUsers: 99,
        isDemo: true,
        isActive: true,
        referralCode: generateReferralCode(),
      } as any);
      const businessId = Number(result.insertId);
      await db.insert(userBusinesses).values({ userId: ctx.user!.id, businessId, role: "owner", isActive: true } as any);
      await db.update(users).set({ currentBusinessId: businessId }).where(eq(users.id, ctx.user!.id));

      // Create default location
      const [locResult] = await db.insert(locations).values({
        businessId,
        name: "Main Branch",
        slug: "main",
        isActive: true,
      } as any);
      const locationId = Number(locResult.insertId);

      // Create default accounts
      await db.insert(accounts).values([
        { name: "Cash Drawer", type: "cash", locationId, openingBalance: "50000.00", currentBalance: "50000.00", isActive: true } as any,
        { name: "M-PESA Till", type: "mpesa", locationId, openingBalance: "75000.00", currentBalance: "75000.00", isActive: true } as any,
        { name: "Bank Account", type: "bank_account", locationId, openingBalance: "200000.00", currentBalance: "200000.00", isActive: true } as any,
      ]);

      return { id: businessId, accountId, success: true, message: "Demo created" };
    }),

  update: businessManage
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
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
      await db.update(users).set({ currentBusinessId: input.businessId }).where(eq(users.id, ctx.user!.id));
      return { success: true };
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
      await db.insert(userBusinesses).values({
        userId: input.userId, businessId: input.businessId, role: input.role, isActive: true,
      } as any).onDuplicateKeyUpdate({ set: { role: input.role, isActive: true } });
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
});
