// ABOUTME: Shared business logic for external API integration endpoints.
// ABOUTME: Called by both the v1 REST routes and the legacy tRPC integrationFinabill router.
import { eq, and, isNull, inArray } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { hashPassword } from "./password";
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
import crypto from "crypto";

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

export function logIntegration(
  ctx: { businessId?: number | null; apiKey?: { id?: number | null } | null },
  operation: string,
  status: string,
  extras?: Record<string, unknown>,
) {
  const payload: Record<string, unknown> = {
    businessId: ctx.businessId ?? null,
    sourceSystem: "integration",
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

// â”€â”€ Read operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function listAccounts(businessId: number, accountType?: string) {
  const db = getDb();
  const conditions = [eq(accounts.businessId, businessId), isNull(accounts.deletedAt)];
  if (accountType) {
    conditions.push(eq(accounts.accountType, accountType as any));
  }
  return db
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
}

export async function listSuppliers(businessId: number) {
  const db = getDb();
  return db
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
}

export async function listCategories(businessId: number) {
  const db = getDb();
  const data = await db
    .select({
      id: expenseCategories.id,
      name: expenseCategories.name,
      categoryType: expenseCategories.accountingClass,
      defaultAccountId: expenseCategories.defaultAccountId,
      externalAccountCode: expenseCategories.externalAccountCode,
      externalSystem: expenseCategories.externalSystem,
      isActive: expenseCategories.isActive,
    })
    .from(expenseCategories)
    .where(and(eq(expenseCategories.businessId, businessId), isNull(expenseCategories.deletedAt)))
    .orderBy(expenseCategories.name);
  return data.map((c) => ({
    id: c.id,
    name: c.name,
    categoryType: "expense" as const,
    defaultAccountId: c.defaultAccountId,
    externalAccountCode: c.externalAccountCode,
    externalId:
      c.externalSystem === "finabill" && c.externalAccountCode
        ? c.externalAccountCode
        : null,
    isActive: c.isActive,
  }));
}

export async function getBusinessProfile(businessId: number) {
  const db = getDb();
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

  if (!business) return null;
  return {
    ...business,
    timezone: null,
    dateFormat: null,
    currency: null,
    accentColor: null,
    logoUrl: null,
  };
}

export async function listLocations(businessId: number) {
  const db = getDb();
  return db
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
}

export async function listUsers(businessId: number) {
  const db = getDb();
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
        isNull(users.deletedAt),
      ),
    );

  const businessLocationRows = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.businessId, businessId), isNull(locations.deletedAt)));
  const businessLocationIds = new Set(businessLocationRows.map((r) => r.id));

  const locationRows = businessLocationIds.size
    ? await db
        .select({ userId: userLocations.userId, locationId: userLocations.locationId })
        .from(userLocations)
        .where(inArray(userLocations.locationId, Array.from(businessLocationIds)))
    : [];

  const locationsByUser = new Map<number, number[]>();
  for (const row of locationRows) {
    const list = locationsByUser.get(row.userId) ?? [];
    list.push(row.locationId);
    locationsByUser.set(row.userId, list);
  }

  return userRows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    isActive: u.isActive,
    assignedLocationIds: locationsByUser.get(u.id) ?? [],
  }));
}

export async function listRoleTemplates() {
  const db = getDb();
  return db
    .select({
      role: rolePermissions.roleKey,
      permissions: rolePermissions.permissions,
    })
    .from(rolePermissions)
    .where(eq(rolePermissions.isActive, true));
}

