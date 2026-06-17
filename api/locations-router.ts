// ABOUTME: Exposes branch listing and maintenance mutations within the active business context.
// ABOUTME: Applies shared subscription enforcement before new locations are added to a business.
// ABOUTME: Auto-assigns the creating owner/admin user to each new location for permission consistency.
import { z } from "zod";
import { createRouter, authedQuery, settingsManage, getAuthorizedLocationIds } from "./middleware";
import { getDb } from "./queries/connection";
import { locations, users, userLocations } from "@db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { assertCanCreateLocation } from "./lib/subscription-enforcement";
import { syncUserLocationAssignments } from "./users-router";

export const locationsRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
    if (!businessId) return [];
    // Scope by the caller's authorized location set so non-owner/admin users only
    // see branches they are assigned to when location enforcement is enabled.
    // (getAuthorizedLocationIds returns ALL locations for owner/admin or when
    // enforcement is off, so this is transparent for those cases.)
    const authorizedIds = await getAuthorizedLocationIds(ctx);
    if (authorizedIds.length === 0) return [];
    return db.select().from(locations).where(
      and(
        eq(locations.businessId, businessId),
        isNull(locations.deletedAt),
        sql`${locations.id} IN (${sql.join(authorizedIds.map(id => sql`${id}`), sql`, `)})`
      )
    ).orderBy(locations.name);
  }),

  listByBusinessId: authedQuery
    .input(z.object({ businessId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(locations).where(
        and(eq(locations.businessId, input.businessId), isNull(locations.deletedAt))
      ).orderBy(locations.name);
    }),

  create: settingsManage
    .input(z.object({
      name: z.string().min(1).max(255),
      slug: z.string().min(1).max(100),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
      if (!businessId) throw new Error("No active business selected");

      await assertCanCreateLocation(
        db,
        businessId,
        ctx.user?.accountId ?? ctx.user?.currentBusiness?.accountId ?? "",
        ctx.user?.accountRefId ?? ctx.user?.currentBusiness?.accountRefId ?? null,
      );

      const [result] = await db.transaction(async (tx) => {
        const [newLocation] = await tx.insert(locations).values({
          name: input.name, slug: input.slug, address: input.address,
          phone: input.phone, email: input.email,
          businessId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any).returning();

        // Auto-assign the creating user (owner or admin) to the new location.
        // getAuthorizedLocationIds treats both roles identically (returns all
        // locations), so admins who create branches get the same auto-assignment.
        const userId = ctx.user?.id;
        if (userId && (ctx.user?.role === "owner" || ctx.user?.role === "admin")) {
          const existingAssignments = await tx.select({ locationId: userLocations.locationId })
            .from(userLocations)
            .where(eq(userLocations.userId, userId));
          const existingIds = existingAssignments.map(r => r.locationId);
          await syncUserLocationAssignments(
            tx,
            userId,
            [...existingIds, newLocation.id],
            userId,
          );
        }

        return [newLocation];
      });

      return { id: result.id, success: true };
    }),

  update: settingsManage
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      slug: z.string().min(1).max(100).optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      isActive: z.boolean().optional(),
      defaultMpesaAccountId: z.number().optional(),
      defaultCashAccountId: z.number().optional(),
      nextBillNumber: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      await db.update(locations).set(updates).where(eq(locations.id, id));
      return { success: true };
    }),

  delete: settingsManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(locations).set({ deletedAt: new Date() }).where(eq(locations.id, input.id));
      return { success: true };
    }),

  /**
   * Assign the CURRENT owner/admin user to all business locations.
   * Guarded by settingsManage at the middleware level (matching create/update/delete),
   * with a defense-in-depth inline role check on top. Renamed from the ambiguous
   * `assignOwnerToAll` to make clear it acts on the calling user, not all owners.
   */
  assignCurrentOwnerToAllLocations: settingsManage
    .input(z.object({}))
    .mutation(async ({ ctx }) => {
      const db = getDb();
      const userId = ctx.user?.id;
      const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
      if (!userId || !businessId) throw new Error("User or business context required");
      // Defense-in-depth: settingsManage already gates on settings:manage, but only
      // owner/admin roles should bulk-assign themselves to every branch.
      if (ctx.user?.role !== "owner" && ctx.user?.role !== "admin") {
        throw new Error("Only business owners or admins can use this");
      }

      const allLocations = await db.select({ id: locations.id }).from(locations)
        .where(and(eq(locations.businessId, businessId), isNull(locations.deletedAt)));

      const locationIds = allLocations.map(l => l.id);

      await db.transaction(async (tx) => {
        await syncUserLocationAssignments(tx, userId, locationIds, userId);
      });

      return { success: true, locationCount: locationIds.length, assignedLocationIds: locationIds };
    }),
});
