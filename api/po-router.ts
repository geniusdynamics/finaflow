import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { purchaseOrders, purchaseOrderItems, bills, locations, suppliers } from "@db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";

export const poRouter = createRouter({
  list: authedQuery
    .input(z.object({ locationId: z.number().optional(), status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const cond = [isNull(purchaseOrders.deletedAt)];
      if (input?.locationId) cond.push(eq(purchaseOrders.locationId, input.locationId));
      if (input?.status) cond.push(eq(purchaseOrders.status, input.status as any));
      const pos = await db.select().from(purchaseOrders).where(and(...cond)).orderBy(desc(purchaseOrders.createdAt));
      // Enrich with supplier and location names
      const locs = await db.select().from(locations).where(isNull(locations.deletedAt));
      const sups = await db.select().from(suppliers).where(isNull(suppliers.deletedAt));
      return pos.map(p => ({
        ...p,
        locationName: locs.find(l => l.id === p.locationId)?.name ?? "",
        supplierName: sups.find(s => s.id === p.supplierId)?.name ?? "",
      }));
    }),

  get: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.id)).limit(1);
      if (!po) throw new Error("PO not found");
      const items = await db.select().from(purchaseOrderItems).where(and(eq(purchaseOrderItems.poId, input.id), isNull(purchaseOrderItems.deletedAt)));
      return { ...po, items };
    }),

  create: authedQuery
    .input(z.object({
      locationId: z.number(),
      supplierId: z.number().optional(),
      billId: z.number().optional(),
      description: z.string().optional(),
      deliveryDate: z.string().optional(),
      deliveryNotes: z.string().optional(),
      terms: z.string().optional(),
      items: z.array(z.object({
        itemName: z.string(),
        quantity: z.string(),
        unitPrice: z.string(),
        totalPrice: z.string(),
        notes: z.string().optional(),
      })).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const createdBy = (ctx as any).user?.id ?? 1;

      // Generate PO number
      const loc = await db.select().from(locations).where(eq(locations.id, input.locationId)).limit(1);
      const locCode = loc[0]?.name?.substring(0, 3).toUpperCase() ?? "HQ";
      const count = await db.select({ c: sql<number>`COUNT(*)` }).from(purchaseOrders);
      const poNumber = `PO-${locCode}-${String((count[0]?.c ?? 0) + 1).padStart(4, "0")}`;

      const subtotal = input.items.reduce((s, i) => s + parseFloat(i.totalPrice), 0);
      const total = subtotal; // tax can be added later

      const [result] = await db.insert(purchaseOrders).values({
        locationId: input.locationId,
        supplierId: input.supplierId,
        billId: input.billId,
        poNumber,
        description: input.description,
        status: "draft",
        subtotal: subtotal.toFixed(2),
        total: total.toFixed(2),
        deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : undefined,
        deliveryNotes: input.deliveryNotes,
        terms: input.terms,
        createdBy,
      } as any);

      const poId = Number(result.insertId);
      for (const item of input.items) {
        await db.insert(purchaseOrderItems).values({
          poId,
          itemName: item.itemName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          notes: item.notes,
        } as any);
      }

      return { id: poId, poNumber, success: true };
    }),

  updateStatus: authedQuery
    .input(z.object({ id: z.number(), status: z.enum(["draft", "sent", "delivered", "billed", "cancelled"]) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(purchaseOrders).set({ status: input.status }).where(eq(purchaseOrders.id, input.id));
      return { success: true };
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(purchaseOrders).set({ deletedAt: new Date() }).where(eq(purchaseOrders.id, input.id));
      return { success: true };
    }),
});
