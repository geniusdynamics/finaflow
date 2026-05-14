import { z } from "zod";
import { createRouter, billQuery, billCreate, billPay, getCurrentBusinessLocationIds, requireAuthorizedLocation, requireAuthorizedEntity, requireAuthorizedBusinessEntity } from "./middleware";
import { getDb } from "./queries/connection";
import { bills, billPayments, billItems, masterItems, suppliers, accounts, ledgerEntries, recurringBillTemplates, attachments, locations, businesses, expenseCategories } from "@db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { d } from "./lib/decimal";
import { notFutureDateString } from "./lib/future-date";
import { logAudit } from "./lib/audit";

const LIABILITY_ACCOUNT_MAP: Record<string, { accountCode: string; description: string }> = {
  rent: { accountCode: "2110", description: "Rent Payable" },
  insurance: { accountCode: "2120", description: "Insurance Premiums Payable" },
  subscription: { accountCode: "2130", description: "Subscriptions Payable" },
  utilities: { accountCode: "2140", description: "Utilities Payable" },
  loan: { accountCode: "2600", description: "Current Loan Payable" },
};

export async function getLiabilityAccountForRecurring(
  businessId: number,
  categoryId?: number,
  customLiabilityAccountId?: number,
  description?: string
): Promise<number | null> {
  const db = getDb();
  
  if (customLiabilityAccountId) {
    const account = await db.select().from(accounts).where(
      and(eq(accounts.id, customLiabilityAccountId), isNull(accounts.deletedAt))
    ).limit(1);
    if (account[0]) return account[0].id;
  }
  
  let accountingClass: string | null = null;
  if (categoryId) {
    const cat = await db.select().from(expenseCategories).where(
      and(eq(expenseCategories.id, categoryId), isNull(expenseCategories.deletedAt))
    ).limit(1);
    if (cat[0]?.accountingClass) {
      accountingClass = cat[0].accountingClass;
    }
  }
  
  const descLower = (description || "").toLowerCase();
  let targetAccountCode: string | null = null;
  
  if (accountingClass === "admin_expense" || descLower.includes("rent")) {
    targetAccountCode = LIABILITY_ACCOUNT_MAP.rent.accountCode;
  } else if (accountingClass === "admin_expense" || descLower.includes("insurance")) {
    targetAccountCode = LIABILITY_ACCOUNT_MAP.insurance.accountCode;
  } else if (accountingClass === "operating_expense" || descLower.includes("subscription")) {
    targetAccountCode = LIABILITY_ACCOUNT_MAP.subscription.accountCode;
  } else if (accountingClass === "operating_expense" || descLower.includes("utility")) {
    targetAccountCode = LIABILITY_ACCOUNT_MAP.utilities.accountCode;
  } else if (descLower.includes("loan") || descLower.includes("financing")) {
    targetAccountCode = LIABILITY_ACCOUNT_MAP.loan.accountCode;
  }
  
  if (targetAccountCode) {
    const account = await db.select().from(accounts).where(
      and(eq(accounts.accountCode, targetAccountCode), isNull(accounts.deletedAt))
    ).limit(1);
    if (account[0]) return account[0].id;
  }
  
  const apAccount = await db.select().from(accounts).where(
    and(
      eq(accounts.businessId, businessId),
      eq(accounts.accountSubType, "accounts_payable" as any),
      isNull(accounts.deletedAt)
    )
  ).limit(1);
  
  return apAccount[0]?.id || null;
}

