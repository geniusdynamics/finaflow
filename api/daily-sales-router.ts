import { z } from "zod";
import { createRouter, salesQuery, salesCreate, getCurrentBusinessLocationIds } from "./middleware";
import { getDb } from "./queries/connection";
import { dailySales, accounts, ledgerEntries, attachments, paymentMethods, dailySalePayments, locationPaymentMethods } from "@db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";

export const dailySalesRouter = createRouter({
  list: salesQuery.query(async () => {
    const db = getDb();
    const sales = await db.select().from(dailySales).where(isNull(dailySales.deletedAt)).orderBy(desc(dailySales.saleDate));
    // Load payments for each sale
    const result = [];
    for (const sale of sales) {
      const payments = await db.select().from(dailySalePayments).where(eq(dailySalePayments.dailySaleId, sale.id));
      result.push({ ...sale, payments });
    }
    return result;
  }),

  getByLocation: salesQuery
    .input(z.object({ locationId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const sales = await db.select().from(dailySales).where(
        and(eq(dailySales.locationId, input.locationId), isNull(dailySales.deletedAt))
      ).orderBy(desc(dailySales.saleDate));
      const result = [];
      for (const sale of sales) {
        const payments = await db.select().from(dailySalePayments).where(eq(dailySalePayments.dailySaleId, sale.id));
        result.push({ ...sale, payments });
      }
      return result;
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

      // Check duplicate
      const existing = await db.select().from(dailySales).where(
        and(eq(dailySales.locationId, input.locationId), sql`${dailySales.saleDate} = ${input.saleDate}`, isNull(dailySales.deletedAt))
      ).limit(1);
      if (existing.length > 0) throw new Error("Sale already exists for this date");

      // Calculate totals
      const grossSales = input.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
      const netSales = (grossSales - parseFloat(input.discountAmount) - parseFloat(input.voidAmount)).toFixed(2);

      const [result] = await db.insert(dailySales).values({
        locationId: input.locationId,
        saleDate: new Date(input.saleDate),
        netSales,
        discountAmount: input.discountAmount,
        voidAmount: input.voidAmount,
        unpaidAmount: input.unpaidAmount,
        ticketCount: input.ticketCount,
        orderCount: input.orderCount,
        notes: input.notes,
        unpaidNotes: input.unpaidNotes,
        enteredBy,
      } as any);

      const saleId = Number(result.insertId);

      // Store payment method breakdowns + auto-ledger via junction table
      for (const payment of input.payments) {
        if (parseFloat(payment.amount) > 0) {
          await db.insert(dailySalePayments).values({
            dailySaleId: saleId,
            paymentMethodId: payment.paymentMethodId,
            amount: payment.amount,
          } as any);

          // Look up the linked account from the location-payment-method junction
          const junction = await db.select().from(locationPaymentMethods).where(
            and(
              eq(locationPaymentMethods.locationId, input.locationId),
              eq(locationPaymentMethods.paymentMethodId, payment.paymentMethodId),
              eq(locationPaymentMethods.isActive, true)
            )
          ).limit(1);

          if (junction[0]?.linkedAccountId) {
            const acct = await db.select().from(accounts).where(eq(accounts.id, junction[0].linkedAccountId)).limit(1);
            if (acct[0]) {
              const newBalance = (parseFloat(acct[0].currentBalance) + parseFloat(payment.amount)).toFixed(2);
              await db.insert(ledgerEntries).values({
                accountId: acct[0].id,
                transactionType: "sale",
                transactionId: saleId,
                entryType: "credit",
                amount: payment.amount,
                balanceAfter: newBalance,
                entryDate: new Date(input.saleDate),
                createdBy: enteredBy,
              } as any);
              await db.update(accounts).set({ currentBalance: newBalance }).where(eq(accounts.id, acct[0].id));
            }
          }
        }
      }

      // Store attachments
      if (input.attachments && input.attachments.length > 0) {
        for (const att of input.attachments) {
          await db.insert(attachments).values({
            recordType: "daily_sales",
            recordId: saleId,
            imageData: att.imageData,
            mimeType: att.mimeType,
            caption: att.caption,
          } as any);
        }
      }

      return { id: saleId, netSales, success: true };
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
    .input(z.object({
      recordId: z.number(),
      imageData: z.string(),
      mimeType: z.string().default("image/jpeg"),
      caption: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(attachments).values({
        recordType: "daily_sales",
        recordId: input.recordId,
        imageData: input.imageData,
        mimeType: input.mimeType,
        caption: input.caption,
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
