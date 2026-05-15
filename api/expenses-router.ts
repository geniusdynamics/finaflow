import { z } from "zod";
import { createRouter, expenseQuery, expenseCreate, expenseManage, getCurrentBusinessLocationIds, requireAuthorizedLocation, requireAuthorizedEntity, requireAuthorizedBusinessEntity } from "./middleware";
import { getDb } from "./queries/connection";
import { expenses, expenseCategories, accounts, ledgerEntries, suppliers, bills, attachments, locations, businesses } from "@db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { d } from "./lib/decimal";
import { notFutureDateString, optionalNotFutureDateString } from "./lib/future-date";
import { logAudit } from "./lib/audit";

export const createExpenseInputSchema = z.object({
  locationId: z.number(),
  categoryId: z.number(),
  supplierId: z.number().optional(),
  amount: z.string(),
  description: z.string().min(1),
  expenseDate: notFutureDateString("Expense date"),
  paymentMethod: z.enum(["cash", "mpesa", "bank_transfer", "card"]),
  accountId: z.number().optional(),
  receiptImageUrl: z.string().optional(),
  mpesaTxnId: z.string().optional(),
  isReimbursable: z.boolean().default(false),
  reimbursedTo: z.number().optional(),
  billId: z.number().optional(),
  attachments: z
    .array(
      z.object({
        imageData: z.string(),
        mimeType: z.string().default("image/jpeg"),
        caption: z.string().optional(),
      })
    )
    .optional(),
  isFixedAsset: z.boolean().default(false),
  usefulLifeMonths: z.number().optional(),
  depreciationMethod: z.enum(["straight_line", "declining_balance"]).optional(),
  salvageValue: z.string().optional(),
  assetAccountId: z.number().optional(),
});

export const updateExpenseInputSchema = z.object({
  id: z.number(),
  categoryId: z.number().optional(),
  amount: z.string().optional(),
  description: z.string().optional(),
  expenseDate: optionalNotFutureDateString("Expense date"),
  paymentMethod: z.enum(["cash", "mpesa", "bank_transfer", "card"]).optional(),
});

