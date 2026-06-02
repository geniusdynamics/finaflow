import { z } from "zod";
import { createRouter, supplierQuery, supplierManage, requireAuthorizedLocation, requireAuthorizedBusinessEntity } from "./middleware";
import { getDb } from "./queries/connection";
import { suppliers, bills, billPayments, locations } from "@db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";

export const suppliersRouter = createRouter({
  list: supplierQuery.query(async ({ ctx }) => {
    const db = getDb();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const businessId = (ctx as any).user?.currentBusiness?.id ?? (ctx as any).user?.currentBusinessId;
    if (!businessId) return [];
    
    return db.select().from(suppliers)
      .where(and(eq(suppliers.businessId, businessId), isNull(suppliers.deletedAt)))
      .orderBy(suppliers.name);
  }),

  search: supplierQuery
    .input(z.object({ query: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const businessId = (ctx as any).user?.currentBusiness?.id ?? (ctx as any).user?.currentBusinessId;
      if (!businessId) return [];

      return db.select().from(suppliers).where(
        and(sql`LOWER(${suppliers.name}) LIKE LOWER(${'%' + input.query + '%'})`, eq(suppliers.businessId, businessId), isNull(suppliers.deletedAt))
      ).limit(20);
    }),

  create: supplierManage
    .input(z.object({
      locationId: z.number().optional(),
      name: z.string().min(1).max(255), phone: z.string().optional(),
      email: z.string().email().optional(), contactPerson: z.string().optional(),
      kraPin: z.string().optional(), paymentTermsDays: z.number().default(30),
      creditLimit: z.string().optional(), currentBalance: z.string().optional(), notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const businessId = (ctx as any).user?.currentBusiness?.id ?? (ctx as any).user?.currentBusinessId;
      if (!businessId) throw new Error("No active business available.");
      
      const targetLocationId = input.locationId;
      if (targetLocationId) {
        await requireAuthorizedLocation(ctx, targetLocationId);
      }

      const cb = input.currentBalance ?? "0.00";
      const [result] = await db.insert(suppliers).values({
        businessId,
        locationId: targetLocationId ?? null,
        name: input.name, phone: input.phone, email: input.email,
        contactPerson: input.contactPerson, kraPin: input.kraPin,
        paymentTermsDays: input.paymentTermsDays, creditLimit: input.creditLimit ?? null,
        currentBalance: cb, totalBilled: cb, notes: input.notes,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).returning();
      return { id: result.id, success: true };
    }),

  updateBalance: supplierManage
    .input(z.object({ id: z.number(), adjustment: z.string(), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const sup = await requireAuthorizedBusinessEntity(ctx, suppliers, input.id);
      
      const newBal = (parseFloat(sup.currentBalance) + parseFloat(input.adjustment)).toFixed(2);
      const newTotalBilled = (parseFloat(sup.totalBilled) + parseFloat(input.adjustment)).toFixed(2);
      await db.update(suppliers).set({ currentBalance: newBal, totalBilled: newTotalBilled }).where(eq(suppliers.id, input.id));
      return { newBalance: newBal, success: true };
    }),

  update: supplierManage
    .input(z.object({
      id: z.number(), name: z.string().min(1).max(255).optional(),
      phone: z.string().optional(), email: z.string().email().optional(),
      contactPerson: z.string().optional(), paymentTermsDays: z.number().optional(),
      creditLimit: z.string().optional(), notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedBusinessEntity(ctx, suppliers, input.id);
      const { id, ...updates } = input;
      await db.update(suppliers).set(updates).where(eq(suppliers.id, id));
      return { success: true };
    }),

  delete: supplierManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedBusinessEntity(ctx, suppliers, input.id);
      await db.update(suppliers).set({ deletedAt: new Date() }).where(eq(suppliers.id, input.id));
      return { success: true };
    }),

  statement: supplierQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedBusinessEntity(ctx, suppliers, input.id);
      const supplierBills = await db.select().from(bills).where(
        and(eq(bills.supplierId, input.id), isNull(bills.deletedAt))
      ).orderBy(desc(bills.issueDate));
      const supplierPayments = await db.select().from(billPayments).where(
        and(sql`${billPayments.billId} IN (SELECT id FROM bills WHERE supplierId = ${input.id})`, isNull(billPayments.deletedAt))
      ).orderBy(desc(billPayments.paymentDate));
      // Fetch bills for payment references
      const billIds = supplierPayments.map(p => p.billId);
      const paymentBills = billIds.length > 0 ? await db.select().from(bills).where(
        sql`${bills.id} IN (${sql.join(billIds.map(id => sql`${id}`), sql`, `)})`
      ) : [];
      const paymentsWithBillNo = supplierPayments.map(p => {
        const b = paymentBills.find(bx => bx.id === p.billId);
        return { ...p, billNumber: b?.billNumber ?? `BILL-${String(b?.id ?? 0).padStart(4,"0")}` };
      });
      return { 
        bills: supplierBills, 
        payments: paymentsWithBillNo,
      };
    }),

  createBill: supplierManage
    .input(z.object({
      supplierId: z.number(),
      locationId: z.number(),
      billNumber: z.string().optional(),
      description: z.string().min(1),
      amount: z.string(),
      issueDate: z.string(),
      dueDate: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      
      await requireAuthorizedLocation(ctx, input.locationId);
      const sup = await requireAuthorizedBusinessEntity(ctx, suppliers, input.supplierId);

      let billNumber = input.billNumber;
      let billId = 0;

      await db.transaction(async (tx) => {
        if (!billNumber) {
          const loc = await tx.select().from(locations).where(eq(locations.id, input.locationId)).limit(1);
          const nextNum = loc[0]?.nextBillNumber ?? 1;
          billNumber = `BILL-${String(nextNum).padStart(4, "0")}`;
          await tx.update(locations).set({ nextBillNumber: nextNum + 1 }).where(eq(locations.id, input.locationId));
        }

        const [result] = await tx.insert(bills).values({
          locationId: input.locationId,
          supplierId: input.supplierId,
          billNumber,
          description: input.description,
          amount: input.amount,
          balanceDue: input.amount,
          issueDate: new Date(input.issueDate),
          dueDate: new Date(input.dueDate),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any).returning();
        billId = result.id;

        const newBal = (parseFloat(sup.currentBalance) + parseFloat(input.amount)).toFixed(2);
        const newBilled = (parseFloat(sup.totalBilled) + parseFloat(input.amount)).toFixed(2);
        await tx.update(suppliers).set({ currentBalance: newBal, totalBilled: newBilled }).where(eq(suppliers.id, input.supplierId));
      });
      return { id: billId, billNumber, success: true };
    }),
});
