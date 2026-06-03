// ABOUTME: tRPC router for debt management — create, list, update, delete, record payments,
// ABOUTME: disburse cash, and generate installment bills against debts. All financial
// ABOUTME: calculations use decimal.js; write operations require DEBTS_MANAGE permission.
import { z } from "zod";
import { createRouter, debtsView, debtsManage, getCurrentBusinessLocationIds, requireAuthorizedLocation, requireAuthorizedEntity } from "./middleware";
import { getDb } from "./queries/connection";
import { debts, locations, accounts } from "@db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { d } from "./lib/decimal";
import {
  postOriginationLedgerEntries,
  postDisbursementLedgerEntries,
  getLoanLiabilityAccountId,
  createRecurringBillTemplateForDebt,
  generateNextInstallment,
  advanceDateByFrequency,
  type Frequency,
} from "./lib/debt-classification";

const statusEnum = z.enum(["active", "paid", "overdue", "defaulted"]);
const paymentScheduleEnum = z.enum(["daily", "weekly", "monthly", "quarterly", "annually"]);

export const debtsRouter = createRouter({
  list: debtsView
    .input(z.object({
      locationId: z.number().optional(),
      status: statusEnum.optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [isNull(debts.deletedAt)];
      if (input?.locationId) {
        await requireAuthorizedLocation(ctx, input.locationId);
        conditions.push(eq(debts.locationId, input.locationId));
      } else {
        const locIds = await getCurrentBusinessLocationIds(ctx);
        if (locIds.length === 0) return [];
        conditions.push(sql`${debts.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`);
      }
      if (input?.status) conditions.push(eq(debts.status, input.status));
      const rows = await db.select().from(debts).where(and(...conditions)).orderBy(desc(debts.dueDate));
      return rows;
    }),

  get: debtsView
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const debt = await requireAuthorizedEntity(ctx, debts, input.id);
      return debt;
    }),

  bankAccounts: debtsView
    .input(z.object({ locationId: z.number().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      // Operational accounts that can receive loan proceeds: bank, cash, and mobile-wallet
      // (mpesa is the mobile-wallet type in this schema). We exclude system COA rows
      // (those have a non-null accountType) and only show real, active accounts.
      const conditions = [
        isNull(accounts.deletedAt),
        isNull(accounts.accountType),
        sql`${accounts.type} IN ('cash', 'mpesa', 'bank_account')`,
      ];
      if (input?.locationId) {
        await requireAuthorizedLocation(ctx, input.locationId);
        conditions.push(eq(accounts.locationId, input.locationId));
      } else {
        const locIds = await getCurrentBusinessLocationIds(ctx);
        if (locIds.length === 0) return [];
        conditions.push(sql`${accounts.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`);
      }
      return db.select().from(accounts).where(and(...conditions)).orderBy(accounts.name);
    }),

  create: debtsManage
    .input(z.object({
      locationId: z.number(),
      creditorName: z.string().min(1).max(255),
      description: z.string().optional(),
      totalAmount: z.string(),
      interestRate: z.string().optional(),
      dueDate: z.string().optional(),
      loanDate: z.string().optional(),
      paymentSchedule: paymentScheduleEnum.optional(),
      destinationAccountId: z.number(),
      disburseImmediately: z.boolean().optional(),
      installmentAmount: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedLocation(ctx, input.locationId);

      const locationRows = await db.select().from(locations).where(eq(locations.id, input.locationId)).limit(1);
      if (!locationRows[0]) throw new Error("Location not found");
      const businessId = locationRows[0].businessId!;
      const enteredBy = ctx.user?.id ?? 1;

      // Validate destination account. Must be an operational cash/wallet/bank account,
      // not a system chart-of-accounts row.
      const [destAcct] = await db.select().from(accounts).where(eq(accounts.id, input.destinationAccountId)).limit(1);
      if (!destAcct) throw new Error("Destination account not found");
      if (destAcct.accountType) throw new Error("Destination must be a real bank/cash/wallet account, not a chart-of-accounts entry");
      if (!["cash", "mpesa", "bank_account"].includes(destAcct.type)) {
        throw new Error("Destination account must be of type bank, cash, or wallet");
      }

      const loanDate = input.loanDate ?? new Date().toISOString();
      const dueDate = input.dueDate ?? null;

      // Auto-classify: 2600 (current_loan) or 2700 (long_term_loan) based on duration.
      const loanAccountId = await getLoanLiabilityAccountId(db, businessId, loanDate, dueDate);
      if (!loanAccountId) {
        throw new Error(
          "Could not find a loan liability account (2600 Current Loan Payable or 2700 Long-Term Loan Payable) for this business. " +
          "Run the accounting seed to provision the system accounts.",
        );
      }

      const [result] = await db.insert(debts).values({
        locationId: input.locationId,
        businessId,
        creditorName: input.creditorName,
        description: input.description || null,
        totalAmount: input.totalAmount,
        paidAmount: "0.00",
        interestRate: input.interestRate || "0.00",
        dueDate: dueDate ? new Date(dueDate) : null,
        loanDate: new Date(loanDate),
        installmentAmount: input.installmentAmount || null,
        destinationAccountId: input.destinationAccountId,
        loanAccountId,
        isDisbursed: false,
        disbursementDate: null,
        disbursementFee: null,
        recurringBillTemplateId: null,
        status: "active",
        paymentSchedule: input.paymentSchedule || "monthly",
        notes: input.notes || null,
        createdBy: enteredBy,
      } as typeof debts.$inferInsert).returning();

      const inserted = result;
      if (!inserted) throw new Error("Failed to insert debt row");

      // Post the origination double-entry (liability always; cash if immediate).
      // We need a fully-typed Debt-shaped object; rebuild it from the insert inputs.
      const insertedDebt: typeof debts.$inferSelect = {
        id: inserted.id,
        locationId: input.locationId,
        businessId,
        creditorName: input.creditorName,
        description: input.description ?? null,
        totalAmount: input.totalAmount,
        paidAmount: "0.00",
        interestRate: input.interestRate ?? "0.00",
        dueDate: dueDate ? new Date(dueDate) : null,
        loanDate: new Date(loanDate),
        installmentAmount: input.installmentAmount ?? null,
        destinationAccountId: input.destinationAccountId,
        loanAccountId,
        isDisbursed: false,
        disbursementDate: null,
        disbursementFee: null,
        recurringBillTemplateId: null,
        status: "active",
        paymentSchedule: input.paymentSchedule ?? "monthly",
        notes: input.notes ?? null,
        createdBy: enteredBy,
        createdAt: inserted.createdAt,
        updatedAt: inserted.updatedAt,
        deletedAt: null,
      };

      await postOriginationLedgerEntries({
        db,
        businessId,
        debt: insertedDebt,
        destinationAccountId: input.destinationAccountId,
        loanAccountId,
        totalAmount: input.totalAmount,
        loanDate,
        immediate: input.disburseImmediately ?? true,
        enteredBy,
      });

      // If a schedule + installment amount were provided, also create a recurring bill template
      // pointing at the loan liability account so the existing Bills flow handles each repayment.
      if (input.installmentAmount && input.paymentSchedule) {
        const frequency = input.paymentSchedule as Frequency;
        const firstDue = advanceDateByFrequency(new Date(loanDate), frequency);
        const templateId = await createRecurringBillTemplateForDebt({
          db,
          debt: insertedDebt,
          liabilityAccountId: loanAccountId,
          installmentAmount: input.installmentAmount,
          frequency,
          nextDueDate: firstDue,
          enteredBy,
        });
        await db.update(debts).set({ recurringBillTemplateId: templateId }).where(eq(debts.id, inserted.id));
      }

      return { id: inserted.id, success: true, loanAccountId };
    }),

  update: debtsManage
    .input(z.object({
      id: z.number(),
      creditorName: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      totalAmount: z.string().optional(),
      paidAmount: z.string().optional(),
      interestRate: z.string().optional(),
      dueDate: z.string().optional(),
      status: statusEnum.optional(),
      paymentSchedule: paymentScheduleEnum.optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, debts, input.id);
      const { id, ...updates } = input;
      const updateData: Record<string, unknown> = {};
      if (updates.creditorName !== undefined) updateData.creditorName = updates.creditorName;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.totalAmount !== undefined) updateData.totalAmount = updates.totalAmount;
      if (updates.paidAmount !== undefined) updateData.paidAmount = updates.paidAmount;
      if (updates.interestRate !== undefined) updateData.interestRate = updates.interestRate;
      if (updates.dueDate !== undefined) updateData.dueDate = new Date(updates.dueDate);
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.paymentSchedule !== undefined) updateData.paymentSchedule = updates.paymentSchedule;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      await db.update(debts).set(updateData).where(eq(debts.id, id));
      return { success: true };
    }),

  delete: debtsManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, debts, input.id);
      await db.update(debts).set({ deletedAt: new Date() }).where(eq(debts.id, input.id));
      return { success: true };
    }),

  recordPayment: debtsManage
    .input(z.object({
      id: z.number(),
      amount: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const debt = await requireAuthorizedEntity(ctx, debts, input.id);

      const paymentAmount = d(input.amount);
      if (paymentAmount.lessThanOrEqualTo(0)) {
        throw new Error("Payment amount must be greater than zero.");
      }

      const currentPaid = d(debt.paidAmount || "0.00");
      const totalAmount = d(debt.totalAmount || "0.00");
      const newPaid = currentPaid.plus(paymentAmount);

      if (newPaid.greaterThan(totalAmount)) {
        throw new Error("Payment amount exceeds the remaining balance on this debt.");
      }

      const newStatus = newPaid.equals(totalAmount) ? "paid" : debt.status;

      await db.transaction(async (tx) => {
        await tx.update(debts).set({
          paidAmount: newPaid.toFixed(2),
          status: newStatus,
        }).where(eq(debts.id, input.id));
      });

      return { success: true, newPaidAmount: newPaid.toFixed(2), status: newStatus };
    }),

  disburse: debtsManage
    .input(z.object({
      id: z.number(),
      disbursementDate: z.string(),
      fee: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const debt = (await requireAuthorizedEntity(ctx, debts, input.id)) as typeof debts.$inferSelect;

      if (debt.isDisbursed) {
        throw new Error("This debt has already been disbursed.");
      }
      if (!debt.destinationAccountId) {
        throw new Error("Debt has no destination bank account. Edit the debt first to set one.");
      }
      if (!debt.loanAccountId) {
        throw new Error("Debt has no classified loan account. Recreate the debt to re-classify.");
      }

      await postDisbursementLedgerEntries({
        db,
        debt,
        destinationAccountId: debt.destinationAccountId,
        loanAccountId: debt.loanAccountId,
        totalAmount: debt.totalAmount,
        disbursementDate: input.disbursementDate,
        fee: input.fee,
        enteredBy: ctx.user?.id ?? 1,
      });

      return { success: true };
    }),

  generateInstallment: debtsManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const debt = (await requireAuthorizedEntity(ctx, debts, input.id)) as typeof debts.$inferSelect;
      if (!debt.recurringBillTemplateId) {
        throw new Error("This debt has no recurring bill template. Set installmentAmount + paymentSchedule on the debt to enable scheduled payments.");
      }
      const billId = await generateNextInstallment(db, debt.recurringBillTemplateId, debt.id);
      return { success: true, billId };
    }),
});
