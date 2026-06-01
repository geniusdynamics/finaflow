// ABOUTME: Backward-compatible daily ledger proxy that queries the new mobile_wallet_daily_ledger table.
// ABOUTME: All queries filter by provider='mpesa' and map fields to the legacy format.
import { z } from "zod";
import { createRouter, mpesaQuery, getCurrentBusinessLocationIds } from "./middleware";
import { getDb } from "./queries/connection";
import { mobileWalletDailyLedger, mobileWalletTransactions } from "@db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLedgerToOldFormat(l: any) {
  return {
    id: l.id,
    locationId: l.locationId,
    accountId: l.accountId,
    ledgerDate: l.ledgerDate,
    openingBalance: l.openingBalance,
    totalTopups: l.totalInflow ?? "0.00",
    totalExpenditures: l.totalOutflow ?? "0.00",
    totalFees: l.totalFees ?? "0.00",
    closingBalance: l.closingBalance,
    transactionCount: l.transactionCount ?? 0,
    notes: l.notes,
    enteredBy: l.enteredBy,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    baseCurrency: l.baseCurrency,
    baseClosingBalance: l.baseClosingBalance,
  };
}

export const dailyLedgerRouter = createRouter({
  list: mpesaQuery
    .input(z.object({ locationId: z.number().optional(), accountId: z.number().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [eq(mobileWalletDailyLedger.provider, "mpesa"), isNull(mobileWalletDailyLedger.deletedAt)];
      if (input?.locationId) {
        conditions.push(eq(mobileWalletDailyLedger.locationId, input.locationId));
      } else {
        const locIds = await getCurrentBusinessLocationIds(ctx);
        if (locIds.length > 0) {
          conditions.push(sql`${mobileWalletDailyLedger.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`);
        }
      }
      if (input?.accountId) conditions.push(eq(mobileWalletDailyLedger.accountId, input.accountId));
      if (input?.dateFrom && input?.dateTo) {
        conditions.push(sql`${mobileWalletDailyLedger.ledgerDate} BETWEEN ${input.dateFrom} AND ${input.dateTo}`);
      }
      const results = await db.select().from(mobileWalletDailyLedger).where(and(...conditions)).orderBy(mobileWalletDailyLedger.ledgerDate);
      return results.map(mapLedgerToOldFormat);
    }),

  create: mpesaQuery
    .input(z.object({
      locationId: z.number(),
      accountId: z.number(),
      ledgerDate: z.string(),
      openingBalance: z.string(),
      closingBalance: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (ctx as any).user?.id ?? 1;

      const conditions = [
        eq(mobileWalletTransactions.locationId, input.locationId),
        eq(mobileWalletTransactions.provider, "mpesa"),
        sql`${mobileWalletTransactions.txnDate} = ${input.ledgerDate}`,
        isNull(mobileWalletTransactions.deletedAt),
      ];

      const txnAgg = await db.select({
        totalInflow: sql<string>`COALESCE(SUM(CASE WHEN ${mobileWalletTransactions.direction} = 'in' THEN CAST(${mobileWalletTransactions.amount} AS DECIMAL) ELSE 0 END), 0)`,
        totalOutflow: sql<string>`COALESCE(SUM(CASE WHEN ${mobileWalletTransactions.direction} = 'out' THEN CAST(${mobileWalletTransactions.amount} AS DECIMAL) ELSE 0 END), 0)`,
        totalFees: sql<string>`COALESCE(SUM(CAST(${mobileWalletTransactions.txnFee} AS DECIMAL)), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(mobileWalletTransactions).where(and(...conditions));

      const totalInflow = parseFloat(txnAgg[0]?.totalInflow ?? "0");
      const totalOutflow = parseFloat(txnAgg[0]?.totalOutflow ?? "0");
      const totalFees = parseFloat(txnAgg[0]?.totalFees ?? "0");
      const openingBalance = parseFloat(input.openingBalance);
      const autoClosing = (openingBalance + totalInflow - totalOutflow - totalFees).toFixed(2);
      const closingBalance = input.closingBalance ?? autoClosing;

      const existing = await db.select().from(mobileWalletDailyLedger).where(
        and(eq(mobileWalletDailyLedger.accountId, input.accountId), eq(mobileWalletDailyLedger.provider, "mpesa"), sql`${mobileWalletDailyLedger.ledgerDate} = ${input.ledgerDate}`)
      ).limit(1);

      if (existing.length > 0) {
        await db.update(mobileWalletDailyLedger).set({
          openingBalance: input.openingBalance,
          totalInflow: totalInflow.toFixed(2),
          totalOutflow: totalOutflow.toFixed(2),
          totalFees: totalFees.toFixed(2),
          closingBalance,
          transactionCount: txnAgg[0]?.count ?? 0,
          notes: input.notes,
          enteredBy: userId,
        }).where(eq(mobileWalletDailyLedger.id, existing[0].id));
        return { id: existing[0].id, closingBalance, success: true };
      } else {
        const [result] = await db.insert(mobileWalletDailyLedger).values({
          locationId: input.locationId,
          provider: "mpesa",
          accountId: input.accountId,
          ledgerDate: input.ledgerDate,
          openingBalance: input.openingBalance,
          totalInflow: totalInflow.toFixed(2),
          totalOutflow: totalOutflow.toFixed(2),
          totalFees: totalFees.toFixed(2),
          closingBalance,
          transactionCount: txnAgg[0]?.count ?? 0,
          notes: input.notes,
          enteredBy: userId,
          baseCurrency: "KES",
          baseClosingBalance: closingBalance,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any).returning();
        return { id: result.id, closingBalance, success: true };
      }
    }),
});
