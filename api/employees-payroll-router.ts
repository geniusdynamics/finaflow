import { z } from "zod";
import { createRouter, payrollQuery, payrollProcess, getCurrentBusinessLocationIds, requireAuthorizedLocation, requireAuthorizedEntity } from "./middleware";
import { getDb } from "./queries/connection";
import { employees, payrollPeriods, payrollEntries, payrollPayments, payrollAdvances, accounts, bills, billItems, locations, businesses } from "@db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { d } from "./lib/decimal";
import { computeEntryAmounts } from "./lib/payroll-calc";
import { postPayments, reversePayment, recoverAdvances, rebuildBillItems } from "./lib/payroll-payments";
import { users, userBusinesses } from "@db/schema";
import { hashPassword } from "./lib/password";
import { logAudit } from "./lib/audit";

export async function buildEmployeeUsername(
  fullName: string,
  businessName: string,
  isTaken: (candidate: string) => boolean | Promise<boolean>,
): Promise<string> {
  // Extract first name from fullName (first word, slugified)
  const firstName = (fullName ?? "")
    .split(" ")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

  const safeFirstName = firstName || "user";

  // Business abbreviation: first 3 alphanumeric chars of business name
  const bizAbbr = (businessName ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 3);

  const safeBizAbbr = bizAbbr || "biz";

  // Build candidate list: try firstName first, then {bizAbbr}_{firstName}, then numbered variants
  const candidates: string[] = [safeFirstName];

  if (bizAbbr) {
    candidates.push(`${safeBizAbbr}_${safeFirstName}`);
    for (let i = 1; i <= 5; i++) {
      candidates.push(`${safeBizAbbr}_${safeFirstName}_${i}`);
    }
  } else {
    for (let i = 1; i <= 5; i++) {
      candidates.push(`${safeFirstName}_${i}`);
    }
  }

  // Return first non-taken candidate
  for (const candidate of candidates) {
    if (!(await isTaken(candidate))) return candidate;
  }

  // Last resort — append timestamp (extremely unlikely to reach here)
  return `${safeFirstName}_${Date.now()}`;
}

