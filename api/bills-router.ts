import { z } from "zod";
import { createRouter, billQuery, billCreate, billPay, getCurrentBusinessLocationIds, requireAuthorizedLocation, requireAuthorizedEntity } from "./middleware";
import { getDb } from "./queries/connection";
import { bills, billPayments, billItems, masterItems, suppliers, accounts, ledgerEntries, recurringBillTemplates, attachments, locations, expenseCategories, expenses } from "@db/schema";
import { eq, and, isNull, desc, sql, inArray } from "drizzle-orm";
import { d } from "./lib/decimal";
import { notFutureDateString } from "./lib/future-date";
import { logAudit } from "./lib/audit";
import { ensureSystemAccount } from "./lib/accounting-accounts";
import { getExpenseAccountSubType } from "./lib/accounting-maps";
import { reverseLedgerEntriesForTransaction } from "./lib/accounting-reversal";

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
    accountingClass = cat[0]?.accountingClass || null;
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
  paymentMethod: z.enum(["cash", "wallet", "bank_transfer", "card"]),
  amount: z.string(),
  paymentDate: notFutureDateString("Payment date"),
  reference: z.string().optional(),
  notes: z.string().optional(),
  accountId: z.number().optional(),
  liabilityAccountId: z.number().optional(),
});

export const batchBillPaymentInputSchema = z.object({
  billIds: z.array(z.number()),
  paymentMethod: z.enum(["cash", "wallet", "bank_transfer", "card"]),
  paymentDate: notFutureDateString("Payment date"),
  accountId: z.number(),
  reference: z.string().optional(),
});

