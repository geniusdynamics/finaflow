import { z } from "zod";
import { createRouter, mpesaQuery, getCurrentBusinessLocationIds } from "./middleware";
import { getDb } from "./queries/connection";
import { dailyMpesaLedger, mpesaTransactions } from "@db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

export const dailyLedgerRouter = createRouter({
  list: mpesaQuery
    .input(z.object({ locationId: z.number().optional(), accountId: z.number().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [isNull(dailyMpesaLedger.deletedAt)];
      if (input?.locationId) {
        conditions.push(eq(dailyMpesaLedger.locationId, input.locationId));
      } else {
        const locIds = await getCurrentBusinessLocationIds(ctx);
        if (locIds.length > 0) {
          conditions.push(sql`${dailyMpesaLedger.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`);
        }
      }
      if (input?.accountId) conditions.push(eq(dailyMpesaLedger.accountId, input.accountId));
      if (input?.dateFrom && input?.dateTo) {
        conditions.push(sql`${dailyMpesaLedger.ledgerDate} BETWEEN ${input.dateFrom} AND ${input.dateTo}`);
      }
      return db.select().from(dailyMpesaLedger).where(and(...conditions)).orderBy(dailyMpesaLedger.ledgerDate);
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
      const userId = (ctx as any).user?.id ?? 1;

      // Auto-calculate from mpesa_transactions for this date and location
      const txnConditions = [
        eq(mpesaTransactions.locationId, input.locationId),
        sql`${mpesaTransactions.txnDate} = ${input.ledgerDate}`,
        isNull(mpesaTransactions.deletedAt),
      ];

      const txnAgg = await db.select({
        totalTopups: sql<string>`COALESCE(SUM(CASE WHEN ${mpesaTransactions.amount} > 0 THEN ${mpesaTransactions.amount} ELSE 0 END), 0)`,
        totalExpenditures: sql<string>`COALESCE(SUM(CASE WHEN ${mpesaTransactions.amount} < 0 THEN ABS(${mpesaTransactions.amount}) ELSE 0 END), 0)`,
        totalFees: sql<string>`COALESCE(SUM(${mpesaTransactions.txnFee}), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(mpesaTransactions).where(and(...txnConditions));

      const totalTopups = parseFloat(txnAgg[0]?.totalTopups ?? "0");
      const totalExpenditures = parseFloat(txnAgg[0]?.totalExpenditures ?? "0");
      const totalFees = parseFloat(txnAgg[0]?.totalFees ?? "0");
      const openingBalance = parseFloat(input.openingBalance);
      const autoClosing = (openingBalance + totalTopups - totalExpenditures - totalFees).toFixed(2);
      const closingBalance = input.closingBalance ?? autoClosing;

      // Upsert
      const existing = await db.select().from(dailyMpesaLedger).where(
        and(eq(dailyMpesaLedger.accountId, input.accountId), sql`${dailyMpesaLedger.ledgerDate} = ${input.ledgerDate}`)
      ).limit(1);

      if (existing.length > 0) {
        await db.update(dailyMpesaLedger).set({
          openingBalance: input.openingBalance,
          totalTopups: totalTopups.toFixed(2),
          totalExpenditures: totalExpenditures.toFixed(2),
          totalFees: totalFees.toFixed(2),
          closingBalance,
          transactionCount: txnAgg[0]?.count ?? 0,
          notes: input.notes,
          enteredBy: userId,
        }).where(eq(dailyMpesaLedger.id, existing[0].id));
        return { id: existing[0].id, closingBalance, success: true };
      } else {
        const [result] = await db.insert(dailyMpesaLedger).values({
          locationId: input.locationId,
          accountId: input.accountId,
          ledgerDate: new Date(input.ledgerDate),
          openingBalance: input.openingBalance,
          totalTopups: totalTopups.toFixed(2),
          totalExpenditures: totalExpenditures.toFixed(2),
          totalFees: totalFees.toFixed(2),
          closingBalance,
          transactionCount: txnAgg[0]?.count ?? 0,
          notes: input.notes,
          enteredBy: userId,
        } as any).returning();
        return { id: result.id, closingBalance, success: true };
      }
    }),
});
