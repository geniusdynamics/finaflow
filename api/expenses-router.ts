import { z } from "zod";
import { createRouter, expenseQuery, expenseCreate, expenseManage, getCurrentBusinessLocationIds } from "./middleware";
import { getDb } from "./queries/connection";
import { expenses, expenseCategories, accounts, ledgerEntries, suppliers, bills, attachments, locations } from "@db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { d } from "./lib/decimal";

export const expensesRouter = createRouter({
  categories: expenseQuery.query(async () => {
    const db = getDb();
    return db.select().from(expenseCategories)
      .where(isNull(expenseCategories.deletedAt))
      .orderBy(expenseCategories.name);
  }),

  createCategory: expenseCreate
    .input(z.object({ name: z.string().min(1).max(100), description: z.string().optional(), color: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(expenseCategories).values({
        name: input.name, description: input.description, color: input.color ?? "#C73E1D",
      });
      return { id: Number(result.insertId), success: true };
    }),

  updateCategory: expenseManage
    .input(z.object({ id: z.number(), name: z.string().min(1).max(100).optional(), description: z.string().optional(), color: z.string().optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      await db.update(expenseCategories).set(updates).where(eq(expenseCategories.id, id));
      return { success: true };
    }),

  deleteCategory: expenseManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(expenseCategories).set({ deletedAt: new Date() }).where(eq(expenseCategories.id, input.id));
      return { success: true };
    }),

  list: expenseQuery
    .input(z.object({ locationId: z.number().optional(), categoryId: z.number().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional(), page: z.number().default(1), pageSize: z.number().default(50) }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [isNull(expenses.deletedAt)];
      if (input?.locationId) {
        conditions.push(eq(expenses.locationId, input.locationId));
      } else {
        const locIds = await getCurrentBusinessLocationIds(ctx);
        if (locIds.length === 0) return [];
        conditions.push(sql`${expenses.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`);
      }
      if (input?.categoryId) conditions.push(eq(expenses.categoryId, input.categoryId));
      if (input?.dateFrom && input?.dateTo) conditions.push(sql`${expenses.expenseDate} BETWEEN ${input.dateFrom} AND ${input.dateTo}`);
      const offset = (input.page - 1) * input.pageSize;
      return db.select().from(expenses).where(and(...conditions)).orderBy(desc(expenses.expenseDate)).limit(input.pageSize).offset(offset);
    }),

  create: expenseCreate
    .input(z.object({
      locationId: z.number(), categoryId: z.number(), supplierId: z.number().optional(),
      amount: z.string(), description: z.string().min(1), expenseDate: z.string(),
      paymentMethod: z.enum(["cash", "mpesa", "bank_transfer", "card"]),
      accountId: z.number().optional(), receiptImageUrl: z.string().optional(),
      mpesaTxnId: z.string().optional(), isReimbursable: z.boolean().default(false),
      reimbursedTo: z.number().optional(), billId: z.number().optional(),
      attachments: z.array(z.object({ imageData: z.string(), mimeType: z.string().default("image/jpeg"), caption: z.string().optional() })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = (ctx as any).user?.id ?? 1;

      const loc = await db.select().from(locations).where(eq(locations.id, input.locationId)).limit(1);
      const nextNum = loc[0]?.nextExpenseNumber ?? 1;
      const expenseNumber = `EXP-${String(nextNum).padStart(4, "0")}`;

      let expenseId: number;
      let accountId = input.accountId;

      await db.transaction(async (tx) => {
        await tx.update(locations).set({ nextExpenseNumber: nextNum + 1 }).where(eq(locations.id, input.locationId));

        if (input.supplierId) {
          const sup = await tx.select().from(suppliers).where(eq(suppliers.id, input.supplierId)).limit(1);
          if (sup[0]) {
            const supplierBills = await tx.select().from(bills).where(
              and(eq(bills.supplierId, input.supplierId), isNull(bills.deletedAt), sql`${bills.balanceDue} > 0`)
            );
            const totalBillDebt = supplierBills.reduce((sum, b) => sum.plus(d(b.balanceDue)), d(0));
            if (supplierBills.length > 0 && d(sup[0].currentBalance).lte(totalBillDebt)) {
              throw new Error(
                `This supplier has Ksh${totalBillDebt.toFixed(2)} in outstanding bills. ` +
                `Please go to Bills and clear the bill first before recording a direct expense.`
              );
            }
          }
        }

        if (!accountId) {
          const typeMap: Record<string, string> = { cash: "cash", mpesa: "mpesa", bank_transfer: "bank_account", card: "bank_account" };
          const accts = await tx.select().from(accounts).where(
            and(eq(accounts.locationId, input.locationId), eq(accounts.type, typeMap[input.paymentMethod] as any), isNull(accounts.deletedAt))
          ).limit(1);
          if (accts[0]) accountId = accts[0].id;
        }

        const [result] = await tx.insert(expenses).values({
          locationId: input.locationId, categoryId: input.categoryId, supplierId: input.supplierId,
          expenseNumber, amount: input.amount, description: input.description,
          expenseDate: new Date(input.expenseDate), paymentMethod: input.paymentMethod,
          accountId, billId: input.billId, receiptImageUrl: input.receiptImageUrl,
          mpesaTxnId: input.mpesaTxnId, isReimbursable: input.isReimbursable,
          reimbursedTo: input.reimbursedTo, enteredBy: userId,
        } as any);
        expenseId = Number(result.insertId);

        if (input.attachments && input.attachments.length > 0) {
          for (const att of input.attachments) {
            await tx.insert(attachments).values({
              recordType: "expense", recordId: expenseId,
              imageData: att.imageData, mimeType: att.mimeType, caption: att.caption,
            } as any);
          }
        }

        if (accountId) {
          const acct = await tx.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
          if (acct[0]) {
            const newBal = d(acct[0].currentBalance).minus(d(input.amount));
            await tx.insert(ledgerEntries).values({
              accountId, transactionType: "expense", transactionId: expenseId,
              entryType: "debit", amount: input.amount, balanceAfter: newBal.toFixed(2),
              entryDate: new Date(input.expenseDate), createdBy: userId, refNo: expenseNumber,
            } as any);
            await tx.update(accounts).set({ currentBalance: newBal.toFixed(2) }).where(eq(accounts.id, accountId));
          }
        }

        if (input.supplierId) {
          const sup = await tx.select().from(suppliers).where(eq(suppliers.id, input.supplierId)).limit(1);
          if (sup[0]) {
            const newPaid = d(sup[0].totalPaid).plus(d(input.amount));
            const newBal = d(sup[0].currentBalance).minus(d(input.amount));
            await tx.update(suppliers).set({ totalPaid: newPaid.toFixed(2), currentBalance: newBal.toFixed(2) }).where(eq(suppliers.id, input.supplierId));
          }
        }

        if (input.billId) {
          const bill = await tx.select().from(bills).where(eq(bills.id, input.billId)).limit(1);
          if (bill[0]) {
            const currentPaid = d(bill[0].amountPaid);
            const paymentAmount = d(input.amount);
            const totalAmount = d(bill[0].amount);
            const newPaid = currentPaid.plus(paymentAmount);
            const newBalance = d(Math.max(0, totalAmount.minus(currentPaid).minus(paymentAmount).toNumber()));
            const newStatus = newBalance.lte(0) ? "paid" : (newPaid.gt(0) ? "partial" : "pending");
            await tx.update(bills).set({ amountPaid: newPaid.toFixed(2), balanceDue: newBalance.toFixed(2), status: newStatus }).where(eq(bills.id, input.billId));
          }
        }
      });

      return { id: expenseId, expenseNumber, success: true };
    }),

  update: expenseCreate
    .input(z.object({ id: z.number(), categoryId: z.number().optional(), amount: z.string().optional(), description: z.string().optional(), expenseDate: z.string().optional(), paymentMethod: z.enum(["cash", "mpesa", "bank_transfer", "card"]).optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...rawUpdates } = input;
      const updates: any = { ...rawUpdates };
      if (rawUpdates.expenseDate) updates.expenseDate = new Date(rawUpdates.expenseDate);
      await db.update(expenses).set(updates).where(eq(expenses.id, id));
      return { success: true };
    }),

  delete: expenseManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(expenses).set({ deletedAt: new Date() }).where(eq(expenses.id, input.id));
      return { success: true };
    }),

  getAttachments: expenseQuery
    .input(z.object({ recordId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(attachments).where(
        and(eq(attachments.recordType, "expense"), eq(attachments.recordId, input.recordId))
      ).orderBy(desc(attachments.createdAt));
    }),

  addAttachment: expenseCreate
    .input(z.object({ recordId: z.number(), imageData: z.string(), mimeType: z.string().default("image/jpeg"), caption: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(attachments).values({
        recordType: "expense", recordId: input.recordId,
        imageData: input.imageData, mimeType: input.mimeType, caption: input.caption,
      } as any);
      return { id: Number(result.insertId), success: true };
    }),

  deleteAttachment: expenseManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(attachments).where(eq(attachments.id, input.id));
      return { success: true };
    }),
});
