import { z } from "zod";
import { createRouter, billQuery, billCreate, billPay, getCurrentBusinessLocationIds, requireAuthorizedLocation, requireAuthorizedEntity, requireAuthorizedBusinessEntity } from "./middleware";
import { getDb } from "./queries/connection";
import { bills, billPayments, billItems, masterItems, suppliers, accounts, ledgerEntries, recurringBillTemplates, attachments, locations } from "@db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { d } from "./lib/decimal";
import { notFutureDateString } from "./lib/future-date";

export const billPaymentInputSchema = z.object({
  billId: z.number(),
  paymentMethod: z.enum(["cash", "mpesa", "bank_transfer", "card"]),
  amount: z.string(),
  paymentDate: notFutureDateString("Payment date"),
  reference: z.string().optional(),
  notes: z.string().optional(),
  accountId: z.number().optional(),
});

export const batchBillPaymentInputSchema = z.object({
  billIds: z.array(z.number()),
  paymentMethod: z.enum(["cash", "mpesa", "bank_transfer", "card"]),
  paymentDate: notFutureDateString("Payment date"),
  accountId: z.number(),
  reference: z.string().optional(),
});

export const billsRouter = createRouter({
  list: billQuery
    .input(z.object({ locationId: z.number().optional(), status: z.enum(["pending", "partial", "paid", "overdue", "cancelled"]).optional(), supplierId: z.number().optional(), page: z.number().default(1), pageSize: z.number().default(50) }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [isNull(bills.deletedAt)];
      if (input?.locationId) {
        await requireAuthorizedLocation(ctx, input.locationId);
        conditions.push(eq(bills.locationId, input.locationId));
      } else {
        const locIds = await getCurrentBusinessLocationIds(ctx);
        if (locIds.length === 0) return [];
        conditions.push(sql`${bills.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`);
      }
      if (input?.status) conditions.push(eq(bills.status, input.status));
      if (input?.supplierId) conditions.push(eq(bills.supplierId, input.supplierId));
      const offset = (input.page - 1) * input.pageSize;
      return db.select().from(bills).where(and(...conditions)).orderBy(desc(bills.dueDate)).limit(input.pageSize).offset(offset);
    }),

  create: billCreate
    .input(z.object({
      locationId: z.number(), supplierId: z.number().optional(),
      billNumber: z.string().optional(), description: z.string().min(1),
      amount: z.string(), issueDate: z.string(), dueDate: z.string(),
      attachments: z.array(z.object({ imageData: z.string(), mimeType: z.string().default("image/jpeg"), caption: z.string().optional() })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      let billNumber = input.billNumber;
      let billId: number;

      await requireAuthorizedLocation(ctx, input.locationId);

      if (input.supplierId) {
        await requireAuthorizedBusinessEntity(ctx, suppliers, input.supplierId);
      }

      await db.transaction(async (tx) => {
        if (!billNumber) {
          const loc = await tx.select().from(locations).where(eq(locations.id, input.locationId)).limit(1);
          const nextNum = loc[0]?.nextBillNumber ?? 1;
          billNumber = `BILL-${String(nextNum).padStart(4, "0")}`;
          await tx.update(locations).set({ nextBillNumber: nextNum + 1 }).where(eq(locations.id, input.locationId));
        }

        const [result] = await tx.insert(bills).values({
          locationId: input.locationId, supplierId: input.supplierId,
          billNumber, description: input.description,
          amount: input.amount, balanceDue: input.amount,
          issueDate: new Date(input.issueDate), dueDate: new Date(input.dueDate),
        } as any).returning();
        billId = result.id;

        if (input.attachments && input.attachments.length > 0) {
          for (const att of input.attachments) {
            await tx.insert(attachments).values({
              recordType: "bill", recordId: billId,
              imageData: att.imageData, mimeType: att.mimeType, caption: att.caption,
            } as any).returning();
          }
        }

        if (input.supplierId) {
          const sup = await tx.select().from(suppliers).where(eq(suppliers.id, input.supplierId)).limit(1);
          if (sup[0]) {
            const newBal = d(sup[0].currentBalance).plus(d(input.amount));
            const newBilled = d(sup[0].totalBilled).plus(d(input.amount));
            await tx.update(suppliers).set({ currentBalance: newBal.toFixed(2), totalBilled: newBilled.toFixed(2) }).where(eq(suppliers.id, input.supplierId));
          }
        }
      });

      return { id: billId, billNumber, success: true };
    }),

  recordPayment: billPay
    .input(billPaymentInputSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const enteredBy = (ctx as any).user?.id ?? 1;

      const bill = await requireAuthorizedEntity(ctx, bills, input.billId);
      
      if (input.accountId) {
        const acct = await requireAuthorizedEntity(ctx, accounts, input.accountId);
        if (acct.locationId !== bill.locationId) {
          throw new Error("Account must belong to the same location as the bill");
        }
      }

      const paymentAmount = d(input.amount);
      const currentPaid = d(bill.amountPaid);
      const totalAmount = d(bill.amount);
      const newPaid = currentPaid.plus(paymentAmount);
      const newBalance = d(Math.max(0, totalAmount.minus(currentPaid).minus(paymentAmount).toNumber()));
      const status = newBalance.lte(0) ? "paid" as const : "partial" as const;

      let paymentId: number;

      await db.transaction(async (tx) => {
        await tx.update(bills).set({ amountPaid: newPaid.toFixed(2), balanceDue: newBalance.toFixed(2), status }).where(eq(bills.id, input.billId));

        const [result] = await tx.insert(billPayments).values({
          billId: input.billId, paymentMethod: input.paymentMethod,
          amount: input.amount, paymentDate: new Date(input.paymentDate),
          reference: input.reference, notes: input.notes,
          accountId: input.accountId, enteredBy,
        } as any).returning();
        paymentId = result.id;

        if (bill.supplierId) {
          const sup = await tx.select().from(suppliers).where(eq(suppliers.id, bill.supplierId)).limit(1);
          if (sup[0]) {
            const newPaidSup = d(sup[0].totalPaid).plus(paymentAmount);
            const newBalSup = d(Math.max(0, d(sup[0].currentBalance).minus(paymentAmount).toNumber()));
            await tx.update(suppliers).set({ totalPaid: newPaidSup.toFixed(2), currentBalance: newBalSup.toFixed(2) }).where(eq(suppliers.id, bill.supplierId));
          }
        }

        if (input.accountId) {
          const acct = await tx.select().from(accounts).where(eq(accounts.id, input.accountId)).limit(1);
          if (acct[0]) {
            const newBal = d(acct[0].currentBalance).minus(paymentAmount);
            await tx.insert(ledgerEntries).values({
              accountId: input.accountId, transactionType: "bill_payment",
              transactionId: paymentId, entryType: "debit",
              amount: input.amount, balanceAfter: newBal.toFixed(2),
              entryDate: new Date(input.paymentDate), createdBy: enteredBy,
              refNo: bill[0].billNumber ?? `BILL-${String(bill[0].id).padStart(4, "0")}`,
            } as any).returning();
            await tx.update(accounts).set({ currentBalance: newBal.toFixed(2) }).where(eq(accounts.id, input.accountId));
          }
        }
      });

      return { id: paymentId, newBalanceDue: newBalance.toFixed(2), status, success: true };
    }),

  delete: billCreate
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, bills, input.id);
      await db.update(bills).set({ deletedAt: new Date() }).where(eq(bills.id, input.id));
      return { success: true };
    }),

  getItems: billQuery
    .input(z.object({ billId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, bills, input.billId);
      return db.select().from(billItems).where(and(eq(billItems.billId, input.billId), isNull(billItems.deletedAt)));
    }),

  addItem: billCreate
    .input(z.object({ billId: z.number(), itemName: z.string().min(1), quantity: z.string(), unitPrice: z.string(), totalPrice: z.string(), categoryId: z.number().optional(), notes: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, bills, input.billId);
      const [result] = await db.insert(billItems).values({
        billId: input.billId, itemName: input.itemName,
        quantity: input.quantity, unitPrice: input.unitPrice,
        totalPrice: input.totalPrice, categoryId: input.categoryId, notes: input.notes,
      } as any).returning();

      const existing = await db.select().from(masterItems).where(eq(masterItems.name, input.itemName)).limit(1);
      if (existing.length > 0) {
        await db.update(masterItems).set({
          lastUnitPrice: input.unitPrice, lastCategoryId: input.categoryId,
          usageCount: (existing[0].usageCount || 0) + 1,
        }).where(eq(masterItems.id, existing[0].id));
      } else {
        await db.insert(masterItems).values({
          name: input.itemName, lastUnitPrice: input.unitPrice,
          lastCategoryId: input.categoryId, usageCount: 1,
        } as any).returning();
      }
      return { id: result.id, success: true };
    }),

  deleteItem: billCreate
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const items = await db.select().from(billItems).where(eq(billItems.id, input.id)).limit(1);
      if (items.length > 0) {
        await requireAuthorizedEntity(ctx, bills, Number(items[0].billId));
      }
      await db.update(billItems).set({ deletedAt: new Date() }).where(eq(billItems.id, input.id));
      return { success: true };
    }),

  searchMasterItems: billQuery
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(masterItems).where(
        and(sql`LOWER(${masterItems.name}) LIKE LOWER(${"%" + input.query + "%"})`, isNull(masterItems.deletedAt))
      ).orderBy(desc(masterItems.usageCount)).limit(10);
    }),

  getMasterItem: billQuery
    .input(z.object({ name: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = getDb();
      const items = await db.select().from(masterItems).where(
        and(eq(masterItems.name, input.name), isNull(masterItems.deletedAt))
      ).limit(1);
      return items[0] ?? null;
    }),

  listRecurring: billQuery
    .input(z.object({ locationId: z.number().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [isNull(recurringBillTemplates.deletedAt), eq(recurringBillTemplates.isActive, true)];
      if (input?.locationId) {
        await requireAuthorizedLocation(ctx, input.locationId);
        conditions.push(eq(recurringBillTemplates.locationId, input.locationId));
      } else {
        const locIds = await getCurrentBusinessLocationIds(ctx);
        if (locIds.length === 0) return [];
        conditions.push(sql`${recurringBillTemplates.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`);
      }
      return db.select().from(recurringBillTemplates).where(and(...conditions)).orderBy(recurringBillTemplates.nextDueDate);
    }),

  createRecurring: billCreate
    .input(z.object({
      locationId: z.number(), supplierId: z.number().optional(),
      description: z.string().min(1), amount: z.string(),
      frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "annually"]),
      dayOfWeek: z.number().min(0).max(6).optional(),
      dayOfMonth: z.number().min(1).max(31).optional(),
      nextDueDate: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedLocation(ctx, input.locationId);
      const [result] = await db.insert(recurringBillTemplates).values({
        locationId: input.locationId, supplierId: input.supplierId,
        description: input.description, amount: input.amount,
        frequency: input.frequency, dayOfWeek: input.dayOfWeek,
        dayOfMonth: input.dayOfMonth, nextDueDate: new Date(input.nextDueDate), isActive: true,
      } as any).returning();
      return { id: result.id, success: true };
    }),

  generateRecurring: billCreate
    .input(z.object({ templateId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const t = await requireAuthorizedEntity(ctx, recurringBillTemplates, input.templateId);

      let billId: number;

      await db.transaction(async (tx) => {
        const loc = await tx.select().from(locations).where(eq(locations.id, t.locationId)).limit(1);
        const nextNum = loc[0]?.nextBillNumber ?? 1;
        const billNumber = `BILL-${String(nextNum).padStart(4, "0")}`;
        await tx.update(locations).set({ nextBillNumber: nextNum + 1 }).where(eq(locations.id, t.locationId));

        const [result] = await tx.insert(bills).values({
          locationId: t.locationId, supplierId: t.supplierId,
          billNumber, description: t.description, amount: t.amount, balanceDue: t.amount,
          issueDate: new Date(), dueDate: t.nextDueDate,
        } as any).returning();
        billId = result.id;

        const nextDue = new Date(t.nextDueDate);
        switch (t.frequency) {
          case "daily": nextDue.setDate(nextDue.getDate() + 1); break;
          case "weekly": nextDue.setDate(nextDue.getDate() + 7); break;
          case "monthly": nextDue.setMonth(nextDue.getMonth() + 1); break;
          case "quarterly": nextDue.setMonth(nextDue.getMonth() + 3); break;
          case "annually": nextDue.setFullYear(nextDue.getFullYear() + 1); break;
        }
        await tx.update(recurringBillTemplates).set({ nextDueDate: nextDue }).where(eq(recurringBillTemplates.id, input.templateId));

        if (t.supplierId) {
          const sup = await tx.select().from(suppliers).where(eq(suppliers.id, t.supplierId)).limit(1);
          if (sup[0]) {
            const newBal = d(sup[0].currentBalance).plus(d(t.amount));
            const newBilled = d(sup[0].totalBilled).plus(d(t.amount));
            await tx.update(suppliers).set({ currentBalance: newBal.toFixed(2), totalBilled: newBilled.toFixed(2) }).where(eq(suppliers.id, t.supplierId));
          }
        }
      });

      return { billId, nextDueDate: new Date().toISOString().split("T")[0], success: true };
    }),

  deleteRecurring: billCreate
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, recurringBillTemplates, input.id);
      await db.update(recurringBillTemplates).set({ deletedAt: new Date(), isActive: false }).where(eq(recurringBillTemplates.id, input.id));
      return { success: true };
    }),

  batchPay: billPay
    .input(batchBillPaymentInputSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const enteredBy = (ctx as any).user?.id ?? 1;
      const results: { billId: number; amount: string; status: string }[] = [];

      const acct = await requireAuthorizedEntity(ctx, accounts, input.accountId);

      // Verify all bills belong to the account's location before doing anything
      for (const billId of input.billIds) {
        const bill = await requireAuthorizedEntity(ctx, bills, billId);
        if (bill.locationId !== acct.locationId) {
          throw new Error(`Bill ${billId} belongs to a different location than the selected account`);
        }
      }

      let runningBalance = d(acct.currentBalance);

      await db.transaction(async (tx) => {
        for (const billId of input.billIds) {
          const bill = await tx.select().from(bills).where(eq(bills.id, billId)).limit(1);
          if (!bill[0]) continue;
          const paymentAmount = d(bill[0].balanceDue);
          if (paymentAmount.lte(0)) continue;

          const currentPaid = d(bill[0].amountPaid);
          const totalAmount = d(bill[0].amount);
          const newPaid = currentPaid.plus(paymentAmount);
          const newBalance = d(Math.max(0, totalAmount.minus(currentPaid).minus(paymentAmount).toNumber()));
          const status = newBalance.lte(0) ? "paid" : "partial";

          await tx.update(bills).set({ amountPaid: newPaid.toFixed(2), balanceDue: newBalance.toFixed(2), status }).where(eq(bills.id, billId));

          const [payResult] = await tx.insert(billPayments).values({
            billId, paymentMethod: input.paymentMethod,
            amount: paymentAmount.toFixed(2), paymentDate: new Date(input.paymentDate),
            reference: input.reference, accountId: input.accountId, enteredBy,
          } as any).returning();

          if (bill[0].supplierId) {
            const sup = await tx.select().from(suppliers).where(eq(suppliers.id, bill[0].supplierId)).limit(1);
            if (sup[0]) {
              const newPaidSup = d(sup[0].totalPaid).plus(paymentAmount);
              const newBalSup = d(Math.max(0, d(sup[0].currentBalance).minus(paymentAmount).toNumber()));
              await tx.update(suppliers).set({ totalPaid: newPaidSup.toFixed(2), currentBalance: newBalSup.toFixed(2) }).where(eq(suppliers.id, bill[0].supplierId));
            }
          }

          runningBalance = runningBalance.minus(paymentAmount);
          await tx.insert(ledgerEntries).values({
            accountId: input.accountId, transactionType: "bill_payment",
            transactionId: payResult.id, entryType: "debit",
            amount: paymentAmount.toFixed(2), balanceAfter: runningBalance.toFixed(2),
            entryDate: new Date(input.paymentDate), createdBy: enteredBy,
            refNo: bill[0].billNumber ?? `BILL-${String(bill[0].id).padStart(4, "0")}`,
          } as any).returning();

          results.push({ billId, amount: paymentAmount.toFixed(2), status });
        }

        await tx.update(accounts).set({ currentBalance: runningBalance.toFixed(2) }).where(eq(accounts.id, input.accountId));
      });

      return { results, success: true };
    }),

  getAttachments: billQuery
    .input(z.object({ recordId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(attachments).where(
        and(eq(attachments.recordType, "bill"), eq(attachments.recordId, input.recordId))
      ).orderBy(desc(attachments.createdAt));
    }),

  addAttachment: billCreate
    .input(z.object({ recordId: z.number(), imageData: z.string(), mimeType: z.string().default("image/jpeg"), caption: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(attachments).values({
        recordType: "bill", recordId: input.recordId,
        imageData: input.imageData, mimeType: input.mimeType, caption: input.caption,
      } as any).returning();
      return { id: result.id, success: true };
    }),

  deleteAttachment: billCreate
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(attachments).where(eq(attachments.id, input.id));
      return { success: true };
    }),
});
