import { z } from "zod";
import { eq, and, isNull, inArray } from "drizzle-orm";
import {
  createRouter,
  apiKeyProcedure,
  requireApiKey,
} from "./middleware";
import { getDb } from "./queries/connection";
import { hashPassword } from "./lib/password";
import {
  accounts,
  suppliers,
  expenseCategories,
  businesses,
  locations,
  users,
  userBusinesses,
  userLocations,
  rolePermissions,
} from "@db/schema";

function getBusinessId(ctx: { businessId?: number | null }): number | null {
  return ctx.businessId ?? null;
}

function logIntegration(
  ctx: { businessId?: number | null; apiKey?: { id?: number | null } | null },
  operation: string,
  status: string,
  extras?: Record<string, unknown>
) {
  const payload: Record<string, unknown> = {
    businessId: ctx.businessId ?? null,
    sourceSystem: "finabill",
    operation,
    status,
    ...extras,
  };
  if (ctx.apiKey?.id) {
    payload.apiKeyId = ctx.apiKey.id;
  }
  const message = `[integration] ${JSON.stringify(payload)}`;
  if (status === "failed") {
    console.error(message);
  } else {
    console.log(message);
  }
}

const INTEGRATION_ALLOWED_ROLES = new Set([
  "manager",
  "employee",
  "accountant",
  "viewer",
  "cashier",
]);

function assertAllowedIntegrationRole(role: string) {
  if (!INTEGRATION_ALLOWED_ROLES.has(role)) {
    throw new Error(
      `Role "${role}" is not allowed via integration API. Allowed: ${Array.from(INTEGRATION_ALLOWED_ROLES).join(", ")}`,
    );
  }
}

