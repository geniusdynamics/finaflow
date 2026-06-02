import { z } from "zod";
import {
  createRouter,
  requireAuthorizedLocation,
  requireAuthorizedEntity,
  requireAuthorizedBusinessEntity,
  getCurrentBusinessLocationIds,
  purchaseOrdersView,
  purchaseOrdersManage,
} from "./middleware";
import { getDb } from "./queries/connection";
import { purchaseOrders, purchaseOrderItems, bills, locations, suppliers } from "@db/schema";
import { eq, and, isNull, desc, sql, inArray } from "drizzle-orm";

export const poRouter = createRouter({
  list: purchaseOrdersView
    .input(z.object({ locationId: z.number().optional(), status: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      let locIds: number[];
      if (input?.locationId) {
        await requireAuthorizedLocation(ctx, input.locationId);
        locIds = [input.locationId];
      } else {
        locIds = await getCurrentBusinessLocationIds(ctx);
      }
      if (locIds.length === 0) return [];

      const cond = [isNull(purchaseOrders.deletedAt), inArray(purchaseOrders.locationId, locIds)];
      if (input?.status) cond.push(eq(purchaseOrders.status, input.status as any));
      const pos = await db.select().from(purchaseOrders).where(and(...cond)).orderBy(desc(purchaseOrders.createdAt));
      
      // Enrich with supplier and location names
      const allLocs = await db.select().from(locations).where(isNull(locations.deletedAt));
      const sups = await db.select().from(suppliers).where(isNull(suppliers.deletedAt));
      return pos.map(p => ({
        ...p,
        locationName: allLocs.find(l => l.id === p.locationId)?.name ?? "",
        supplierName: sups.find(s => s.id === p.supplierId)?.name ?? "",
      }));
    }),

  get: purchaseOrdersView
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const po = await requireAuthorizedEntity(ctx, purchaseOrders, input.id);
      const items = await db.select().from(purchaseOrderItems).where(and(eq(purchaseOrderItems.poId, input.id), isNull(purchaseOrderItems.deletedAt)));
      return { ...po, items };
    }),

  create: purchaseOrdersManage
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

      await requireAuthorizedLocation(ctx, input.locationId);

      if (input.supplierId) {
        const sup = await requireAuthorizedBusinessEntity(ctx, suppliers, input.supplierId);
      }

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
      } as any).returning();

      const poId = result.id;
      for (const item of input.items) {
        await db.insert(purchaseOrderItems).values({
          poId,
          itemName: item.itemName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          notes: item.notes,
        } as any).returning();
      }

      return { id: poId, poNumber, success: true };
    }),

  updateStatus: purchaseOrdersManage
    .input(z.object({ id: z.number(), status: z.enum(["draft", "sent", "delivered", "billed", "cancelled"]) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, purchaseOrders, input.id);
      await db.update(purchaseOrders).set({ status: input.status }).where(eq(purchaseOrders.id, input.id));
      return { success: true };
    }),

  delete: purchaseOrdersManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, purchaseOrders, input.id);
      await db.update(purchaseOrders).set({ deletedAt: new Date() }).where(eq(purchaseOrders.id, input.id));
      return { success: true };
    }),
});