export const billPaymentInputSchema = z.object({
  billId: z.number(),
  paymentMethod: z.enum(["cash", "mpesa", "bank_transfer", "card"]),
  amount: z.string(),
  paymentDate: notFutureDateString("Payment date"),
  reference: z.string().optional(),
  notes: z.string().optional(),
  accountId: z.number().optional(),
  liabilityAccountId: z.number().optional(),
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
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 50;
      const offset = (page - 1) * pageSize;
      return db.select().from(bills).where(and(...conditions)).orderBy(desc(bills.dueDate)).limit(pageSize).offset(offset);
    }),

  create: billCreate
    .input(z.object({
      locationId: z.number(), supplierId: z.number().optional(),
      billNumber: z.string().optional(), description: z.string().min(1),
      amount: z.string(), issueDate: z.string(), dueDate: z.string(),
      categoryId: z.number().optional(),
      liabilityAccountId: z.number().optional(),
      attachments: z.array(z.object({ imageData: z.string(), mimeType: z.string().default("image/jpeg"), caption: z.string().optional() })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      let billNumber = input.billNumber;
      let billId = 0;
      const enteredBy = (ctx as any).user?.id ?? 1;

      await requireAuthorizedLocation(ctx, input.locationId);

      if (input.supplierId) {
        await requireAuthorizedBusinessEntity(ctx, suppliers, input.supplierId);
      }

      const loc = await db.select().from(locations).where(eq(locations.id, input.locationId)).limit(1);
      const business = await db.select().from(businesses).where(eq(businesses.id, loc[0]?.businessId)).limit(1);
      const businessId = business[0]?.id;

      await db.transaction(async (tx) => {
        if (!billNumber) {
          const nextNum = loc[0]?.nextBillNumber ?? 1;
          billNumber = `BILL-${String(nextNum).padStart(4, "0")}`;
          await tx.update(locations).set({ nextBillNumber: nextNum + 1 }).where(eq(locations.id, input.locationId));
        }

        const [result] = await tx.insert(bills).values({
          locationId: input.locationId,
          businessId,
          supplierId: input.supplierId,
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

        if (businessId) {
          const expenseCategory = input.categoryId 
            ? await tx.select().from(expenseCategories).where(eq(expenseCategories.id, input.categoryId)).limit(1)
            : null;
          
          let expenseAccountId: number | undefined;
          if (expenseCategory?.[0]?.defaultAccountId) {
            expenseAccountId = expenseCategory[0].defaultAccountId!;
          } else {
            const accountingClass = expenseCategory?.[0]?.accountingClass || "operating_expense";
            const subtypeMap: Record<string, string> = {
              cogs: "cogs",
              operating_expense: "operating_expense",
              admin_expense: "admin_expense",
              marketing: "marketing_expense",
              depreciation: "depreciation_expense",
              other: "other_expense",
            };
            const expenseAcct = await tx.select().from(accounts).where(
              and(
                eq(accounts.businessId, businessId),
                eq(accounts.accountSubType, subtypeMap[accountingClass] as any),
                isNull(accounts.deletedAt)
              )
            ).limit(1);
            if (expenseAcct[0]) expenseAccountId = expenseAcct[0].id;
          }

          const liabilityAcctId = input.liabilityAccountId;
          const apAccount = liabilityAcctId
            ? await tx.select().from(accounts).where(and(eq(accounts.id, liabilityAcctId), isNull(accounts.deletedAt))).limit(1)
            : await tx.select().from(accounts).where(
                and(
                  eq(accounts.businessId, businessId),
                  eq(accounts.accountSubType, "accounts_payable" as any),
                  isNull(accounts.deletedAt)
                )
              ).limit(1);

          if (expenseAccountId && apAccount[0]) {
            const issueDateStr = new Date(input.issueDate).toISOString().split("T")[0];
            const expenseNewBal = d(expenseAccountId ? (await tx.select().from(accounts).where(eq(accounts.id, expenseAccountId)).limit(1))[0]?.currentBalance || "0" : "0").plus(d(input.amount));
            const apNewBal = d(apAccount[0].currentBalance || "0").plus(d(input.amount));

            if (expenseAccountId) {
              await tx.insert(ledgerEntries).values({
                accountId: expenseAccountId,
                transactionType: "expense" as any,
                transactionId: billId,
                entryType: "debit",
                amount: input.amount,
                balanceAfter: expenseNewBal.toFixed(2),
                entryDate: issueDateStr,
                createdBy: enteredBy,
                description: `Bill: ${input.description}`,
              } as any).returning();
              await tx.update(accounts).set({ currentBalance: expenseNewBal.toFixed(2) }).where(eq(accounts.id, expenseAccountId));
            }

            await tx.insert(ledgerEntries).values({
              accountId: apAccount[0].id,
              transactionType: "bill_payment" as any,
              transactionId: billId,
              entryType: "credit",
              amount: input.amount,
              balanceAfter: apNewBal.toFixed(2),
              entryDate: issueDateStr,
              createdBy: enteredBy,
              description: `Bill: ${input.description}`,
            } as any).returning();
            await tx.update(accounts).set({ currentBalance: apNewBal.toFixed(2) }).where(eq(accounts.id, apAccount[0].id));
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

      let paymentId = 0;

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

        let cashAccountId = input.accountId;
        if (!cashAccountId) {
          const typeMap: Record<string, string> = { cash: "cash", mpesa: "cash", bank_transfer: "bank", card: "bank" };
          const defaultAccount = await tx.select().from(accounts).where(
            and(
              eq(accounts.locationId, bill.locationId),
              eq(accounts.type, typeMap[input.paymentMethod] as any),
              isNull(accounts.deletedAt)
            )
          ).limit(1);
          if (defaultAccount[0]) cashAccountId = defaultAccount[0].id;
        }

        if (cashAccountId) {
          const acct = await tx.select().from(accounts).where(eq(accounts.id, cashAccountId)).limit(1);
          if (acct[0]) {
            const newBal = d(acct[0].currentBalance || "0").minus(paymentAmount);
            const paymentDateStr = new Date(input.paymentDate).toISOString().split("T")[0];
            await tx.insert(ledgerEntries).values({
              accountId: cashAccountId, transactionType: "bill_payment",
              transactionId: paymentId, entryType: "credit",
              amount: input.amount, balanceAfter: newBal.toFixed(2),
              entryDate: paymentDateStr, createdBy: enteredBy,
              refNo: bill.billNumber ?? `BILL-${String(bill.id).padStart(4, "0")}`,
            } as any).returning();
            await tx.update(accounts).set({ currentBalance: newBal.toFixed(2) }).where(eq(accounts.id, cashAccountId));
          }
        }

        if (bill.businessId) {
          const liabilityAcctId = input.liabilityAccountId;
          const existingAp = liabilityAcctId
            ? await tx.select().from(accounts).where(and(eq(accounts.id, liabilityAcctId), isNull(accounts.deletedAt))).limit(1)
            : await tx.select().from(accounts).where(
                and(
                  eq(accounts.businessId, bill.businessId),
                  eq(accounts.accountSubType, "accounts_payable" as any),
                  isNull(accounts.deletedAt)
                )
              ).limit(1);

          if (existingAp[0]) {
            const apNewBal = d(existingAp[0].currentBalance || "0").minus(paymentAmount);
            const paymentDateStr = new Date(input.paymentDate).toISOString().split("T")[0];
            await tx.insert(ledgerEntries).values({
              accountId: existingAp[0].id,
              transactionType: "bill_payment" as any,
              transactionId: paymentId,
              entryType: "debit",
              amount: input.amount,
              balanceAfter: apNewBal.toFixed(2),
              entryDate: paymentDateStr,
              createdBy: enteredBy,
              description: `Bill Payment: ${input.reference || bill.description}`,
            } as any).returning();
            await tx.update(accounts).set({ currentBalance: apNewBal.toFixed(2) }).where(eq(accounts.id, existingAp[0].id));
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
      }
      return db.select().from(recurringBillTemplates).where(and(...conditions)).orderBy(desc(recurringBillTemplates.createdAt));
    }),

  createRecurring: billCreate
    .input(z.object({ 
      locationId: z.number(), 
      supplierId: z.number().optional(), 
      categoryId: z.number().optional(),
      description: z.string().min(1), 
      amount: z.string(), 
      billingCycle: z.enum(["weekly", "biweekly", "monthly", "quarterly", "annually"]), 
      nextDueDate: z.string(), 
      liabilityAccountId: z.number().optional(),
      attachments: z.array(z.object({ imageData: z.string(), mimeType: z.string().default("image/jpeg"), caption: z.string().optional() })).optional() 
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedLocation(ctx, input.locationId);
      
      const loc = await db.select().from(locations).where(eq(locations.id, input.locationId)).limit(1);
      const businessId = loc[0]?.businessId;
      
      const [result] = await db.insert(recurringBillTemplates).values({
        locationId: input.locationId, 
        businessId,
        supplierId: input.supplierId,
        categoryId: input.categoryId,
        liabilityAccountId: input.liabilityAccountId,
        description: input.description, 
        amount: input.amount, 
        billingCycle: input.billingCycle,
        nextDueDate: new Date(input.nextDueDate),
      } as any).returning();
      return { id: result.id, success: true };
    }),

  updateRecurring: billCreate
    .input(z.object({ 
      id: z.number(),
      categoryId: z.number().optional(),
      description: z.string().min(1).optional(), 
      amount: z.string().optional(), 
      billingCycle: z.enum(["weekly", "biweekly", "monthly", "quarterly", "annually"]).optional(), 
      nextDueDate: z.string().optional(), 
      liabilityAccountId: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      await db.update(recurringBillTemplates).set({
        ...updates as any,
        nextDueDate: updates.nextDueDate ? new Date(updates.nextDueDate) : undefined,
      }).where(eq(recurringBillTemplates.id, id));
      return { success: true };
    }),

  deleteRecurring: billCreate
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(recurringBillTemplates).set({ deletedAt: new Date() }).where(eq(recurringBillTemplates.id, input.id));
      return { success: true };
    }),

  getPayments: billQuery
    .input(z.object({ billId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, bills, input.billId);
      return db.select().from(billPayments).where(eq(billPayments.billId, input.billId)).orderBy(desc(billPayments.paymentDate));
    }),

  getSupplierSummary: billQuery
    .input(z.object({ supplierId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedBusinessEntity(ctx, suppliers, input.supplierId);
      const allBills = await db.select().from(bills).where(and(eq(bills.supplierId, input.supplierId), isNull(bills.deletedAt)));
      const supplier = await db.select().from(suppliers).where(eq(suppliers.id, input.supplierId)).limit(1);
      return { bills: allBills, supplier: supplier[0] };
    }),
});
