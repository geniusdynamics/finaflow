import { z } from "zod";
import { createRouter, expenseQuery, expenseCreate, expenseManage, getCurrentBusinessLocationIds, requireAuthorizedLocation, requireAuthorizedEntity, requireAuthorizedBusinessEntity } from "./middleware";
import { getDb } from "./queries/connection";
import { expenses, expenseItems, expenseCategories, accounts, ledgerEntries, suppliers, bills, attachments, locations } from "@db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { d } from "./lib/decimal";
import { notFutureDateString, optionalNotFutureDateString } from "./lib/future-date";
import { logAudit } from "./lib/audit";
import { ensureSystemAccount } from "./lib/accounting-accounts";
import { getExpenseAccountSubType } from "./lib/accounting-maps";
import { payBill } from "./lib/bill-payment";
import { reverseLedgerEntriesForTransaction } from "./lib/accounting-reversal";

export const expenseItemInputSchema = z.object({
  itemName: z.string().min(1),
  quantity: z.string().default("1"),
  unitPrice: z.string(),
  totalPrice: z.string(),
  categoryId: z.number(),
  notes: z.string().optional(),
});

export const expenseItemWithIdSchema = expenseItemInputSchema.extend({
  id: z.number().optional(),
});

export const createExpenseInputSchema = z.object({
  locationId: z.number(),
  categoryId: z.number(),
  supplierId: z.number().optional(),
  amount: z.string(),
  description: z.string().min(1),
  expenseDate: notFutureDateString("Expense date"),
  paymentMethod: z.enum(["cash", "wallet", "bank_transfer", "card"]),
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
  items: z.array(expenseItemInputSchema).optional(),
});

export const updateExpenseInputSchema = z.object({
  id: z.number(),
  categoryId: z.number().optional(),
  amount: z.string().optional(),
  description: z.string().optional(),
  expenseDate: optionalNotFutureDateString("Expense date"),
  paymentMethod: z.enum(["cash", "wallet", "bank_transfer", "card"]).optional(),
});

