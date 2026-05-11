import { z } from "zod";
import { createRouter, authedQuery, getCurrentBusinessLocationIds, reportQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { dailySales, expenses, bills, payrollPeriods, payrollEntries, billItems, suppliers, recurringBillTemplates, budgets, expenseCategories, accounts, locations, cogsTargets } from "@db/schema";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { d } from "./lib/decimal";

export const reportsRouter = createRouter({
  plStatement: reportQuery
    .input(z.object({ year: z.number(), month: z.number().optional(), locationId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const { year, month, locationId } = input;
      let locIds: number[] = [];
      if (locationId) locIds = [locationId];
      else locIds = await getCurrentBusinessLocationIds(ctx);
      const locIdSql = locIds.length > 0 ? sql.join(locIds.map(id => sql`${id}`), sql`, `) : null;

      const revConditions = [sql`EXTRACT(YEAR FROM ${dailySales.saleDate}) = ${year}`, isNull(dailySales.deletedAt)];
      if (month) revConditions.push(sql`EXTRACT(MONTH FROM ${dailySales.saleDate}) = ${month}`);
      if (locIdSql) revConditions.push(sql`${dailySales.locationId} IN (${locIdSql})`);
      const revenue = await db.select({ total: sql<string>`COALESCE(SUM(${dailySales.netSales}), 0)` }).from(dailySales).where(and(...revConditions));

      const expConditions = [sql`EXTRACT(YEAR FROM ${expenses.expenseDate}) = ${year}`, isNull(expenses.deletedAt)];
      if (month) expConditions.push(sql`EXTRACT(MONTH FROM ${expenses.expenseDate}) = ${month}`);
      if (locIdSql) expConditions.push(sql`${expenses.locationId} IN (${locIdSql})`);
      const totalExpenses = await db.select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` }).from(expenses).where(and(...expConditions));

      const expByCategory = await db.select({
        categoryId: expenses.categoryId,
        total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
      }).from(expenses).where(and(...expConditions)).groupBy(expenses.categoryId);

      const payConditions = [sql`EXTRACT(YEAR FROM ${payrollPeriods.paymentDate}) = ${year}`, isNull(payrollPeriods.deletedAt)];
      if (month) payConditions.push(sql`EXTRACT(MONTH FROM ${payrollPeriods.paymentDate}) = ${month}`);
      if (locIdSql) payConditions.push(sql`${payrollPeriods.locationId} IN (${locIdSql})`);
      const payrollTotal = await db.select({ total: sql<string>`COALESCE(SUM(${payrollPeriods.totalNetPay}), 0)` }).from(payrollPeriods).where(and(...payConditions));

      const cogsConditions = [sql`EXTRACT(YEAR FROM ${bills.issueDate}) = ${year}`, isNull(bills.deletedAt)];
      if (month) cogsConditions.push(sql`EXTRACT(MONTH FROM ${bills.issueDate}) = ${month}`);
      if (locIdSql) cogsConditions.push(sql`${bills.locationId} IN (${locIdSql})`);
      const cogs = await db.select({ total: sql<string>`COALESCE(SUM(${bills.amount}), 0)` }).from(bills).where(and(...cogsConditions));

      const rev = d(revenue[0]?.total ?? "0");
      const cogsAmount = d(cogs[0]?.total ?? "0");
      const exp = d(totalExpenses[0]?.total ?? "0");
      const payroll = d(payrollTotal[0]?.total ?? "0");
      const grossProfit = rev.minus(cogsAmount);
      const netProfit = grossProfit.minus(exp).minus(payroll);

      return {
        revenue: rev.toFixed(2), cogs: cogsAmount.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        grossMargin: rev.gt(0) ? grossProfit.div(rev).mul(100).toFixed(1) : "0",
        expenses: exp.toFixed(2), payroll: payroll.toFixed(2),
        netProfit: netProfit.toFixed(2),
        netMargin: rev.gt(0) ? netProfit.div(rev).mul(100).toFixed(1) : "0",
        expenseByCategory: expByCategory,
      };
    }),

  plMonthly: reportQuery
    .input(z.object({ year: z.number(), locationId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const { year, locationId } = input;
      let locIds: number[] = [];
      if (locationId) locIds = [locationId];
      else locIds = await getCurrentBusinessLocationIds(ctx);
      const locIdSql = locIds.length > 0 ? sql.join(locIds.map(id => sql`${id}`), sql`, `) : null;

      const revCond = [sql`EXTRACT(YEAR FROM ${dailySales.saleDate}) = ${year}`, isNull(dailySales.deletedAt)];
      if (locIdSql) revCond.push(sql`${dailySales.locationId} IN (${locIdSql})`);
      const revByMonth = await db.select({ month: sql<number>`EXTRACT(MONTH FROM ${dailySales.saleDate})`, total: sql<string>`COALESCE(SUM(${dailySales.netSales}), 0)` }).from(dailySales).where(and(...revCond)).groupBy(sql`EXTRACT(MONTH FROM ${dailySales.saleDate})`);

      const expCond = [sql`EXTRACT(YEAR FROM ${expenses.expenseDate}) = ${year}`, isNull(expenses.deletedAt)];
      if (locIdSql) expCond.push(sql`${expenses.locationId} IN (${locIdSql})`);
      const expByMonth = await db.select({ month: sql<number>`EXTRACT(MONTH FROM ${expenses.expenseDate})`, total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` }).from(expenses).where(and(...expCond)).groupBy(sql`EXTRACT(MONTH FROM ${expenses.expenseDate})`);

      const payCond = [sql`EXTRACT(YEAR FROM ${payrollPeriods.paymentDate}) = ${year}`, isNull(payrollPeriods.deletedAt)];
      if (locIdSql) payCond.push(sql`${payrollPeriods.locationId} IN (${locIdSql})`);
      const payByMonth = await db.select({ month: sql<number>`EXTRACT(MONTH FROM ${payrollPeriods.paymentDate})`, total: sql<string>`COALESCE(SUM(${payrollPeriods.totalNetPay}), 0)` }).from(payrollPeriods).where(and(...payCond)).groupBy(sql`EXTRACT(MONTH FROM ${payrollPeriods.paymentDate})`);

      const cogsCond = [sql`EXTRACT(YEAR FROM ${bills.issueDate}) = ${year}`, isNull(bills.deletedAt)];
      if (locIdSql) cogsCond.push(sql`${bills.locationId} IN (${locIdSql})`);
      const cogsByMonth = await db.select({ month: sql<number>`EXTRACT(MONTH FROM ${bills.issueDate})`, total: sql<string>`COALESCE(SUM(${bills.amount}), 0)` }).from(bills).where(and(...cogsCond)).groupBy(sql`EXTRACT(MONTH FROM ${bills.issueDate})`);

      const months = [];
      for (let m = 1; m <= 12; m++) {
        const rev = d(revByMonth.find(r => r.month === m)?.total ?? "0");
        const exp = d(expByMonth.find(e => e.month === m)?.total ?? "0");
        const payroll = d(payByMonth.find(p => p.month === m)?.total ?? "0");
        const cogs = d(cogsByMonth.find(c => c.month === m)?.total ?? "0");
        const grossProfit = rev.minus(cogs);
        months.push({
          month: m,
          monthName: new Date(year, m - 1, 1).toLocaleDateString("en-KE", { month: "short" }),
          revenue: rev.toFixed(2), cogs: cogs.toFixed(2), expenses: exp.toFixed(2), payroll: payroll.toFixed(2),
          netProfit: grossProfit.minus(exp).minus(payroll).toFixed(2),
        });
      }
      return months;
    }),

  plComparative: reportQuery
    .input(z.object({ locationId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const now = new Date();
      const thisYear = now.getFullYear();
      const thisMonth = now.getMonth() + 1;
      const lastMonth = thisMonth === 1 ? 12 : thisMonth - 1;
      const lastMonthYear = thisMonth === 1 ? thisYear - 1 : thisYear;
      let locIds: number[] = [];
      if (input.locationId) locIds = [input.locationId];
      else locIds = await getCurrentBusinessLocationIds(ctx);
      const locIdSql = locIds.length > 0 ? sql.join(locIds.map(id => sql`${id}`), sql`, `) : null;

      const getPL = async (year: number, month: number) => {
        const revCond = [sql`EXTRACT(YEAR FROM ${dailySales.saleDate}) = ${year}`, sql`EXTRACT(MONTH FROM ${dailySales.saleDate}) = ${month}`, isNull(dailySales.deletedAt)];
        const expCond = [sql`EXTRACT(YEAR FROM ${expenses.expenseDate}) = ${year}`, sql`EXTRACT(MONTH FROM ${expenses.expenseDate}) = ${month}`, isNull(expenses.deletedAt)];
        const payCond = [sql`EXTRACT(YEAR FROM ${payrollPeriods.paymentDate}) = ${year}`, sql`EXTRACT(MONTH FROM ${payrollPeriods.paymentDate}) = ${month}`, isNull(payrollPeriods.deletedAt)];
        const cogsCond = [sql`EXTRACT(YEAR FROM ${bills.issueDate}) = ${year}`, sql`EXTRACT(MONTH FROM ${bills.issueDate}) = ${month}`, isNull(bills.deletedAt)];
        if (locIdSql) {
          revCond.push(sql`${dailySales.locationId} IN (${locIdSql})`);
          expCond.push(sql`${expenses.locationId} IN (${locIdSql})`);
          payCond.push(sql`${payrollPeriods.locationId} IN (${locIdSql})`);
          cogsCond.push(sql`${bills.locationId} IN (${locIdSql})`);
        }

        const [rev] = await db.select({ total: sql<string>`COALESCE(SUM(${dailySales.netSales}), 0)` }).from(dailySales).where(and(...revCond));
        const [exp] = await db.select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` }).from(expenses).where(and(...expCond));
        const [pay] = await db.select({ total: sql<string>`COALESCE(SUM(${payrollPeriods.totalNetPay}), 0)` }).from(payrollPeriods).where(and(...payCond));
        const [cogs] = await db.select({ total: sql<string>`COALESCE(SUM(${bills.amount}), 0)` }).from(bills).where(and(...cogsCond));
        const revenue = d(rev.total ?? "0");
        const expensesAmt = d(exp.total ?? "0");
        const payroll = d(pay.total ?? "0");
        const cogsAmt = d(cogs.total ?? "0");
        const netProfit = revenue.minus(cogsAmt).minus(expensesAmt).minus(payroll);
        return { revenue: revenue.toFixed(2), cogs: cogsAmt.toFixed(2), expenses: expensesAmt.toFixed(2), payroll: payroll.toFixed(2), netProfit: netProfit.toFixed(2) };
      };

      const current = await getPL(thisYear, thisMonth);
      const previous = await getPL(lastMonthYear, lastMonth);
      return { current: { ...current, label: `${new Date(thisYear, thisMonth - 1).toLocaleDateString("en-KE", { month: "long", year: "numeric" })}` }, previous: { ...previous, label: `${new Date(lastMonthYear, lastMonth - 1).toLocaleDateString("en-KE", { month: "long", year: "numeric" })}` } };
    }),

  budgetVsActual: reportQuery
    .input(z.object({ year: z.number(), month: z.number(), locationId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const { year, month, locationId } = input;
      let locIds: number[] = [];
      if (locationId) locIds = [locationId];
      else locIds = await getCurrentBusinessLocationIds(ctx);
      const locIdSql = locIds.length > 0 ? sql.join(locIds.map(id => sql`${id}`), sql`, `) : null;

      const budgetCond = [eq(budgets.year, year), eq(budgets.month, month), isNull(budgets.deletedAt)];
      if (locIdSql) budgetCond.push(sql`${budgets.locationId} IN (${locIdSql})`);
      const budgetRows = await db.select().from(budgets).where(and(...budgetCond));

      const expCond = [sql`EXTRACT(YEAR FROM ${expenses.expenseDate}) = ${year}`, sql`EXTRACT(MONTH FROM ${expenses.expenseDate}) = ${month}`, isNull(expenses.deletedAt)];
      if (locIdSql) expCond.push(sql`${expenses.locationId} IN (${locIdSql})`);
      const actualRows = await db.select({ categoryId: expenses.categoryId, total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` }).from(expenses).where(and(...expCond)).groupBy(expenses.categoryId);

      const cats = await db.select().from(expenseCategories).where(isNull(expenseCategories.deletedAt));

      const result = cats.map(cat => {
        const budgetRow = budgetRows.find(b => b.categoryId === cat.id);
        const actualRow = actualRows.find(a => a.categoryId === cat.id);
        const budgeted = d(budgetRow?.amount ?? "0");
        const actual = d(actualRow?.total ?? "0");
        const variance = budgeted.minus(actual);
        const variancePercent = budgeted.gt(0) ? variance.div(budgeted).mul(100).toFixed(1) : "0";
        return {
          categoryId: cat.id, categoryName: cat.name, categoryColor: cat.color,
          budgeted: budgeted.toFixed(2), actual: actual.toFixed(2),
          variance: variance.toFixed(2), variancePercent,
          isOverBudget: actual.gt(budgeted),
        };
      });

      const totalBudgeted = result.reduce((s, r) => s.plus(d(r.budgeted)), d(0));
      const totalActual = result.reduce((s, r) => s.plus(d(r.actual)), d(0));
      return { categories: result, totalBudgeted: totalBudgeted.toFixed(2), totalActual: totalActual.toFixed(2), totalVariance: totalBudgeted.minus(totalActual).toFixed(2) };
    }),

  cashFlowForecast: reportQuery
    .input(z.object({ locationId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const today = new Date().toISOString().split("T")[0];
      const d30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
      let locIds: number[] = [];
      if (input.locationId) locIds = [input.locationId];
      else locIds = await getCurrentBusinessLocationIds(ctx);
      const locIdSql = locIds.length > 0 ? sql.join(locIds.map(id => sql`${id}`), sql`, `) : null;

      const billsCond = [sql`${bills.dueDate} BETWEEN ${today} AND ${d30}`, isNull(bills.deletedAt), sql`${bills.balanceDue} > 0`];
      if (locIdSql) billsCond.push(sql`${bills.locationId} IN (${locIdSql})`);
      const billsDue = await db.select({ total: sql<string>`COALESCE(SUM(${bills.balanceDue}), 0)`, count: sql<number>`COUNT(*)` }).from(bills).where(and(...billsCond));

      const recurringCond = [isNull(recurringBillTemplates.deletedAt), eq(recurringBillTemplates.isActive, true), sql`${recurringBillTemplates.nextDueDate} BETWEEN ${today} AND ${d30}`];
      if (locIdSql) recurringCond.push(sql`${recurringBillTemplates.locationId} IN (${locIdSql})`);
      const recurringDue = await db.select({ total: sql<string>`COALESCE(SUM(${recurringBillTemplates.amount}), 0)`, count: sql<number>`COUNT(*)` }).from(recurringBillTemplates).where(and(...recurringCond));

      const d30ago = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const histCond = [sql`${dailySales.saleDate} BETWEEN ${d30ago} AND ${today}`, isNull(dailySales.deletedAt)];
      if (locIdSql) histCond.push(sql`${dailySales.locationId} IN (${locIdSql})`);
      const histSales = await db.select({ total: sql<string>`COALESCE(SUM(${dailySales.netSales}), 0)`, days: sql<number>`COUNT(DISTINCT ${dailySales.saleDate})` }).from(dailySales).where(and(...histCond));

      const totalSales = d(histSales[0]?.total ?? "0");
      const salesDays = histSales[0]?.days ?? 1;
      const dailyAvgRevenue = totalSales.div(Math.max(salesDays, 1));
      const projectedRevenue30d = dailyAvgRevenue.mul(30);

      const totalBillsDue = d(billsDue[0]?.total ?? "0");
      const totalRecurring = d(recurringDue[0]?.total ?? "0");
      const totalOutflows = totalBillsDue.plus(totalRecurring);

      return {
        projectedInflows: projectedRevenue30d.toFixed(2),
        dailyAvgRevenue: dailyAvgRevenue.toFixed(2),
        projectedOutflows: totalOutflows.toFixed(2),
        billsDue: { total: totalBillsDue.toFixed(2), count: billsDue[0]?.count ?? 0 },
        recurringDue: { total: totalRecurring.toFixed(2), count: recurringDue[0]?.count ?? 0 },
        netProjected: projectedRevenue30d.minus(totalOutflows).toFixed(2),
        period: `${today} to ${d30}`,
      };
    }),

  cogsAnalysis: reportQuery
    .input(z.object({ year: z.number(), month: z.number().optional(), locationId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const { year, month, locationId } = input;
      let locIds: number[] = [];
      if (locationId) locIds = [locationId];
      else locIds = await getCurrentBusinessLocationIds(ctx);
      const locIdSql = locIds.length > 0 ? sql.join(locIds.map(id => sql`${id}`), sql`, `) : null;

      const revCond = [sql`EXTRACT(YEAR FROM ${dailySales.saleDate}) = ${year}`, isNull(dailySales.deletedAt)];
      if (month) revCond.push(sql`EXTRACT(MONTH FROM ${dailySales.saleDate}) = ${month}`);
      if (locIdSql) revCond.push(sql`${dailySales.locationId} IN (${locIdSql})`);
      const revenue = await db.select({ total: sql<string>`COALESCE(SUM(${dailySales.netSales}), 0)` }).from(dailySales).where(and(...revCond));

      const cogsCond = [sql`EXTRACT(YEAR FROM ${bills.issueDate}) = ${year}`, isNull(bills.deletedAt)];
      if (month) cogsCond.push(sql`EXTRACT(MONTH FROM ${bills.issueDate}) = ${month}`);
      if (locIdSql) cogsCond.push(sql`${bills.locationId} IN (${locIdSql})`);
      const cogsTotal = await db.select({ total: sql<string>`COALESCE(SUM(${bills.amount}), 0)` }).from(bills).where(and(...cogsCond));

      const targetCond = locIdSql ? [sql`${cogsTargets.locationId} IN (${locIdSql})`] : [];
      const targets = await db.select().from(cogsTargets).where(and(...targetCond)).limit(1);
      const targetPercent = d(targets[0]?.targetFoodCostPercent ?? "35");
      const alertPercent = d(targets[0]?.alertThresholdPercent ?? "38");

      const rev = d(revenue[0]?.total ?? "0");
      const cogs = d(cogsTotal[0]?.total ?? "0");
      const foodCostPercent = rev.gt(0) ? cogs.div(rev).mul(100) : d(0);

      return {
        revenue: rev.toFixed(2), cogs: cogs.toFixed(2),
        foodCostPercent: foodCostPercent.toFixed(1),
        targetPercent: targetPercent.toFixed(1), alertPercent: alertPercent.toFixed(1),
        isOverTarget: foodCostPercent.gt(targetPercent),
        isAlert: foodCostPercent.gt(alertPercent),
        status: foodCostPercent.gt(alertPercent) ? "critical" : foodCostPercent.gt(targetPercent) ? "warning" : "good",
      };
    }),

  listBudgets: reportQuery
    .input(z.object({ year: z.number(), month: z.number(), locationId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const cond = [eq(budgets.year, input.year), eq(budgets.month, input.month), isNull(budgets.deletedAt)];
      if (input.locationId) cond.push(eq(budgets.locationId, input.locationId));
      else {
        const locIds = await getCurrentBusinessLocationIds(ctx);
        if (locIds.length > 0) cond.push(sql`${budgets.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`);
      }
      return db.select().from(budgets).where(and(...cond));
    }),

  setBudget: reportQuery
    .input(z.object({ locationId: z.number().optional(), categoryId: z.number(), year: z.number(), month: z.number(), amount: z.string(), notes: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      if (!input.locationId) {
        const locIds = await getCurrentBusinessLocationIds(ctx);
        if (locIds.length > 0) input.locationId = locIds[0];
      }
      const cond = [eq(budgets.categoryId, input.categoryId), eq(budgets.year, input.year), eq(budgets.month, input.month), isNull(budgets.deletedAt)];
      if (input.locationId) cond.push(eq(budgets.locationId, input.locationId));
      const existing = await db.select().from(budgets).where(and(...cond)).limit(1);
      if (existing.length > 0) {
        await db.update(budgets).set({ amount: input.amount, notes: input.notes }).where(eq(budgets.id, existing[0].id));
        return { id: existing[0].id, success: true };
      } else {
        const [result] = await db.insert(budgets).values({ locationId: input.locationId, categoryId: input.categoryId, year: input.year, month: input.month, amount: input.amount, notes: input.notes } as any).returning();
        return { id: result.id, success: true };
      }
    }),

  deleteBudget: reportQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(budgets).set({ deletedAt: new Date() }).where(eq(budgets.id, input.id));
      return { success: true };
    }),

  getCogsTarget: reportQuery
    .input(z.object({ locationId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      let locIds: number[] = [];
      if (input.locationId) locIds = [input.locationId];
      else locIds = await getCurrentBusinessLocationIds(ctx);
      const locIdSql = locIds.length > 0 ? sql.join(locIds.map(id => sql`${id}`), sql`, `) : null;
      const cond = locIdSql ? [sql`${cogsTargets.locationId} IN (${locIdSql})`] : [];
      const rows = await db.select().from(cogsTargets).where(and(...cond)).limit(1);
      return rows[0] ?? { targetFoodCostPercent: "35.00", alertThresholdPercent: "38.00" };
    }),

  setCogsTarget: reportQuery
    .input(z.object({ locationId: z.number().optional(), targetFoodCostPercent: z.string(), alertThresholdPercent: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      if (!input.locationId) {
        const locIds = await getCurrentBusinessLocationIds(ctx);
        if (locIds.length > 0) input.locationId = locIds[0];
      }
      const cond = input.locationId ? [eq(cogsTargets.locationId, input.locationId)] : [];
      const existing = await db.select().from(cogsTargets).where(and(...cond)).limit(1);
      if (existing.length > 0) {
        await db.update(cogsTargets).set({ targetFoodCostPercent: input.targetFoodCostPercent, alertThresholdPercent: input.alertThresholdPercent }).where(eq(cogsTargets.id, existing[0].id));
        return { success: true };
      } else {
        const [result] = await db.insert(cogsTargets).values({ locationId: input.locationId, targetFoodCostPercent: input.targetFoodCostPercent, alertThresholdPercent: input.alertThresholdPercent } as any).returning();
        return { id: result.id, success: true };
      }
    }),
});
