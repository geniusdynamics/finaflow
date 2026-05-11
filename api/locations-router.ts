// ABOUTME: Exposes branch listing and maintenance mutations within the active business context.
// ABOUTME: Applies shared subscription enforcement before new locations are added to a business.
import { z } from "zod";
import { createRouter, authedQuery, settingsManage, getCurrentBusinessLocationIds } from "./middleware";
import { getDb } from "./queries/connection";
import { locations } from "@db/schema";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { assertCanCreateLocation } from "./lib/subscription-enforcement";

export const locationsRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
    if (!businessId) return [];
    return db.select().from(locations).where(
      and(eq(locations.businessId, businessId), isNull(locations.deletedAt))
    ).orderBy(locations.name);
  }),

  create: settingsManage
    .input(z.object({
      name: z.string().min(1).max(255),
      slug: z.string().min(1).max(100),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
      if (!businessId) throw new Error("No active business selected");

      await assertCanCreateLocation(
        db,
        businessId,
        ctx.user?.accountId ?? ctx.user?.currentBusiness?.accountId ?? "",
        ctx.user?.accountRefId ?? ctx.user?.currentBusiness?.accountRefId ?? null,
      );

      const [result] = await db.insert(locations).values({
        name: input.name, slug: input.slug, address: input.address,
        phone: input.phone, email: input.email,
        businessId,
      } as any).returning();
      return { id: result.id, success: true };
    }),

  update: settingsManage
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      slug: z.string().min(1).max(100).optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      isActive: z.boolean().optional(),
      defaultMpesaAccountId: z.number().optional(),
      defaultCashAccountId: z.number().optional(),
      nextBillNumber: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      await db.update(locations).set(updates).where(eq(locations.id, id));
      return { success: true };
    }),

  delete: settingsManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(locations).set({ deletedAt: new Date() }).where(eq(locations.id, input.id));
      return { success: true };
    }),
});
