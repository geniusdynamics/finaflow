import { z } from "zod";
import { createRouter, salesQuery, salesCreate, getCurrentBusinessLocationIds } from "./middleware";
import { getDb } from "./queries/connection";
import { dailySales, accounts, ledgerEntries, attachments, paymentMethods, dailySalePayments, locationPaymentMethods } from "@db/schema";
import { eq, and, isNull, desc, sql, inArray } from "drizzle-orm";
import { d } from "./lib/decimal";

export const dailySalesRouter = createRouter({
  list: salesQuery
    .input(z.object({
      locationId: z.number().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(50),
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      let locationIds: number[];
      if (input.locationId) {
        locationIds = [input.locationId];
      } else {
        locationIds = await getCurrentBusinessLocationIds(ctx);
      }
      if (locationIds.length === 0) return [];

      const conditions = [inArray(dailySales.locationId, locationIds), isNull(dailySales.deletedAt)];
      if (input.dateFrom) conditions.push(sql`${dailySales.saleDate} >= ${input.dateFrom}`);
      if (input.dateTo) conditions.push(sql`${dailySales.saleDate} <= ${input.dateTo}`);

      const offset = (input.page - 1) * input.pageSize;
      const sales = await db.select().from(dailySales).where(and(...conditions)).orderBy(desc(dailySales.saleDate)).limit(input.pageSize).offset(offset);

      // Batch load payments
      const saleIds = sales.map((s) => s.id);
      const allPayments = saleIds.length > 0
        ? await db.select().from(dailySalePayments).where(inArray(dailySalePayments.dailySaleId, saleIds))
        : [];
      const paymentsBySaleId = new Map<number, typeof allPayments>();
      for (const p of allPayments) {
        const existing = paymentsBySaleId.get(p.dailySaleId) || [];
        existing.push(p);
        paymentsBySaleId.set(p.dailySaleId, existing);
      }
      return sales.map((sale) => ({ ...sale, payments: paymentsBySaleId.get(sale.id) || [] }));
    }),

  getByLocation: salesQuery
    .input(z.object({ locationId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const sales = await db.select().from(dailySales).where(
        and(eq(dailySales.locationId, input.locationId), isNull(dailySales.deletedAt))
      ).orderBy(desc(dailySales.saleDate));
      const saleIds = sales.map((s) => s.id);
      const allPayments = saleIds.length > 0
        ? await db.select().from(dailySalePayments).where(inArray(dailySalePayments.dailySaleId, saleIds))
        : [];
      const paymentsBySaleId = new Map<number, typeof allPayments>();
      for (const p of allPayments) {
        const existing = paymentsBySaleId.get(p.dailySaleId) || [];
        existing.push(p);
        paymentsBySaleId.set(p.dailySaleId, existing);
      }
      return sales.map((sale) => ({ ...sale, payments: paymentsBySaleId.get(sale.id) || [] }));
    }),

  create: salesCreate
    .input(z.object({
      locationId: z.number(),
      saleDate: z.string(),
      payments: z.array(z.object({
        paymentMethodId: z.number(),
        amount: z.string(),
      })),
      discountAmount: z.string().default("0.00"),
      voidAmount: z.string().default("0.00"),
      unpaidAmount: z.string().default("0.00"),
      ticketCount: z.number().default(0),
      orderCount: z.number().default(0),
      notes: z.string().optional(),
      unpaidNotes: z.string().optional(),
      attachments: z.array(z.object({ imageData: z.string(), mimeType: z.string().default("image/jpeg"), caption: z.string().optional() })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const enteredBy = (ctx as any).user?.id ?? 1;

      const existing = await db.select().from(dailySales).where(
        and(eq(dailySales.locationId, input.locationId), sql`${dailySales.saleDate} = ${input.saleDate}`, isNull(dailySales.deletedAt))
      ).limit(1);
      if (existing.length > 0) throw new Error("Sale already exists for this date");

      const grossSales = input.payments.reduce((sum, p) => sum.plus(d(p.amount)), d(0));
      const netSales = grossSales.minus(d(input.discountAmount)).minus(d(input.voidAmount));

      let saleId: number;
      await db.transaction(async (tx) => {
        const [result] = await tx.insert(dailySales).values({
          locationId: input.locationId,
          saleDate: new Date(input.saleDate),
          netSales: netSales.toFixed(2),
          discountAmount: input.discountAmount,
          voidAmount: input.voidAmount,
          unpaidAmount: input.unpaidAmount,
          ticketCount: input.ticketCount,
          orderCount: input.orderCount,
          notes: input.notes,
          unpaidNotes: input.unpaidNotes,
          enteredBy,
        } as any);
        saleId = Number(result.insertId);

        for (const payment of input.payments) {
          if (d(payment.amount).gt(0)) {
            await tx.insert(dailySalePayments).values({
              dailySaleId: saleId,
              paymentMethodId: payment.paymentMethodId,
              amount: payment.amount,
            } as any);

            const junction = await tx.select().from(locationPaymentMethods).where(
              and(eq(locationPaymentMethods.locationId, input.locationId), eq(locationPaymentMethods.paymentMethodId, payment.paymentMethodId), eq(locationPaymentMethods.isActive, true))
            ).limit(1);

            if (junction[0]?.linkedAccountId) {
              const acct = await tx.select().from(accounts).where(eq(accounts.id, junction[0].linkedAccountId)).limit(1);
              if (acct[0]) {
                const newBalance = d(acct[0].currentBalance).plus(d(payment.amount));
                await tx.insert(ledgerEntries).values({
                  accountId: acct[0].id,
                  transactionType: "sale",
                  transactionId: saleId,
                  entryType: "credit",
                  amount: payment.amount,
                  balanceAfter: newBalance.toFixed(2),
                  entryDate: new Date(input.saleDate),
                  createdBy: enteredBy,
                } as any);
                await tx.update(accounts).set({ currentBalance: newBalance.toFixed(2) }).where(eq(accounts.id, acct[0].id));
              }
            }
          }
        }

        if (input.attachments && input.attachments.length > 0) {
          for (const att of input.attachments) {
            await tx.insert(attachments).values({
              recordType: "daily_sales",
              recordId: saleId,
              imageData: att.imageData,
              mimeType: att.mimeType,
              caption: att.caption,
            } as any);
          }
        }
      });

      return { id: saleId, netSales: netSales.toFixed(2), success: true };
    }),

  update: salesCreate
    .input(z.object({
      id: z.number(),
      discountAmount: z.string().optional(),
      voidAmount: z.string().optional(),
      unpaidAmount: z.string().optional(),
      ticketCount: z.number().optional(),
      orderCount: z.number().optional(),
      notes: z.string().optional(),
      unpaidNotes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      await db.update(dailySales).set(updates as any).where(eq(dailySales.id, id));
      return { success: true };
    }),

  delete: salesCreate
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(dailySales).set({ deletedAt: new Date() }).where(eq(dailySales.id, input.id));
      return { success: true };
    }),

  getAttachments: salesQuery
    .input(z.object({ recordId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(attachments).where(
        and(eq(attachments.recordType, "daily_sales"), eq(attachments.recordId, input.recordId))
      ).orderBy(desc(attachments.createdAt));
    }),

  addAttachment: salesCreate
    .input(z.object({ recordId: z.number(), imageData: z.string(), mimeType: z.string().default("image/jpeg"), caption: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(attachments).values({
        recordType: "daily_sales", recordId: input.recordId,
        imageData: input.imageData, mimeType: input.mimeType, caption: input.caption,
      } as any);
      return { id: Number(result.insertId), success: true };
    }),

  deleteAttachment: salesCreate
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(attachments).where(eq(attachments.id, input.id));
      return { success: true };
    }),
});
