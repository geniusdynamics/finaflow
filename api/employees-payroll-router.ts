import { z } from "zod";
import { createRouter, payrollQuery, payrollProcess, getCurrentBusinessLocationIds, requireAuthorizedLocation, requireAuthorizedEntity } from "./middleware";
import { getDb } from "./queries/connection";
import { employees, payrollPeriods, payrollEntries, payrollAdvances, accounts, ledgerEntries, bills, billPayments, billItems } from "@db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { d } from "./lib/decimal";
import { computePaye, computeNhif, computeNssf, computeHousingLevy } from "./lib/tax";

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
      const [result] = await db.insert(employees).values({
        ...input, employmentDate: new Date(input.employmentDate),
      } as any).returning();
      return { id: result.id, success: true };
    }),

  update: payrollProcess
    .input(z.object({
      id: z.number(), fullName: z.string().optional(), phone: z.string().optional(),
      basicSalary: z.string().optional(), isActive: z.boolean().optional(),
      terminationDate: z.string().optional(), bankName: z.string().optional(),
      bankAccount: z.string().optional(), bankCode: z.string().optional(),
      idNumber: z.string().optional(), kraPin: z.string().optional(),
      nssfNumber: z.string().optional(), nhifNumber: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, employees, input.id);
      
      const { id, ...rawUpdates } = input;
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
});

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

      return emps.map(emp => {
        const entry = entries.find(e => e.employeeId === emp.id);
        return { employee: emp, entry: entry ?? null };
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
      } as any).returning();
      return { id: result.id, success: true };
    }),

  processPayroll: payrollProcess
    .input(z.object({ periodId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const period = await requireAuthorizedEntity(ctx, payrollPeriods, input.periodId);

      const emps = await db.select().from(employees).where(
        and(eq(employees.locationId, period.locationId), eq(employees.isActive, true), isNull(employees.deletedAt))
      );

      const existingEntries = await db.select().from(payrollEntries).where(
        and(eq(payrollEntries.periodId, input.periodId), isNull(payrollEntries.deletedAt))
      );
      const existingEmpIds = new Set(existingEntries.map(e => e.employeeId));

      let totalNetPay = d(0);
      const entries: { id: number; employeeId: number; netPay: string }[] = [];
      let billId = period.generatedBillId;

      await db.transaction(async (tx) => {
        for (const emp of emps) {
          if (existingEmpIds.has(emp.id)) continue;

          const advances = await tx.select().from(payrollAdvances).where(
            and(eq(payrollAdvances.employeeId, emp.id), eq(payrollAdvances.status, "approved"),
              sql`${payrollAdvances.payrollPeriodId} = ${input.periodId} OR ${payrollAdvances.payrollPeriodId} IS NULL`,
              isNull(payrollAdvances.deletedAt))
          );
          const advanceDeduction = advances.reduce((sum, a) => sum.plus(d(a.balanceRemaining)), d(0));
          const basicPay = d(emp.basicSalary);
          const grossNum = basicPay.toNumber();
          const nssfVal = computeNssf(grossNum);
          const nssf = d(nssfVal.employee);
          const housingLevy = d(computeHousingLevy(grossNum));
          const taxableIncome = d(Math.max(0, grossNum - nssfVal.employee - housingLevy.toNumber()));
          const nhif = d(computeNhif(grossNum));
          const paye = d(computePaye(taxableIncome.toNumber()));
          const grossDeductions = advanceDeduction.plus(nssf).plus(nhif).plus(housingLevy).plus(paye);
          const netPay = d(Math.max(0, basicPay.minus(grossDeductions).toNumber()));

          totalNetPay = totalNetPay.plus(netPay);

          const [result] = await tx.insert(payrollEntries).values({
            periodId: input.periodId, employeeId: emp.id,
            basicPay: emp.basicSalary, advancesDeducted: advanceDeduction.toFixed(2),
            deductions: grossDeductions.toFixed(2), netPay: netPay.toFixed(2),
            payeDeducted: paye.toFixed(2),
            nhifDeducted: nhif.toFixed(2),
            nssfDeducted: nssf.toFixed(2),
          } as any).returning();
          entries.push({ id: result.id, employeeId: emp.id, netPay: netPay.toFixed(2) });

          for (const adv of advances) {
            const newBal = d(Math.max(0, d(adv.balanceRemaining).minus(netPay.mul(0.3)).toNumber()));
            const newStatus = newBal.lte(0) ? "repaid" : "partially_repaid";
            await tx.update(payrollAdvances).set({ balanceRemaining: newBal.toFixed(2), status: newStatus }).where(eq(payrollAdvances.id, adv.id));
          }
        }

        for (const e of existingEntries) {
          totalNetPay = totalNetPay.plus(d(e.netPay));
        }

        if (!billId) {
          const [billResult] = await tx.insert(bills).values({
            locationId: period.locationId,
            description: `Payroll: ${period.periodName}`,
            amount: totalNetPay.toFixed(2),
            balanceDue: totalNetPay.toFixed(2),
            issueDate: new Date(),
            dueDate: period.paymentDate,
          } as any).returning();
          billId = billResult.id;
        } else {
          await tx.update(bills).set({ amount: totalNetPay.toFixed(2), balanceDue: totalNetPay.toFixed(2) }).where(eq(bills.id, billId));
          await tx.update(billItems).set({ deletedAt: new Date() }).where(eq(billItems.billId, billId));
        }

        const allEntriesForBill = await tx.select().from(payrollEntries).where(
          and(eq(payrollEntries.periodId, input.periodId), isNull(payrollEntries.deletedAt))
        );
        for (const entry of allEntriesForBill) {
          const emp = await tx.select().from(employees).where(eq(employees.id, entry.employeeId)).limit(1);
          const empName = emp[0]?.fullName ?? `Employee #${entry.employeeId}`;
          await tx.insert(billItems).values({
            billId,
            itemName: empName,
            quantity: "1.000",
            unitPrice: entry.netPay,
            totalPrice: entry.netPay,
            notes: `Basic: ${entry.basicPay}, Deductions: ${entry.deductions}, Advances: ${entry.advancesDeducted}, PAYE: ${entry.payeDeducted ?? "0"}`,
          } as any).returning();
        }

        await tx.update(payrollPeriods).set({
          status: "processing",
          generatedBillId: billId,
          totalNetPay: totalNetPay.toFixed(2),
        }).where(eq(payrollPeriods.id, input.periodId));
      });

      return { entries, billId, totalNetPay: totalNetPay.toFixed(2), success: true };
    }),

  markPaid: payrollProcess
    .input(z.object({ periodId: z.number(), accountId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const period = await requireAuthorizedEntity(ctx, payrollPeriods, input.periodId);
      const acct = await requireAuthorizedEntity(ctx, accounts, input.accountId);
      
      if (acct.locationId !== period.locationId) {
        throw new Error("Account and Period must belong to the same location");
      }

      await db.transaction(async (tx) => {
        const entries = await tx.select().from(payrollEntries).where(
          and(eq(payrollEntries.periodId, input.periodId), isNull(payrollEntries.deletedAt))
        );
        const totalPayroll = entries.reduce((sum, e) => sum.plus(d(e.netPay)), d(0));

        const newBalance = d(acct.currentBalance).minus(totalPayroll);
        await tx.insert(ledgerEntries).values({
          accountId: input.accountId, transactionType: "payroll",
          transactionId: input.periodId, entryType: "debit",
          amount: totalPayroll.toFixed(2), balanceAfter: newBalance.toFixed(2), entryDate: new Date(),
          createdBy: (ctx as any).user?.id,
        } as any).returning();
        await tx.update(accounts).set({ currentBalance: newBalance.toFixed(2) }).where(eq(accounts.id, input.accountId));

        if (period.generatedBillId) {
          await tx.update(bills).set({
            status: "paid", amountPaid: totalPayroll.toFixed(2), balanceDue: "0.00"
          }).where(eq(bills.id, period[0].generatedBillId));
          await tx.insert(billPayments).values({
            billId: period[0].generatedBillId,
            paymentMethod: "bank_transfer",
            amount: totalPayroll.toFixed(2),
            paymentDate: new Date(),
            accountId: input.accountId,
            reference: `Payroll ${period[0].periodName}`,
            enteredBy: (ctx as any).user?.id,
          } as any).returning();
        }

        await tx.update(payrollPeriods).set({ status: "paid" }).where(eq(payrollPeriods.id, input.periodId));
        for (const entry of entries) {
          await tx.update(payrollEntries).set({ paidAt: new Date() }).where(eq(payrollEntries.id, entry.id));
        }
      });

      return { success: true };
    }),

  addEmployeeToPeriod: payrollProcess
    .input(z.object({ periodId: z.number(), employeeId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const period = await requireAuthorizedEntity(ctx, payrollPeriods, input.periodId);
      const emp = await requireAuthorizedEntity(ctx, employees, input.employeeId);
      
      if (emp.locationId !== period.locationId) throw new Error("Employee does not belong to this period's location");

      const existing = await db.select().from(payrollEntries).where(
        and(eq(payrollEntries.periodId, input.periodId), eq(payrollEntries.employeeId, input.employeeId), isNull(payrollEntries.deletedAt))
      ).limit(1);
      if (existing.length > 0) return { entryId: existing[0].id, success: true };

      await db.transaction(async (tx) => {
        const advances = await tx.select().from(payrollAdvances).where(
        and(eq(payrollAdvances.employeeId, emp.id), eq(payrollAdvances.status, "approved"),
        sql`${payrollAdvances.payrollPeriodId} = ${input.periodId} OR ${payrollAdvances.payrollPeriodId} IS NULL`,
        isNull(payrollAdvances.deletedAt))
        );
        const advanceDeduction = advances.reduce((sum, a) => sum.plus(d(a.balanceRemaining)), d(0));
        const basicPay = d(emp.basicSalary);
        const grossNum = basicPay.toNumber();
        const nssfVal = computeNssf(grossNum);
        const nssf = d(nssfVal.employee);
        const housingLevy = d(computeHousingLevy(grossNum));
        const taxableIncome = d(Math.max(0, grossNum - nssfVal.employee - housingLevy.toNumber()));
        const nhif = d(computeNhif(grossNum));
          const paye = d(computePaye(taxableIncome.toNumber()));
        const grossDeductions = advanceDeduction.plus(nssf).plus(nhif).plus(housingLevy).plus(paye);
        const netPay = d(Math.max(0, basicPay.minus(grossDeductions).toNumber()));

        const [result] = await tx.insert(payrollEntries).values({
        periodId: input.periodId, employeeId: emp.id,
        basicPay: emp.basicSalary, advancesDeducted: advanceDeduction.toFixed(2),
        deductions: grossDeductions.toFixed(2), netPay: netPay.toFixed(2),
          payeDeducted: paye.toFixed(2),
            nhifDeducted: nhif.toFixed(2),
          nssfDeducted: nssf.toFixed(2),
        } as any).returning();

        for (const adv of advances) {
          const newBal = d(Math.max(0, d(adv.balanceRemaining).minus(netPay.mul(0.3)).toNumber()));
            const newStatus = newBal.lte(0) ? "repaid" : "partially_repaid";
            await tx.update(payrollAdvances).set({ balanceRemaining: newBal.toFixed(2), status: newStatus }).where(eq(payrollAdvances.id, adv.id));
          }

        const allEntries = await tx.select().from(payrollEntries).where(
          and(eq(payrollEntries.periodId, input.periodId), isNull(payrollEntries.deletedAt))
        );
        const totalNetPay = allEntries.reduce((sum, e) => sum.plus(d(e.netPay)), d(0));

        if (period.generatedBillId) {
          await tx.update(bills).set({ amount: totalNetPay.toFixed(2), balanceDue: totalNetPay.toFixed(2) }).where(eq(bills.id, period.generatedBillId));
        }
        await tx.update(payrollPeriods).set({ totalNetPay: totalNetPay.toFixed(2) }).where(eq(payrollPeriods.id, input.periodId));
      });

      return { success: true };
    }),

  removeEmployeeFromPeriod: payrollProcess
    .input(z.object({ periodId: z.number(), employeeId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const period = await requireAuthorizedEntity(ctx, payrollPeriods, input.periodId);
      await requireAuthorizedEntity(ctx, employees, input.employeeId);

      await db.transaction(async (tx) => {
        await tx.update(payrollEntries).set({ deletedAt: new Date() }).where(
          and(eq(payrollEntries.periodId, input.periodId), eq(payrollEntries.employeeId, input.employeeId))
        );
        const allEntries = await tx.select().from(payrollEntries).where(
          and(eq(payrollEntries.periodId, input.periodId), isNull(payrollEntries.deletedAt))
        );
        const totalNetPay = allEntries.reduce((sum, e) => sum.plus(d(e.netPay)), d(0));

        if (period.generatedBillId) {
          await tx.update(bills).set({ amount: totalNetPay.toFixed(2), balanceDue: totalNetPay.toFixed(2) }).where(eq(bills.id, period.generatedBillId));
        }
        await tx.update(payrollPeriods).set({ totalNetPay: totalNetPay.toFixed(2) }).where(eq(payrollPeriods.id, input.periodId));
      });
      return { success: true };
    }),

  listAdvances: payrollQuery
    .input(z.object({ employeeId: z.number().optional(), status: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [isNull(payrollAdvances.deletedAt)];
      if (input?.employeeId) {
        await requireAuthorizedEntity(ctx, employees, input.employeeId);
        conditions.push(eq(payrollAdvances.employeeId, input.employeeId));
      } else {
        const locIds = await getCurrentBusinessLocationIds(ctx);
        if (locIds.length === 0) return [];
        // We need to join with employees to filter by locationId since payrollAdvances lacks it
        const emps = await db.select({ id: employees.id }).from(employees).where(
          sql`${employees.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`
        );
        const empIds = emps.map(e => e.id);
        if (empIds.length === 0) return [];
        conditions.push(sql`${payrollAdvances.employeeId} IN (${sql.join(empIds.map(id => sql`${id}`), sql`, `)})`);
      }
      if (input?.status) conditions.push(eq(payrollAdvances.status, input.status as any));
      return db.select().from(payrollAdvances).where(and(...conditions)).orderBy(desc(payrollAdvances.requestDate));
    }),

  requestAdvance: payrollQuery
    .input(z.object({
      employeeId: z.number(), amount: z.string(), requestDate: z.string(),
      repaymentPeriods: z.number().default(1), notes: z.string().optional(),
      payrollPeriodId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, employees, input.employeeId);
      if (input.payrollPeriodId) {
        await requireAuthorizedEntity(ctx, payrollPeriods, input.payrollPeriodId);
      }
      const [result] = await db.insert(payrollAdvances).values({
        employeeId: input.employeeId, amount: input.amount, balanceRemaining: input.amount,
        requestDate: new Date(input.requestDate), repaymentPeriods: input.repaymentPeriods,
        notes: input.notes, status: "pending", payrollPeriodId: input.payrollPeriodId,
      } as any).returning();
      return { id: result.id, success: true };
    }),

  approveAdvance: payrollProcess
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      // Since payrollAdvances lacks locationId, we fetch it first, then check the employee
      const advance = await db.select().from(payrollAdvances).where(and(eq(payrollAdvances.id, input.id), isNull(payrollAdvances.deletedAt))).limit(1);
      if (advance.length === 0) throw new Error("Advance not found");
      await requireAuthorizedEntity(ctx, employees, advance[0].employeeId);

      await db.update(payrollAdvances).set({
        status: "approved", approvedBy: (ctx as any).user?.id,
      }).where(eq(payrollAdvances.id, input.id));
      return { success: true };
    }),
});
