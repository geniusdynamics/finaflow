import { z } from "zod";
import { createRouter, reportQuery, budgetManage, getCurrentBusinessLocationIds } from "./middleware";
import { getDb } from "./queries/connection";
import { dailySales, expenses, bills, expenseCategories, budgets } from "@db/schema";
import { eq, and, isNull, sql, inArray, gt } from "drizzle-orm";
import { d } from "./lib/decimal";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveLocationFilter(ctx: any, inputLocationId?: number): Promise<number[]> {
  const locIds = await getCurrentBusinessLocationIds(ctx);
  if (inputLocationId !== undefined) {
    if (!locIds.includes(inputLocationId)) {
      throw new Error("Invalid location for the current business");
    }
    return [inputLocationId];
  }
  return locIds;
}

export const reportsRouter = createRouter({
  plStatement: reportQuery
    .input(z.object({ year: z.number(), month: z.number(), locationId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const startDate = `${input.year}-${String(input.month).padStart(2, "0")}-01`;
      const endDate = new Date(input.year, input.month, 0).toISOString().split("T")[0];
      const locFilter = await resolveLocationFilter(ctx, input.locationId);
      const locIdSql = sql.join(locFilter.map(id => sql`${id}`), sql`, `);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const salesCond: any[] = [
        sql`${dailySales.saleDate} >= ${startDate}`,
        sql`${dailySales.saleDate} <= ${endDate}`,
        isNull(dailySales.deletedAt),
        sql`${dailySales.locationId} IN (${locIdSql})`,
      ];
      const salesData = await db.select().from(dailySales).where(and(...salesCond));
      const revenue = salesData.reduce((sum, s) => sum.plus(d(s.netSales || "0")), d(0));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const expenseCond: any[] = [
        sql`${expenses.expenseDate} >= ${startDate}`,
        sql`${expenses.expenseDate} <= ${endDate}`,
        isNull(expenses.deletedAt),
        sql`${expenses.locationId} IN (${locIdSql})`,
      ];
      const expenseResult = await db
        .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
        .from(expenses)
        .where(and(...expenseCond));
      const expensesTotal = d(expenseResult[0]?.total || "0");

      const netProfit = revenue.minus(expensesTotal);
      const grossMargin = revenue.gt(0) ? "100.0" : "0.0";
      const netMargin = revenue.gt(0) ? netProfit.dividedBy(revenue).times(100).toFixed(1) : "0.0";

      return {
        revenue: revenue.toFixed(2),
        cogs: "0.00",
        expenses: expensesTotal.toFixed(2),
        payroll: "0.00",
        netProfit: netProfit.toFixed(2),
        grossMargin,
        netMargin,
      };
    }),

  plMonthly: reportQuery
    .input(z.object({ year: z.number(), locationId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const locFilter = await resolveLocationFilter(ctx, input.locationId);
      const locIdSql = sql.join(locFilter.map(id => sql`${id}`), sql`, `);
      const months: {
        month: number;
        monthName: string;
        revenue: string;
        expenses: string;
        netProfit: string;
      }[] = [];
      for (let m = 1; m <= 12; m++) {
        const monthStart = `${input.year}-${String(m).padStart(2, "0")}-01`;
        const monthEnd = new Date(input.year, m, 0).toISOString().split("T")[0];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const salesCond: any[] = [
          sql`${dailySales.saleDate} >= ${monthStart}`,
          sql`${dailySales.saleDate} <= ${monthEnd}`,
          isNull(dailySales.deletedAt),
          sql`${dailySales.locationId} IN (${locIdSql})`,
        ];
        const salesData = await db.select().from(dailySales).where(and(...salesCond));
        const revenue = salesData.reduce((sum, s) => sum.plus(d(s.netSales || "0")), d(0));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const expenseCond: any[] = [
          sql`${expenses.expenseDate} >= ${monthStart}`,
          sql`${expenses.expenseDate} <= ${monthEnd}`,
          isNull(expenses.deletedAt),
          sql`${expenses.locationId} IN (${locIdSql})`,
        ];
        const expenseResult = await db
          .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
          .from(expenses)
          .where(and(...expenseCond));
        const expensesTotal = d(expenseResult[0]?.total || "0");

        months.push({
          month: m,
          monthName: new Date(2000, m - 1).toLocaleDateString("en-KE", { month: "short" }),
          revenue: revenue.toFixed(2),
          expenses: expensesTotal.toFixed(2),
          netProfit: revenue.minus(expensesTotal).toFixed(2),
        });
      }
      return months;
    }),

  plComparative: reportQuery
    .input(z.object({ locationId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const locFilter = await resolveLocationFilter(ctx, input.locationId);
      const locIdSql = sql.join(locFilter.map(id => sql`${id}`), sql`, `);
      const thisYear = new Date().getFullYear();
      const lastYear = thisYear - 1;

      const getTotals = async (year: number) => {
        const start = `${year}-01-01`;
        const end = `${year}-12-31`;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const salesCond: any[] = [sql`${dailySales.saleDate} >= ${start}`, sql`${dailySales.saleDate} <= ${end}`, isNull(dailySales.deletedAt), sql`${dailySales.locationId} IN (${locIdSql})`];
        const salesData = await db.select().from(dailySales).where(and(...salesCond));
        const revenue = salesData.reduce((sum, s) => sum.plus(d(s.netSales || "0")), d(0));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const expenseCond: any[] = [sql`${expenses.expenseDate} >= ${start}`, sql`${expenses.expenseDate} <= ${end}`, isNull(expenses.deletedAt), sql`${expenses.locationId} IN (${locIdSql})`];
        const expenseResult = await db.select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` }).from(expenses).where(and(...expenseCond));
        const expensesTotal = d(expenseResult[0]?.total || "0");

        return {
          label: `${year}`,
          sales: revenue.toFixed(2),
          expenses: expensesTotal.toFixed(2),
          payroll: "0.00",
          netProfit: revenue.minus(expensesTotal).toFixed(2),
        };
      };

      return {
        thisYear: await getTotals(thisYear),
        lastYear: await getTotals(lastYear),
      };
    }),

  budgetVsActual: reportQuery
    .input(z.object({ year: z.number(), month: z.number().optional(), locationId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const locFilter = await resolveLocationFilter(ctx, input.locationId);
      const locIdSql = sql.join(locFilter.map(id => sql`${id}`), sql`, `);
      const targetMonth = input.month ?? new Date().getMonth() + 1;
      const startDate = `${input.year}-01-01`;
      const endDate = input.month ? new Date(input.year, input.month, 0).toISOString().split("T")[0] : `${input.year}-12-31`;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const expenseCond: any[] = [
        sql`${expenses.expenseDate} >= ${startDate}`,
        sql`${expenses.expenseDate} <= ${endDate}`,
        isNull(expenses.deletedAt),
        sql`${expenses.locationId} IN (${locIdSql})`,
      ];

      const expenseData = await db
        .select({
          categoryId: expenseCategories.id,
          categoryName: expenseCategories.name,
          categoryColor: expenseCategories.color,
          actual: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
        })
        .from(expenses)
        .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
        .where(and(...expenseCond))
        .groupBy(expenseCategories.id, expenseCategories.name, expenseCategories.color);

      // Fetch budgeted amounts from the budgets table
      const budgetRows = await db
        .select()
        .from(budgets)
        .where(and(
          eq(budgets.year, input.year),
          eq(budgets.month, targetMonth),
          sql`${budgets.locationId} IN (${locIdSql})`,
          isNull(budgets.deletedAt),
        ));

      const budgetMap = new Map<number, string>();
      for (const b of budgetRows) {
        if (b.categoryId != null) {
          budgetMap.set(b.categoryId, b.amount);
        }
      }

      const categories = expenseData.map((c) => {
        const budgeted = budgetMap.get(c.categoryId) || "0.00";
        const actual = c.actual;
        const actualDec = d(actual);
        const budgetedDec = d(budgeted);
        const variance = budgetedDec.minus(actualDec).toFixed(2);
        const variancePercent = budgetedDec.gt(0)
          ? actualDec.minus(budgetedDec).dividedBy(budgetedDec).times(100).toFixed(1)
          : "0.0";
        const isOverBudget = actualDec.gt(budgetedDec) && budgetedDec.gt(0);

        return {
          categoryId: c.categoryId,
          categoryName: c.categoryName,
          categoryColor: c.categoryColor,
          budgeted,
          actual,
          variance,
          variancePercent,
          isOverBudget,
        };
      });

      const totalBudgeted = categories.reduce((sum, c) => sum.plus(d(c.budgeted)), d(0));
      const totalActual = categories.reduce((sum, c) => sum.plus(d(c.actual)), d(0));

      return {
        categories,
        totalBudgeted: totalBudgeted.toFixed(2),
        totalActual: totalActual.toFixed(2),
        totalVariance: totalBudgeted.minus(totalActual).toFixed(2),
      };
    }),

  cashFlowForecast: reportQuery
    .input(z.object({ locationId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      try {
        const db = getDb();
        const locFilter = await resolveLocationFilter(ctx, input.locationId);
        const locIdSql = sql.join(locFilter.map(id => sql`${id}`), sql`, `);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const today = new Date().toISOString().split("T")[0];
        const next30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const salesCond: any[] = [
          sql`${dailySales.saleDate} >= ${thirtyDaysAgo}`,
          sql`${dailySales.saleDate} <= ${today}`,
          isNull(dailySales.deletedAt),
          sql`${dailySales.locationId} IN (${locIdSql})`,
        ];
        let salesData: Array<{ netSales: string | null }> = [];
        try {
          salesData = await db.select().from(dailySales).where(and(...salesCond));
        } catch (salesErr) {
          console.error("cashFlowForecast - sales query failed:", salesErr);
        }
        const totalSales = salesData.reduce((sum, s) => sum.plus(d(s.netSales || "0")), d(0));
        const avgDaily = totalSales.gt(0) ? totalSales.dividedBy(30) : d(0);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const billCond: any[] = [
          sql`${bills.dueDate} >= ${today}`,
          sql`${bills.dueDate} <= ${next30}`,
          sql`${bills.balanceDue} > ${'0'}`,
          isNull(bills.deletedAt),
          sql`${bills.locationId} IN (${locIdSql})`,
        ];
        let billData: Array<{ balanceDue: string | null }> = [];
        try {
          billData = await db.select().from(bills).where(and(...billCond));
        } catch (billsErr) {
          console.error("cashFlowForecast - bills query failed:", billsErr);
        }
        const totalBills = billData.reduce((sum, b) => sum.plus(d(b.balanceDue || "0")), d(0));

        return {
          period: `${thirtyDaysAgo} to ${next30}`,
          projectedInflows: avgDaily.times(30).toFixed(2),
          dailyAvgRevenue: avgDaily.toFixed(2),
          billsDue: { total: totalBills.toFixed(2), count: billData.length },
          recurringDue: { total: "0.00", count: 0 },
          netProjected: avgDaily.times(30).minus(totalBills).toFixed(2),
        };
      } catch (error) {
        console.error("cashFlowForecast error:", error);
        // Return safe defaults instead of throwing
        return {
          period: "N/A",
          projectedInflows: "0.00",
          dailyAvgRevenue: "0.00",
          billsDue: { total: "0.00", count: 0 },
          recurringDue: { total: "0.00", count: 0 },
          netProjected: "0.00",
        };
      }
    }),

  cogsAnalysis: reportQuery
    .input(z.object({ year: z.number(), month: z.number().optional(), locationId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const locFilter = await resolveLocationFilter(ctx, input.locationId);
      const locIdSql = sql.join(locFilter.map(id => sql`${id}`), sql`, `);
      const startDate = input.month ? `${input.year}-${String(input.month).padStart(2, "0")}-01` : `${input.year}-01-01`;
      const endDate = input.month ? new Date(input.year, input.month, 0).toISOString().split("T")[0] : `${input.year}-12-31`;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const salesCond: any[] = [
        sql`${dailySales.saleDate} >= ${startDate}`,
        sql`${dailySales.saleDate} <= ${endDate}`,
        isNull(dailySales.deletedAt),
        sql`${dailySales.locationId} IN (${locIdSql})`,
      ];
      const salesData = await db.select().from(dailySales).where(and(...salesCond));
      const revenue = salesData.reduce((sum, s) => sum.plus(d(s.netSales || "0")), d(0));

      const cogsCatIds = (
        await db
          .select({ id: expenseCategories.id })
          .from(expenseCategories)
          .where(sql`LOWER(${expenseCategories.name}) IN ('food supplies', 'beverages')`)
      ).map((c) => c.id);

      let totalCogs = d("0");
      if (cogsCatIds.length > 0) {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cogsCond: any[] = [
          sql`${expenses.expenseDate} >= ${startDate}`,
          sql`${expenses.expenseDate} <= ${endDate}`,
          inArray(expenses.categoryId, cogsCatIds),
          isNull(expenses.deletedAt),
          sql`${expenses.locationId} IN (${locIdSql})`,
        ];
        const cogsResult = await db
          .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
          .from(expenses)
          .where(and(...cogsCond));
        totalCogs = d(cogsResult[0]?.total || "0");
      }

      const foodCostPercent = revenue.gt(0) ? totalCogs.dividedBy(revenue).times(100).toFixed(1) : "0.0";
      const targetPercent = "35.0";
      const alertPercent = "38.0";
      const percentNum = parseFloat(foodCostPercent);
      let status: "good" | "warning" | "critical" = "good";
      if (percentNum > parseFloat(alertPercent)) status = "critical";
      else if (percentNum > parseFloat(targetPercent)) status = "warning";

      return {
        revenue: revenue.toFixed(2),
        cogs: totalCogs.toFixed(2),
        foodCostPercent,
        status,
        targetPercent,
        alertPercent,
        isAlert: status === "critical",
      };
    }),

  getCogsTarget: reportQuery
    .input(z.object({ locationId: z.number().optional() }))
    .query(async () => ({
      targetFoodCostPercent: "35",
      alertThresholdPercent: "38",
    })),

  setBudget: budgetManage
    .input(z.object({
      year: z.number(),
      month: z.number(),
      categoryId: z.number(),
      amount: z.string(),
      locationId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { year, month, categoryId, amount, locationId } = input;

      const existing = await db
        .select()
        .from(budgets)
        .where(and(
          eq(budgets.year, year),
          eq(budgets.month, month),
          eq(budgets.categoryId, categoryId),
          eq(budgets.locationId, locationId),
          isNull(budgets.deletedAt),
        ))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(budgets)
          .set({ amount, updatedAt: new Date() })
          .where(eq(budgets.id, existing[0].id));
      } else {
        await db.insert(budgets).values({
          year,
          month,
          categoryId,
          amount,
          locationId,
        });
      }

      return { success: true };
    }),

  "budgets.batchSet": budgetManage
    .input(z.object({
      budgets: z.array(z.object({
        year: z.number(),
        month: z.number(),
        categoryId: z.number(),
        amount: z.string(),
        locationId: z.number(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      let count = 0;
      await db.transaction(async (tx) => {
        for (const entry of input.budgets) {
          const { year, month, categoryId, amount, locationId } = entry;
          const existing = await tx
            .select()
            .from(budgets)
            .where(and(
              eq(budgets.year, year),
              eq(budgets.month, month),
              eq(budgets.categoryId, categoryId),
              eq(budgets.locationId, locationId),
              isNull(budgets.deletedAt),
            ))
            .limit(1);
          if (existing.length > 0) {
            await tx
              .update(budgets)
              .set({ amount, updatedAt: new Date() })
              .where(eq(budgets.id, existing[0].id));
          } else {
            await tx.insert(budgets).values({
              year,
              month,
              categoryId,
              amount,
              locationId,
            });
          }
          count++;
        }
      });
      return { success: true, count };
    }),

  budgetsList: reportQuery
    .input(z.object({
      year: z.number(),
      month: z.number(),
      locationId: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const locIds = input.locationId
        ? await resolveLocationFilter(ctx, input.locationId)
        : await resolveLocationFilter(ctx);
      const locIdSql = sql.join(locIds.map(id => sql`${id}`), sql`, `);

      const rows = await db
        .select({
          id: budgets.id,
          categoryId: budgets.categoryId,
          amount: budgets.amount,
          month: budgets.month,
          year: budgets.year,
          locationId: budgets.locationId,
          notes: budgets.notes,
        })
        .from(budgets)
        .where(and(
          eq(budgets.year, input.year),
          eq(budgets.month, input.month),
          sql`${budgets.locationId} IN (${locIdSql})`,
          isNull(budgets.deletedAt),
        ));

      return rows;
    }),

  setCogsTarget: reportQuery
    .input(z.object({ locationId: z.number(), cogsTarget: z.string() }))
    .mutation(async () => ({ success: true })),

  incomeStatement: reportQuery
    .input(z.object({ businessId: z.number(), startDate: z.string(), endDate: z.string(), saveReport: z.boolean().default(false) }))
    .mutation(async ({ input }) => {
      const { generateIncomeStatement } = await import("./lib/reports");
      return generateIncomeStatement(input.businessId, new Date(input.startDate), new Date(input.endDate));
    }),

  balanceSheet: reportQuery
    .input(z.object({ businessId: z.number(), asOfDate: z.string(), saveReport: z.boolean().default(false) }))
    .mutation(async ({ input }) => {
      const { generateBalanceSheet } = await import("./lib/reports");
      return generateBalanceSheet(input.businessId, new Date(input.asOfDate));
    }),

  trialBalance: reportQuery
    .input(z.object({ businessId: z.number(), asOfDate: z.string(), saveReport: z.boolean().default(false) }))
    .mutation(async ({ input }) => {
      const { generateTrialBalance } = await import("./lib/reports");
      return generateTrialBalance(input.businessId, new Date(input.asOfDate));
    }),

  assetRegister: reportQuery
    .input(z.object({ businessId: z.number(), saveReport: z.boolean().default(false) }))
    .mutation(async ({ input }) => {
      const { generateAssetRegister } = await import("./lib/reports");
      return generateAssetRegister(input.businessId);
    }),
});
