import { z } from "zod";
import { createRouter, authedQuery, partnerView, ownerQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { partnerCommissions, businesses, users, userBusinesses } from "@db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";

export const partnerRouter = createRouter({
  // Partner dashboard: list all client businesses
  clients: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user!.id;
    // Find businesses where this user is marked as partner
    const clientBiz = await db.select().from(businesses).where(and(eq(businesses.partnerId, userId), isNull(businesses.deletedAt))).orderBy(sql`businesses.createdAt DESC`);
    return clientBiz;
  }),

  // Commission report for a period
  commissions: authedQuery
    .input(z.object({ year: z.number().optional(), month: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user!.id;
      const cond = [eq(partnerCommissions.partnerId, userId)];
      if (input.year) cond.push(eq(partnerCommissions.year, input.year));
      if (input.month) cond.push(eq(partnerCommissions.month, input.month));
      const rows = await db.select().from(partnerCommissions).where(and(...cond)).orderBy(desc(partnerCommissions.createdAt));
      // Enrich with business names
      const bizIds = [...new Set(rows.map(r => r.businessId))];
      const bizs = bizIds.length > 0
        ? await db.select().from(businesses).where(sql`${businesses.id} IN (${sql.join(bizIds.map(id => sql`${id}`), sql`, `)})`)
        : [];
      return rows.map(r => ({ ...r, businessName: bizs.find(b => b.id === r.businessId)?.name ?? "" }));
    }),

  // Calculate commissions for a period
  calculate: ownerQuery
    .input(z.object({ year: z.number(), month: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      // Find all partner-linked businesses
      const partnerBizs = await db.select().from(businesses).where(and(sql`${businesses.partnerId} IS NOT NULL`, isNull(businesses.deletedAt)));
      let created = 0;
      for (const biz of partnerBizs) {
        const revShare = parseFloat(biz.revSharePercent ?? "20");
        // Estimate subscription value based on plan tier
        const planPrices: Record<string, number> = { free: 0, starter: 2999, growth: 5999, pro: 7999 };
        const subAmount = planPrices[biz.plan ?? "free"] ?? 0;
        const commission = subAmount * (revShare / 100);

        // Upsert commission record
        const existing = await db.select().from(partnerCommissions).where(
          and(eq(partnerCommissions.partnerId, biz.partnerId!), eq(partnerCommissions.businessId, biz.id), eq(partnerCommissions.month, input.month), eq(partnerCommissions.year, input.year))
        ).limit(1);

        if (existing.length > 0) {
          await db.update(partnerCommissions).set({
            subscriptionAmount: subAmount.toFixed(2),
            commissionPercent: revShare.toFixed(2),
            commissionAmount: commission.toFixed(2),
          }).where(eq(partnerCommissions.id, existing[0].id));
        } else {
          await db.insert(partnerCommissions).values({
            partnerId: biz.partnerId!,
            businessId: biz.id,
            month: input.month,
            year: input.year,
            subscriptionAmount: subAmount.toFixed(2),
            commissionPercent: revShare.toFixed(2),
            commissionAmount: commission.toFixed(2),
          } as any);
          created++;
        }
      }
      return { created };
    }),
});
