import { z } from "zod";
import { createRouter, payrollQuery, payrollProcess, getCurrentBusinessLocationIds } from "./middleware";
import { getDb } from "./queries/connection";
import { employees, payrollPeriods, payrollEntries, payrollAdvances, accounts, ledgerEntries, bills, billPayments, billItems } from "@db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";

export const employeesRouter = createRouter({
  list: payrollQuery
    .input(z.object({ locationId: z.number().optional(), active: z.boolean().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [isNull(employees.deletedAt)];
      if (input?.locationId) {
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
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(employees).where(and(eq(employees.id, input.id), isNull(employees.deletedAt))).limit(1);
      return rows[0] ?? null;
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
      // Verify the location belongs to current business
      const locIds = await getCurrentBusinessLocationIds(ctx);
      if (!locIds.includes(input.locationId)) throw new Error("Invalid location for current business");
      const [result] = await db.insert(employees).values({
        ...input, employmentDate: new Date(input.employmentDate),
      } as any);
      return { id: Number(result.insertId), success: true };
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
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...rawUpdates } = input;
      const updates: any = { ...rawUpdates };
      if (rawUpdates.terminationDate) updates.terminationDate = new Date(rawUpdates.terminationDate);
      await db.update(employees).set(updates).where(eq(employees.id, id));
      return { success: true };
    }),

  delete: payrollProcess
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
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
        conditions.push(eq(payrollPeriods.locationId, input.locationId));
      } else {
        const locIds = await getCurrentBusinessLocationIds(ctx);
        if (locIds.length > 0) {
          conditions.push(sql`${payrollPeriods.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`);
        }
      }
      return db.select().from(payrollPeriods).where(and(...conditions)).orderBy(desc(payrollPeriods.startDate));
    }),

  // Return ALL employees for the location, with their entry if any
  entries: payrollQuery
    .input(z.object({ periodId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const period = await db.select().from(payrollPeriods).where(eq(payrollPeriods.id, input.periodId)).limit(1);
      if (!period[0]) return [];

      // Get ALL active employees for this location
      const emps = await db.select().from(employees).where(
        and(eq(employees.locationId, period[0].locationId), eq(employees.isActive, true), isNull(employees.deletedAt))
      ).orderBy(employees.fullName);

      // Get entries for this period
      const entries = await db.select().from(payrollEntries).where(
        and(eq(payrollEntries.periodId, input.periodId), isNull(payrollEntries.deletedAt))
      );

      // Merge: every employee gets shown, with entry if exists
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
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(payrollPeriods).values({
        ...input, status: "open",
        startDate: new Date(input.startDate), endDate: new Date(input.endDate),
        paymentDate: new Date(input.paymentDate),
      } as any);
      return { id: Number(result.insertId), success: true };
    }),

  processPayroll: payrollProcess
    .input(z.object({ periodId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const period = await db.select().from(payrollPeriods).where(eq(payrollPeriods.id, input.periodId)).limit(1);
      if (!period[0]) throw new Error("Period not found");

      const emps = await db.select().from(employees).where(
        and(eq(employees.locationId, period[0].locationId), eq(employees.isActive, true), isNull(employees.deletedAt))
      );

      let totalNetPay = 0;
      const entries: { id: number; employeeId: number; netPay: string }[] = [];

      // Check existing entries first
      const existingEntries = await db.select().from(payrollEntries).where(
        and(eq(payrollEntries.periodId, input.periodId), isNull(payrollEntries.deletedAt))
      );
      const existingEmpIds = new Set(existingEntries.map(e => e.employeeId));

      for (const emp of emps) {
        if (existingEmpIds.has(emp.id)) continue; // already processed

        // Get approved advances linked to this period
        const advances = await db.select().from(payrollAdvances).where(
          and(
            eq(payrollAdvances.employeeId, emp.id),
            eq(payrollAdvances.status, "approved"),
            sql`${payrollAdvances.payrollPeriodId} = ${input.periodId} OR ${payrollAdvances.payrollPeriodId} IS NULL`,
            isNull(payrollAdvances.deletedAt)
          )
        );
        const advanceDeduction = advances.reduce((sum, a) => sum + parseFloat(a.balanceRemaining), 0);
        const basicPay = parseFloat(emp.basicSalary);
        const nssf = Math.min(basicPay * 0.06, 2160);
        const nhif = basicPay < 6000 ? 150 : basicPay < 8000 ? 300 : basicPay < 12000 ? 400 : 500;
        const netPay = Math.max(0, basicPay - advanceDeduction - nssf - nhif);
        totalNetPay += netPay;

        const [result] = await db.insert(payrollEntries).values({
          periodId: input.periodId, employeeId: emp.id,
          basicPay: emp.basicSalary, advancesDeducted: advanceDeduction.toFixed(2),
          deductions: (nssf + nhif).toFixed(2), netPay: netPay.toFixed(2),
        } as any);
        entries.push({ id: Number(result.insertId), employeeId: emp.id, netPay: netPay.toFixed(2) });

        // Deduct advances
        for (const adv of advances) {
          const newBal = Math.max(0, parseFloat(adv.balanceRemaining) - netPay * 0.3).toFixed(2);
          const newStatus = parseFloat(newBal) <= 0 ? "repaid" : "partially_repaid";
          await db.update(payrollAdvances).set({ balanceRemaining: newBal, status: newStatus }).where(eq(payrollAdvances.id, adv.id));
        }
      }

      // Include existing entries in total
      for (const e of existingEntries) {
        totalNetPay += parseFloat(e.netPay);
      }

      // Update or create the bill for total payroll amount
      let billId = period[0].generatedBillId;
      if (!billId) {
        const [billResult] = await db.insert(bills).values({
          locationId: period[0].locationId,
          description: `Payroll: ${period[0].periodName}`,
          amount: totalNetPay.toFixed(2),
          balanceDue: totalNetPay.toFixed(2),
          issueDate: new Date(),
          dueDate: period[0].paymentDate,
        } as any);
        billId = Number(billResult.insertId);
      } else {
        await db.update(bills).set({
          amount: totalNetPay.toFixed(2),
          balanceDue: totalNetPay.toFixed(2),
        }).where(eq(bills.id, billId));
        // Clear old bill items for this payroll bill
        await db.update(billItems).set({ deletedAt: new Date() }).where(eq(billItems.billId, billId));
      }

      // Add all employees in this period as bill line items
      const allEntriesForBill = await db.select().from(payrollEntries).where(
        and(eq(payrollEntries.periodId, input.periodId), isNull(payrollEntries.deletedAt))
      );
      for (const entry of allEntriesForBill) {
        const emp = await db.select().from(employees).where(eq(employees.id, entry.employeeId)).limit(1);
        const empName = emp[0]?.fullName ?? `Employee #${entry.employeeId}`;
        await db.insert(billItems).values({
          billId: billId,
          itemName: empName,
          quantity: "1.000",
          unitPrice: entry.netPay,
          totalPrice: entry.netPay,
          notes: `Basic: ${entry.basicPay}, Deductions: ${entry.deductions}, Advances: ${entry.advancesDeducted}`,
        } as any);
      }

      await db.update(payrollPeriods).set({
        status: "processing",
        generatedBillId: billId,
        totalNetPay: totalNetPay.toFixed(2),
      }).where(eq(payrollPeriods.id, input.periodId));

      return { entries, billId, totalNetPay: totalNetPay.toFixed(2), success: true };
    }),

  markPaid: payrollProcess
    .input(z.object({ periodId: z.number(), accountId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const period = await db.select().from(payrollPeriods).where(eq(payrollPeriods.id, input.periodId)).limit(1);
      if (!period[0]) throw new Error("Period not found");

      const entries = await db.select().from(payrollEntries).where(
        and(eq(payrollEntries.periodId, input.periodId), isNull(payrollEntries.deletedAt))
      );
      const totalPayroll = entries.reduce((sum, e) => sum + parseFloat(e.netPay), 0);
      const totalPayrollStr = totalPayroll.toFixed(2);

      const acct = await db.select().from(accounts).where(eq(accounts.id, input.accountId)).limit(1);
      if (!acct[0]) throw new Error("Account not found");

      const newBalance = (parseFloat(acct[0].currentBalance) - totalPayroll).toFixed(2);
      await db.insert(ledgerEntries).values({
        accountId: input.accountId, transactionType: "payroll",
        transactionId: input.periodId, entryType: "debit",
        amount: totalPayrollStr, balanceAfter: newBalance, entryDate: new Date(),
        createdBy: (ctx as any).user?.id,
      } as any);
      await db.update(accounts).set({ currentBalance: newBalance }).where(eq(accounts.id, input.accountId));

      // Mark the generated bill as paid too
      if (period[0].generatedBillId) {
        await db.update(bills).set({
          status: "paid", amountPaid: totalPayrollStr, balanceDue: "0.00"
        }).where(eq(bills.id, period[0].generatedBillId));
        await db.insert(billPayments).values({
          billId: period[0].generatedBillId,
          paymentMethod: "bank_transfer",
          amount: totalPayrollStr,
          paymentDate: new Date(),
          accountId: input.accountId,
          reference: `Payroll ${period[0].periodName}`,
          enteredBy: (ctx as any).user?.id,
        } as any);
      }

      await db.update(payrollPeriods).set({ status: "paid" }).where(eq(payrollPeriods.id, input.periodId));
      for (const entry of entries) {
        await db.update(payrollEntries).set({ paidAt: new Date() }).where(eq(payrollEntries.id, entry.id));
      }

      return { totalPayroll: totalPayrollStr, success: true };
    }),

  addEmployeeToPeriod: payrollProcess
    .input(z.object({ periodId: z.number(), employeeId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const period = await db.select().from(payrollPeriods).where(eq(payrollPeriods.id, input.periodId)).limit(1);
      if (!period[0]) throw new Error("Period not found");

      const emp = await db.select().from(employees).where(
        and(eq(employees.id, input.employeeId), isNull(employees.deletedAt))
      ).limit(1);
      if (!emp[0]) throw new Error("Employee not found");
      if (emp[0].locationId !== period[0].locationId) {
        throw new Error("Employee does not belong to this period's location");
      }

      // Check if entry already exists (including soft-deleted)
      const existing = await db.select().from(payrollEntries).where(
        and(eq(payrollEntries.periodId, input.periodId), eq(payrollEntries.employeeId, input.employeeId), isNull(payrollEntries.deletedAt))
      ).limit(1);
      if (existing.length > 0) return { entryId: existing[0].id, success: true };

      // Get approved advances linked to this period
      const advances = await db.select().from(payrollAdvances).where(
        and(
          eq(payrollAdvances.employeeId, emp[0].id),
          eq(payrollAdvances.status, "approved"),
          sql`${payrollAdvances.payrollPeriodId} = ${input.periodId} OR ${payrollAdvances.payrollPeriodId} IS NULL`,
          isNull(payrollAdvances.deletedAt)
        )
      );
      const advanceDeduction = advances.reduce((sum, a) => sum + parseFloat(a.balanceRemaining), 0);
      const basicPay = parseFloat(emp[0].basicSalary);
      const nssf = Math.min(basicPay * 0.06, 2160);
      const nhif = basicPay < 6000 ? 150 : basicPay < 8000 ? 300 : basicPay < 12000 ? 400 : 500;
      const netPay = Math.max(0, basicPay - advanceDeduction - nssf - nhif);

      const [result] = await db.insert(payrollEntries).values({
        periodId: input.periodId, employeeId: emp[0].id,
        basicPay: emp[0].basicSalary, advancesDeducted: advanceDeduction.toFixed(2),
        deductions: (nssf + nhif).toFixed(2), netPay: netPay.toFixed(2),
      } as any);

      // Deduct advances
      for (const adv of advances) {
        const newBal = Math.max(0, parseFloat(adv.balanceRemaining) - netPay * 0.3).toFixed(2);
        const newStatus = parseFloat(newBal) <= 0 ? "repaid" : "partially_repaid";
        await db.update(payrollAdvances).set({ balanceRemaining: newBal, status: newStatus }).where(eq(payrollAdvances.id, adv.id));
      }

      // Recalculate period total
      const allEntries = await db.select().from(payrollEntries).where(
        and(eq(payrollEntries.periodId, input.periodId), isNull(payrollEntries.deletedAt))
      );
      const totalNetPay = allEntries.reduce((sum, e) => sum + parseFloat(e.netPay), 0);

      if (period[0].generatedBillId) {
        await db.update(bills).set({
          amount: totalNetPay.toFixed(2),
          balanceDue: totalNetPay.toFixed(2),
        }).where(eq(bills.id, period[0].generatedBillId));
      }
      await db.update(payrollPeriods).set({ totalNetPay: totalNetPay.toFixed(2) }).where(eq(payrollPeriods.id, input.periodId));

      return { entryId: Number(result.insertId), success: true };
    }),

  removeEmployeeFromPeriod: payrollProcess
    .input(z.object({ periodId: z.number(), employeeId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const period = await db.select().from(payrollPeriods).where(eq(payrollPeriods.id, input.periodId)).limit(1);
      if (!period[0]) throw new Error("Period not found");

      // Soft delete the entry
      await db.update(payrollEntries).set({ deletedAt: new Date() }).where(
        and(eq(payrollEntries.periodId, input.periodId), eq(payrollEntries.employeeId, input.employeeId))
      );

      // Recalculate period total
      const allEntries = await db.select().from(payrollEntries).where(
        and(eq(payrollEntries.periodId, input.periodId), isNull(payrollEntries.deletedAt))
      );
      const totalNetPay = allEntries.reduce((sum, e) => sum + parseFloat(e.netPay), 0);

      if (period[0].generatedBillId) {
        await db.update(bills).set({
          amount: totalNetPay.toFixed(2),
          balanceDue: totalNetPay.toFixed(2),
        }).where(eq(bills.id, period[0].generatedBillId));
      }
      await db.update(payrollPeriods).set({ totalNetPay: totalNetPay.toFixed(2) }).where(eq(payrollPeriods.id, input.periodId));

      return { success: true };
    }),

  // Advances
  listAdvances: payrollQuery
    .input(z.object({ employeeId: z.number().optional(), status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [isNull(payrollAdvances.deletedAt)];
      if (input?.employeeId) conditions.push(eq(payrollAdvances.employeeId, input.employeeId));
      if (input?.status) conditions.push(eq(payrollAdvances.status, input.status as any));
      return db.select().from(payrollAdvances).where(and(...conditions)).orderBy(desc(payrollAdvances.requestDate));
    }),

  requestAdvance: payrollQuery
    .input(z.object({
      employeeId: z.number(), amount: z.string(), requestDate: z.string(),
      repaymentPeriods: z.number().default(1), notes: z.string().optional(),
      payrollPeriodId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(payrollAdvances).values({
        employeeId: input.employeeId, amount: input.amount, balanceRemaining: input.amount,
        requestDate: new Date(input.requestDate), repaymentPeriods: input.repaymentPeriods,
        notes: input.notes, status: "pending", payrollPeriodId: input.payrollPeriodId,
      } as any);
      return { id: Number(result.insertId), success: true };
    }),

  approveAdvance: payrollProcess
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db.update(payrollAdvances).set({
        status: "approved", approvedBy: (ctx as any).user?.id,
      }).where(eq(payrollAdvances.id, input.id));
      return { success: true };
    }),
});
