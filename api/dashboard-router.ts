import { z } from "zod";
import { createRouter, authedQuery, ownerQuery, getCurrentBusinessLocationIds } from "./middleware";
import { getDb } from "./queries/connection";
import { dailySales, expenses, bills, billItems, billPayments, accounts, mpesaTransactions, recurringBillTemplates, payrollPeriods, payrollEntries, payrollAdvances, ledgerEntries, dailyMpesaLedger, suppliers, attachments, locations } from "@db/schema";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { d, Decimal } from "./lib/decimal";
import { resetBusinessTransactions } from "./lib/business-reset";

export const dashboardRouter = createRouter({
  summary: authedQuery
    .input(z.object({ dateFrom: z.string(), dateTo: z.string(), locationId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      let locationFilter: number[] | null = null;
      if (input.locationId) {
        locationFilter = [input.locationId];
      } else {
        locationFilter = await getCurrentBusinessLocationIds(ctx);
        if (locationFilter.length === 0) {
          return { totalSales: "0", totalExpenses: "0", totalBillsDue: "0", totalUnpaidSales: "0", netCashflow: "0", accounts: [], mpesa: { totalIn: "0", totalOut: "0", totalFees: "0" } };
        }
      }
      const locIdSql = sql.join(locationFilter.map(id => sql`${id}`), sql`, `);

      const salesConditions = [sql`${dailySales.saleDate} BETWEEN ${input.dateFrom} AND ${input.dateTo}`, isNull(dailySales.deletedAt), sql`${dailySales.locationId} IN (${locIdSql})`];
      const salesR = await db.select({ total: sql<string>`COALESCE(SUM(${dailySales.netSales}), 0)` }).from(dailySales).where(and(...salesConditions));

      const expConditions = [sql`${expenses.expenseDate} BETWEEN ${input.dateFrom} AND ${input.dateTo}`, isNull(expenses.deletedAt), sql`${expenses.locationId} IN (${locIdSql})`];
      const expR = await db.select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` }).from(expenses).where(and(...expConditions));

      const billsConditions = [sql`${bills.dueDate} >= ${input.dateFrom} AND ${bills.dueDate} <= ${input.dateTo}`, isNull(bills.deletedAt), sql`${bills.status} IN ('pending','partial','overdue')`, sql`${bills.locationId} IN (${locIdSql})`];
      const billsR = await db.select({ total: sql<string>`COALESCE(SUM(${bills.balanceDue}), 0)` }).from(bills).where(and(...billsConditions));

      const unpaidR = await db.select({ total: sql<string>`COALESCE(SUM(${dailySales.unpaidAmount}), 0)` }).from(dailySales).where(and(...salesConditions));

      const accts = await db.select().from(accounts).where(and(sql`${accounts.locationId} IN (${locIdSql})`, isNull(accounts.deletedAt), eq(accounts.isActive, true), isNull(accounts.accountType)));
      const mpR = await db.select({
        totalIn: sql<string>`COALESCE(SUM(CASE WHEN ${mpesaTransactions.amount} > 0 THEN ${mpesaTransactions.amount} ELSE 0 END), 0)`,
        totalOut: sql<string>`COALESCE(SUM(CASE WHEN ${mpesaTransactions.amount} < 0 THEN ABS(${mpesaTransactions.amount}) ELSE 0 END), 0)`,
        totalFees: sql<string>`COALESCE(SUM(${mpesaTransactions.txnFee}), 0)`,
      }).from(mpesaTransactions).where(and(sql`${mpesaTransactions.txnDate} BETWEEN ${input.dateFrom} AND ${input.dateTo}`, isNull(mpesaTransactions.deletedAt), sql`${mpesaTransactions.locationId} IN (${locIdSql})`));

      return {
        totalSales: salesR[0]?.total ?? "0", totalExpenses: expR[0]?.total ?? "0",
        totalBillsDue: billsR[0]?.total ?? "0",
        totalUnpaidSales: unpaidR[0]?.total ?? "0",
        netCashflow: d(salesR[0]?.total ?? "0").minus(d(expR[0]?.total ?? "0")).toFixed(2),
        accounts: accts.map((a) => ({ id: a.id, name: a.name, type: a.type, currentBalance: a.currentBalance })),
        mpesa: { totalIn: mpR[0]?.totalIn ?? "0", totalOut: mpR[0]?.totalOut ?? "0", totalFees: mpR[0]?.totalFees ?? "0" },
      };
    }),

  alerts: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const today = new Date().toISOString().split("T")[0];
    const d7 = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const d30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
    const locIds = await getCurrentBusinessLocationIds(ctx);
    if (locIds.length === 0) return { overdueBills: [], upcomingBills7: [], upcomingBills30: [], lowBalanceAccounts: [], upcomingRecurring: [], today };
    const billLocFilter = sql`${bills.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`;
    const acctLocFilter = sql`${accounts.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`;
    const recurLocFilter = sql`${recurringBillTemplates.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`;

    const overdue = await db.select().from(bills).where(and(sql`${bills.dueDate} < ${today}`, isNull(bills.deletedAt), sql`${bills.status} IN ('pending','partial')`, billLocFilter)).limit(10);
    const up7 = await db.select().from(bills).where(and(sql`${bills.dueDate} BETWEEN ${today} AND ${d7}`, isNull(bills.deletedAt), sql`${bills.status} IN ('pending','partial')`, billLocFilter)).orderBy(bills.dueDate).limit(10);
    const up30 = await db.select().from(bills).where(and(sql`${bills.dueDate} BETWEEN ${d7} AND ${d30}`, isNull(bills.deletedAt), sql`${bills.status} IN ('pending','partial')`, billLocFilter)).orderBy(bills.dueDate).limit(10);
    const lowBal = await db.select().from(accounts).where(and(isNull(accounts.deletedAt), eq(accounts.isActive, true), isNull(accounts.accountType), sql`${accounts.currentBalance} < 5000`, acctLocFilter));
    const recur = await db.select().from(recurringBillTemplates).where(and(isNull(recurringBillTemplates.deletedAt), eq(recurringBillTemplates.isActive, true), sql`${recurringBillTemplates.nextDueDate} <= ${d30}`, recurLocFilter)).orderBy(recurringBillTemplates.nextDueDate).limit(10);

    return { overdueBills: overdue, upcomingBills7: up7, upcomingBills30: up30, lowBalanceAccounts: lowBal, upcomingRecurring: recur, today };
  }),

  billCalendar: authedQuery
    .input(z.object({ dateFrom: z.string().optional(), dateTo: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const today = new Date().toISOString().split("T")[0];
      const fromD = input?.dateFrom ?? today;
      const toD = input?.dateTo ?? new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0];
      const locIds = await getCurrentBusinessLocationIds(ctx);
      if (locIds.length === 0) return { bills: [], recurring: [], today };
      const billLocFilter = sql`${bills.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`;
      const recurLocFilter = sql`${recurringBillTemplates.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`;
      const pending = await db.select().from(bills).where(and(sql`${bills.dueDate} BETWEEN ${fromD} AND ${toD}`, isNull(bills.deletedAt), sql`${bills.status} IN ('pending','partial','overdue')`, billLocFilter)).orderBy(bills.dueDate);
      const recur = await db.select().from(recurringBillTemplates).where(and(isNull(recurringBillTemplates.deletedAt), eq(recurringBillTemplates.isActive, true), sql`${recurringBillTemplates.nextDueDate} BETWEEN ${fromD} AND ${toD}`, recurLocFilter)).orderBy(recurringBillTemplates.nextDueDate);
      return { bills: pending, recurring: recur, today };
    }),

  feeAnalysis: authedQuery
    .input(z.object({ dateFrom: z.string().optional(), dateTo: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const locIds = await getCurrentBusinessLocationIds(ctx);
      if (locIds.length === 0) return { totalFees: { total: "0", count: 0 }, feesByType: [], topRecipients: [] };
      const locFilter = sql`${mpesaTransactions.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`;
      const conditions = [isNull(mpesaTransactions.deletedAt), locFilter];
      if (input?.dateFrom && input?.dateTo) conditions.push(sql`${mpesaTransactions.txnDate} BETWEEN ${input.dateFrom} AND ${input.dateTo}`);
      const totalFees = await db.select({
        total: sql<string>`COALESCE(SUM(${mpesaTransactions.txnFee}), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(mpesaTransactions).where(and(...conditions));
      const feesByType = await db.select({
        txnType: mpesaTransactions.txnType,
        totalFees: sql<string>`COALESCE(SUM(${mpesaTransactions.txnFee}), 0)`,
        count: sql<number>`COUNT(*)`,
        avgFee: sql<string>`COALESCE(AVG(${mpesaTransactions.txnFee}), 0)`,
      }).from(mpesaTransactions).where(and(...conditions)).groupBy(mpesaTransactions.txnType);
      const topRecipients = await db.select({
        partyName: mpesaTransactions.partyName,
        totalFees: sql<string>`COALESCE(SUM(${mpesaTransactions.txnFee}), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(mpesaTransactions).where(and(...conditions, sql`${mpesaTransactions.txnFee} > 0`)).groupBy(mpesaTransactions.partyName).orderBy(sql`SUM(${mpesaTransactions.txnFee}) DESC`).limit(10);
      return { totalFees: totalFees[0], feesByType, topRecipients };
    }),

  dailyPayments: authedQuery
    .input(z.object({ date: z.string(), locationId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const date = input.date;
      let locationFilter: number[] | null = null;
      if (input.locationId) {
        locationFilter = [input.locationId];
      } else {
        locationFilter = await getCurrentBusinessLocationIds(ctx);
        if (locationFilter.length === 0) return { billPayments: [], expenses: [], payroll: [], mpesa: [] };
      }
      const locIdSql = sql.join(locationFilter.map(id => sql`${id}`), sql`, `);

      const billsConditions = [isNull(bills.deletedAt), sql`DATE(${bills.dueDate}) = ${date}`, sql`${bills.status} IN ('pending','partial','overdue')`, sql`${bills.locationId} IN (${locIdSql})`];
      const billPaymentsToday = await db.select().from(bills).where(and(...billsConditions)).orderBy(desc(bills.dueDate));

      const expConditions = [sql`DATE(${expenses.expenseDate}) = ${date}`, isNull(expenses.deletedAt), sql`${expenses.locationId} IN (${locIdSql})`];
      const expensesToday = await db.select().from(expenses).where(and(...expConditions)).orderBy(desc(expenses.expenseDate));

      const payrollConditions = [sql`DATE(${payrollPeriods.paymentDate}) = ${date}`, isNull(payrollPeriods.deletedAt), sql`${payrollPeriods.locationId} IN (${locIdSql})`];
      const payrollToday = await db.select().from(payrollPeriods).where(and(...payrollConditions)).orderBy(desc(payrollPeriods.paymentDate));

      const mpesaConditions = [sql`DATE(${mpesaTransactions.txnDate}) = ${date}`, isNull(mpesaTransactions.deletedAt), sql`${mpesaTransactions.locationId} IN (${locIdSql})`];
      const mpesaToday = await db.select().from(mpesaTransactions).where(and(...mpesaConditions)).orderBy(desc(mpesaTransactions.txnDate));

      return { billPayments: billPaymentsToday, expenses: expensesToday, payroll: payrollToday, mpesa: mpesaToday };
    }),

  previousDayIncome: authedQuery
    .input(z.object({ date: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const targetDate = input?.date ?? new Date(Date.now() - 86400000).toISOString().split("T")[0];
      const locIds = await getCurrentBusinessLocationIds(ctx);
      if (locIds.length === 0) return { date: targetDate, totalIncome: "0", byBranch: [] };
      const locFilter = sql`${dailySales.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`;
      const salesConditions = [sql`DATE(${dailySales.saleDate}) = ${targetDate}`, isNull(dailySales.deletedAt), locFilter];
      const totalR = await db.select({ total: sql<string>`COALESCE(SUM(${dailySales.netSales}), 0)` }).from(dailySales).where(and(...salesConditions));
      const byBranch = await db.select({
        locationId: dailySales.locationId,
        total: sql<string>`COALESCE(SUM(${dailySales.netSales}), 0)`,
      }).from(dailySales).where(and(...salesConditions)).groupBy(dailySales.locationId);
      return { date: targetDate, totalIncome: totalR[0]?.total ?? "0", byBranch };
    }),

  accountBalances: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const locIds = await getCurrentBusinessLocationIds(ctx);
    if (locIds.length === 0) return { totalBalance: "0.00", byLocation: {} };
    const locFilter = sql`${accounts.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`;
    const accts = await db.select().from(accounts).where(and(isNull(accounts.deletedAt), eq(accounts.isActive, true), isNull(accounts.accountType), locFilter));
    const totalBalance = accts.reduce((sum, a) => sum.plus(d(a.currentBalance)), d(0));
    const byLocation = accts.reduce((acc, a) => {
      if (a.locationId === null) {
        return acc;
      }
      if (!acc[a.locationId]) acc[a.locationId] = d(0);
      acc[a.locationId] = acc[a.locationId].plus(d(a.currentBalance));
      return acc;
    }, {} as Record<number, Decimal>);
    const byLocationPlain: Record<string, string> = {};
    for (const [k, v] of Object.entries(byLocation)) {
      byLocationPlain[k] = v.toFixed(2);
    }
    return { totalBalance: totalBalance.toFixed(2), byLocation: byLocationPlain };
  }),

  billsSummary: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const locIds = await getCurrentBusinessLocationIds(ctx);
    if (locIds.length === 0) {
      return { bills: { week: { total: "0", count: 0 }, month: { total: "0", count: 0 }, year: { total: "0", count: 0 } }, recurring: { week: { total: "0", count: 0 }, month: { total: "0", count: 0 }, year: { total: "0", count: 0 } } };
    }
    const billLocFilter = sql`${bills.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`;
    const recurLocFilter = sql`${recurringBillTemplates.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`;
    const today = new Date().toISOString().split("T")[0];
    const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const monthEnd = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
    const yearEnd = new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0];

    const [billsWeek] = await db.select({ total: sql<string>`COALESCE(SUM(${bills.balanceDue}), 0)`, count: sql<number>`COUNT(*)` }).from(bills).where(and(sql`${bills.dueDate} BETWEEN ${today} AND ${weekEnd}`, isNull(bills.deletedAt), sql`${bills.status} IN ('pending','partial','overdue')`, billLocFilter));
    const [billsMonth] = await db.select({ total: sql<string>`COALESCE(SUM(${bills.balanceDue}), 0)`, count: sql<number>`COUNT(*)` }).from(bills).where(and(sql`${bills.dueDate} BETWEEN ${today} AND ${monthEnd}`, isNull(bills.deletedAt), sql`${bills.status} IN ('pending','partial','overdue')`, billLocFilter));
    const [billsYear] = await db.select({ total: sql<string>`COALESCE(SUM(${bills.balanceDue}), 0)`, count: sql<number>`COUNT(*)` }).from(bills).where(and(sql`${bills.dueDate} BETWEEN ${today} AND ${yearEnd}`, isNull(bills.deletedAt), sql`${bills.status} IN ('pending','partial','overdue')`, billLocFilter));

    const [recurWeek] = await db.select({ total: sql<string>`COALESCE(SUM(${recurringBillTemplates.amount}), 0)`, count: sql<number>`COUNT(*)` }).from(recurringBillTemplates).where(and(isNull(recurringBillTemplates.deletedAt), eq(recurringBillTemplates.isActive, true), sql`${recurringBillTemplates.nextDueDate} BETWEEN ${today} AND ${weekEnd}`, recurLocFilter));
    const [recurMonth] = await db.select({ total: sql<string>`COALESCE(SUM(${recurringBillTemplates.amount}), 0)`, count: sql<number>`COUNT(*)` }).from(recurringBillTemplates).where(and(isNull(recurringBillTemplates.deletedAt), eq(recurringBillTemplates.isActive, true), sql`${recurringBillTemplates.nextDueDate} BETWEEN ${today} AND ${monthEnd}`, recurLocFilter));
    const [recurYear] = await db.select({ total: sql<string>`COALESCE(SUM(${recurringBillTemplates.amount}), 0)`, count: sql<number>`COUNT(*)` }).from(recurringBillTemplates).where(and(isNull(recurringBillTemplates.deletedAt), eq(recurringBillTemplates.isActive, true), sql`${recurringBillTemplates.nextDueDate} BETWEEN ${today} AND ${yearEnd}`, recurLocFilter));

    return {
      bills: { week: billsWeek, month: billsMonth, year: billsYear },
      recurring: { week: recurWeek, month: recurMonth, year: recurYear },
    };
  }),

  resetAllTransactions: ownerQuery
    .mutation(async ({ ctx }) => {
      const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
      if (!businessId) {
        throw new Error("No active business available for reset.");
      }

      const resetResult = await resetBusinessTransactions({
        db: getDb(),
        businessId,
      });

      return {
        ...resetResult,
        message: "All transactions have been reset.",
      };
    }),
});
