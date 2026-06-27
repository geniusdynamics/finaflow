import { z } from "zod";
import { createRouter, salesQuery, salesViewOwn, salesCreate, getCurrentBusinessLocationIds, requireAuthorizedLocation, requireAuthorizedEntity } from "./middleware";
import { getDb } from "./queries/connection";
import { dailySales, accounts, ledgerEntries, attachments, dailySalePayments, locationPaymentMethods, locations } from "@db/schema";
import { eq, and, isNull, desc, sql, inArray } from "drizzle-orm";
import { d } from "./lib/decimal";

export const dailySalesRouter = createRouter({
  // ABOUTME: Full-view list — requires sales:view (sees all entries).
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
        await requireAuthorizedLocation(ctx, input.locationId);
        locationIds = [input.locationId];
      } else {
        locationIds = await getCurrentBusinessLocationIds(ctx);
      }
      if (locationIds.length === 0) return [];

      const conditions = [inArray(dailySales.locationId, locationIds), isNull(dailySales.deletedAt)];
      if (input.dateFrom) conditions.push(sql`${dailySales.saleDate} >= ${input.dateFrom}`);
      if (input.dateTo) conditions.push(sql`${dailySales.saleDate} <= ${input.dateTo}`);

      const offset = (input.page - 1) * input.pageSize;
      const sales = await db.select().from(dailySales)
        .where(and(...conditions))
        .orderBy(desc(dailySales.saleDate), desc(dailySales.id))
        .limit(input.pageSize)
        .offset(offset);

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

  // ABOUTME: Owner-only list — requires sales:view_own (sees only entries the current user created).
  listOwn: salesViewOwn
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
        await requireAuthorizedLocation(ctx, input.locationId);
        locationIds = [input.locationId];
      } else {
        locationIds = await getCurrentBusinessLocationIds(ctx);
      }
      if (locationIds.length === 0) return [];

      const userId = ctx.user?.id;
      const conditions = [inArray(dailySales.locationId, locationIds), isNull(dailySales.deletedAt), eq(dailySales.enteredBy, userId)];
      if (input.dateFrom) conditions.push(sql`${dailySales.saleDate} >= ${input.dateFrom}`);
      if (input.dateTo) conditions.push(sql`${dailySales.saleDate} <= ${input.dateTo}`);

      const offset = (input.page - 1) * input.pageSize;
      const sales = await db.select().from(dailySales)
        .where(and(...conditions))
        .orderBy(desc(dailySales.saleDate), desc(dailySales.id))
        .limit(input.pageSize)
        .offset(offset);

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
    .query(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedLocation(ctx, input.locationId);
      const sales = await db.select().from(dailySales).where(
        and(eq(dailySales.locationId, input.locationId), isNull(dailySales.deletedAt))
      ).orderBy(desc(dailySales.saleDate), desc(dailySales.id));
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
      salesType: z.enum(["food", "beverage", "delivery", "other"]).default("food"),
      attachments: z.array(z.object({ imageData: z.string(), mimeType: z.string().default("image/jpeg"), caption: z.string().optional() })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const enteredBy = (ctx as any).user?.id ?? 1;

      await requireAuthorizedLocation(ctx, input.locationId);

      const existing = await db.select().from(dailySales).where(
        and(eq(dailySales.locationId, input.locationId), sql`${dailySales.saleDate} = ${input.saleDate}`, isNull(dailySales.deletedAt))
      ).limit(1);
      if (existing.length > 0) throw new Error("Sale already exists for this date");

      const grossSales = input.payments.reduce((sum, p) => sum.plus(d(p.amount)), d(0));
      const netSales = grossSales.plus(d(input.unpaidAmount)).minus(d(input.discountAmount)).minus(d(input.voidAmount));

      const [location] = await db.select().from(locations).where(eq(locations.id, input.locationId)).limit(1);
      const businessId = location?.businessId;
      if (!businessId) {
        throw new Error("Selected location is not linked to a business");
      }
      const saleDateStr = new Date(input.saleDate).toISOString().split("T")[0];

      let saleId = 0;
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any).returning();
        saleId = result.id;

        let revenueAccountId: number | undefined;
        if (businessId) {
          const typeToSubtype: Record<string, string> = {
            food: "sales_revenue",
            beverage: "sales_revenue",
            delivery: "service_revenue",
            other: "other_income",
          };
          const revenueSubtype = typeToSubtype[input.salesType || "food"];
          const revenueAcct = await tx.select().from(accounts).where(
            and(
              eq(accounts.businessId, businessId),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
              eq(accounts.accountSubType, revenueSubtype as any),
              isNull(accounts.deletedAt)
            )
          ).limit(1);
          if (revenueAcct[0]) revenueAccountId = revenueAcct[0].id;
        }

        for (const payment of input.payments) {
          if (d(payment.amount).gt(0)) {
            await tx.insert(dailySalePayments).values({
              dailySaleId: saleId,
              paymentMethodId: payment.paymentMethodId,
              amount: payment.amount,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any).returning();

            const junction = await tx.select().from(locationPaymentMethods).where(
              and(eq(locationPaymentMethods.locationId, input.locationId), eq(locationPaymentMethods.paymentMethodId, payment.paymentMethodId), eq(locationPaymentMethods.isActive, true))
            ).limit(1);

            if (junction[0]?.linkedAccountId) {
              const cashAcct = await tx.select().from(accounts).where(eq(accounts.id, junction[0].linkedAccountId)).limit(1);
              if (cashAcct[0]) {
                const cashNewBal = d(cashAcct[0].currentBalance || "0").plus(d(payment.amount));
                await tx.insert(ledgerEntries).values({
                  accountId: cashAcct[0].id,
                  transactionType: "sale",
                  transactionId: saleId,
                  entryType: "debit",
                  amount: payment.amount,
                  balanceAfter: cashNewBal.toFixed(2),
                  entryDate: saleDateStr,
                  createdBy: enteredBy,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any).returning();
                await tx.update(accounts).set({ currentBalance: cashNewBal.toFixed(2) }).where(eq(accounts.id, cashAcct[0].id));
              }
            }
          }
        }

        if (revenueAccountId && netSales.gt(0)) {
          const revenueAcct = await tx.select().from(accounts).where(eq(accounts.id, revenueAccountId)).limit(1);
          if (revenueAcct[0]) {
            const revenueNewBal = d(revenueAcct[0].currentBalance || "0").plus(netSales);
            await tx.insert(ledgerEntries).values({
              accountId: revenueAccountId,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
              transactionType: "sale" as any,
              transactionId: saleId,
              entryType: "credit",
              amount: netSales.toFixed(2),
              balanceAfter: revenueNewBal.toFixed(2),
              entryDate: saleDateStr,
              createdBy: enteredBy,
              description: `Daily Sales - ${input.salesType || "food"}`,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any).returning();
            await tx.update(accounts).set({ currentBalance: revenueNewBal.toFixed(2) }).where(eq(accounts.id, revenueAccountId));
          }
        }

        if (d(input.unpaidAmount).gt(0)) {
          const arAcct = await tx.query.accounts.findFirst({
            where: and(
              eq(accounts.accountCode, "1300"),
              eq(accounts.businessId, businessId),
              isNull(accounts.deletedAt)
            ),
          });
          if (arAcct) {
            const arNewBal = d(arAcct.currentBalance || "0").plus(d(input.unpaidAmount));
            await tx.insert(ledgerEntries).values({
              accountId: arAcct.id,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
              transactionType: "sale" as any,
              transactionId: saleId,
              entryType: "debit",
              amount: input.unpaidAmount,
              balanceAfter: arNewBal.toFixed(2),
              entryDate: saleDateStr,
              createdBy: enteredBy,
              description: `Credit Sale - ${input.salesType || "food"} ${input.unpaidNotes ? "(" + input.unpaidNotes + ")" : ""}`,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any).returning();
            await tx.update(accounts).set({ currentBalance: arNewBal.toFixed(2) }).where(eq(accounts.id, arAcct.id));
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any).returning();
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
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, dailySales, input.id);
      const { id, ...updates } = input;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.update(dailySales).set(updates as any).where(eq(dailySales.id, id));
      return { success: true };
    }),

  delete: salesCreate
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, dailySales, input.id);
      await db.update(dailySales).set({ deletedAt: new Date() }).where(eq(dailySales.id, input.id));
      return { success: true };
    }),

  getAttachments: salesQuery
    .input(z.object({ recordId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, dailySales, input.recordId);
      return db.select().from(attachments).where(
        and(eq(attachments.recordType, "daily_sales"), eq(attachments.recordId, input.recordId))
      ).orderBy(desc(attachments.createdAt));
    }),

  addAttachment: salesCreate
    .input(z.object({ recordId: z.number(), imageData: z.string(), mimeType: z.string().default("image/jpeg"), caption: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, dailySales, input.recordId);
      const [result] = await db.insert(attachments).values({
        recordType: "daily_sales", recordId: input.recordId,
        imageData: input.imageData, mimeType: input.mimeType, caption: input.caption,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).returning();
      return { id: result.id, success: true };
    }),

  deleteAttachment: salesCreate
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(attachments).where(eq(attachments.id, input.id));
      return { success: true };
    }),
});