export const employeesRouter = createRouter({
  list: payrollQuery
    .input(z.object({ locationId: z.number().optional(), active: z.boolean().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [isNull(employees.deletedAt)];
      if (input?.locationId) {
        await requireAuthorizedLocation(ctx, input.locationId);
        conditions.push(eq(employees.locationId, input.locationId));
      } else {
        const locIds = await getCurrentBusinessLocationIds(ctx);
        if (locIds.length === 0) return [];
        conditions.push(sql`${employees.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`);
      }
      if (input?.active) conditions.push(eq(employees.isActive, true));
      return db.select().from(employees).where(and(...conditions)).orderBy(employees.fullName);
    }),

  get: payrollQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const emp = await requireAuthorizedEntity(ctx, employees, input.id);
      return emp;
    }),

  create: payrollProcess
    .input(z.object({
      locationId: z.number(), fullName: z.string().min(1).max(255),
      phone: z.string().min(1).max(20), idNumber: z.string().optional(),
      kraPin: z.string().optional(), nssfNumber: z.string().optional(),
      nhifNumber: z.string().optional(), salaryType: z.enum(["monthly", "weekly", "daily", "hourly"]),
      basicSalary: z.string(), bankName: z.string().optional(),
      bankAccount: z.string().optional(), bankCode: z.string().optional(),
      employmentDate: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedLocation(ctx, input.locationId);

      const accountId = ctx.user?.currentBusiness?.accountId || ctx.user?.accountId;
      const currentBusinessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId ?? null;
      if (!accountId) throw new Error("Account context required to create employee user");

      // Generate username using first-name + business-abbr strategy
      const businessRow = currentBusinessId
        ? await db.select({ name: businesses.name }).from(businesses).where(eq(businesses.id, currentBusinessId)).limit(1)
        : [];
      const businessName = businessRow[0]?.name ?? "";
      const isTaken = async (candidate: string): Promise<boolean> => {
        const existing = await db.query.users.findFirst({
          where: (u, { eq, and, isNull }) => and(
            eq(u.username, candidate),
            eq(u.accountId, accountId),
            isNull(u.deletedAt),
          ),
          columns: { id: true },
        });
        return !!existing;
      };
      const username = await buildEmployeeUsername(input.fullName, businessName, isTaken);
      const initialPassword = "emp@" + Math.random().toString(36).slice(2, 8).toUpperCase();
      const passwordHash = await hashPassword(initialPassword);

      const [result] = await db.transaction(async (tx) => {
        // Create user account with employee role
        const [createdUser] = await tx.insert(users).values({
          username,
          passwordHash,
          name: input.fullName,
          phone: input.phone,
          role: "employee",
          accountId,
          currentBusinessId,
          isActive: true,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any).returning();

        // Link user to business
        if (currentBusinessId) {
          await tx.insert(userBusinesses).values({
            userId: createdUser.id,
            businessId: currentBusinessId,
            role: "employee",
            isActive: true,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);
        }

        // Create the employee record
        const [createdEmp] = await tx.insert(employees).values({
          ...input,
          userId: createdUser.id,
          employmentDate: new Date(input.employmentDate),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any).returning();

        return [createdEmp, username, initialPassword];
      });

      return { id: result.id, success: true, username: result[1], initialPassword: result[2] };
    }),

  update: payrollProcess
    .input(z.object({
      id: z.number(), fullName: z.string().optional(), phone: z.string().optional(),
      basicSalary: z.string().optional(), isActive: z.boolean().optional(),
      terminationDate: z.string().optional(), bankName: z.string().optional(),
      bankAccount: z.string().optional(), bankCode: z.string().optional(),
      idNumber: z.string().optional(), kraPin: z.string().optional(),
      nssfNumber: z.string().optional(), nhifNumber: z.string().optional(),
      userId: z.number().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, employees, input.id);
      
      const { id, ...rawUpdates } = input;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: any = { ...rawUpdates };
      if (rawUpdates.terminationDate) updates.terminationDate = new Date(rawUpdates.terminationDate);
      await db.update(employees).set(updates).where(eq(employees.id, id));
      return { success: true };
    }),

  delete: payrollProcess
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, employees, input.id);
      await db.update(employees).set({ deletedAt: new Date() }).where(eq(employees.id, input.id));
      return { success: true };
    }),

  deleteWithUser: payrollProcess
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const emp = await requireAuthorizedEntity(ctx, employees, input.id);
      const _currentUserId = ctx.user?.id;

      await db.transaction(async (tx) => {
        // Soft-delete the employee record
        await tx.update(employees).set({ deletedAt: new Date(), isActive: false }).where(eq(employees.id, input.id));

        // If the employee has a linked user, soft-delete that user too
        if (emp.userId) {
          await tx.update(users).set({ deletedAt: new Date(), isActive: false }).where(eq(users.id, emp.userId));
          await tx.update(userBusinesses).set({ isActive: false }).where(eq(userBusinesses.userId, emp.userId));
        }
      });

      return { success: true, deletedUserId: emp.userId ?? null };
    }),
});

/** Resolves the owning business for a location so payroll can find the right ledger accounts. */
export async function resolveBusinessId(db: ReturnType<typeof getDb>, locationId: number): Promise<number | null> {
  const [loc] = await db.select({ businessId: locations.businessId }).from(locations).where(eq(locations.id, locationId)).limit(1);
  if (!loc?.businessId) return null;
  const [biz] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, loc.businessId)).limit(1);
  return biz?.id ?? null;
}

