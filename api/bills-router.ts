import { z } from "zod";
import { createRouter, billQuery, billCreate, billPay, getCurrentBusinessLocationIds } from "./middleware";
import { getDb } from "./queries/connection";
import { bills, billPayments, billItems, masterItems, suppliers, accounts, ledgerEntries, recurringBillTemplates, attachments, locations } from "@db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";

export const billsRouter = createRouter({
  list: billQuery
    .input(z.object({
      locationId: z.number().optional(), status: z.enum(["pending", "partial", "paid", "overdue", "cancelled"]).optional(),
      supplierId: z.number().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [isNull(bills.deletedAt)];
      if (input?.locationId) {
        conditions.push(eq(bills.locationId, input.locationId));
      } else {
        const locIds = await getCurrentBusinessLocationIds(ctx);
        if (locIds.length === 0) return [];
        conditions.push(sql`${bills.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`);
      }
      if (input?.status) conditions.push(eq(bills.status, input.status));
      if (input?.supplierId) conditions.push(eq(bills.supplierId, input.supplierId));
      return db.select().from(bills).where(and(...conditions)).orderBy(desc(bills.dueDate)).limit(200);
    }),

  create: billCreate
    .input(z.object({
      locationId: z.number(), supplierId: z.number().optional(),
      billNumber: z.string().optional(), description: z.string().min(1),
      amount: z.string(), issueDate: z.string(), dueDate: z.string(),
      attachments: z.array(z.object({ imageData: z.string(), mimeType: z.string().default("image/jpeg"), caption: z.string().optional() })).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

      // Auto-generate bill number if not provided
      let billNumber = input.billNumber;
      if (!billNumber) {
        const loc = await db.select().from(locations).where(eq(locations.id, input.locationId)).limit(1);
        const nextNum = loc[0]?.nextBillNumber ?? 1;
        billNumber = `BILL-${String(nextNum).padStart(4, "0")}`;
        // Increment counter
        await db.update(locations).set({ nextBillNumber: nextNum + 1 }).where(eq(locations.id, input.locationId));
      }

      const [result] = await db.insert(bills).values({
        locationId: input.locationId, supplierId: input.supplierId,
        billNumber, description: input.description,
        amount: input.amount, balanceDue: input.amount,
        issueDate: new Date(input.issueDate), dueDate: new Date(input.dueDate),
      } as any);
      const billId = Number(result.insertId);

      if (input.attachments && input.attachments.length > 0) {
        for (const att of input.attachments) {
          await db.insert(attachments).values({
            recordType: "bill",
            recordId: billId,
            imageData: att.imageData,
            mimeType: att.mimeType,
            caption: att.caption,
          } as any);
        }
      }

      if (input.supplierId) {
        const sup = await db.select().from(suppliers).where(eq(suppliers.id, input.supplierId)).limit(1);
        if (sup[0]) {
          const newBal = (parseFloat(sup[0].currentBalance) + parseFloat(input.amount)).toFixed(2);
          const newBilled = (parseFloat(sup[0].totalBilled) + parseFloat(input.amount)).toFixed(2);
          await db.update(suppliers).set({ currentBalance: newBal, totalBilled: newBilled }).where(eq(suppliers.id, input.supplierId));
        }
      }
      return { id: billId, billNumber, success: true };
    }),

  recordPayment: billPay
    .input(z.object({
      billId: z.number(), paymentMethod: z.enum(["cash", "mpesa", "bank_transfer", "card"]),
      amount: z.string(), paymentDate: z.string(), reference: z.string().optional(),
      notes: z.string().optional(), accountId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const enteredBy = (ctx as any).user?.id ?? 1;

      const bill = await db.select().from(bills).where(eq(bills.id, input.billId)).limit(1);
      if (!bill[0]) throw new Error("Bill not found");

      const paymentAmount = parseFloat(input.amount);
      const currentPaid = parseFloat(bill[0].amountPaid);
      const totalAmount = parseFloat(bill[0].amount);
      const newPaid = (currentPaid + paymentAmount).toFixed(2);
      const newBalance = Math.max(0, totalAmount - currentPaid - paymentAmount).toFixed(2);

      let status: "partial" | "paid" = "partial";
      if (parseFloat(newBalance) <= 0) status = "paid";

      await db.update(bills).set({ amountPaid: newPaid, balanceDue: newBalance, status }).where(eq(bills.id, input.billId));

      const [result] = await db.insert(billPayments).values({
        billId: input.billId, paymentMethod: input.paymentMethod,
        amount: input.amount, paymentDate: new Date(input.paymentDate),
        reference: input.reference, notes: input.notes,
        accountId: input.accountId, enteredBy,
      } as any);

      // Update supplier
      if (bill[0].supplierId) {
        const sup = await db.select().from(suppliers).where(eq(suppliers.id, bill[0].supplierId)).limit(1);
        if (sup[0]) {
          const newPaidSup = (parseFloat(sup[0].totalPaid) + paymentAmount).toFixed(2);
          const newBalSup = Math.max(0, parseFloat(sup[0].currentBalance) - paymentAmount).toFixed(2);
          await db.update(suppliers).set({ totalPaid: newPaidSup, currentBalance: newBalSup }).where(eq(suppliers.id, bill[0].supplierId));
        }
      }

      // Ledger
      if (input.accountId) {
        const acct = await db.select().from(accounts).where(eq(accounts.id, input.accountId)).limit(1);
        if (acct[0]) {
          const newBal = (parseFloat(acct[0].currentBalance) - paymentAmount).toFixed(2);
          await db.insert(ledgerEntries).values({
            accountId: input.accountId, transactionType: "bill_payment",
            transactionId: Number(result.insertId), entryType: "debit",
            amount: input.amount, balanceAfter: newBal,
            entryDate: new Date(input.paymentDate), createdBy: enteredBy,
            refNo: bill[0].billNumber ?? `BILL-${String(bill[0].id).padStart(4, "0")}`,
          } as any);
          await db.update(accounts).set({ currentBalance: newBal }).where(eq(accounts.id, input.accountId));
        }
      }

      return { id: Number(result.insertId), newBalanceDue: newBalance, status, success: true };
    }),

  delete: billCreate
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(bills).set({ deletedAt: new Date() }).where(eq(bills.id, input.id));
      return { success: true };
    }),

  // Bill Items
  getItems: billQuery
    .input(z.object({ billId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(billItems).where(
        and(eq(billItems.billId, input.billId), isNull(billItems.deletedAt))
      );
    }),

  addItem: billCreate
    .input(z.object({
      billId: z.number(), itemName: z.string().min(1),
      quantity: z.string(), unitPrice: z.string(),
      totalPrice: z.string(), categoryId: z.number().optional(), notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(billItems).values({
        billId: input.billId, itemName: input.itemName,
        quantity: input.quantity, unitPrice: input.unitPrice,
        totalPrice: input.totalPrice, categoryId: input.categoryId, notes: input.notes,
      } as any);

      // Upsert master item for autocomplete and price memory
      const existing = await db.select().from(masterItems).where(eq(masterItems.name, input.itemName)).limit(1);
      if (existing.length > 0) {
        await db.update(masterItems).set({
          lastUnitPrice: input.unitPrice,
          lastCategoryId: input.categoryId,
          usageCount: (existing[0].usageCount || 0) + 1,
        }).where(eq(masterItems.id, existing[0].id));
      } else {
        await db.insert(masterItems).values({
          name: input.itemName,
          lastUnitPrice: input.unitPrice,
          lastCategoryId: input.categoryId,
          usageCount: 1,
        } as any);
      }

      return { id: Number(result.insertId), success: true };
    }),

  deleteItem: billCreate
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(billItems).set({ deletedAt: new Date() }).where(eq(billItems.id, input.id));
      return { success: true };
    }),

  // Master Items (for autocomplete + price memory)
  searchMasterItems: billQuery
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(masterItems).where(
        and(
          sql`LOWER(${masterItems.name}) LIKE LOWER(${"%" + input.query + "%"})`,
          isNull(masterItems.deletedAt)
        )
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

  // Recurring Bills
  listRecurring: billQuery
    .input(z.object({ locationId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [isNull(recurringBillTemplates.deletedAt), eq(recurringBillTemplates.isActive, true)];
      if (input?.locationId) conditions.push(eq(recurringBillTemplates.locationId, input.locationId));
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
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(recurringBillTemplates).values({
        locationId: input.locationId, supplierId: input.supplierId,
        description: input.description, amount: input.amount,
        frequency: input.frequency, dayOfWeek: input.dayOfWeek,
        dayOfMonth: input.dayOfMonth, nextDueDate: new Date(input.nextDueDate), isActive: true,
      } as any);
      return { id: Number(result.insertId), success: true };
    }),

  generateRecurring: billCreate
    .input(z.object({ templateId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const template = await db.select().from(recurringBillTemplates).where(eq(recurringBillTemplates.id, input.templateId)).limit(1);
      if (!template[0]) throw new Error("Template not found");
      const t = template[0];

      // Auto-generate bill number
      const loc = await db.select().from(locations).where(eq(locations.id, t.locationId)).limit(1);
      const nextNum = loc[0]?.nextBillNumber ?? 1;
      const billNumber = `BILL-${String(nextNum).padStart(4, "0")}`;
      await db.update(locations).set({ nextBillNumber: nextNum + 1 }).where(eq(locations.id, t.locationId));

      const [result] = await db.insert(bills).values({
        locationId: t.locationId, supplierId: t.supplierId,
        billNumber, description: t.description, amount: t.amount, balanceDue: t.amount,
        issueDate: new Date(), dueDate: t.nextDueDate,
      } as any);

      // Advance next due date
      const nextDue = new Date(t.nextDueDate);
      switch (t.frequency) {
        case "daily": nextDue.setDate(nextDue.getDate() + 1); break;
        case "weekly": nextDue.setDate(nextDue.getDate() + 7); break;
        case "monthly": nextDue.setMonth(nextDue.getMonth() + 1); break;
        case "quarterly": nextDue.setMonth(nextDue.getMonth() + 3); break;
        case "annually": nextDue.setFullYear(nextDue.getFullYear() + 1); break;
      }
      await db.update(recurringBillTemplates).set({ nextDueDate: nextDue }).where(eq(recurringBillTemplates.id, input.templateId));

      // Update supplier balance
      if (t.supplierId) {
        const sup = await db.select().from(suppliers).where(eq(suppliers.id, t.supplierId)).limit(1);
        if (sup[0]) {
          const newBal = (parseFloat(sup[0].currentBalance) + parseFloat(t.amount)).toFixed(2);
          const newBilled = (parseFloat(sup[0].totalBilled) + parseFloat(t.amount)).toFixed(2);
          await db.update(suppliers).set({ currentBalance: newBal, totalBilled: newBilled }).where(eq(suppliers.id, t.supplierId));
        }
      }
      return { billId: Number(result.insertId), nextDueDate: nextDue.toISOString().split("T")[0], success: true };
    }),

  deleteRecurring: billCreate
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(recurringBillTemplates).set({ deletedAt: new Date(), isActive: false }).where(eq(recurringBillTemplates.id, input.id));
      return { success: true };
    }),

  // Batch pay multiple bills (for daily payments cross-link)
  batchPay: billPay
    .input(z.object({
      billIds: z.array(z.number()),
      paymentMethod: z.enum(["cash", "mpesa", "bank_transfer", "card"]),
      paymentDate: z.string(),
      accountId: z.number(),
      reference: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const enteredBy = (ctx as any).user?.id ?? 1;
      const results: { billId: number; amount: string; status: string }[] = [];

      const acct = await db.select().from(accounts).where(eq(accounts.id, input.accountId)).limit(1);
      if (!acct[0]) throw new Error("Account not found");
      let runningBalance = parseFloat(acct[0].currentBalance);

      for (const billId of input.billIds) {
        const bill = await db.select().from(bills).where(eq(bills.id, billId)).limit(1);
        if (!bill[0]) continue;
        const paymentAmount = parseFloat(bill[0].balanceDue);
        if (paymentAmount <= 0) continue;

        const currentPaid = parseFloat(bill[0].amountPaid);
        const totalAmount = parseFloat(bill[0].amount);
        const newPaid = (currentPaid + paymentAmount).toFixed(2);
        const newBalance = Math.max(0, totalAmount - currentPaid - paymentAmount).toFixed(2);
        const status = parseFloat(newBalance) <= 0 ? "paid" : "partial";

        await db.update(bills).set({ amountPaid: newPaid, balanceDue: newBalance, status }).where(eq(bills.id, billId));

        const [payResult] = await db.insert(billPayments).values({
          billId, paymentMethod: input.paymentMethod,
          amount: paymentAmount.toFixed(2), paymentDate: new Date(input.paymentDate),
          reference: input.reference, accountId: input.accountId, enteredBy,
        } as any);

        if (bill[0].supplierId) {
          const sup = await db.select().from(suppliers).where(eq(suppliers.id, bill[0].supplierId)).limit(1);
          if (sup[0]) {
            const newPaidSup = (parseFloat(sup[0].totalPaid) + paymentAmount).toFixed(2);
            const newBalSup = Math.max(0, parseFloat(sup[0].currentBalance) - paymentAmount).toFixed(2);
            await db.update(suppliers).set({ totalPaid: newPaidSup, currentBalance: newBalSup }).where(eq(suppliers.id, bill[0].supplierId));
          }
        }

        runningBalance -= paymentAmount;
        await db.insert(ledgerEntries).values({
          accountId: input.accountId, transactionType: "bill_payment",
          transactionId: Number(payResult.insertId), entryType: "debit",
          amount: paymentAmount.toFixed(2), balanceAfter: runningBalance.toFixed(2),
          entryDate: new Date(input.paymentDate), createdBy: enteredBy,
          refNo: bill[0].billNumber ?? `BILL-${String(bill[0].id).padStart(4, "0")}`,
        } as any);

        results.push({ billId, amount: paymentAmount.toFixed(2), status });
      }

      await db.update(accounts).set({ currentBalance: runningBalance.toFixed(2) }).where(eq(accounts.id, input.accountId));
      return { results, success: true };
    }),

  // Attachments
  getAttachments: billQuery
    .input(z.object({ recordId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(attachments).where(
        and(eq(attachments.recordType, "bill"), eq(attachments.recordId, input.recordId))
      ).orderBy(desc(attachments.createdAt));
    }),

  addAttachment: billCreate
    .input(z.object({
      recordId: z.number(),
      imageData: z.string(),
      mimeType: z.string().default("image/jpeg"),
      caption: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(attachments).values({
        recordType: "bill",
        recordId: input.recordId,
        imageData: input.imageData,
        mimeType: input.mimeType,
        caption: input.caption,
      } as any);
      return { id: Number(result.insertId), success: true };
    }),

  deleteAttachment: billCreate
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(attachments).where(eq(attachments.id, input.id));
      return { success: true };
    }),
});
