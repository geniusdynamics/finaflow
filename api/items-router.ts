import { z } from "zod";
import { createRouter, accountManage } from "./middleware";
import { getDb } from "./queries/connection";
import { items, fixedAssetDepreciation } from "@db/schema";
import { eq, and, isNull, sql, desc } from "drizzle-orm";

export const itemsRouter = createRouter({
  list: accountManage
    .input(
      z.object({
        businessId: z.number(),
        itemType: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const business = ctx.user.currentBusiness;
      if (!business || business.id !== input.businessId) {
        throw new Error("Unauthorized access to this business");
      }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conditions: any[] = [eq(items.businessId, input.businessId)];
      if (input.itemType) {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        conditions.push(eq(items.itemType, input.itemType as any));
      }
      conditions.push(isNull(items.deletedAt));

      const offset = (input.page - 1) * input.pageSize;

      const result = await db
        .select()
        .from(items)
        .where(and(...conditions))
        .orderBy(desc(items.createdAt))
        .limit(input.pageSize)
        .offset(offset);

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(items)
        .where(and(...conditions));

      return {
        items: result,
        total: countResult[0]?.count || 0,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil((countResult[0]?.count || 0) / input.pageSize),
      };
    }),

  getById: accountManage
    .input(
      z.object({
        id: z.number(),
        businessId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const business = ctx.user.currentBusiness;
      if (!business || business.id !== input.businessId) {
        throw new Error("Unauthorized access to this business");
      }

      const item = await db.query.items.findFirst({
        where: and(eq(items.id, input.id), isNull(items.deletedAt)),
      });

      if (!item) throw new Error("Item not found");

      return item;
    }),

  create: accountManage
    .input(
      z.object({
        businessId: z.number(),
        locationId: z.number().optional(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        sku: z.string().max(50).optional(),
        itemType: z.enum(["inventory", "fixed_asset", "service", "non_inventory"]),
        incomeAccountId: z.number().optional(),
        expenseAccountId: z.number().optional(),
        assetAccountId: z.number().optional(),
        isFixedAsset: z.boolean().default(false),
        purchaseDate: z.string().optional(),
        purchasePrice: z.string().optional(),
        usefulLifeMonths: z.number().optional(),
        depreciationMethod: z.enum(["straight_line", "declining_balance"]).optional(),
        salvageValue: z.string().optional(),
        unitCost: z.string().optional(),
        unitPrice: z.string().optional(),
        currentStock: z.string().optional(),
        reorderLevel: z.string().optional(),
        taxRate: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const business = ctx.user.currentBusiness;
      if (!business || business.id !== input.businessId) {
        throw new Error("Unauthorized access to this business");
      }

      const [item] = await db
        .insert(items)
        .values({
          businessId: business.id,
          locationId: input.locationId,
          name: input.name,
          description: input.description,
          sku: input.sku,
          itemType: input.itemType,
          incomeAccountId: input.incomeAccountId,
          expenseAccountId: input.expenseAccountId,
          assetAccountId: input.assetAccountId,
          isFixedAsset: input.isFixedAsset,
          purchaseDate: input.purchaseDate,
          purchasePrice: input.purchasePrice,
          usefulLifeMonths: input.usefulLifeMonths,
          depreciationMethod: input.depreciationMethod,
          salvageValue: input.salvageValue || "0.00",
          accumulatedDepreciation: "0.00",
          currentBookValue: input.purchasePrice,
          unitCost: input.unitCost,
          unitPrice: input.unitPrice,
          currentStock: input.currentStock || "0",
          reorderLevel: input.reorderLevel,
          taxRate: input.taxRate,
          notes: input.notes,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .returning();

      return item;
    }),

  update: accountManage
    .input(
      z.object({
        id: z.number(),
        businessId: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        sku: z.string().max(50).optional(),
        incomeAccountId: z.number().optional(),
        expenseAccountId: z.number().optional(),
        assetAccountId: z.number().optional(),
        usefulLifeMonths: z.number().optional(),
        depreciationMethod: z.enum(["straight_line", "declining_balance"]).optional(),
        salvageValue: z.string().optional(),
        unitCost: z.string().optional(),
        unitPrice: z.string().optional(),
        currentStock: z.string().optional(),
        reorderLevel: z.string().optional(),
        taxRate: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const business = ctx.user.currentBusiness;
      if (!business || business.id !== input.businessId) {
        throw new Error("Unauthorized access to this business");
      }

      const item = await db.query.items.findFirst({
        where: and(eq(items.id, input.id), isNull(items.deletedAt)),
      });

      if (!item) throw new Error("Item not found");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: any = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.sku !== undefined) updates.sku = input.sku;
      if (input.incomeAccountId !== undefined) updates.incomeAccountId = input.incomeAccountId;
      if (input.expenseAccountId !== undefined) updates.expenseAccountId = input.expenseAccountId;
      if (input.assetAccountId !== undefined) updates.assetAccountId = input.assetAccountId;
      if (input.usefulLifeMonths !== undefined) updates.usefulLifeMonths = input.usefulLifeMonths;
      if (input.depreciationMethod !== undefined) updates.depreciationMethod = input.depreciationMethod;
      if (input.salvageValue !== undefined) updates.salvageValue = input.salvageValue;
      if (input.unitCost !== undefined) updates.unitCost = input.unitCost;
      if (input.unitPrice !== undefined) updates.unitPrice = input.unitPrice;
      if (input.currentStock !== undefined) updates.currentStock = input.currentStock;
      if (input.reorderLevel !== undefined) updates.reorderLevel = input.reorderLevel;
      if (input.taxRate !== undefined) updates.taxRate = input.taxRate;
      if (input.notes !== undefined) updates.notes = input.notes;

      await db.update(items).set(updates).where(eq(items.id, input.id));

      return { success: true };
    }),

  delete: accountManage
    .input(
      z.object({
        id: z.number(),
        businessId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const business = ctx.user.currentBusiness;
      if (!business || business.id !== input.businessId) {
        throw new Error("Unauthorized access to this business");
      }

      await db
        .update(items)
        .set({ deletedAt: new Date() })
        .where(eq(items.id, input.id));

      return { success: true };
    }),

  getDepreciationSchedule: accountManage
    .input(
      z.object({
        id: z.number(),
        businessId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const business = ctx.user.currentBusiness;
      if (!business || business.id !== input.businessId) {
        throw new Error("Unauthorized access to this business");
      }

      const item = await db.query.items.findFirst({
        where: and(eq(items.id, input.id), isNull(items.deletedAt)),
      });

      if (!item) throw new Error("Item not found");
      if (!item.isFixedAsset) throw new Error("Item is not a fixed asset");

      const depreciation = await db
        .select()
        .from(fixedAssetDepreciation)
        .where(eq(fixedAssetDepreciation.itemId, input.id))
        .orderBy(fixedAssetDepreciation.periodYear, fixedAssetDepreciation.periodMonth);

      return {
        item,
        depreciation,
      };
    }),

  dispose: accountManage
    .input(
      z.object({
        id: z.number(),
        businessId: z.number(),
        disposalDate: z.string(),
        disposalValue: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const business = ctx.user.currentBusiness;
      if (!business || business.id !== input.businessId) {
        throw new Error("Unauthorized access to this business");
      }

      const item = await db.query.items.findFirst({
        where: and(eq(items.id, input.id), isNull(items.deletedAt)),
      });

      if (!item) throw new Error("Item not found");
      if (!item.isFixedAsset) throw new Error("Item is not a fixed asset");
      if (item.disposalDate) throw new Error("Asset already disposed");

      await db
        .update(items)
        .set({
          disposalDate: input.disposalDate,
          disposalValue: input.disposalValue,
          notes: input.notes ? `${item.notes || ""}\n${input.notes}` : item.notes,
        })
        .where(eq(items.id, input.id));

      return { success: true };
    }),
});
