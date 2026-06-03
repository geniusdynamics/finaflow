import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { alertsConfig, alertsLog, accounts, locations } from "@db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

type AlertsConfigInsert = typeof alertsConfig.$inferInsert;

export const alertsRouter = createRouter({
  // Config CRUD
  listConfig: authedQuery.query(async () => {
    const db = getDb();
    return db.select().from(alertsConfig).orderBy(desc(alertsConfig.createdAt));
  }),

  createConfig: authedQuery
    .input(z.object({
      locationId: z.number().optional(),
      accountId: z.number().optional(),
      minBalance: z.string().default("10000"),
      notifyEmail: z.string().optional(),
      notifyPhone: z.string().optional(),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(alertsConfig).values(input as AlertsConfigInsert).returning();
      return { id: result.id, success: true };
    }),

  updateConfig: authedQuery
    .input(z.object({ id: z.number(), minBalance: z.string().optional(), notifyEmail: z.string().optional(), notifyPhone: z.string().optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      await db.update(alertsConfig).set(updates as Partial<AlertsConfigInsert>).where(eq(alertsConfig.id, id));
      return { success: true };
    }),

  deleteConfig: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(alertsConfig).where(eq(alertsConfig.id, input.id));
      return { success: true };
    }),

  // Check all alerts (returns current alert states)
  checkAll: authedQuery.query(async () => {
    const db = getDb();
    const configs = await db.select().from(alertsConfig).where(eq(alertsConfig.isActive, true));
    const alerts: { type: string; severity: "info" | "warning" | "critical"; title: string; message: string; accountId?: number; locationId?: number }[] = [];

    for (const config of configs) {
      if (config.accountId) {
        const acct = await db.select().from(accounts).where(eq(accounts.id, config.accountId)).limit(1);
        if (acct[0] && parseFloat(acct[0].currentBalance) < parseFloat(config.minBalance ?? "0")) {
          const loc = config.locationId ? await db.select().from(locations).where(eq(locations.id, config.locationId)).limit(1) : [];
          alerts.push({
            type: "low_balance",
            severity: "warning",
            title: `Low Balance: ${acct[0].name}`,
            message: `${acct[0].name} at ${loc[0]?.name ?? "Unknown"} is at ${acct[0].currentBalance} (below threshold ${config.minBalance})`,
            accountId: config.accountId,
            locationId: config.locationId ?? undefined,
          });
        }
      }
    }

    // Overdue bills are now managed via notifications.generateOverdueNotifications
    // with a full lifecycle (highlighted → faded → re-highlighted → clearance).
    // They are intentionally excluded here to avoid duplicate entries in the panel.

    return alerts;
  }),

  // Log
  listLog: authedQuery
    .input(z.object({ limit: z.number().default(50) }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(alertsLog).orderBy(desc(alertsLog.createdAt)).limit(input?.limit ?? 50);
    }),

  markRead: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(alertsLog).set({ isRead: true }).where(eq(alertsLog.id, input.id));
      return { success: true };
    }),
});
