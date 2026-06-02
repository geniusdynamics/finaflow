import { z } from "zod";
import { createRouter, authedQuery, apiKeysManage, webhooksManage } from "./middleware";
import { getDb } from "./queries/connection";
import { apiKeys, webhooks, webhookDeliveries } from "@db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";

function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "fna_";
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

export const integrationsRouter = createRouter({
  // API Keys
  listKeys: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
    if (!businessId) return [];
    return db.select().from(apiKeys).where(and(eq(apiKeys.businessId, businessId), isNull(apiKeys.deletedAt))).orderBy(desc(apiKeys.createdAt));
  }),

  createKey: apiKeysManage
    .input(z.object({ name: z.string().min(1), scopes: z.array(z.string()).optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
      if (!businessId) throw new Error("No active business");
      const rawKey = generateApiKey();
      const prefix = rawKey.slice(0, 8);
      // Hash the key for storage (simple hash, in production use bcrypt/scrypt)
      const keyHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawKey)).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join(""));
      const [result] = await db.insert(apiKeys).values({
        businessId,
        name: input.name,
        keyHash,
        keyPrefix: prefix,
        scopes: input.scopes ?? ["read"],
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).returning();
      return { id: result.id, key: rawKey, prefix };
    }),

  revokeKey: apiKeysManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.id, input.id));
      return { success: true };
    }),

  deleteKey: apiKeysManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(apiKeys).set({ deletedAt: new Date() }).where(eq(apiKeys.id, input.id));
      return { success: true };
    }),

  // Webhooks
  listWebhooks: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
    if (!businessId) return [];
    return db.select().from(webhooks).where(and(eq(webhooks.businessId, businessId), isNull(webhooks.deletedAt))).orderBy(desc(webhooks.createdAt));
  }),

  createWebhook: webhooksManage
    .input(z.object({
      name: z.string().min(1),
      url: z.string().url(),
      events: z.array(z.enum(["bill.overdue", "bill.paid", "sale.recorded", "expense.created", "payroll.processed", "low.balance"])),
      secret: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
      if (!businessId) throw new Error("No active business");
      const [result] = await db.insert(webhooks).values({
        businessId,
        name: input.name,
        url: input.url,
        events: input.events,
        secret: input.secret,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).returning();
      return { id: result.id };
    }),

  updateWebhook: webhooksManage
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      url: z.string().url().optional(),
      events: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.update(webhooks).set(updates as any).where(eq(webhooks.id, id));
      return { success: true };
    }),

  deleteWebhook: webhooksManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(webhooks).set({ deletedAt: new Date() }).where(eq(webhooks.id, input.id));
      return { success: true };
    }),

  // Webhook delivery log
  listDeliveries: webhooksManage
    .input(z.object({ webhookId: z.number(), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(webhookDeliveries).where(eq(webhookDeliveries.webhookId, input.webhookId)).orderBy(desc(webhookDeliveries.createdAt)).limit(input.limit);
    }),
});