async function resolveBillCategoryId(tx: any, billId: number, supplierId?: number | null) {
  const itemCategories = await tx
    .select({ categoryId: billItems.categoryId })
    .from(billItems)
    .where(and(eq(billItems.billId, billId), isNull(billItems.deletedAt), sql`${billItems.categoryId} IS NOT NULL`));

  const distinctCategoryIds = [...new Set(itemCategories.map((item) => item.categoryId).filter((value): value is number => value !== null))];

  if (distinctCategoryIds.length === 1) {
    return distinctCategoryIds[0];
  }

  if (distinctCategoryIds.length > 1) {
    const categories = await tx
      .select({ id: expenseCategories.id, name: expenseCategories.name })
      .from(expenseCategories)
      .where(inArray(expenseCategories.id, distinctCategoryIds as number[]));
    const categoryNames = categories.map((c) => `${c.name}`).join(", ");
    throw new Error(
      `Bill line items have conflicting categories: ${categoryNames}. ` +
      `Please assign a single top-level category to the bill to resolve this conflict.`
    );
  }

  const [bill] = await tx.select().from(bills).where(eq(bills.id, billId)).limit(1);
  if (bill?.categoryId) {
    return bill.categoryId;
  }

  if (supplierId) {
    const [supplier] = await tx.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
    if (supplier?.autoCategoryId) {
      return supplier.autoCategoryId;
    }
  }

  return null;
}

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

      const [location] = await db.select().from(locations).where(eq(locations.id, input.locationId)).limit(1);
      if (!location) {
        throw new Error("Location not found");
      }
      const businessId = location.businessId!;

      await db.transaction(async (tx) => {
        if (!billNumber) {
          const nextNum = location.nextBillNumber ?? 1;
          billNumber = `BILL-${String(nextNum).padStart(4, "0")}`;
          await tx.update(locations).set({ nextBillNumber: nextNum + 1 }).where(eq(locations.id, input.locationId));
        }

        const [result] = await tx.insert(bills).values({
          locationId: input.locationId,
          businessId,
          supplierId: input.supplierId,
          categoryId: input.categoryId,
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

        const supplier = input.supplierId
          ? await tx.select().from(suppliers).where(eq(suppliers.id, input.supplierId)).limit(1)
          : [];
        const resolvedCategoryId = input.categoryId ?? supplier[0]?.autoCategoryId ?? null;
        const expenseCategory = resolvedCategoryId
          ? await tx.select().from(expenseCategories).where(eq(expenseCategories.id, resolvedCategoryId)).limit(1)
          : [];

        let expenseAccountId: number | undefined;
        if (expenseCategory[0]?.defaultAccountId) {
          expenseAccountId = expenseCategory[0].defaultAccountId;
        } else if (resolvedCategoryId) {
          const accountingClass = expenseCategory[0]?.accountingClass || "operating_expense";
          expenseAccountId = await ensureSystemAccount({
            businessId,
            accountType: "expense",
            accountSubType: getExpenseAccountSubType(accountingClass as any),
            name: expenseCategory[0]?.name || input.description,
          });
        }

        const liabilityAcctId = input.liabilityAccountId
          ?? await ensureSystemAccount({
            businessId,
            accountType: "liability",
            accountSubType: "accounts_payable",
            name: "Accounts Payable",
          });
        const [apAccount] = await tx
          .select()
          .from(accounts)
          .where(and(eq(accounts.id, liabilityAcctId), isNull(accounts.deletedAt)))
          .limit(1);

        if (expenseAccountId && apAccount) {
          const issueDateStr = new Date(input.issueDate).toISOString().split("T")[0];
          const [expenseAccount] = await tx.select().from(accounts).where(eq(accounts.id, expenseAccountId)).limit(1);
          const expenseNewBal = d(expenseAccount?.currentBalance || "0").plus(d(input.amount));
          const apNewBal = d(apAccount.currentBalance || "0").plus(d(input.amount));

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

          await tx.insert(ledgerEntries).values({
            accountId: apAccount.id,
            transactionType: "bill_payment" as any,
            transactionId: billId,
            entryType: "credit",
            amount: input.amount,
            balanceAfter: apNewBal.toFixed(2),
            entryDate: issueDateStr,
            createdBy: enteredBy,
            description: `Bill: ${input.description}`,
          } as any).returning();
          await tx.update(accounts).set({ currentBalance: apNewBal.toFixed(2) }).where(eq(accounts.id, apAccount.id));
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
      const newBalance = d(Math.max(0, d(totalAmount).minus(currentPaid).minus(paymentAmount).toNumber()));
      const status = newBalance.lte(0) ? "paid" as const : "partial" as const;

      const resolvedCategoryId = await resolveBillCategoryId(db, input.billId, bill.supplierId);
      if (!resolvedCategoryId) {
        throw new Error("No category is defined for this bill. Kindly define one before processing payment.");
      }

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
          const typeMap: Record<string, string> = { cash: "cash", wallet: "cash", bank_transfer: "bank", card: "bank" };
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
            const billBalanceDue = d(bill.balanceDue || "0");
            const apDebitAmount = paymentAmount.lte(billBalanceDue) ? paymentAmount : billBalanceDue;
            const prepaymentAmount = paymentAmount.gt(billBalanceDue) ? paymentAmount.minus(billBalanceDue) : d(0);
            const paymentDateStr = new Date(input.paymentDate).toISOString().split("T")[0];

            if (apDebitAmount.gt(0)) {
              const apNewBal = d(existingAp[0].currentBalance || "0").minus(apDebitAmount);
              await tx.insert(ledgerEntries).values({
                accountId: existingAp[0].id,
                transactionType: "bill_payment" as any,
                transactionId: paymentId,
                entryType: "debit",
                amount: apDebitAmount.toFixed(2),
                balanceAfter: apNewBal.toFixed(2),
                entryDate: paymentDateStr,
                createdBy: enteredBy,
                description: `Bill Payment: ${input.reference || bill.description}`,
              } as any).returning();
              await tx.update(accounts).set({ currentBalance: apNewBal.toFixed(2) }).where(eq(accounts.id, existingAp[0].id));
            }

            if (prepaymentAmount.gt(0)) {
              const prepayAccountId = await ensureSystemAccount({
                businessId: bill.businessId,
                accountType: "asset",
                accountSubType: "prepaid_expense",
                name: "Supplier Prepayments",
              });
              const prepayAcct = await tx.query.accounts.findFirst({
                where: and(
                  eq(accounts.id, prepayAccountId),
                  eq(accounts.businessId, bill.businessId),
                  isNull(accounts.deletedAt)
                ),
              });
              if (prepayAcct) {
                const prepayNewBal = d(prepayAcct.currentBalance || "0").plus(prepaymentAmount);
                await tx.insert(ledgerEntries).values({
                  accountId: prepayAcct.id,
                  transactionType: "bill_payment" as any,
                  transactionId: paymentId,
                  entryType: "debit",
                  amount: prepaymentAmount.toFixed(2),
                  balanceAfter: prepayNewBal.toFixed(2),
                  entryDate: paymentDateStr,
                  createdBy: enteredBy,
                  description: `Supplier Overpayment (${input.reference || bill.description})`,
                } as any).returning();
                await tx.update(accounts).set({ currentBalance: prepayNewBal.toFixed(2) }).where(eq(accounts.id, prepayAcct.id));
              }
            }
          }
        }

        const expenseNumber = `EXP-BP-${String(paymentId).padStart(6, "0")}`;
        await tx.insert(expenses).values({
          locationId: bill.locationId,
          businessId: bill.businessId,
          categoryId: resolvedCategoryId,
          supplierId: bill.supplierId,
          expenseNumber,
          billId: input.billId,
          amount: input.amount,
          description: `Bill Payment: ${input.reference || bill.description}`,
          expenseDate: new Date(input.paymentDate),
          paymentMethod: input.paymentMethod,
          accountId: cashAccountId ?? null,
          enteredBy,
          refNo: bill.billNumber ?? `BILL-${String(bill.id).padStart(4, "0")}`,
        } as any).returning();
      });

      return { id: paymentId, newBalanceDue: newBalance.toFixed(2), status, success: true };
    }),

  delete: billCreate
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, bills, input.id);
      const existingLedger = await db
        .select({ id: ledgerEntries.id })
        .from(ledgerEntries)
        .where(eq(ledgerEntries.transactionId, input.id))
        .limit(1);

      if (existingLedger[0]) {
        throw new Error("Posted bills cannot be deleted. Reverse the posted entry instead.");
      }

      await db.update(bills).set({ deletedAt: new Date() }).where(eq(bills.id, input.id));
      return { success: true };
    }),

  reverse: billCreate
    .input(z.object({ id: z.number(), reason: z.string().min(1).max(255) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const bill = await requireAuthorizedEntity(ctx, bills, input.id);

      if (bill.reversedAt) {
        throw new Error("This bill has already been reversed.");
      }

      const existingPayments = await db
        .select({ id: billPayments.id })
        .from(billPayments)
        .where(and(eq(billPayments.billId, input.id), isNull(billPayments.deletedAt)))
        .limit(1);

      if (existingPayments[0]) {
        throw new Error("Bills with recorded payments must be corrected from the payment history before reversal.");
      }

      await db.transaction(async (tx) => {
        await reverseLedgerEntriesForTransaction({
          db: tx,
          transactionId: input.id,
          userId: (ctx as any).user?.id ?? 1,
          reason: input.reason,
        });

        await tx
          .update(bills)
          .set({
            reversedAt: new Date(),
            reversedBy: (ctx as any).user?.id ?? 1,
            status: "cancelled",
            balanceDue: "0.00",
          })
          .where(eq(bills.id, input.id));
      });

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
      frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "annually"]), 
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
        frequency: input.frequency,
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
      frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "annually"]).optional(), 
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
      await requireAuthorizedEntity(ctx, suppliers, input.supplierId);
      const allBills = await db.select().from(bills).where(and(eq(bills.supplierId, input.supplierId), isNull(bills.deletedAt)));
      const supplier = await db.select().from(suppliers).where(eq(suppliers.id, input.supplierId)).limit(1);
      return { bills: allBills, supplier: supplier[0] };
    }),
});
