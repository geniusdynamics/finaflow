import { z } from "zod";
import { createRouter, accountManage } from "./middleware";
import { getDb } from "./queries/connection";
import { dailySales, expenses, bills, expenseCategories, accounts, financialReports } from "@db/schema";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { d } from "./lib/decimal";

export const reportsRouter = createRouter({
  plStatement: accountManage
    .input(z.object({ year: z.number(), month: z.number(), locationId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      const startDate = `${input.year}-${String(input.month).padStart(2, "0")}-01`;
      const endDate = new Date(input.year, input.month, 0).toISOString().split("T")[0];

      const salesCond: any[] = [
        sql`${dailySales.saleDate} >= ${startDate}`,
        sql`${dailySales.saleDate} <= ${endDate}`,
        isNull(dailySales.deletedAt),
      ];
      if (input.locationId) salesCond.push(eq(dailySales.locationId, input.locationId));
      const salesData = await db.select().from(dailySales).where(and(...salesCond));
      const revenue = salesData.reduce((sum, s) => sum.plus(d(s.netSales || "0")), d(0));

      const expenseCond: any[] = [
        sql`${expenses.expenseDate} >= ${startDate}`,
        sql`${expenses.expenseDate} <= ${endDate}`,
        isNull(expenses.deletedAt),
      ];
      if (input.locationId) expenseCond.push(eq(expenses.locationId, input.locationId));
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

  plMonthly: accountManage
    .input(z.object({ year: z.number(), locationId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      const months = [];
      for (let m = 1; m <= 12; m++) {
        const monthStart = `${input.year}-${String(m).padStart(2, "0")}-01`;
        const monthEnd = new Date(input.year, m, 0).toISOString().split("T")[0];

        const salesCond: any[] = [
          sql`${dailySales.saleDate} >= ${monthStart}`,
          sql`${dailySales.saleDate} <= ${monthEnd}`,
          isNull(dailySales.deletedAt),
        ];
        if (input.locationId) salesCond.push(eq(dailySales.locationId, input.locationId));
        const salesData = await db.select().from(dailySales).where(and(...salesCond));
        const revenue = salesData.reduce((sum, s) => sum.plus(d(s.netSales || "0")), d(0));

        const expenseCond: any[] = [
          sql`${expenses.expenseDate} >= ${monthStart}`,
          sql`${expenses.expenseDate} <= ${monthEnd}`,
          isNull(expenses.deletedAt),
        ];
        if (input.locationId) expenseCond.push(eq(expenses.locationId, input.locationId));
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

  plComparative: accountManage
    .input(z.object({ locationId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      const thisYear = new Date().getFullYear();
      const lastYear = thisYear - 1;

      const getTotals = async (year: number) => {
        const start = `${year}-01-01`;
        const end = `${year}-12-31`;
        const salesCond: any[] = [sql`${dailySales.saleDate} >= ${start}`, sql`${dailySales.saleDate} <= ${end}`, isNull(dailySales.deletedAt)];
        if (input.locationId) salesCond.push(eq(dailySales.locationId, input.locationId));
        const salesData = await db.select().from(dailySales).where(and(...salesCond));
        const revenue = salesData.reduce((sum, s) => sum.plus(d(s.netSales || "0")), d(0));

        const expenseCond: any[] = [sql`${expenses.expenseDate} >= ${start}`, sql`${expenses.expenseDate} <= ${end}`, isNull(expenses.deletedAt)];
        if (input.locationId) expenseCond.push(eq(expenses.locationId, input.locationId));
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

  budgetVsActual: accountManage
    .input(z.object({ year: z.number(), month: z.number().optional(), locationId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      const startDate = `${input.year}-01-01`;
      const endDate = input.month ? new Date(input.year, input.month, 0).toISOString().split("T")[0] : `${input.year}-12-31`;

      const expenseCond: any[] = [
        sql`${expenses.expenseDate} >= ${startDate}`,
        sql`${expenses.expenseDate} <= ${endDate}`,
        isNull(expenses.deletedAt),
      ];
      if (input.locationId) expenseCond.push(eq(expenses.locationId, input.locationId));

      const expenseData = await db
        .select({
          categoryId: expenseCategories.id,
          categoryName: expenseCategories.name,
          actual: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
        })
        .from(expenses)
        .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
        .where(and(...expenseCond))
        .groupBy(expenseCategories.id, expenseCategories.name);

      const categories = expenseData.map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        budgeted: "0.00",
        actual: c.actual,
        variance: d(0).minus(d(c.actual)).toFixed(2),
        variancePercent: "0.0",
        isOverBudget: d(c.actual).gt(0),
      }));

      const totalActual = categories.reduce((sum, c) => sum.plus(d(c.actual)), d(0));

      return {
        categories,
        totalBudgeted: "0.00",
        totalActual: totalActual.toFixed(2),
        totalVariance: totalActual.negated().toFixed(2),
      };
    }),

  cashFlowForecast: accountManage
    .input(z.object({ locationId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const today = new Date().toISOString().split("T")[0];
      const next30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const salesCond: any[] = [
        sql`${dailySales.saleDate} >= ${thirtyDaysAgo}`,
        sql`${dailySales.saleDate} <= ${today}`,
        isNull(dailySales.deletedAt),
      ];
      if (input.locationId) salesCond.push(eq(dailySales.locationId, input.locationId));
      const salesData = await db.select().from(dailySales).where(and(...salesCond));
      const totalSales = salesData.reduce((sum, s) => sum.plus(d(s.netSales || "0")), d(0));
      const avgDaily = totalSales.gt(0) ? totalSales.dividedBy(30) : d(0);

      const billCond: any[] = [
        sql`${bills.dueDate} >= ${today}`,
        sql`${bills.dueDate} <= ${next30}`,
        sql`${bills.balanceDue} > 0`,
        isNull(bills.deletedAt),
      ];
      if (input.locationId) billCond.push(eq(bills.locationId, input.locationId));
      const billData = await db.select().from(bills).where(and(...billCond));
      const totalBills = billData.reduce((sum, b) => sum.plus(d(b.balanceDue || "0")), d(0));

      return {
        period: `${thirtyDaysAgo} to ${next30}`,
        projectedInflows: avgDaily.times(30).toFixed(2),
        dailyAvgRevenue: avgDaily.toFixed(2),
        billsDue: { total: totalBills.toFixed(2), count: billData.length },
        recurringDue: { total: "0.00", count: 0 },
        netProjected: avgDaily.times(30).minus(totalBills).toFixed(2),
      };
    }),

  cogsAnalysis: accountManage
    .input(z.object({ year: z.number(), month: z.number().optional(), locationId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      const startDate = input.month ? `${input.year}-${String(input.month).padStart(2, "0")}-01` : `${input.year}-01-01`;
      const endDate = input.month ? new Date(input.year, input.month, 0).toISOString().split("T")[0] : `${input.year}-12-31`;

      const salesCond: any[] = [
        sql`${dailySales.saleDate} >= ${startDate}`,
        sql`${dailySales.saleDate} <= ${endDate}`,
        isNull(dailySales.deletedAt),
      ];
      if (input.locationId) salesCond.push(eq(dailySales.locationId, input.locationId));
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
        const cogsCond: any[] = [
          sql`${expenses.expenseDate} >= ${startDate}`,
          sql`${expenses.expenseDate} <= ${endDate}`,
          inArray(expenses.categoryId, cogsCatIds),
          isNull(expenses.deletedAt),
        ];
        if (input.locationId) cogsCond.push(eq(expenses.locationId, input.locationId));
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

  getCogsTarget: accountManage
    .input(z.object({ locationId: z.number().optional() }))
    .query(async () => ({
      targetFoodCostPercent: "35",
      alertThresholdPercent: "38",
    })),

  setBudget: accountManage
    .input(z.object({ year: z.number(), month: z.number(), budgetType: z.enum(["cogs", "sales"]), amount: z.string(), locationId: z.number() }))
    .mutation(async () => ({ success: true })),

  setCogsTarget: accountManage
    .input(z.object({ locationId: z.number(), cogsTarget: z.string() }))
    .mutation(async () => ({ success: true })),

  incomeStatement: accountManage
    .input(z.object({ businessId: z.number(), startDate: z.string(), endDate: z.string(), saveReport: z.boolean().default(false) }))
    .mutation(async ({ input }) => {
      const { generateIncomeStatement } = await import("./lib/reports");
      return generateIncomeStatement(input.businessId, new Date(input.startDate), new Date(input.endDate));
    }),

  balanceSheet: accountManage
    .input(z.object({ businessId: z.number(), asOfDate: z.string(), saveReport: z.boolean().default(false) }))
    .mutation(async ({ input }) => {
      const { generateBalanceSheet } = await import("./lib/reports");
      return generateBalanceSheet(input.businessId, new Date(input.asOfDate));
    }),

  trialBalance: accountManage
    .input(z.object({ businessId: z.number(), asOfDate: z.string(), saveReport: z.boolean().default(false) }))
    .mutation(async ({ input }) => {
      const { generateTrialBalance } = await import("./lib/reports");
      return generateTrialBalance(input.businessId, new Date(input.asOfDate));
    }),

  assetRegister: accountManage
    .input(z.object({ businessId: z.number(), saveReport: z.boolean().default(false) }))
    .mutation(async ({ input }) => {
      const { generateAssetRegister } = await import("./lib/reports");
      return generateAssetRegister(input.businessId);
    }),
});
