import { z } from "zod";
import { createRouter, payrollQuery, payrollProcess, getCurrentBusinessLocationIds, requireAuthorizedLocation, requireAuthorizedEntity } from "./middleware";
import { getDb } from "./queries/connection";
import { employees, payrollPeriods, payrollEntries, payrollAdvances, accounts, ledgerEntries, bills, billPayments, billItems, locations, businesses } from "@db/schema";
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

          await tx.insert(payrollEntries).values({
            periodId: input.periodId, employeeId: emp.id,
            basicPay: emp.basicSalary, advancesDeducted: advanceDeduction.toFixed(2),
            deductions: grossDeductions.toFixed(2), netPay: netPay.toFixed(2),
            payeDeducted: paye.toFixed(2),
            nhifDeducted: nhif.toFixed(2),
            nssfDeducted: nssf.toFixed(2),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any).returning();
          entries.push({ id: emp.id, employeeId: emp.id, netPay: netPay.toFixed(2) });

          for (const adv of advances) {
            const newBal = d(Math.max(0, d(adv.balanceRemaining).minus(netPay.mul(0.3)).toNumber()));
            const newStatus = newBal.lte(0) ? "repaid" : "partially_repaid";
            await tx.update(payrollAdvances).set({ balanceRemaining: newBal.toFixed(2), status: newStatus }).where(eq(payrollAdvances.id, adv.id));
          }
        }

        for (const e of existingEntries) {
          totalNetPay = totalNetPay.plus(d(e.netPay || "0"));
        }

        if (!billId) {
          const [billResult] = await tx.insert(bills).values({
            locationId: period.locationId,
            description: `Payroll: ${period.periodName}`,
            amount: totalNetPay.toFixed(2),
            balanceDue: totalNetPay.toFixed(2),
            issueDate: new Date(),
            dueDate: period.paymentDate,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            notes: `Basic: ${entry.basicPay}, Deductions: ${entry.deductions}, Advances: ${entry.advancesDeducted ?? "0"}, PAYE: ${entry.payeDeducted ?? "0"}`,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (ctx as any).user?.id ?? 1;
      const period = await requireAuthorizedEntity(ctx, payrollPeriods, input.periodId);
      const acct = await requireAuthorizedEntity(ctx, accounts, input.accountId);
      
      if (acct.locationId !== period.locationId) {
        throw new Error("Account and Period must belong to the same location");
      }

      const loc = await db.select().from(locations).where(eq(locations.id, period.locationId)).limit(1);
      const locationBusinessId = loc[0]?.businessId;
      if (!locationBusinessId) {
        throw new Error("Selected payroll period location is not linked to a business");
      }
      const business = await db.select().from(businesses).where(eq(businesses.id, locationBusinessId)).limit(1);
      const businessId = business[0]?.id;

      await db.transaction(async (tx) => {
        const entries = await tx.select().from(payrollEntries).where(
          and(eq(payrollEntries.periodId, input.periodId), isNull(payrollEntries.deletedAt))
        );
        
        let totalNetPay = d(0);
        let totalPaye = d(0);
        let totalNssf = d(0);
        let totalNhif = d(0);
        let totalHousingLevy = d(0);

        for (const entry of entries) {
          totalNetPay = totalNetPay.plus(d(entry.netPay || "0"));
          totalPaye = totalPaye.plus(d(entry.payeDeducted || "0"));
          totalNssf = totalNssf.plus(d(entry.nssfDeducted || "0"));
          totalNhif = totalNhif.plus(d(entry.nhifDeducted || "0"));
          totalHousingLevy = totalHousingLevy.plus(d(entry.deductions || "0")).minus(d(entry.payeDeducted || "0")).minus(d(entry.nhifDeducted || "0")).minus(d(entry.nssfDeducted || "0"));
        }

        const totalGross = totalNetPay.plus(totalPaye).plus(totalNssf).plus(totalNhif).plus(totalHousingLevy);
        const cashNewBalance = d(acct.currentBalance || "0").minus(totalNetPay);
        const paymentDateStr = new Date().toISOString().split("T")[0];

        await tx.insert(ledgerEntries).values({
          accountId: input.accountId,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
          transactionType: "payroll" as any,
          transactionId: input.periodId,
          entryType: "credit",
          amount: totalNetPay.toFixed(2),
          balanceAfter: cashNewBalance.toFixed(2),
          entryDate: paymentDateStr,
          createdBy: userId,
          description: `Payroll: ${period.periodName}`,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any).returning();
        await tx.update(accounts).set({ currentBalance: cashNewBalance.toFixed(2) }).where(eq(accounts.id, input.accountId));

        if (businessId && d(totalGross || "0").gt(0)) {
          const salaryExpenseAcct = await tx.query.accounts.findFirst({
            where: and(
              eq(accounts.accountCode, "6300"),
              eq(accounts.businessId, businessId),
              isNull(accounts.deletedAt)
            ),
          });
          if (salaryExpenseAcct) {
            const expenseNewBal = d(salaryExpenseAcct.currentBalance || "0").plus(totalGross);
            await tx.insert(ledgerEntries).values({
              accountId: salaryExpenseAcct.id,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
              transactionType: "payroll" as any,
              transactionId: input.periodId,
              entryType: "debit",
              amount: totalGross.toFixed(2),
              balanceAfter: expenseNewBal.toFixed(2),
              entryDate: paymentDateStr,
              createdBy: userId,
              description: `Salaries & Wages: ${period.periodName}`,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any).returning();
            await tx.update(accounts).set({ currentBalance: expenseNewBal.toFixed(2) }).where(eq(accounts.id, salaryExpenseAcct.id));
          }
        }

        if (businessId && d(totalPaye || "0").gt(0)) {
          const payePayableAcct = await tx.query.accounts.findFirst({
            where: and(
              eq(accounts.accountCode, "2200"),
              eq(accounts.businessId, businessId),
              isNull(accounts.deletedAt)
            ),
          });
          if (payePayableAcct) {
            const payeNewBal = d(payePayableAcct.currentBalance || "0").plus(totalPaye);
            await tx.insert(ledgerEntries).values({
              accountId: payePayableAcct.id,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
              transactionType: "payroll" as any,
              transactionId: input.periodId,
              entryType: "credit",
              amount: totalPaye.toFixed(2),
              balanceAfter: payeNewBal.toFixed(2),
              entryDate: paymentDateStr,
              createdBy: userId,
              description: `PAYE Payable: ${period.periodName}`,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any).returning();
            await tx.update(accounts).set({ currentBalance: payeNewBal.toFixed(2) }).where(eq(accounts.id, payePayableAcct.id));
          }
        }

        if (businessId && d(totalNssf || "0").gt(0)) {
          const nssfPayableAcct = await tx.query.accounts.findFirst({
            where: and(
              eq(accounts.accountCode, "2300"),
              eq(accounts.businessId, businessId),
              isNull(accounts.deletedAt)
            ),
          });
          if (nssfPayableAcct) {
            const nssfNewBal = d(nssfPayableAcct.currentBalance || "0").plus(totalNssf);
            await tx.insert(ledgerEntries).values({
              accountId: nssfPayableAcct.id,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
              transactionType: "payroll" as any,
              transactionId: input.periodId,
              entryType: "credit",
              amount: totalNssf.toFixed(2),
              balanceAfter: nssfNewBal.toFixed(2),
              entryDate: paymentDateStr,
              createdBy: userId,
              description: `NSSF Payable: ${period.periodName}`,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any).returning();
            await tx.update(accounts).set({ currentBalance: nssfNewBal.toFixed(2) }).where(eq(accounts.id, nssfPayableAcct.id));
          }
        }

        if (businessId && d(totalNhif || "0").gt(0)) {
          const nhifPayableAcct = await tx.query.accounts.findFirst({
            where: and(
              eq(accounts.accountCode, "2400"),
              eq(accounts.businessId, businessId),
              isNull(accounts.deletedAt)
            ),
          });
          if (nhifPayableAcct) {
            const nhifNewBal = d(nhifPayableAcct.currentBalance || "0").plus(totalNhif);
            await tx.insert(ledgerEntries).values({
              accountId: nhifPayableAcct.id,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
              transactionType: "payroll" as any,
              transactionId: input.periodId,
              entryType: "credit",
              amount: totalNhif.toFixed(2),
              balanceAfter: nhifNewBal.toFixed(2),
              entryDate: paymentDateStr,
              createdBy: userId,
              description: `NHIF Payable: ${period.periodName}`,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any).returning();
            await tx.update(accounts).set({ currentBalance: nhifNewBal.toFixed(2) }).where(eq(accounts.id, nhifPayableAcct.id));
          }
        }

        if (businessId && d(totalHousingLevy || "0").gt(0)) {
          const hlPayableAcct = await tx.query.accounts.findFirst({
            where: and(
              eq(accounts.accountCode, "2600"),
              eq(accounts.businessId, businessId),
              isNull(accounts.deletedAt)
            ),
          });
          if (hlPayableAcct) {
            const hlNewBal = d(hlPayableAcct.currentBalance || "0").plus(totalHousingLevy);
            await tx.insert(ledgerEntries).values({
              accountId: hlPayableAcct.id,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
              transactionType: "payroll" as any,
              transactionId: input.periodId,
              entryType: "credit",
              amount: totalHousingLevy.toFixed(2),
              balanceAfter: hlNewBal.toFixed(2),
              entryDate: paymentDateStr,
              createdBy: userId,
              description: `Housing Levy Payable: ${period.periodName}`,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any).returning();
            await tx.update(accounts).set({ currentBalance: hlNewBal.toFixed(2) }).where(eq(accounts.id, hlPayableAcct.id));
          }
        }

        if (period.generatedBillId) {
          await tx.update(bills).set({
            status: "paid", amountPaid: totalNetPay.toFixed(2), balanceDue: "0.00"
          }).where(eq(bills.id, period.generatedBillId));
          await tx.insert(billPayments).values({
            billId: period.generatedBillId,
            paymentMethod: "bank_transfer",
            amount: totalNetPay.toFixed(2),
            paymentDate: new Date(),
            accountId: input.accountId,
            reference: `Payroll ${period.periodName}`,
            enteredBy: userId,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

        await tx.insert(payrollEntries).values({
          periodId: input.periodId, employeeId: emp.id,
          basicPay: emp.basicSalary, advancesDeducted: advanceDeduction.toFixed(2),
          deductions: grossDeductions.toFixed(2), netPay: netPay.toFixed(2),
          payeDeducted: paye.toFixed(2),
          nhifDeducted: nhif.toFixed(2),
          nssfDeducted: nssf.toFixed(2),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any).returning();

        for (const adv of advances) {
          const newBal = d(Math.max(0, d(adv.balanceRemaining).minus(netPay.mul(0.3)).toNumber()));
          const newStatus = newBal.lte(0) ? "repaid" : "partially_repaid";
          await tx.update(payrollAdvances).set({ balanceRemaining: newBal.toFixed(2), status: newStatus }).where(eq(payrollAdvances.id, adv.id));
        }

        const allEntries = await tx.select().from(payrollEntries).where(
          and(eq(payrollEntries.periodId, input.periodId), isNull(payrollEntries.deletedAt))
        );
        const period = await tx.select().from(payrollPeriods).where(eq(payrollPeriods.id, input.periodId)).limit(1);

        if (period[0]?.generatedBillId) {
          await tx.update(billItems).set({ deletedAt: new Date() }).where(eq(billItems.billId, period[0].generatedBillId));
          for (const _entry of allEntries) {
            await tx.insert(billItems).values({
              billId: period[0].generatedBillId,
              itemName: emp.fullName,
              quantity: "1.000",
              unitPrice: netPay.toFixed(2),
              totalPrice: netPay.toFixed(2),
              notes: `Basic: ${emp.basicSalary}, Deductions: ${grossDeductions.toFixed(2)}`,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any).returning();
          }
        }
      });

      return { success: true };
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

  removeEmployeeFromPeriod: payrollProcess
    .input(z.object({ periodId: z.number(), employeeId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, payrollPeriods, input.periodId);
      await requireAuthorizedEntity(ctx, employees, input.employeeId);
      const existing = await db.select().from(payrollEntries).where(
        and(eq(payrollEntries.periodId, input.periodId), eq(payrollEntries.employeeId, input.employeeId), isNull(payrollEntries.deletedAt))
      ).limit(1);
      if (existing.length > 0) {
        await db.update(payrollEntries).set({ deletedAt: new Date() }).where(eq(payrollEntries.id, existing[0].id));
      }
      return { success: true };
    }),
});