// â”€â”€ Write operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function upsertSupplier(
  businessId: number,
  input: {
    externalId?: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    taxId?: string | null;
  },
) {
  const db = getDb();
  const existing = input.externalId
    ? await db
        .select()
        .from(suppliers)
        .where(
          and(
            eq(suppliers.businessId, businessId),
            eq(suppliers.id, Number(input.externalId)),
            isNull(suppliers.deletedAt),
          ),
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
  return { id: created.id, created: true };
}

export async function upsertUser(
  businessId: number,
  input: {
    externalId?: string;
    name: string;
    email: string;
    phone?: string | null;
    role: string;
    isActive?: boolean;
    locationIds?: number[];
  },
) {
  const db = getDb();
  assertAllowedIntegrationRole(input.role);
  const locationIds = input.locationIds ?? [];

  if (locationIds.length > 0) {
    const validLocations = await db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.businessId, businessId),
          inArray(locations.id, locationIds),
          isNull(locations.deletedAt),
        ),
      );
    if (validLocations.length !== locationIds.length) {
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
            isNull(users.deletedAt),
          ),
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
        isActive: input.isActive ?? true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing[0].user.id))
      .returning();

    const [membership] = await db
      .select()
      .from(userBusinesses)
      .where(and(eq(userBusinesses.userId, updated.id), eq(userBusinesses.businessId, businessId)))
      .limit(1);

    if (membership) {
      await db
        .update(userBusinesses)
        .set({ role: input.role as any, isActive: input.isActive ?? true })
        .where(eq(userBusinesses.id, membership.id));
    } else {
      await db.insert(userBusinesses).values({
        userId: updated.id,
        businessId,
        role: input.role as any,
        isActive: input.isActive ?? true,
      });
    }

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
      isActive: input.isActive ?? true,
    })
    .returning();

  await db.insert(userBusinesses).values({
    userId: created.id,
    businessId,
    role: input.role as any,
    isActive: input.isActive ?? true,
  });

  if (locationIds.length > 0) {
    await db.insert(userLocations).values(
      locationIds.map((locationId, idx) => ({
        userId: created.id,
        locationId,
        isPrimary: idx === 0,
        isActive: true,
      })),
    );
  }

  return { id: created.id, created: true };
}

export async function upsertCategory(
  businessId: number,
  input: {
    externalId?: string;
    name: string;
    categoryType?: "expense" | "income";
    defaultAccountId?: number | null;
    description?: string | null;
    isActive?: boolean;
  },
) {
  const db = getDb();
  const categoryType = input.categoryType ?? "expense";
  if (categoryType !== "expense") {
    // FinaFlow currently models operational categories as expense_categories only.
    // Income classification lives on the chart of accounts / revenue accounts.
    throw new Error(
      'categoryType "income" is not supported on FinaFlow yet. Map income via chart-of-accounts revenue accounts.',
    );
  }

  if (input.defaultAccountId != null) {
    const [account] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.id, input.defaultAccountId),
          eq(accounts.businessId, businessId),
          isNull(accounts.deletedAt),
        ),
      )
      .limit(1);
    if (!account) {
      throw new Error("defaultAccountId must belong to this business");
    }
  }

  const externalId = input.externalId?.trim() || null;

  let existing =
    externalId
      ? await db
          .select()
          .from(expenseCategories)
          .where(
            and(
              eq(expenseCategories.businessId, businessId),
              eq(expenseCategories.externalSystem, "finabill"),
              eq(expenseCategories.externalAccountCode, externalId),
              isNull(expenseCategories.deletedAt),
            ),
          )
          .limit(1)
      : [];

  if (!existing[0]) {
    existing = await db
      .select()
      .from(expenseCategories)
      .where(
        and(
          eq(expenseCategories.businessId, businessId),
          eq(expenseCategories.name, input.name),
          isNull(expenseCategories.deletedAt),
        ),
      )
      .limit(1);
  }

  if (existing[0]) {
    const [updated] = await db
      .update(expenseCategories)
      .set({
        name: input.name,
        description: input.description ?? existing[0].description,
        defaultAccountId:
          input.defaultAccountId !== undefined
            ? input.defaultAccountId
            : existing[0].defaultAccountId,
        externalSystem: externalId ? "finabill" : existing[0].externalSystem,
        externalAccountCode: externalId ?? existing[0].externalAccountCode,
        isActive: input.isActive ?? existing[0].isActive,
        updatedAt: new Date(),
        deletedAt: null,
      })
      .where(eq(expenseCategories.id, existing[0].id))
      .returning();
    return {
      id: updated.id,
      created: false,
      categoryType: "expense" as const,
      name: updated.name,
      defaultAccountId: updated.defaultAccountId,
    };
  }

  const [created] = await db
    .insert(expenseCategories)
    .values({
      businessId,
      name: input.name,
      description: input.description ?? null,
      defaultAccountId: input.defaultAccountId ?? null,
      externalSystem: externalId ? "finabill" : null,
      externalAccountCode: externalId,
      accountingClass: "operating_expense",
      isActive: input.isActive ?? true,
    })
    .returning();

  return {
    id: created.id,
    created: true,
    categoryType: "expense" as const,
    name: created.name,
    defaultAccountId: created.defaultAccountId,
  };
}