export const integrationFinabillRouter = createRouter({
  verify: apiKeyProcedure.query(async ({ ctx }) => {
    const businessId = getBusinessId(ctx);
    logIntegration(ctx, "finabill.verify", "success");
    return {
      ok: true,
      businessId,
      authMethod: ctx.apiKey ? "api_key" : "none",
    };
  }),

  listAccounts: apiKeyProcedure
    .use(requireApiKey("read"))
    .input(z.object({ accountType: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        logIntegration(ctx, "finabill.listAccounts", "failed", { error: "No active business" });
        return { data: [] };
      }

      const conditions = [
        eq(accounts.businessId, businessId),
        isNull(accounts.deletedAt),
      ];
      if (input?.accountType) {
        conditions.push(eq(accounts.accountType, input.accountType as any));
      }

      const data = await db
        .select({
          id: accounts.id,
          name: accounts.name,
          accountCode: accounts.accountCode,
          accountType: accounts.accountType,
          accountSubType: accounts.accountSubType,
          isActive: accounts.isActive,
        })
        .from(accounts)
        .where(and(...conditions))
        .orderBy(accounts.name);

      logIntegration(ctx, "finabill.listAccounts", "success", { count: data.length });
      return { data };
    }),

  listSuppliers: apiKeyProcedure
    .use(requireApiKey("read"))
    .query(async ({ ctx }) => {
      const db = getDb();
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        logIntegration(ctx, "finabill.listSuppliers", "failed", { error: "No active business" });
        return { data: [] };
      }

      const data = await db
        .select({
          id: suppliers.id,
          name: suppliers.name,
          email: suppliers.email,
          phone: suppliers.phone,
          taxId: suppliers.kraPin,
        })
        .from(suppliers)
        .where(and(eq(suppliers.businessId, businessId), isNull(suppliers.deletedAt)))
        .orderBy(suppliers.name);

      logIntegration(ctx, "finabill.listSuppliers", "success", { count: data.length });
      return { data };
    }),

  listCategories: apiKeyProcedure
    .use(requireApiKey("read"))
    .query(async ({ ctx }) => {
      const db = getDb();
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        logIntegration(ctx, "finabill.listCategories", "failed", { error: "No active business" });
        return { data: [] };
      }

      const data = await db
        .select({
          id: expenseCategories.id,
          name: expenseCategories.name,
          categoryType: expenseCategories.accountingClass,
          defaultAccountId: expenseCategories.defaultAccountId,
          externalAccountCode: expenseCategories.externalAccountCode,
          isActive: expenseCategories.isActive,
        })
        .from(expenseCategories)
        .where(
          and(
            eq(expenseCategories.businessId, businessId),
            isNull(expenseCategories.deletedAt)
          )
        )
        .orderBy(expenseCategories.name);

      logIntegration(ctx, "finabill.listCategories", "success", { count: data.length });
      return { data: data.map((c) => ({ ...c, categoryType: "expense" as const })) };
    }),

  upsertSupplier: apiKeyProcedure
    .use(requireApiKey("write"))
    .input(
      z.object({
        externalId: z.string().optional(),
        name: z.string().min(1),
        email: z.string().email().optional().nullable(),
        phone: z.string().optional().nullable(),
        taxId: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        logIntegration(ctx, "finabill.upsertSupplier", "failed", { error: "No active business" });
        throw new Error("No active business");
      }

      const existing = input.externalId
        ? await db
            .select()
            .from(suppliers)
            .where(
              and(
                eq(suppliers.businessId, businessId),
                eq(suppliers.id, Number(input.externalId)),
                isNull(suppliers.deletedAt)
              )
            )
            .limit(1)
        : [];

      if (existing[0]) {
        const [updated] = await db
          .update(suppliers)
          .set({
            name: input.name,
            email: input.email ?? existing[0].email,
            phone: input.phone ?? existing[0].phone,
            kraPin: input.taxId ?? existing[0].kraPin,
            updatedAt: new Date(),
          })
          .where(eq(suppliers.id, existing[0].id))
          .returning();
        logIntegration(ctx, "finabill.upsertSupplier", "success", { supplierId: updated.id, created: false });
        return { id: updated.id, created: false };
      }

      const [created] = await db
        .insert(suppliers)
        .values({
          businessId,
          name: input.name,
          email: input.email ?? null,
          phone: input.phone ?? null,
          kraPin: input.taxId ?? null,
        })
        .returning();
      logIntegration(ctx, "finabill.upsertSupplier", "success", { supplierId: created.id, created: true });
      return { id: created.id, created: true };
    }),

  getBusinessProfile: apiKeyProcedure
    .use(requireApiKey("read"))
    .query(async ({ ctx }) => {
      const db = getDb();
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        logIntegration(ctx, "finabill.getBusinessProfile", "failed", { error: "No active business" });
        return { data: null };
      }

      const [business] = await db
        .select({
          id: businesses.id,
          name: businesses.name,
          email: businesses.email,
          phone: businesses.phone,
          address: businesses.address,
          country: businesses.country,
          fiscalYearStartMonth: businesses.fiscalYearStartMonth,
          registrationNumber: businesses.businessRegNumber,
          taxId: businesses.kraPin,
        })
        .from(businesses)
        .where(and(eq(businesses.id, businessId), isNull(businesses.deletedAt)))
        .limit(1);

      // FinaFlow's business table does not carry every FinaBill field; normalize nulls.
      const normalized = business
        ? {
            ...business,
            timezone: null,
            dateFormat: null,
            currency: null,
            accentColor: null,
            logoUrl: null,
          }
        : null;

      logIntegration(ctx, "finabill.getBusinessProfile", "success", { found: Boolean(normalized) });
      return { data: normalized };
    }),

  listLocations: apiKeyProcedure
    .use(requireApiKey("read"))
    .query(async ({ ctx }) => {
      const db = getDb();
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        logIntegration(ctx, "finabill.listLocations", "failed", { error: "No active business" });
        return { data: [] };
      }

      const data = await db
        .select({
          id: locations.id,
          name: locations.name,
          slug: locations.slug,
          isActive: locations.isActive,
          address: locations.address,
          phone: locations.phone,
          email: locations.email,
          defaultIncomeAccountId: locations.defaultCashAccountId,
          defaultBankAccountId: locations.defaultMpesaAccountId,
        })
        .from(locations)
        .where(and(eq(locations.businessId, businessId), isNull(locations.deletedAt)))
        .orderBy(locations.name);

      logIntegration(ctx, "finabill.listLocations", "success", { count: data.length });
      return { data };
    }),

  listUsers: apiKeyProcedure
    .use(requireApiKey("read"))
    .query(async ({ ctx }) => {
      const db = getDb();
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        logIntegration(ctx, "finabill.listUsers", "failed", { error: "No active business" });
        return { data: [] };
      }

      const userRows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          role: userBusinesses.role,
          isActive: users.isActive,
        })
        .from(users)
        .innerJoin(userBusinesses, eq(users.id, userBusinesses.userId))
        .where(
          and(
            eq(userBusinesses.businessId, businessId),
            eq(userBusinesses.isActive, true),
            isNull(users.deletedAt)
          )
        );

      const businessLocationRows = await db
        .select({ id: locations.id })
        .from(locations)
        .where(and(eq(locations.businessId, businessId), isNull(locations.deletedAt)));
      const businessLocationIds = new Set(businessLocationRows.map((r) => r.id));

      const locationRows = businessLocationIds.size
        ? await db
            .select({
              userId: userLocations.userId,
              locationId: userLocations.locationId,
            })
            .from(userLocations)
            .where(inArray(userLocations.locationId, Array.from(businessLocationIds)))
        : [];

      const locationsByUser = new Map<number, number[]>();
      for (const row of locationRows) {
        const list = locationsByUser.get(row.userId) ?? [];
        list.push(row.locationId);
        locationsByUser.set(row.userId, list);
      }

      const data = userRows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        isActive: u.isActive,
        assignedLocationIds: locationsByUser.get(u.id) ?? [],
      }));

      logIntegration(ctx, "finabill.listUsers", "success", { count: data.length });
      return { data };
    }),

  listRoleTemplates: apiKeyProcedure
    .use(requireApiKey("read"))
    .query(async ({ ctx }) => {
      const db = getDb();
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        logIntegration(ctx, "finabill.listRoleTemplates", "failed", { error: "No active business" });
        return { data: [] };
      }

      const data = await db
        .select({
          role: rolePermissions.roleKey,
          permissions: rolePermissions.permissions,
        })
        .from(rolePermissions)
        .where(eq(rolePermissions.isActive, true));

      logIntegration(ctx, "finabill.listRoleTemplates", "success", { count: data.length });
      return { data };
    }),

  upsertUser: apiKeyProcedure
    .use(requireApiKey("users:write"))
    .input(
      z.object({
        externalId: z.string().optional(),
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional().nullable(),
        role: z.string().min(1),
        isActive: z.boolean().optional().default(true),
        locationIds: z.array(z.number()).optional().default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        logIntegration(ctx, "finabill.upsertUser", "failed", { error: "No active business" });
        throw new Error("No active business");
      }

      assertAllowedIntegrationRole(input.role);

      if (input.locationIds.length > 0) {
        const validLocations = await db
          .select({ id: locations.id })
          .from(locations)
          .where(
            and(
              eq(locations.businessId, businessId),
              inArray(locations.id, input.locationIds),
              isNull(locations.deletedAt),
            ),
          );
        if (validLocations.length !== input.locationIds.length) {
          throw new Error("One or more locationIds do not belong to this business");
        }
      }

      const existing = input.externalId
        ? await db
            .select({ user: users })
            .from(users)
            .innerJoin(userBusinesses, eq(users.id, userBusinesses.userId))
            .where(
              and(
                eq(userBusinesses.businessId, businessId),
                eq(users.id, Number(input.externalId)),
                isNull(users.deletedAt)
              )
            )
            .limit(1)
        : [];

      if (existing[0]) {
        const [updated] = await db
          .update(users)
          .set({
            name: input.name,
            email: input.email,
            phone: input.phone ?? existing[0].user.phone,
            role: input.role as any,
            isActive: input.isActive,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existing[0].user.id))
          .returning();

        const [membership] = await db
          .select()
          .from(userBusinesses)
          .where(
            and(
              eq(userBusinesses.userId, updated.id),
              eq(userBusinesses.businessId, businessId)
            )
          )
          .limit(1);

        if (membership) {
          await db
            .update(userBusinesses)
            .set({
              role: input.role as any,
              isActive: input.isActive,
            })
            .where(eq(userBusinesses.id, membership.id));
        } else {
          await db.insert(userBusinesses).values({
            userId: updated.id,
            businessId,
            role: input.role as any,
            isActive: input.isActive,
          });
        }

        logIntegration(ctx, "finabill.upsertUser", "success", { userId: updated.id, created: false });
        return { id: updated.id, created: false };
      }

      const passwordHash = await hashPassword(crypto.randomUUID());
      const username = input.email.toLowerCase().trim();

      const [created] = await db
        .insert(users)
        .values({
          name: input.name,
          email: input.email,
          phone: input.phone ?? null,
          username,
          passwordHash,
          role: input.role as any,
          isActive: input.isActive,
        })
        .returning();

      await db.insert(userBusinesses).values({
        userId: created.id,
        businessId,
        role: input.role as any,
        isActive: input.isActive,
      });

      if (input.locationIds.length > 0) {
        await db.insert(userLocations).values(
          input.locationIds.map((locationId, idx) => ({
            userId: created.id,
            locationId,
            isPrimary: idx === 0,
            isActive: true,
          }))
        );
      }

      logIntegration(ctx, "finabill.upsertUser", "success", { userId: created.id, created: true });
      return { id: created.id, created: true };
    }),
});