export const expensesRouter = createRouter({
  categories: expenseQuery.query(async ({ ctx }) => {
    const db = getDb();
    const businessId = (ctx as any).user?.currentBusiness?.id ?? (ctx as any).user?.currentBusinessId;
    if (!businessId) return [];
    return db.select().from(expenseCategories)
      .where(and(
        isNull(expenseCategories.deletedAt),
        sql`((${isNull(expenseCategories.businessId)}) OR (${eq(expenseCategories.businessId, businessId)}))`
      ))
      .orderBy(expenseCategories.name);
  }),

  createCategory: expenseCreate
    .input(z.object({ 
      name: z.string().min(1).max(100), 
      description: z.string().optional(), 
      color: z.string().optional(),
      accountingClass: z.enum(["cogs", "operating_expense", "admin_expense", "marketing", "depreciation", "other"]).optional(),
      defaultAccountId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = (ctx as any).user?.id ?? 1;
      const account = await db.query.accounts.findFirst({
        where: and(
          eq(accounts.id, input.defaultAccountId),
          eq(accounts.accountType, "expense" as any),
          isNull(accounts.deletedAt)
        ),
      });
      if (!account) {
        throw new Error("Default account must be a valid chart of accounts expense entry");
      }
      const [result] = await db.insert(expenseCategories).values({
        name: input.name, 
        description: input.description, 
        color: input.color ?? "#C73E1D",
        accountingClass: (input.accountingClass || "operating_expense") as any,
        defaultAccountId: input.defaultAccountId,
      }).returning();
      
      await logAudit({
        userId,
        action: "CREATE",
        resource: "expense_categories",
        resourceId: result.id,
        details: {
          name: input.name,
          defaultAccountId: input.defaultAccountId,
        },
      });
      
      return { id: result.id, success: true };
    }),

  updateCategory: expenseManage
    .input(z.object({ 
      id: z.number(), 
      name: z.string().min(1).max(100).optional(), 
      description: z.string().optional(), 
      color: z.string().optional(), 
      isActive: z.boolean().optional(),
      accountingClass: z.enum(["cogs", "operating_expense", "admin_expense", "marketing", "depreciation", "other"]).optional(),
      defaultAccountId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = (ctx as any).user?.id ?? 1;
      const { id, ...updates } = input;
      
      const existing = await db.select().from(expenseCategories).where(
        and(eq(expenseCategories.id, id), isNull(expenseCategories.deletedAt))
      ).limit(1);
      
      const auditDetails: Record<string, any> = {};
      if (updates.accountingClass && updates.accountingClass !== existing[0]?.accountingClass) {
        auditDetails.accountingClassChange = {
          from: existing[0]?.accountingClass,
          to: updates.accountingClass,
        };
      }
      if (updates.defaultAccountId && updates.defaultAccountId !== existing[0]?.defaultAccountId) {
        auditDetails.defaultAccountIdChange = {
          from: existing[0]?.defaultAccountId,
          to: updates.defaultAccountId,
        };
      }
      
      await db.update(expenseCategories).set(updates as any).where(eq(expenseCategories.id, id));
      
      if (Object.keys(auditDetails).length > 0) {
        await logAudit({
          userId,
          action: "UPDATE",
          resource: "expense_categories",
          resourceId: id,
          details: auditDetails,
        });
      }
      
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
    .input(z.object({ locationId: z.number().optional(), categoryId: z.number().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional(), page: z.number().default(1), pageSize: z.number().default(50) }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [isNull(expenses.deletedAt)];
      if (input?.locationId) {
        await requireAuthorizedLocation(ctx, input.locationId);
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
    .input(createExpenseInputSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = (ctx as any).user?.id ?? 1;

      await requireAuthorizedLocation(ctx, input.locationId);
      
      if (input.accountId) {
        const acct = await requireAuthorizedEntity(ctx, accounts, input.accountId);
        if (acct.locationId !== input.locationId) throw new Error("Account does not belong to the selected location");
      }
      
      if (input.supplierId) {
        await requireAuthorizedBusinessEntity(ctx, suppliers, input.supplierId);
      }

      const loc = await db.select().from(locations).where(eq(locations.id, input.locationId)).limit(1);
      const business = await db.select().from(businesses).where(eq(businesses.id, loc[0]?.businessId)).limit(1);
      const nextNum = loc[0]?.nextExpenseNumber ?? 1;
      const expenseNumber = `EXP-${String(nextNum).padStart(4, "0")}`;

      let expenseId = 0;
      let accountId = input.accountId;
      let fixedAssetItemId: number | undefined;

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
          const typeMap: Record<string, string> = { cash: "cash", mpesa: "cash", bank_transfer: "bank", card: "bank" };
          const accts = await tx.select().from(accounts).where(
            and(eq(accounts.locationId, input.locationId), eq(accounts.type, typeMap[input.paymentMethod] as any), isNull(accounts.deletedAt))
          ).limit(1);
          if (accts[0]) accountId = accts[0].id;
        }

        const [result] = await tx.insert(expenses).values({
          locationId: input.locationId, 
          businessId: business[0]?.id,
          categoryId: input.categoryId, 
          supplierId: input.supplierId,
          expenseNumber, 
          amount: input.amount, 
          description: input.description,
          expenseDate: new Date(input.expenseDate), 
          paymentMethod: input.paymentMethod,
          accountId, 
          billId: input.billId, 
          receiptImageUrl: input.receiptImageUrl,
          mpesaTxnId: input.mpesaTxnId, 
          isReimbursable: input.isReimbursable,
          reimbursedTo: input.reimbursedTo, 
          enteredBy: userId,
          isFixedAsset: input.isFixedAsset,
          usefulLifeMonths: input.usefulLifeMonths,
          depreciationMethod: input.depreciationMethod,
          salvageValue: input.salvageValue,
        } as any).returning();
        expenseId = result.id;

        if (input.attachments && input.attachments.length > 0) {
          for (const att of input.attachments) {
            await tx.insert(attachments).values({
              recordType: "expense", recordId: expenseId,
              imageData: att.imageData, mimeType: att.mimeType, caption: att.caption,
            } as any).returning();
          }
        }

        if (accountId) {
          const cashAcct = await tx.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
          if (cashAcct[0]) {
            const cashNewBal = d(cashAcct[0].currentBalance).minus(d(input.amount));
            await tx.insert(ledgerEntries).values({
              accountId, transactionType: "expense", transactionId: expenseId,
              entryType: "credit", amount: input.amount, balanceAfter: cashNewBal.toFixed(2),
              entryDate: new Date(input.expenseDate), createdBy: userId, refNo: expenseNumber,
            } as any).returning();
            await tx.update(accounts).set({ currentBalance: cashNewBal.toFixed(2) }).where(eq(accounts.id, accountId));

            if (input.isFixedAsset && input.assetAccountId) {
              const assetAcct = await tx.select().from(accounts).where(eq(accounts.id, input.assetAccountId)).limit(1);
              if (assetAcct[0]) {
                const assetNewBal = d(assetAcct[0].currentBalance || "0").plus(d(input.amount));
                await tx.insert(ledgerEntries).values({
                  accountId: input.assetAccountId, transactionType: "expense", transactionId: expenseId,
                  entryType: "debit", amount: input.amount, balanceAfter: assetNewBal.toFixed(2),
                  entryDate: new Date(input.expenseDate), createdBy: userId, refNo: expenseNumber,
                } as any).returning();
                await tx.update(accounts).set({ currentBalance: assetNewBal.toFixed(2) }).where(eq(accounts.id, input.assetAccountId));
              }
            } else if (input.billId && business[0]?.id) {
              const apAccount = await tx.query.accounts.findFirst({
                where: and(
                  eq(accounts.accountSubType, "accounts_payable" as any),
                  eq(accounts.businessId, business[0].id),
                  isNull(accounts.deletedAt)
                ),
              });
              const billRecord = await tx.select().from(bills).where(eq(bills.id, input.billId)).limit(1);
              const billBalanceDue = d(billRecord[0]?.balanceDue || "0");
              const apDebitAmount = d.min(d(input.amount), billBalanceDue);
              const prepaymentAmount = d(input.amount).gt(billBalanceDue) ? d(input.amount).minus(billBalanceDue) : d(0);
              if (apAccount && apAccount.id !== accountId && apDebitAmount.gt(0)) {
                const apNewBal = d(apAccount.currentBalance || "0").minus(apDebitAmount);
                await tx.insert(ledgerEntries).values({
                  accountId: apAccount.id, transactionType: "bill_payment" as any, transactionId: expenseId,
                  entryType: "debit", amount: apDebitAmount.toFixed(2), balanceAfter: apNewBal.toFixed(2),
                  entryDate: new Date(input.expenseDate), createdBy: userId, refNo: expenseNumber,
                } as any).returning();
                await tx.update(accounts).set({ currentBalance: apNewBal.toFixed(2) }).where(eq(accounts.id, apAccount.id));
              }
              if (prepaymentAmount.gt(0)) {
                const prepayAcct = await tx.query.accounts.findFirst({
                  where: and(
                    eq(accounts.accountCode, "1550"),
                    eq(accounts.businessId, business[0].id),
                    isNull(accounts.deletedAt)
                  ),
                });
                if (prepayAcct) {
                  const prepayNewBal = d(prepayAcct.currentBalance || "0").plus(prepaymentAmount);
                  await tx.insert(ledgerEntries).values({
                    accountId: prepayAcct.id, transactionType: "bill_payment" as any, transactionId: expenseId,
                    entryType: "debit", amount: prepaymentAmount.toFixed(2), balanceAfter: prepayNewBal.toFixed(2),
                    entryDate: new Date(input.expenseDate), createdBy: userId, refNo: expenseNumber,
                  } as any).returning();
                  await tx.update(accounts).set({ currentBalance: prepayNewBal.toFixed(2) }).where(eq(accounts.id, prepayAcct.id));
                }
              }
            } else {
              const category = await tx.select().from(expenseCategories).where(
                and(eq(expenseCategories.id, input.categoryId), isNull(expenseCategories.deletedAt))
              ).limit(1);

              if (!category[0] || !category[0].defaultAccountId) {
                throw new Error(
                  "Expense category is not linked to a chart of accounts expense entry. " +
                  "Please update the category settings to select a default expense account."
                );
              }

              const expenseAccountId = category[0].defaultAccountId;

              if (expenseAccountId !== accountId) {
                const expenseAcct = await tx.select().from(accounts).where(eq(accounts.id, expenseAccountId)).limit(1);
                if (expenseAcct[0]) {
                  const expenseNewBal = d(expenseAcct[0].currentBalance || "0").plus(d(input.amount));
                  await tx.insert(ledgerEntries).values({
                    accountId: expenseAccountId, transactionType: "expense", transactionId: expenseId,
                    entryType: "debit", amount: input.amount, balanceAfter: expenseNewBal.toFixed(2),
                    entryDate: new Date(input.expenseDate), createdBy: userId, refNo: expenseNumber,
                  } as any).returning();
                  await tx.update(accounts).set({ currentBalance: expenseNewBal.toFixed(2) }).where(eq(accounts.id, expenseAccountId));
                }
              }
            }
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
    .input(updateExpenseInputSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, expenses, input.id);
      const { id, ...rawUpdates } = input;
      const updates: any = { ...rawUpdates };
      if (rawUpdates.expenseDate) updates.expenseDate = new Date(rawUpdates.expenseDate);
      await db.update(expenses).set(updates).where(eq(expenses.id, id));
      return { success: true };
    }),

  delete: expenseManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, expenses, input.id);
      await db.update(expenses).set({ deletedAt: new Date() }).where(eq(expenses.id, input.id));
      return { success: true };
    }),

  getAttachments: expenseQuery
    .input(z.object({ recordId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, expenses, input.recordId);
      return db.select().from(attachments).where(
        and(eq(attachments.recordType, "expense"), eq(attachments.recordId, input.recordId))
      ).orderBy(desc(attachments.createdAt));
    }),

  addAttachment: expenseCreate
    .input(z.object({ recordId: z.number(), imageData: z.string(), mimeType: z.string().default("image/jpeg"), caption: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, expenses, input.recordId);
      const [result] = await db.insert(attachments).values({
        recordType: "expense", recordId: input.recordId,
        imageData: input.imageData, mimeType: input.mimeType, caption: input.caption,
      } as any).returning();
      return { id: result.id, success: true };
    }),

  deleteAttachment: expenseManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db.delete(attachments).where(eq(attachments.id, input.id));
      return { success: true };
    }),

  getFixedAssets: expenseQuery
    .input(z.object({ locationId: z.number().optional(), page: z.number().default(1), pageSize: z.number().default(50) }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [
        isNull(expenses.deletedAt),
        eq(expenses.isFixedAsset, true)
      ];
      if (input.locationId) {
        await requireAuthorizedLocation(ctx, input.locationId);
        conditions.push(eq(expenses.locationId, input.locationId));
      }
      const offset = (input.page - 1) * input.pageSize;
      const result = await db.select().from(expenses)
        .where(and(...conditions))
        .orderBy(desc(expenses.expenseDate))
        .limit(input.pageSize)
        .offset(offset);
      return result;
    }),
});