export const payrollRouter = createRouter({
  periods: payrollQuery
    .input(z.object({ locationId: z.number().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [isNull(payrollPeriods.deletedAt)];
      if (input?.locationId) {
        await requireAuthorizedLocation(ctx, input.locationId);
        conditions.push(eq(payrollPeriods.locationId, input.locationId));
      } else {
        const locIds = await getCurrentBusinessLocationIds(ctx);
        if (locIds.length > 0) {
          conditions.push(sql`${payrollPeriods.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`);
        }
      }
      return db.select().from(payrollPeriods).where(and(...conditions)).orderBy(desc(payrollPeriods.startDate));
    }),

  entries: payrollQuery
    .input(z.object({ periodId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const period = await requireAuthorizedEntity(ctx, payrollPeriods, input.periodId);

      const emps = await db.select().from(employees).where(
        and(eq(employees.locationId, period.locationId), eq(employees.isActive, true), isNull(employees.deletedAt))
      ).orderBy(employees.fullName);

      const entries = await db.select().from(payrollEntries).where(
        and(eq(payrollEntries.periodId, input.periodId), isNull(payrollEntries.deletedAt))
      );

      const payments = await db.select().from(payrollPayments).where(
        eq(payrollPayments.periodId, input.periodId)
      );

      return emps.map(emp => {
        const entry = entries.find(e => e.employeeId === emp.id);
        return {
          employee: emp,
          entry: entry ?? null,
          payments: entry ? payments.filter(p => p.entryId === entry.id) : [],
          assigned: Boolean(entry),
        };
      });
    }),

  createPeriod: payrollProcess
    .input(z.object({
      locationId: z.number(), periodName: z.string().min(1).max(50),
      startDate: z.string(), endDate: z.string(), paymentDate: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedLocation(ctx, input.locationId);
      const [result] = await db.insert(payrollPeriods).values({
        ...input, status: "open",
        startDate: new Date(input.startDate), endDate: new Date(input.endDate),
        paymentDate: new Date(input.paymentDate),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).returning();
      return { id: result.id, success: true };
    }),

  processPayroll: payrollProcess
    .input(z.object({ periodId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const period = await requireAuthorizedEntity(ctx, payrollPeriods, input.periodId);

      // Only employees explicitly assigned to the period are processed. Being
      // active at the location is not the same as being on this payroll run.
      const entries = await db.select().from(payrollEntries).where(
        and(eq(payrollEntries.periodId, input.periodId), isNull(payrollEntries.deletedAt))
      );
      if (entries.length === 0) {
        throw new Error("Assign at least one employee to this period before processing payroll");
      }

      const processed: { entryId: number; employeeId: number; netPay: string }[] = [];
      let billId = period.generatedBillId;
      let totalNetPay = d(0);

      await db.transaction(async (tx) => {
        for (const entry of entries) {
          // An entry that has already been (partly) paid is never rewritten.
          if (d(entry.paidAmount ?? "0").gt(0)) {
            totalNetPay = totalNetPay.plus(d(entry.netPay));
            processed.push({ entryId: entry.id, employeeId: entry.employeeId, netPay: entry.netPay });
            continue;
          }

          const [emp] = await tx.select().from(employees).where(eq(employees.id, entry.employeeId)).limit(1);
          if (!emp) continue;

          const advances = await tx.select().from(payrollAdvances).where(
            and(eq(payrollAdvances.employeeId, emp.id), eq(payrollAdvances.status, "approved"),
              sql`${payrollAdvances.payrollPeriodId} = ${input.periodId} OR ${payrollAdvances.payrollPeriodId} IS NULL`,
              isNull(payrollAdvances.deletedAt))
          );
          const advanceDeduction = advances.reduce((sum, a) => sum.plus(d(a.balanceRemaining)), d(0));
          const amounts = computeEntryAmounts(emp, entry.daysWorked, advanceDeduction.toFixed(2));

          await tx.update(payrollEntries).set({
            basicPay: amounts.basicPay,
            daysWorked: amounts.daysWorked,
            advancesDeducted: amounts.advancesDeducted,
            deductions: amounts.deductions,
            payeDeducted: amounts.paye,
            nhifDeducted: amounts.nhif,
            nssfDeducted: amounts.nssf,
            housingLevyDeducted: amounts.housingLevy,
            netPay: amounts.netPay,
            paymentStatus: "unpaid",
          }).where(eq(payrollEntries.id, entry.id));

          totalNetPay = totalNetPay.plus(d(amounts.netPay));
          processed.push({ entryId: entry.id, employeeId: entry.employeeId, netPay: amounts.netPay });
        }

        totalNetPay = totalNetPay.toDecimalPlaces(2);
        const total = totalNetPay.toFixed(2);

        if (!billId) {
          const [billResult] = await tx.insert(bills).values({
            locationId: period.locationId,
            description: `Payroll: ${period.periodName}`,
            amount: total,
            amountPaid: "0.00",
            balanceDue: total,
            issueDate: new Date(),
            dueDate: period.paymentDate,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any).returning();
          billId = billResult.id;
        } else {
          await tx.update(bills).set({ amount: total }).where(eq(bills.id, billId));
          await tx.update(billItems).set({ deletedAt: new Date() }).where(eq(billItems.billId, billId));
        }

        const allEntriesForBill = await tx.select().from(payrollEntries).where(
          and(eq(payrollEntries.periodId, input.periodId), isNull(payrollEntries.deletedAt))
        );
        for (const entry of allEntriesForBill) {
          const [empRow] = await tx.select({ fullName: employees.fullName }).from(employees).where(eq(employees.id, entry.employeeId)).limit(1);
          const empName = empRow?.fullName ?? `Employee #${entry.employeeId}`;
          await tx.insert(billItems).values({
            billId,
            itemName: empName,
            quantity: "1.000",
            unitPrice: entry.netPay,
            totalPrice: entry.netPay,
            notes: `Basic: ${entry.basicPay}, Deductions: ${entry.deductions}, Advances: ${entry.advancesDeducted ?? "0"}, PAYE: ${entry.payeDeducted ?? "0"}`,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any).returning();
        }

        await tx.update(payrollPeriods).set({
          status: "processing",
          generatedBillId: billId,
          totalNetPay: total,
        }).where(eq(payrollPeriods.id, input.periodId));
      });

      return { entries: processed, billId, totalNetPay: totalNetPay.toFixed(2), success: true };
    }),

  // Pays every remaining balance in one run. Kept so existing callers keep
  // working; the UI uses recordPayments for partial or selective payments.
  markPaid: payrollProcess
    .input(z.object({ periodId: z.number(), accountId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (ctx as any).user?.id ?? 1;
      const period = await requireAuthorizedEntity(ctx, payrollPeriods, input.periodId);
      const acct = await requireAuthorizedEntity(ctx, accounts, input.accountId);

      if (acct.locationId !== period.locationId) {
        throw new Error("Account and Period must belong to the same location");
      }
      const businessId = await resolveBusinessId(db, period.locationId);

      const entries = await db.select().from(payrollEntries).where(
        and(eq(payrollEntries.periodId, input.periodId), isNull(payrollEntries.deletedAt))
      );
      const payments = entries
        .map(e => ({
          entryId: e.id,
          amount: d(e.netPay).minus(d(e.paidAmount ?? "0")).toDecimalPlaces(2).toFixed(2),
        }))
        .filter(p => d(p.amount).gt(0));
      if (payments.length === 0) throw new Error("Nothing left to pay for this period");

      const result = await postPayments({
        period: period as typeof payrollPeriods.$inferSelect,
        account: acct as typeof accounts.$inferSelect,
        businessId,
        userId,
        paymentMethod: "bank_transfer",
        reference: `Payroll ${period.periodName}`,
        payments,
      });
      return { success: true, payments: result.payments };
    }),

  recordPayments: payrollProcess
    .input(z.object({
      periodId: z.number(),
      accountId: z.number(),
      paymentMethod: z.enum(["cash", "mpesa", "bank_transfer", "wallet"]).default("mpesa"),
      reference: z.string().max(100).optional(),
      payments: z.array(z.object({ entryId: z.number(), amount: z.string() })).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (ctx as any).user?.id ?? 1;
      const period = await requireAuthorizedEntity(ctx, payrollPeriods, input.periodId);
      const acct = await requireAuthorizedEntity(ctx, accounts, input.accountId);

      if (acct.locationId !== period.locationId) {
        throw new Error("Account and Period must belong to the same location");
      }
      const businessId = await resolveBusinessId(db, period.locationId);

      const result = await postPayments({
        period: period as typeof payrollPeriods.$inferSelect,
        account: acct as typeof accounts.$inferSelect,
        businessId,
        userId,
        paymentMethod: input.paymentMethod,
        reference: input.reference ?? null,
        payments: input.payments,
      });

      await logAudit({
        userId,
        businessId: businessId ?? undefined,
        action: "UPDATE",
        resource: "payroll",
        resourceId: period.id,
        details: {
          action: "record_payments",
          count: result.payments.length,
          total: result.payments.reduce((sum, p) => d(sum).plus(d(p.amount)).toFixed(2), "0.00"),
        },
      });

      return result;
    }),

  reversePayment: payrollProcess
    .input(z.object({ paymentId: z.number(), reason: z.string().trim().min(1).max(500) }))
    .mutation(async ({ input, ctx }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (ctx as any).user?.id ?? 1;
      const result = await reversePayment({ paymentId: input.paymentId, reason: input.reason, userId });

      await logAudit({
        userId,
        action: "UPDATE",
        resource: "payroll",
        resourceId: input.paymentId,
        details: { action: "reverse_payment", reason: input.reason },
      });

      return result;
    }),

  payments: payrollQuery
    .input(z.object({ periodId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, payrollPeriods, input.periodId);
      return db.select({
        id: payrollPayments.id,
        entryId: payrollPayments.entryId,
        employeeId: payrollPayments.employeeId,
        amount: payrollPayments.amount,
        accountId: payrollPayments.accountId,
        paymentMethod: payrollPayments.paymentMethod,
        reference: payrollPayments.reference,
        paidAt: payrollPayments.paidAt,
        reversedAt: payrollPayments.reversedAt,
        reversalReason: payrollPayments.reversalReason,
        employeeName: employees.fullName,
      }).from(payrollPayments)
        .leftJoin(employees, eq(employees.id, payrollPayments.employeeId))
        .where(eq(payrollPayments.periodId, input.periodId))
        .orderBy(desc(payrollPayments.paidAt));
    }),

  addEmployeeToPeriod: payrollProcess
    .input(z.object({ periodId: z.number(), employeeId: z.number(), daysWorked: z.number().min(0).max(744).optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const period = await requireAuthorizedEntity(ctx, payrollPeriods, input.periodId);
      const emp = await requireAuthorizedEntity(ctx, employees, input.employeeId);

      if (emp.locationId !== period.locationId) throw new Error("Employee does not belong to this period's location");

      // Employee must have been hired on or before the period's end date.
      const empDate = new Date(String(emp.employmentDate));
      const periodEnd = new Date(String(period.endDate));
      if (empDate > periodEnd) {
        throw new Error(`Employee was hired after this payroll period ended. Employment date: ${empDate.toISOString().split("T")[0]}, Period ends: ${periodEnd.toISOString().split("T")[0]}`);
      }

      const existing = await db.select().from(payrollEntries).where(
        and(eq(payrollEntries.periodId, input.periodId), eq(payrollEntries.employeeId, input.employeeId), isNull(payrollEntries.deletedAt))
      ).limit(1);
      if (existing.length > 0) return { entryId: existing[0].id, success: true };

      let entryId = 0;
      await db.transaction(async (tx) => {
        const advances = await tx.select().from(payrollAdvances).where(
          and(eq(payrollAdvances.employeeId, emp.id), eq(payrollAdvances.status, "approved"),
            sql`${payrollAdvances.payrollPeriodId} = ${input.periodId} OR ${payrollAdvances.payrollPeriodId} IS NULL`,
            isNull(payrollAdvances.deletedAt))
        );
        const advanceDeduction = advances.reduce((sum, a) => sum.plus(d(a.balanceRemaining)), d(0));
        const amounts = computeEntryAmounts(emp as { salaryType: string; basicSalary: string }, input.daysWorked, advanceDeduction.toFixed(2));

        const [created] = await tx.insert(payrollEntries).values({
          periodId: input.periodId,
          employeeId: emp.id,
          basicPay: amounts.basicPay,
          daysWorked: amounts.daysWorked,
          advancesDeducted: amounts.advancesDeducted,
          deductions: amounts.deductions,
          payeDeducted: amounts.paye,
          nhifDeducted: amounts.nhif,
          nssfDeducted: amounts.nssf,
          housingLevyDeducted: amounts.housingLevy,
          netPay: amounts.netPay,
          paymentStatus: "unpaid",
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any).returning({ id: payrollEntries.id });
        entryId = created.id;

        await recoverAdvances(tx, advances, d(amounts.advancesDeducted));

        if (period.generatedBillId) {
          await rebuildBillItems(tx, period.generatedBillId, input.periodId);
        }
      });

      return { entryId, success: true };
    }),

  requestAdvance: payrollProcess
    .input(z.object({
      employeeId: z.number(),
      amount: z.string(),
      requestDate: z.string(),
      notes: z.string().optional(),
      payrollPeriodId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, employees, input.employeeId);
      const [result] = await db.insert(payrollAdvances).values({
        employeeId: input.employeeId,
        amount: input.amount,
        balanceRemaining: input.amount,
        requestDate: new Date(input.requestDate),
        payrollPeriodId: input.payrollPeriodId ?? null,
        notes: input.notes ?? null,
        status: "approved",
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).returning();
      return { id: result.id, success: true };
    }),

  // Updates the days (or hours) a casual worked in the period and recalculates their pay.
  setEntryDaysWorked: payrollProcess
    .input(z.object({ periodId: z.number(), employeeId: z.number(), daysWorked: z.number().min(0).max(744) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const period = await requireAuthorizedEntity(ctx, payrollPeriods, input.periodId);
      const emp = await requireAuthorizedEntity(ctx, employees, input.employeeId);

      const [entry] = await db.select().from(payrollEntries).where(
        and(eq(payrollEntries.periodId, input.periodId), eq(payrollEntries.employeeId, input.employeeId), isNull(payrollEntries.deletedAt))
      ).limit(1);
      if (!entry) throw new Error("Employee is not assigned to this period");
      if (d(entry.paidAmount ?? "0").gt(0)) throw new Error("Days worked cannot change after a payment has been made");

      const advances = await db.select().from(payrollAdvances).where(
        and(eq(payrollAdvances.employeeId, emp.id), eq(payrollAdvances.status, "approved"),
          sql`${payrollAdvances.payrollPeriodId} = ${input.periodId} OR ${payrollAdvances.payrollPeriodId} IS NULL`,
          isNull(payrollAdvances.deletedAt))
      );
      const advanceDeduction = advances.reduce((sum, a) => sum.plus(d(a.balanceRemaining)), d(0));
      const amounts = computeEntryAmounts(emp as { salaryType: string; basicSalary: string }, input.daysWorked, advanceDeduction.toFixed(2));

      await db.transaction(async (tx) => {
        await tx.update(payrollEntries).set({
          basicPay: amounts.basicPay,
          daysWorked: amounts.daysWorked,
          advancesDeducted: amounts.advancesDeducted,
          deductions: amounts.deductions,
          payeDeducted: amounts.paye,
          nhifDeducted: amounts.nhif,
          nssfDeducted: amounts.nssf,
          housingLevyDeducted: amounts.housingLevy,
          netPay: amounts.netPay,
        }).where(eq(payrollEntries.id, entry.id));

        if (period.generatedBillId) {
          await rebuildBillItems(tx, period.generatedBillId, input.periodId);
          const all = await tx.select().from(payrollEntries).where(
            and(eq(payrollEntries.periodId, input.periodId), isNull(payrollEntries.deletedAt))
          );
          const total = all.reduce((sum, e) => sum.plus(d(e.netPay)), d(0));
          await tx.update(payrollPeriods).set({ totalNetPay: total.toFixed(2) }).where(eq(payrollPeriods.id, input.periodId));
        }
      });

      return { success: true, netPay: amounts.netPay };
    }),

  removeEmployeeFromPeriod: payrollProcess
    .input(z.object({ periodId: z.number(), employeeId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const period = await requireAuthorizedEntity(ctx, payrollPeriods, input.periodId);
      await requireAuthorizedEntity(ctx, employees, input.employeeId);

      const [existing] = await db.select().from(payrollEntries).where(
        and(eq(payrollEntries.periodId, input.periodId), eq(payrollEntries.employeeId, input.employeeId), isNull(payrollEntries.deletedAt))
      ).limit(1);
      if (!existing) return { success: true };
      if (d(existing.paidAmount ?? "0").gt(0)) {
        throw new Error("This employee has already been paid for this period. Reverse the payment first.");
      }

      await db.transaction(async (tx) => {
        await tx.update(payrollEntries).set({ deletedAt: new Date() }).where(eq(payrollEntries.id, existing.id));
        if (period.generatedBillId) {
          await rebuildBillItems(tx, period.generatedBillId, input.periodId);
          const all = await tx.select().from(payrollEntries).where(
            and(eq(payrollEntries.periodId, input.periodId), isNull(payrollEntries.deletedAt))
          );
          const total = all.reduce((sum, e) => sum.plus(d(e.netPay)), d(0));
          await tx.update(payrollPeriods).set({ totalNetPay: total.toFixed(2) }).where(eq(payrollPeriods.id, input.periodId));
        }
      });

      return { success: true };
    }),
});
