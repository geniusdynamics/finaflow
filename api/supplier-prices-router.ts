import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { supplierPriceHistory, priceAlertRules, bills, billItems, suppliers } from "@db/schema";
import { eq, and, desc, sql, isNull } from "drizzle-orm";

export const supplierPricesRouter = createRouter({
  // Get price history for an item
  history: authedQuery
    .input(z.object({
      itemName: z.string().optional(),
      supplierId: z.number().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const cond: any[] = [];
      if (input.itemName) cond.push(sql`LOWER(${supplierPriceHistory.itemName}) LIKE LOWER(${"%" + input.itemName + "%"})`);
      if (input.supplierId) cond.push(eq(supplierPriceHistory.supplierId, input.supplierId));
      return db.select().from(supplierPriceHistory).where(cond.length > 0 ? and(...cond) : undefined).orderBy(desc(supplierPriceHistory.priceDate)).limit(input.limit);
    }),

  // Price trend for a specific item
  trend: authedQuery
    .input(z.object({
      itemName: z.string(),
      supplierId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const cond = [sql`LOWER(${supplierPriceHistory.itemName}) = LOWER(${input.itemName})`];
      if (input.supplierId) cond.push(eq(supplierPriceHistory.supplierId, input.supplierId));

      const history = await db.select().from(supplierPriceHistory).where(and(...cond)).orderBy(desc(supplierPriceHistory.priceDate)).limit(20);

      if (history.length < 2) return { itemName: input.itemName, trend: history, change: null, changePercent: null, averagePrice: null };

      const latest = parseFloat(history[0].unitPrice);
      const oldest = parseFloat(history[history.length - 1].unitPrice);
      const change = latest - oldest;
      const changePercent = oldest > 0 ? (change / oldest) * 100 : 0;
      const avg = history.reduce((s, h) => s + parseFloat(h.unitPrice), 0) / history.length;

      return {
        itemName: input.itemName,
        trend: history,
        change: change.toFixed(2),
        changePercent: changePercent.toFixed(1),
        averagePrice: avg.toFixed(2),
        latestPrice: latest.toFixed(2),
        isIncrease: change > 0,
      };
    }),

  // All items with price changes
  allItems: authedQuery
    .input(z.object({ supplierId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const cond = input?.supplierId ? [eq(supplierPriceHistory.supplierId, input.supplierId)] : [];

      // Get distinct items
      const items = await db.selectDistinct({
        itemName: supplierPriceHistory.itemName,
        supplierId: supplierPriceHistory.supplierId,
      }).from(supplierPriceHistory).where(cond.length > 0 ? and(...cond) : undefined).limit(200);

      const results: any[] = [];
      for (const item of items) {
        const history = await db.select().from(supplierPriceHistory).where(
          and(eq(supplierPriceHistory.supplierId, item.supplierId!), sql`LOWER(${supplierPriceHistory.itemName}) = LOWER(${item.itemName})`)
        ).orderBy(desc(supplierPriceHistory.priceDate)).limit(10);

        if (history.length >= 2) {
          const latest = parseFloat(history[0].unitPrice);
          const previous = parseFloat(history[1].unitPrice);
          const avg = history.reduce((s, h) => s + parseFloat(h.unitPrice), 0) / history.length;
          const changePercent = previous > 0 ? ((latest - previous) / previous) * 100 : 0;
          const sup = await db.select().from(suppliers).where(eq(suppliers.id, item.supplierId!)).limit(1);

          results.push({
            itemName: item.itemName,
            supplierName: sup[0]?.name ?? "",
            supplierId: item.supplierId!,
            latestPrice: latest.toFixed(2),
            previousPrice: previous.toFixed(2),
            averagePrice: avg.toFixed(2),
            changePercent: changePercent.toFixed(1),
            isIncrease: changePercent > 0,
            purchases: history.length,
          });
        }
      }

      return results.sort((a, b) => Math.abs(parseFloat(b.changePercent)) - Math.abs(parseFloat(a.changePercent)));
    }),

  // Record price when bill item is created (called internally)
  record: authedQuery
    .input(z.object({
      supplierId: z.number(),
      itemName: z.string(),
      unitPrice: z.string(),
      quantity: z.string().optional(),
      billId: z.number().optional(),
      locationId: z.number().optional(),
      priceDate: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(supplierPriceHistory).values({
        supplierId: input.supplierId,
        itemName: input.itemName,
        unitPrice: input.unitPrice,
        quantity: input.quantity ?? "1",
        billId: input.billId,
        locationId: input.locationId,
        priceDate: new Date(input.priceDate),
      } as any).returning();
      return { id: result.id };
    }),

  // Check price alerts (auto-detect significant price changes)
  checkAlerts: authedQuery
    .query(async () => {
      const db = getDb();
      const rules = await db.select().from(priceAlertRules).where(eq(priceAlertRules.isActive, true));
      const alerts: { itemName: string; supplierId: number; latestPrice: string; expectedPrice: string; variancePercent: string; message: string }[] = [];

      for (const rule of rules) {
        const latest = await db.select().from(supplierPriceHistory).where(
          and(eq(supplierPriceHistory.supplierId, rule.supplierId!), sql`LOWER(${supplierPriceHistory.itemName}) = LOWER(${rule.itemName})`)
        ).orderBy(desc(supplierPriceHistory.priceDate)).limit(1);

        if (latest.length > 0 && rule.expectedPrice) {
          const currentPrice = parseFloat(latest[0].unitPrice);
          const expected = parseFloat(rule.expectedPrice);
          const varianceThreshold = parseFloat(rule.variancePercent ?? "10");
          const variance = Math.abs(((currentPrice - expected) / expected) * 100);

          if (variance > varianceThreshold) {
            alerts.push({
              itemName: rule.itemName,
              supplierId: rule.supplierId!,
              latestPrice: latest[0].unitPrice,
              expectedPrice: rule.expectedPrice,
              variancePercent: variance.toFixed(1),
              message: `${rule.itemName}: KES ${latest[0].unitPrice} vs expected KES ${rule.expectedPrice} (${variance > 0 ? '+' : ''}${variance.toFixed(1)}%)`,
            });
          }
        }
      }

      return alerts;
    }),

  // Price alert rules CRUD
  listRules: authedQuery.query(async () => {
    const db = getDb();
    return db.select().from(priceAlertRules).where(eq(priceAlertRules.isActive, true));
  }),

  createRule: authedQuery
    .input(z.object({
      supplierId: z.number().optional(),
      itemName: z.string(),
      expectedPrice: z.string(),
      variancePercent: z.string().default("10"),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(priceAlertRules).values(input as any).returning();
      return { id: result.id };
    }),

  updateRule: authedQuery
    .input(z.object({ id: z.number(), expectedPrice: z.string().optional(), variancePercent: z.string().optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(priceAlertRules).set(data as any).where(eq(priceAlertRules.id, id));
      return { success: true };
    }),

  deleteRule: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(priceAlertRules).where(eq(priceAlertRules.id, input.id));
      return { success: true };
    }),
});
