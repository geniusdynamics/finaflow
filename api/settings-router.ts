import { z } from "zod";
import { createRouter, authedQuery, settingsManage, getUserBusinessIds } from "./middleware";
import { getDb } from "./queries/connection";
import { appSettings } from "@db/schema";
import { eq, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyBusinessAccess(ctx: any, businessId?: number) {
  if (!businessId) return;
  const userId = ctx.user?.id;
  if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  const allowedIds = await getUserBusinessIds(userId);
  if (!allowedIds.includes(businessId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this business settings." });
  }
}

export const settingsRouter = createRouter({
  get: authedQuery
    .input(z.object({ key: z.string(), businessId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      await verifyBusinessAccess(ctx, input.businessId);
      const db = getDb();
      const conditions = [eq(appSettings.key, input.key)];
      if (input.businessId) conditions.push(eq(appSettings.businessId, input.businessId));
      else conditions.push(sql`${appSettings.businessId} IS NULL`);
      const rows = await db.select().from(appSettings).where(and(...conditions)).limit(1);
      return rows[0]?.value ?? null;
    }),

  set: settingsManage
    .input(z.object({
      key: z.string(),
      value: z.string(),
      businessId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await verifyBusinessAccess(ctx, input.businessId);
      const db = getDb();
      const conditions = [eq(appSettings.key, input.key)];
      if (input.businessId) conditions.push(eq(appSettings.businessId, input.businessId));
      else conditions.push(sql`${appSettings.businessId} IS NULL`);
      const existing = await db.select().from(appSettings).where(and(...conditions)).limit(1);
      if (existing.length > 0) {
        await db.update(appSettings).set({ value: input.value }).where(eq(appSettings.id, existing[0].id));
      } else {
        await db.insert(appSettings).values({
          key: input.key,
          value: input.value,
          businessId: input.businessId,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any).returning();
      }
      return { success: true };
    }),

  list: authedQuery
    .input(z.object({ businessId: z.number().optional() }).optional())
    .query(async ({ input, ctx }) => {
      await verifyBusinessAccess(ctx, input?.businessId);
      const db = getDb();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conditions: any[] = [];
      if (input?.businessId) {
        conditions.push(sql`${appSettings.businessId} = ${input.businessId} OR ${appSettings.businessId} IS NULL`);
      }
      const rows = await db.select().from(appSettings)
        .where(conditions.length > 0 ? and(...conditions) : sql`1=1`);
      // Return as key-value map
      const map: Record<string, string> = {};
      for (const r of rows) {
        map[r.key] = r.value ?? "";
      }
      return map;
    }),
});
