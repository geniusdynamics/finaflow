import { z } from "zod";
import { createRouter, accountManage } from "./middleware";
import { getDb } from "./queries/connection";
import { items, fixedAssetDepreciation, journalEntries, journalLines, accounts } from "@db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import Decimal from "decimal.js";

function d(value: string | number): Decimal {
  return new Decimal(value || 0);
}

function calculateStraightLine(
  purchasePrice: string,
  salvageValue: string,
  usefulLifeMonths: number
): string {
  const depreciableAmount = d(purchasePrice).minus(d(salvageValue));
  const monthlyDepreciation = depreciableAmount.dividedBy(usefulLifeMonths);
  return monthlyDepreciation.toFixed(2);
}

function calculateDecliningBalance(
  currentBookValue: string,
  usefulLifeMonths: number
): string {
  const usefulLifeYears = usefulLifeMonths / 12;
  const rate = new Decimal(2).dividedBy(usefulLifeYears);
  const annualDepreciation = d(currentBookValue).times(rate);
  const monthlyDepreciation = annualDepreciation.dividedBy(12);
  return monthlyDepreciation.toFixed(2);
}

export const depreciationRouter = createRouter({
  calculateSchedule: accountManage
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
      if (!item.purchasePrice) throw new Error("Purchase price not set");

      const schedule: any[] = [];
      const purchaseDate = item.purchaseDate 
        ? new Date(item.purchaseDate) 
        : new Date();
      const startYear = purchaseDate.getFullYear();
      const startMonth = purchaseDate.getMonth() + 1;
      const usefulLifeMonths = item.usefulLifeMonths || 60;
      const salvageValue = item.salvageValue || "0.00";

      let currentBookValue = d(item.purchasePrice);
      let accumulatedDepreciation = d("0.00");

      for (let month = 0; month < usefulLifeMonths; month++) {
        const currentYear = startYear + Math.floor((startMonth + month - 1) / 12);
        const currentMonth = ((startMonth + month - 1) % 12) + 1;

        let monthlyDepreciation: Decimal;
        if (item.depreciationMethod === "declining_balance") {
          const monthlyAmount = calculateDecliningBalance(
            currentBookValue.toString(),
            usefulLifeMonths
          );
          monthlyDepreciation = d(monthlyAmount);
        } else {
          const monthlyAmount = calculateStraightLine(
            item.purchasePrice!,
            salvageValue,
            usefulLifeMonths
          );
          monthlyDepreciation = d(monthlyAmount);
        }

        if (currentBookValue.minus(monthlyDepreciation).lessThan(d(salvageValue))) {
          monthlyDepreciation = currentBookValue.minus(d(salvageValue));
        }

        accumulatedDepreciation = accumulatedDepreciation.plus(monthlyDepreciation);
        currentBookValue = currentBookValue.minus(monthlyDepreciation);

        schedule.push({
          periodYear: currentYear,
          periodMonth: currentMonth,
          depreciationAmount: monthlyDepreciation.toFixed(2),
          accumulatedAfter: accumulatedDepreciation.toFixed(2),
          bookValueAfter: currentBookValue.toFixed(2),
        });
      }

      return {
        item,
        schedule,
      };
    }),

  postDepreciation: accountManage
    .input(
      z.object({
        id: z.number(),
        businessId: z.number(),
        year: z.number(),
        month: z.number(),
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
      if (item.disposalDate) throw new Error("Asset has been disposed");

      const existingDep = await db.query.fixedAssetDepreciation.findFirst({
        where: and(
          eq(fixedAssetDepreciation.itemId, input.id),
          eq(fixedAssetDepreciation.periodYear, input.year),
          eq(fixedAssetDepreciation.periodMonth, input.month)
        ),
      });

      if (existingDep) throw new Error("Depreciation already posted for this period");

      let monthlyDepreciation: string;
      if (item.depreciationMethod === "declining_balance") {
        monthlyDepreciation = calculateDecliningBalance(
          item.currentBookValue || item.purchasePrice || "0",
          item.usefulLifeMonths || 60
        );
      } else {
        monthlyDepreciation = calculateStraightLine(
          item.purchasePrice || "0",
          item.salvageValue || "0.00",
          item.usefulLifeMonths || 60
        );
      }

      const newAccumulated = d(item.accumulatedDepreciation || "0").plus(monthlyDepreciation);
      const newBookValue = d(item.purchasePrice || "0").minus(newAccumulated);

      const journalNumber = `DEP-${input.year}-${String(input.month).padStart(2, "0")}-${item.id}`;
      const entryDateObj = new Date(input.year, input.month - 1, 1);
      const entryDateStr = entryDateObj.toISOString().split("T")[0];

      const [journalEntry] = await db
        .insert(journalEntries)
        .values({
          businessId: business.id,
          entryNumber: journalNumber,
          entryDate: entryDateStr,
          description: `Depreciation - ${item.name} - ${input.year}/${input.month}`,
          sourceType: "depreciation",
          sourceId: item.id,
          isPosted: true,
          postedBy: ctx.user.id,
          postedAt: new Date(),
          createdBy: ctx.user.id,
        } as any)
        .returning();

      const depreciationExpenseAccount = await db.query.accounts.findFirst({
        where: and(
          eq(accounts.businessId, business.id),
          eq(accounts.accountSubType, "depreciation_expense"),
          isNull(accounts.deletedAt)
        ),
      });

      const accumulatedDepAccount = await db.query.accounts.findFirst({
        where: and(
          eq(accounts.businessId, business.id),
          eq(accounts.accountSubType, "accumulated_depreciation"),
          isNull(accounts.deletedAt)
        ),
      });

      if (depreciationExpenseAccount && accumulatedDepAccount) {
        await db.insert(journalLines).values([
          {
            journalEntryId: journalEntry.id,
            accountId: depreciationExpenseAccount.id,
            debit: monthlyDepreciation,
            credit: "0.00",
            description: "Depreciation expense",
            lineNumber: 1,
          } as any,
          {
            journalEntryId: journalEntry.id,
            accountId: accumulatedDepAccount.id,
            debit: "0.00",
            credit: monthlyDepreciation,
            description: "Accumulated depreciation",
            lineNumber: 2,
          } as any,
        ]);

        await db.update(accounts).set({
          currentBalance: d(depreciationExpenseAccount.currentBalance || "0")
            .plus(monthlyDepreciation)
            .toFixed(2),
        }).where(eq(accounts.id, depreciationExpenseAccount.id));

        await db.update(accounts).set({
          currentBalance: d(accumulatedDepAccount.currentBalance || "0")
            .plus(monthlyDepreciation)
            .toFixed(2),
        }).where(eq(accounts.id, accumulatedDepAccount.id));
      }

      await db.insert(fixedAssetDepreciation).values({
        itemId: item.id,
        journalEntryId: journalEntry.id,
        periodYear: input.year,
        periodMonth: input.month,
        depreciationAmount: monthlyDepreciation,
        accumulatedAfter: newAccumulated.toFixed(2),
        bookValueAfter: newBookValue.toFixed(2),
        isPosted: true,
      } as any);

      await db.update(items).set({
        accumulatedDepreciation: newAccumulated.toFixed(2),
        currentBookValue: newBookValue.toFixed(2),
      }).where(eq(items.id, item.id));

      return { success: true, journalEntryId: journalEntry.id };
    }),

  getDepreciationHistory: accountManage
    .input(
      z.object({
        businessId: z.number(),
        year: z.number().optional(),
        month: z.number().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const business = ctx.user.currentBusiness;
      if (!business || business.id !== input.businessId) {
        throw new Error("Unauthorized access to this business");
      }

      const conditions: any[] = [isNull(fixedAssetDepreciation.isPosted)];

      if (input.year) {
        conditions.push(eq(fixedAssetDepreciation.periodYear, input.year));
      }
      if (input.month) {
        conditions.push(eq(fixedAssetDepreciation.periodMonth, input.month));
      }

      const result = await db
        .select({
          id: fixedAssetDepreciation.id,
          itemId: fixedAssetDepreciation.itemId,
          periodYear: fixedAssetDepreciation.periodYear,
          periodMonth: fixedAssetDepreciation.periodMonth,
          depreciationAmount: fixedAssetDepreciation.depreciationAmount,
          accumulatedAfter: fixedAssetDepreciation.accumulatedAfter,
          bookValueAfter: fixedAssetDepreciation.bookValueAfter,
          isPosted: fixedAssetDepreciation.isPosted,
          itemName: items.name,
          itemPurchasePrice: items.purchasePrice,
        })
        .from(fixedAssetDepreciation)
        .leftJoin(items, eq(fixedAssetDepreciation.itemId, items.id))
        .where(and(...conditions))
        .orderBy(desc(fixedAssetDepreciation.periodYear), desc(fixedAssetDepreciation.periodMonth));

      return result;
    }),

  getUpcomingDepreciation: accountManage
    .input(
      z.object({
        businessId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const business = ctx.user.currentBusiness;
      if (!business || business.id !== input.businessId) {
        throw new Error("Unauthorized access to this business");
      }

      const fixedAssets = await db
        .select()
        .from(items)
        .where(
          and(
            eq(items.businessId, input.businessId),
            eq(items.isFixedAsset, true),
            isNull(items.disposalDate),
            isNull(items.deletedAt)
          )
        );

      const upcoming: any[] = [];
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      for (const asset of fixedAssets) {
        const usefulLifeMonths = asset.usefulLifeMonths || 60;
        const purchaseDate = asset.purchaseDate 
          ? new Date(asset.purchaseDate) 
          : now;
        const startYear = purchaseDate.getFullYear();
        const startMonth = purchaseDate.getMonth() + 1;

        const monthsDepreciated = (currentYear - startYear) * 12 + (currentMonth - startMonth);
        const monthsRemaining = usefulLifeMonths - monthsDepreciated;

        if (monthsRemaining > 0) {
          let monthlyAmount: string;
          if (asset.depreciationMethod === "declining_balance") {
            monthlyAmount = calculateDecliningBalance(
              asset.currentBookValue || asset.purchasePrice || "0",
              usefulLifeMonths
            );
          } else {
            monthlyAmount = calculateStraightLine(
              asset.purchasePrice || "0",
              asset.salvageValue || "0.00",
              usefulLifeMonths
            );
          }

          upcoming.push({
            itemId: asset.id,
            itemName: asset.name,
            currentBookValue: asset.currentBookValue,
            monthlyDepreciation: monthlyAmount,
            monthsRemaining,
            nextDepreciationDate: new Date(currentYear, currentMonth, 1),
          });
        }
      }

      return upcoming;
    }),
});
