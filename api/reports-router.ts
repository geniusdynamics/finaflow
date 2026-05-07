import { z } from "zod";
import { createRouter, authedQuery, getCurrentBusinessLocationIds } from "./middleware";
import { getDb } from "./queries/connection";
import { dailySales, expenses, bills, payrollPeriods, payrollEntries, billItems, suppliers, recurringBillTemplates, budgets, expenseCategories, accounts, locations, cogsTargets } from "@db/schema";
import { eq, and, isNull, sql, desc } from "drizzle-orm";

export const reportsRouter = createRouter({
  // Profit & Loss by period and location
  plStatement: authedQuery
    .input(z.object({
      year: z.number(),
      month: z.number().optional(),
      locationId: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const { year, month, locationId } = input;
      const monthFilter = month ? sql`${month}` : sql`MONTH(CURRENT_DATE)`;

      // Determine location filter
      let locIds: number[] = [];
      if (locationId) {
        locIds = [locationId];
      } else {
        locIds = await getCurrentBusinessLocationIds(ctx);
      }
      const locIdSql = locIds.length > 0 ? sql.join(locIds.map(id => sql`${id}`), sql`, `) : null;

      // Revenue
      const revConditions = [sql`YEAR(${dailySales.saleDate}) = ${year}`, isNull(dailySales.deletedAt)];
      if (month) revConditions.push(sql`MONTH(${dailySales.saleDate}) = ${month}`);
      if (locIdSql) revConditions.push(sql`${dailySales.locationId} IN (${locIdSql})`);
      const revenue = await db.select({
        total: sql<string>`COALESCE(SUM(${dailySales.netSales}), 0)`,
      }).from(dailySales).where(and(...revConditions));

      // Expenses
      const expConditions = [sql`YEAR(${expenses.expenseDate}) = ${year}`, isNull(expenses.deletedAt)];
      if (month) expConditions.push(sql`MONTH(${expenses.expenseDate}) = ${month}`);
      if (locIdSql) expConditions.push(sql`${expenses.locationId} IN (${locIdSql})`);
      const totalExpenses = await db.select({
        total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
      }).from(expenses).where(and(...expConditions));

      // Expenses by category
      const expByCategory = await db.select({
        categoryId: expenses.categoryId,
        total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
      }).from(expenses).where(and(...expConditions)).groupBy(expenses.categoryId);

      // Payroll
      const payConditions = [sql`YEAR(${payrollPeriods.paymentDate}) = ${year}`, isNull(payrollPeriods.deletedAt)];
      if (month) payConditions.push(sql`MONTH(${payrollPeriods.paymentDate}) = ${month}`);
      if (locIdSql) payConditions.push(sql`${payrollPeriods.locationId} IN (${locIdSql})`);
      const payrollTotal = await db.select({
        total: sql<string>`COALESCE(SUM(${payrollPeriods.totalNetPay}), 0)`,
      }).from(payrollPeriods).where(and(...payConditions));

      // COGS (bill items = inventory purchases)
      const cogsConditions = [sql`YEAR(${bills.issueDate}) = ${year}`, isNull(bills.deletedAt)];
      if (month) cogsConditions.push(sql`MONTH(${bills.issueDate}) = ${month}`);
      if (locIdSql) cogsConditions.push(sql`${bills.locationId} IN (${locIdSql})`);
      const cogs = await db.select({
        total: sql<string>`COALESCE(SUM(${bills.amount}), 0)`,
      }).from(bills).where(and(...cogsConditions));

      const rev = parseFloat(revenue[0]?.total ?? "0");
      const cogsAmount = parseFloat(cogs[0]?.total ?? "0");
      const exp = parseFloat(totalExpenses[0]?.total ?? "0");
      const payroll = parseFloat(payrollTotal[0]?.total ?? "0");
      const grossProfit = rev - cogsAmount;
      const netProfit = grossProfit - exp - payroll;

      return {
        revenue: rev.toFixed(2),
        cogs: cogsAmount.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        grossMargin: rev > 0 ? ((grossProfit / rev) * 100).toFixed(1) : "0",
        expenses: exp.toFixed(2),
        payroll: payroll.toFixed(2),
        netProfit: netProfit.toFixed(2),
        netMargin: rev > 0 ? ((netProfit / rev) * 100).toFixed(1) : "0",
        expenseByCategory: expByCategory,
      };
    }),

  // Monthly P&L for a year (for charts)
  plMonthly: authedQuery
    .input(z.object({
      year: z.number(),
      locationId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const { year, locationId } = input;

      // Monthly revenue
      const revCond = [sql`YEAR(${dailySales.saleDate}) = ${year}`, isNull(dailySales.deletedAt)];
      if (locationId) revCond.push(eq(dailySales.locationId, locationId));
      const revByMonth = await db.select({
        month: sql<number>`MONTH(${dailySales.saleDate})`,
        total: sql<string>`COALESCE(SUM(${dailySales.netSales}), 0)`,
      }).from(dailySales).where(and(...revCond)).groupBy(sql`MONTH(${dailySales.saleDate})`);

      // Monthly expenses
      const expCond = [sql`YEAR(${expenses.expenseDate}) = ${year}`, isNull(expenses.deletedAt)];
      if (locationId) expCond.push(eq(expenses.locationId, locationId));
      const expByMonth = await db.select({
        month: sql<number>`MONTH(${expenses.expenseDate})`,
        total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
      }).from(expenses).where(and(...expCond)).groupBy(sql`MONTH(${expenses.expenseDate})`);

      // Monthly payroll
      const payCond = [sql`YEAR(${payrollPeriods.paymentDate}) = ${year}`, isNull(payrollPeriods.deletedAt)];
      if (locationId) payCond.push(eq(payrollPeriods.locationId, locationId));
      const payByMonth = await db.select({
        month: sql<number>`MONTH(${payrollPeriods.paymentDate})`,
        total: sql<string>`COALESCE(SUM(${payrollPeriods.totalNetPay}), 0)`,
      }).from(payrollPeriods).where(and(...payCond)).groupBy(sql`MONTH(${payrollPeriods.paymentDate})`);

      // Build 12 months
      const months = [];
      for (let m = 1; m <= 12; m++) {
        const rev = parseFloat(revByMonth.find(r => r.month === m)?.total ?? "0");
        const exp = parseFloat(expByMonth.find(e => e.month === m)?.total ?? "0");
        const payroll = parseFloat(payByMonth.find(p => p.month === m)?.total ?? "0");
        months.push({
          month: m,
          monthName: new Date(year, m - 1, 1).toLocaleDateString("en-KE", { month: "short" }),
          revenue: rev.toFixed(2),
          expenses: exp.toFixed(2),
          payroll: payroll.toFixed(2),
          netProfit: (rev - exp - payroll).toFixed(2),
        });
      }
      return months;
    }),

  // Comparative: this month vs last month
  plComparative: authedQuery
    .input(z.object({ locationId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      const now = new Date();
      const thisYear = now.getFullYear();
      const thisMonth = now.getMonth() + 1;
      const lastMonth = thisMonth === 1 ? 12 : thisMonth - 1;
      const lastMonthYear = thisMonth === 1 ? thisYear - 1 : thisYear;

      const getPL = async (year: number, month: number) => {
        const revCond = [sql`YEAR(${dailySales.saleDate}) = ${year}`, sql`MONTH(${dailySales.saleDate}) = ${month}`, isNull(dailySales.deletedAt)];
        const expCond = [sql`YEAR(${expenses.expenseDate}) = ${year}`, sql`MONTH(${expenses.expenseDate}) = ${month}`, isNull(expenses.deletedAt)];
        const payCond = [sql`YEAR(${payrollPeriods.paymentDate}) = ${year}`, sql`MONTH(${payrollPeriods.paymentDate}) = ${month}`, isNull(payrollPeriods.deletedAt)];
        if (input.locationId) { revCond.push(eq(dailySales.locationId, input.locationId)); expCond.push(eq(expenses.locationId, input.locationId)); payCond.push(eq(payrollPeriods.locationId, input.locationId)); }

        const [rev] = await db.select({ total: sql<string>`COALESCE(SUM(${dailySales.netSales}), 0)` }).from(dailySales).where(and(...revCond));
        const [exp] = await db.select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` }).from(expenses).where(and(...expCond));
        const [pay] = await db.select({ total: sql<string>`COALESCE(SUM(${payrollPeriods.totalNetPay}), 0)` }).from(payrollPeriods).where(and(...payCond));
        const revenue = parseFloat(rev.total ?? "0");
        const expensesAmt = parseFloat(exp.total ?? "0");
        const payroll = parseFloat(pay.total ?? "0");
        return { revenue: revenue.toFixed(2), expenses: expensesAmt.toFixed(2), payroll: payroll.toFixed(2), netProfit: (revenue - expensesAmt - payroll).toFixed(2) };
      };

      const current = await getPL(thisYear, thisMonth);
      const previous = await getPL(lastMonthYear, lastMonth);
      return { current: { ...current, label: `${new Date(thisYear, thisMonth - 1).toLocaleDateString("en-KE", { month: "long", year: "numeric" })}` }, previous: { ...previous, label: `${new Date(lastMonthYear, lastMonth - 1).toLocaleDateString("en-KE", { month: "long", year: "numeric" })}` } };
    }),

  // Budget vs Actual
  budgetVsActual: authedQuery
    .input(z.object({
      year: z.number(),
      month: z.number(),
      locationId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const { year, month, locationId } = input;

      // Get budgets
      const budgetCond = [eq(budgets.year, year), eq(budgets.month, month), isNull(budgets.deletedAt)];
      if (locationId) budgetCond.push(eq(budgets.locationId, locationId));
      const budgetRows = await db.select().from(budgets).where(and(...budgetCond));

      // Get actual expenses by category
      const expCond = [sql`YEAR(${expenses.expenseDate}) = ${year}`, sql`MONTH(${expenses.expenseDate}) = ${month}`, isNull(expenses.deletedAt)];
      if (locationId) expCond.push(eq(expenses.locationId, locationId));
      const actualRows = await db.select({
        categoryId: expenses.categoryId,
        total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
      }).from(expenses).where(and(...expCond)).groupBy(expenses.categoryId);

      // Get categories
      const cats = await db.select().from(expenseCategories).where(isNull(expenseCategories.deletedAt));

      const result = cats.map(cat => {
        const budgetRow = budgetRows.find(b => b.categoryId === cat.id);
        const actualRow = actualRows.find(a => a.categoryId === cat.id);
        const budgeted = parseFloat(budgetRow?.amount ?? "0");
        const actual = parseFloat(actualRow?.total ?? "0");
        const variance = budgeted - actual;
        const variancePercent = budgeted > 0 ? ((variance / budgeted) * 100).toFixed(1) : "0";
        return {
          categoryId: cat.id,
          categoryName: cat.name,
          categoryColor: cat.color,
          budgeted: budgeted.toFixed(2),
          actual: actual.toFixed(2),
          variance: variance.toFixed(2),
          variancePercent,
          isOverBudget: actual > budgeted,
        };
      });

      const totalBudgeted = result.reduce((s, r) => s + parseFloat(r.budgeted), 0);
      const totalActual = result.reduce((s, r) => s + parseFloat(r.actual), 0);

      return { categories: result, totalBudgeted: totalBudgeted.toFixed(2), totalActual: totalActual.toFixed(2), totalVariance: (totalBudgeted - totalActual).toFixed(2) };
    }),

  // Cash Flow Forecast (30 days)
  cashFlowForecast: authedQuery
    .input(z.object({ locationId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      const today = new Date().toISOString().split("T")[0];
      const d30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

      // Expected outflows: bills due in next 30 days
      const billsDue = await db.select({
        total: sql<string>`COALESCE(SUM(${bills.balanceDue}), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(bills).where(and(
        sql`${bills.dueDate} BETWEEN ${today} AND ${d30}`,
        isNull(bills.deletedAt),
        sql`${bills.balanceDue} > 0`
      ));

      // Recurring bills in next 30 days
      const recurringDue = await db.select({
        total: sql<string>`COALESCE(SUM(${recurringBillTemplates.amount}), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(recurringBillTemplates).where(and(
        isNull(recurringBillTemplates.deletedAt),
        eq(recurringBillTemplates.isActive, true),
        sql`${recurringBillTemplates.nextDueDate} BETWEEN ${today} AND ${d30}`
      ));

      // Historical daily avg revenue (last 30 days)
      const d30ago = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const histSales = await db.select({
        total: sql<string>`COALESCE(SUM(${dailySales.netSales}), 0)`,
        days: sql<number>`COUNT(DISTINCT ${dailySales.saleDate})`,
      }).from(dailySales).where(and(
        sql`${dailySales.saleDate} BETWEEN ${d30ago} AND ${today}`,
        isNull(dailySales.deletedAt),
        input.locationId ? eq(dailySales.locationId, input.locationId) : undefined,
      ).filter(Boolean));

      const totalSales = parseFloat(histSales[0]?.total ?? "0");
      const salesDays = histSales[0]?.days ?? 1;
      const dailyAvgRevenue = totalSales / Math.max(salesDays, 1);
      const projectedRevenue30d = dailyAvgRevenue * 30;

      const totalBillsDue = parseFloat(billsDue[0]?.total ?? "0");
      const totalRecurring = parseFloat(recurringDue[0]?.total ?? "0");
      const totalOutflows = totalBillsDue + totalRecurring;

      return {
        projectedInflows: projectedRevenue30d.toFixed(2),
        dailyAvgRevenue: dailyAvgRevenue.toFixed(2),
        projectedOutflows: totalOutflows.toFixed(2),
        billsDue: { total: totalBillsDue.toFixed(2), count: billsDue[0]?.count ?? 0 },
        recurringDue: { total: totalRecurring.toFixed(2), count: recurringDue[0]?.count ?? 0 },
        netProjected: (projectedRevenue30d - totalOutflows).toFixed(2),
        period: `${today} to ${d30}`,
      };
    }),

  // COGS / Food Cost Analysis
  cogsAnalysis: authedQuery
    .input(z.object({
      year: z.number(),
      month: z.number().optional(),
      locationId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const { year, month, locationId } = input;

      // Revenue
      const revCond = [sql`YEAR(${dailySales.saleDate}) = ${year}`, isNull(dailySales.deletedAt)];
      if (month) revCond.push(sql`MONTH(${dailySales.saleDate}) = ${month}`);
      if (locationId) revCond.push(eq(dailySales.locationId, locationId));
      const revenue = await db.select({ total: sql<string>`COALESCE(SUM(${dailySales.netSales}), 0)` }).from(dailySales).where(and(...revCond));

      // COGS (inventory purchases = bill items linked to supplier bills)
      const cogsCond = [sql`YEAR(${bills.issueDate}) = ${year}`, isNull(bills.deletedAt)];
      if (month) cogsCond.push(sql`MONTH(${bills.issueDate}) = ${month}`);
      if (locationId) cogsCond.push(eq(bills.locationId, locationId));
      const cogsTotal = await db.select({ total: sql<string>`COALESCE(SUM(${bills.amount}), 0)` }).from(bills).where(and(...cogsCond));

      // Get target
      const targetCond = locationId ? [eq(cogsTargets.locationId, locationId)] : [];
      const targets = await db.select().from(cogsTargets).where(and(...targetCond)).limit(1);
      const targetPercent = parseFloat(targets[0]?.targetFoodCostPercent ?? "35");
      const alertPercent = parseFloat(targets[0]?.alertThresholdPercent ?? "38");

      const rev = parseFloat(revenue[0]?.total ?? "0");
      const cogs = parseFloat(cogsTotal[0]?.total ?? "0");
      const foodCostPercent = rev > 0 ? (cogs / rev) * 100 : 0;

      return {
        revenue: rev.toFixed(2),
        cogs: cogs.toFixed(2),
        foodCostPercent: foodCostPercent.toFixed(1),
        targetPercent: targetPercent.toFixed(1),
        alertPercent: alertPercent.toFixed(1),
        isOverTarget: foodCostPercent > targetPercent,
        isAlert: foodCostPercent > alertPercent,
        status: foodCostPercent > alertPercent ? "critical" : foodCostPercent > targetPercent ? "warning" : "good",
      };
    }),

  // Budget CRUD
  listBudgets: authedQuery
    .input(z.object({ year: z.number(), month: z.number(), locationId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      const cond = [eq(budgets.year, input.year), eq(budgets.month, input.month), isNull(budgets.deletedAt)];
      if (input.locationId) cond.push(eq(budgets.locationId, input.locationId));
      return db.select().from(budgets).where(and(...cond));
    }),

  setBudget: authedQuery
    .input(z.object({
      locationId: z.number().optional(),
      categoryId: z.number(),
      year: z.number(),
      month: z.number(),
      amount: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      // Upsert
      const cond = [eq(budgets.categoryId, input.categoryId), eq(budgets.year, input.year), eq(budgets.month, input.month), isNull(budgets.deletedAt)];
      if (input.locationId) cond.push(eq(budgets.locationId, input.locationId));
      const existing = await db.select().from(budgets).where(and(...cond)).limit(1);
      if (existing.length > 0) {
        await db.update(budgets).set({ amount: input.amount, notes: input.notes }).where(eq(budgets.id, existing[0].id));
        return { id: existing[0].id, success: true };
      } else {
        const [result] = await db.insert(budgets).values({
          locationId: input.locationId,
          categoryId: input.categoryId,
          year: input.year,
          month: input.month,
          amount: input.amount,
          notes: input.notes,
        } as any);
        return { id: Number(result.insertId), success: true };
      }
    }),

  deleteBudget: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(budgets).set({ deletedAt: new Date() }).where(eq(budgets.id, input.id));
      return { success: true };
    }),

  // COGS target CRUD
  getCogsTarget: authedQuery
    .input(z.object({ locationId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      const cond = input.locationId ? [eq(cogsTargets.locationId, input.locationId)] : [];
      const rows = await db.select().from(cogsTargets).where(and(...cond)).limit(1);
      return rows[0] ?? { targetFoodCostPercent: "35.00", alertThresholdPercent: "38.00" };
    }),

  setCogsTarget: authedQuery
    .input(z.object({
      locationId: z.number().optional(),
      targetFoodCostPercent: z.string(),
      alertThresholdPercent: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const cond = input.locationId ? [eq(cogsTargets.locationId, input.locationId)] : [];
      const existing = await db.select().from(cogsTargets).where(and(...cond)).limit(1);
      if (existing.length > 0) {
        await db.update(cogsTargets).set({
          targetFoodCostPercent: input.targetFoodCostPercent,
          alertThresholdPercent: input.alertThresholdPercent,
        }).where(eq(cogsTargets.id, existing[0].id));
        return { success: true };
      } else {
        const [result] = await db.insert(cogsTargets).values({
          locationId: input.locationId,
          targetFoodCostPercent: input.targetFoodCostPercent,
          alertThresholdPercent: input.alertThresholdPercent,
        } as any);
        return { id: Number(result.insertId), success: true };
      }
    }),
});
