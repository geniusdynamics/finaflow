import { z } from "zod";
import { createRouter, settingsManage, requireAuthorizedLocation } from "./middleware";
import { getDb } from "./queries/connection";
import { paymentMethods, locationPaymentMethods, accounts } from "@db/schema";
import { eq, and, isNull, asc, sql } from "drizzle-orm";
import { logAudit } from "./lib/audit";

export const paymentMethodsRouter = createRouter({
  list: settingsManage.query(async ({ ctx }) => {
    const db = getDb();
    const accountRefId = ctx.user?.accountRefId ?? ctx.user?.currentBusiness?.accountRefId ?? null;
    const currentBusinessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId ?? null;

    if (accountRefId) {
      return db.select().from(paymentMethods)
        .where(and(eq(paymentMethods.accountRefId, accountRefId), isNull(paymentMethods.deletedAt)))
        .orderBy(asc(paymentMethods.sortOrder));
    }

    if (currentBusinessId) {
      return db.select().from(paymentMethods)
        .where(and(eq(paymentMethods.businessId, currentBusinessId), isNull(paymentMethods.deletedAt)))
        .orderBy(asc(paymentMethods.sortOrder));
    }

    return db.select().from(paymentMethods)
      .where(isNull(paymentMethods.deletedAt))
      .orderBy(asc(paymentMethods.sortOrder));
  }),

  create: settingsManage
    .input(z.object({
      name: z.string().min(1).max(100),
      code: z.string().min(1).max(50),
      color: z.string().default("#C73E1D"),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const currentBusinessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId ?? null;
      const accountRefId = ctx.user?.accountRefId ?? ctx.user?.currentBusiness?.accountRefId ?? null;

      const [result] = await db.insert(paymentMethods).values({
        businessId: currentBusinessId,
        accountRefId,
        name: input.name,
        code: input.code,
        color: input.color,
        sortOrder: input.sortOrder,
        isActive: true,
      } as any).returning();
      return { id: result.id, success: true };
    }),

  update: settingsManage
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(100).optional(),
      code: z.string().min(1).max(50).optional(),
      color: z.string().optional(),
      sortOrder: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      await db.update(paymentMethods).set(updates as any).where(eq(paymentMethods.id, id));
      return { success: true };
    }),

  delete: settingsManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(paymentMethods).set({ deletedAt: new Date() }).where(eq(paymentMethods.id, input.id));
      return { success: true };
    }),

  // For a given location, which payment methods are available with their linked accounts?
  byLocation: settingsManage
    .input(z.object({ locationId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      // Get active junction records for this location
      const junctions = await db.select().from(locationPaymentMethods)
        .where(and(
          eq(locationPaymentMethods.locationId, input.locationId),
          eq(locationPaymentMethods.isActive, true)
        ));
      if (junctions.length === 0) return [];

      // Get all payment methods
      const pmIds = junctions.map(j => j.paymentMethodId);
      const methods = await db.select().from(paymentMethods)
        .where(and(
          sql`${paymentMethods.id} IN (${sql.join(pmIds.map(id => sql`${id}`), sql`, `)})`,
          isNull(paymentMethods.deletedAt),
          eq(paymentMethods.isActive, true)
        ))
        .orderBy(asc(paymentMethods.sortOrder));

      // Get all accounts for name resolution
      const allAccounts = await db.select().from(accounts).where(isNull(accounts.deletedAt));

      // Merge junction data (linkedAccountId) with payment method data
      return methods.map(m => {
        const jx = junctions.find(j => j.paymentMethodId === m.id);
        const linkedAcct = allAccounts.find(a => a.id === jx?.linkedAccountId);
        return {
          ...m,
          linkedAccountId: jx?.linkedAccountId ?? null,
          linkedAccountName: linkedAcct?.name ?? null,
        };
      });
    }),

  // Assign payment method to a location, optionally with linked account
  assignToLocation: settingsManage
    .input(z.object({
      locationId: z.number(),
      paymentMethodId: z.number(),
      linkedAccountId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = (ctx as any).user?.id ?? 1;
      const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId ?? undefined;
      await requireAuthorizedLocation(ctx, input.locationId);

      if (input.linkedAccountId !== undefined) {
        const [linkedAccount] = await db.select().from(accounts).where(
          and(eq(accounts.id, input.linkedAccountId), isNull(accounts.deletedAt), eq(accounts.isActive, true))
        ).limit(1);

        if (!linkedAccount || linkedAccount.locationId !== input.locationId) {
          throw new Error("Linked account must belong to the selected location");
        }
      }

      // Check if junction already exists
      const existing = await db.select().from(locationPaymentMethods).where(
        and(
          eq(locationPaymentMethods.locationId, input.locationId),
          eq(locationPaymentMethods.paymentMethodId, input.paymentMethodId)
        )
      ).limit(1);

      if (existing.length > 0) {
        // Update existing — set active and update linked account if provided
        const updates: any = { isActive: true };
        if (input.linkedAccountId !== undefined) updates.linkedAccountId = input.linkedAccountId;
        await db.update(locationPaymentMethods)
          .set(updates)
          .where(eq(locationPaymentMethods.id, existing[0].id));
      } else {
        await db.insert(locationPaymentMethods).values({
          locationId: input.locationId,
          paymentMethodId: input.paymentMethodId,
          linkedAccountId: input.linkedAccountId,
          isActive: true,
        } as any).returning();
      }

      await logAudit({
        userId,
        businessId,
        action: "UPDATE",
        resource: "location_payment_methods",
        resourceId: input.paymentMethodId,
        details: input,
      });

      return { success: true };
    }),

  // Update the linked account for an existing location-payment-method assignment
  updateLocationLink: settingsManage
    .input(z.object({
      locationId: z.number(),
      paymentMethodId: z.number(),
      linkedAccountId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = (ctx as any).user?.id ?? 1;
      const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId ?? undefined;
      await requireAuthorizedLocation(ctx, input.locationId);

      if (input.linkedAccountId !== undefined) {
        const [linkedAccount] = await db.select().from(accounts).where(
          and(eq(accounts.id, input.linkedAccountId), isNull(accounts.deletedAt), eq(accounts.isActive, true))
        ).limit(1);

        if (!linkedAccount || linkedAccount.locationId !== input.locationId) {
          throw new Error("Linked account must belong to the selected location");
        }
      }

      await db.update(locationPaymentMethods)
        .set({ linkedAccountId: input.linkedAccountId ?? null })
        .where(and(
          eq(locationPaymentMethods.locationId, input.locationId),
          eq(locationPaymentMethods.paymentMethodId, input.paymentMethodId)
        ));

      await logAudit({
        userId,
        businessId,
        action: "UPDATE",
        resource: "location_payment_methods",
        resourceId: input.paymentMethodId,
        details: input,
      });

      return { success: true };
    }),

  removeFromLocation: settingsManage
    .input(z.object({ locationId: z.number(), paymentMethodId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = (ctx as any).user?.id ?? 1;
      const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId ?? undefined;
      await requireAuthorizedLocation(ctx, input.locationId);
      await db.update(locationPaymentMethods)
        .set({ isActive: false })
        .where(and(
          eq(locationPaymentMethods.locationId, input.locationId),
          eq(locationPaymentMethods.paymentMethodId, input.paymentMethodId)
        ));

      await logAudit({
        userId,
        businessId,
        action: "DELETE",
        resource: "location_payment_methods",
        resourceId: input.paymentMethodId,
        details: input,
      });

      return { success: true };
    }),
});