export const expensesRouter = createRouter({
  categories: expenseQuery.query(async ({ ctx }) => {
    const db = getDb();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      defaultAccountId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (ctx as any).user?.id ?? 1;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const businessId = (ctx as any).user?.currentBusiness?.id ?? (ctx as any).user?.currentBusinessId;

      if (!businessId) {
        throw new Error("No active business context available");
      }

      if (!input) {
        throw new Error("Invalid input");
      }

      let defaultAccountId = input.defaultAccountId;
      if (defaultAccountId) {
        const account = await db.query.accounts.findFirst({
          where: and(
            eq(accounts.id, defaultAccountId),
            eq(accounts.businessId, businessId),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            eq(accounts.accountType, "expense" as any),
            isNull(accounts.deletedAt)
          ),
        });
        if (!account) {
          throw new Error("Default account must be a valid chart of accounts expense entry for this business");
        }
      } else {
        const accountSubType = getExpenseAccountSubType(input.accountingClass);
        defaultAccountId = (await ensureSystemAccount({
          businessId,
          accountType: "expense",
          accountSubType,
          name: input.name,
        })).id;
      }

      const [result] = await db.insert(expenseCategories).values({
        businessId,
        name: input.name, 
        description: input.description, 
        color: input.color ?? "#C73E1D",
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        accountingClass: (input.accountingClass || "operating_expense") as any,
        defaultAccountId,
      }).returning();
      
      await logAudit({
        userId,
        businessId,
        action: "CREATE",
        resource: "expense_categories",
        resourceId: result.id,
        details: {
          name: input.name,
          defaultAccountId,
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (ctx as any).user?.id ?? 1;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const businessId = (ctx as any).user?.currentBusiness?.id ?? (ctx as any).user?.currentBusinessId;
      const { id, ...updates } = input;
      
      const existing = await db.select().from(expenseCategories).where(
        and(eq(expenseCategories.id, id), isNull(expenseCategories.deletedAt))
      ).limit(1);

      const normalizedUpdates: Record<string, unknown> = { ...updates };
      if (businessId && updates.defaultAccountId === undefined) {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const accountingClass = (updates.accountingClass ?? existing[0]?.accountingClass ?? "operating_expense") as any;
        normalizedUpdates.defaultAccountId = (await ensureSystemAccount({
          businessId,
          accountType: "expense",
          accountSubType: getExpenseAccountSubType(accountingClass),
          name: (updates.name ?? existing[0]?.name ?? "Operating Expense") as string,
        })).id;
      } else if (updates.defaultAccountId !== undefined && businessId) {
        const account = await db.query.accounts.findFirst({
          where: and(
            eq(accounts.id, updates.defaultAccountId),
            eq(accounts.businessId, businessId),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            eq(accounts.accountType, "expense" as any),
            isNull(accounts.deletedAt)
          ),
        });
        if (!account) {
          throw new Error("Default account must be a valid chart of accounts expense entry for this business");
        }
      }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.update(expenseCategories).set(normalizedUpdates as any).where(eq(expenseCategories.id, id));
      
      if (Object.keys(auditDetails).length > 0) {
        await logAudit({
          userId,
          businessId,
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

  getItems: expenseQuery
    .input(z.object({ expenseId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, expenses, input.expenseId);
      return db.select().from(expenseItems).where(and(eq(expenseItems.expenseId, input.expenseId), isNull(expenseItems.deletedAt)));
    }),

  create: expenseCreate
    .input(createExpenseInputSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (ctx as any).user?.id ?? 1;

      await requireAuthorizedLocation(ctx, input.locationId);
      
      if (input.accountId) {
        const acct = await requireAuthorizedEntity(ctx, accounts, input.accountId);
        if (acct.locationId !== input.locationId) throw new Error("Account does not belong to the selected location");
      }
      
      if (input.supplierId) {
        await requireAuthorizedBusinessEntity(ctx, suppliers, input.supplierId);
      }

      const [location] = await db.select().from(locations).where(eq(locations.id, input.locationId)).limit(1);
      const businessId = location?.businessId;
      if (!businessId) {
        throw new Error("Selected location is not linked to a business");
      }
      const nextNum = location?.nextExpenseNumber ?? 1;
      const expenseNumber = `EXP-${String(nextNum).padStart(4, "0")}`;

      let expenseId = 0;
      let accountId = input.accountId;
      let _fixedAssetItemId: number | undefined;

      await db.transaction(async (tx) => {
        await tx.update(locations).set({ nextExpenseNumber: nextNum + 1 }).where(eq(locations.id, input.locationId));

        if (!input.billId && input.supplierId) {
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
          const typeMap: Record<string, string> = { cash: "cash", wallet: "cash", bank_transfer: "bank", card: "bank" };
          const accts = await tx.select().from(accounts).where(
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            and(eq(accounts.locationId, input.locationId), eq(accounts.type, typeMap[input.paymentMethod] as any), isNull(accounts.deletedAt))
          ).limit(1);
          if (accts[0]) accountId = accts[0].id;
        }

        const [result] = await tx.insert(expenses).values({
          locationId: input.locationId, 
          businessId,
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any).returning();
        expenseId = result.id;

        if (input.attachments && input.attachments.length > 0) {
          for (const att of input.attachments) {
            await tx.insert(attachments).values({
              recordType: "expense", recordId: expenseId,
              imageData: att.imageData, mimeType: att.mimeType, caption: att.caption,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any).returning();
          }
        }

        if (input.items && input.items.length > 0) {
          for (const item of input.items) {
            await tx.insert(expenseItems).values({
              expenseId,
              itemName: item.itemName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              categoryId: item.categoryId,
              notes: item.notes,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any).returning();
                await tx.update(accounts).set({ currentBalance: assetNewBal.toFixed(2) }).where(eq(accounts.id, input.assetAccountId));
              }
            } else if (input.billId) {
              await payBill({
                db: tx,
                billId: input.billId,
                paymentMethod: input.paymentMethod,
                amount: input.amount,
                paymentDate: input.expenseDate,
                reference: input.description,
                accountId: accountId!,
                categoryId: input.categoryId,
                enteredBy: userId,
                businessId,
                locationId: input.locationId,
                supplierId: input.supplierId,
                skipExpenseCreation: true,
              });
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                  } as any).returning();
                  await tx.update(accounts).set({ currentBalance: expenseNewBal.toFixed(2) }).where(eq(accounts.id, expenseAccountId));
                }
              }
            }
          }
        }

        if (!input.billId && input.supplierId) {
          const sup = await tx.select().from(suppliers).where(eq(suppliers.id, input.supplierId)).limit(1);
          if (sup[0]) {
            const newPaid = d(sup[0].totalPaid).plus(d(input.amount));
            const newBal = d(sup[0].currentBalance).minus(d(input.amount));
            await tx.update(suppliers).set({ totalPaid: newPaid.toFixed(2), currentBalance: newBal.toFixed(2) }).where(eq(suppliers.id, input.supplierId));
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      const existingLedger = await db
        .select({ id: ledgerEntries.id })
        .from(ledgerEntries)
        .where(eq(ledgerEntries.transactionId, input.id))
        .limit(1);

      if (existingLedger[0]) {
        throw new Error("Posted expenses cannot be deleted. Reverse the posted entry instead.");
      }

      await db.update(expenses).set({ deletedAt: new Date() }).where(eq(expenses.id, input.id));
      return { success: true };
    }),

  reverse: expenseManage
    .input(z.object({ id: z.number(), reason: z.string().min(1).max(255) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const expense = await requireAuthorizedEntity(ctx, expenses, input.id);

      if (expense.reversedAt) {
        throw new Error("This expense has already been reversed.");
      }

      await db.transaction(async (tx) => {
        await reverseLedgerEntriesForTransaction({
          db: tx,
          transactionId: input.id,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
          userId: (ctx as any).user?.id ?? 1,
          reason: input.reason,
        });

        await tx
          .update(expenses)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
          .set({ reversedAt: new Date(), reversedBy: (ctx as any).user?.id ?? 1 })
          .where(eq(expenses.id, input.id));
      });

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).returning();
      return { id: result.id, success: true };
    }),

  deleteAttachment: expenseManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
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
