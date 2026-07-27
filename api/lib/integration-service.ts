// ABOUTME: Shared business logic for external API integration endpoints.
// ABOUTME: Called by both the v1 REST routes and the legacy tRPC integrationFinabill router.
import { eq, and, isNull, inArray, or, gt, sql } from "drizzle-orm";
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
  ledgerEntries,
  bills,
  billItems,
  expenses,
  type AccountType,
  type AccountSubType,
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

/**
 * List operational money/payment accounts (cash drawers, M-Pesa tills, wallets,
 * bank accounts) for a business — the rows shown on the "Your Accounts" page.
 * These have accountType IS NULL and carry a live currentBalance, unlike CoA rows.
 * Accounts may be attached to the business directly or via a location.
 */
export async function listPaymentAccounts(businessId: number) {
  const db = getDb();
  return db
    .select({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
      accountCode: accounts.accountCode,
      accountNumber: accounts.accountNumber,
      currency: accounts.currency,
      openingBalance: accounts.openingBalance,
      currentBalance: accounts.currentBalance,
      isActive: accounts.isActive,
      locationId: accounts.locationId,
      locationName: locations.name,
    })
    .from(accounts)
    .leftJoin(locations, eq(accounts.locationId, locations.id))
    .where(
      and(
        or(eq(accounts.businessId, businessId), eq(locations.businessId, businessId)),
        isNull(accounts.accountType),
        isNull(accounts.deletedAt)
      )
    )
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
      externalId: suppliers.externalId,
      externalSystem: suppliers.externalSystem,
    })
    .from(suppliers)
    .where(and(eq(suppliers.businessId, businessId), isNull(suppliers.deletedAt)))
    .orderBy(suppliers.name);
}

/**
 * List ledger entries for one operational money account, oldest first.
 * Cursor-paginated by entry id so FinaBill can pull incrementally.
 */
export async function listAccountTransactions(
  businessId: number,
  accountId: number,
  options?: { sinceEntryId?: number; limit?: number },
) {
  const db = getDb();
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 200);

  // The account must be an operational money account of this business
  // (attached directly or via one of its locations).
  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .leftJoin(locations, eq(accounts.locationId, locations.id))
    .where(
      and(
        eq(accounts.id, accountId),
        or(eq(accounts.businessId, businessId), eq(locations.businessId, businessId)),
        isNull(accounts.accountType),
        isNull(accounts.deletedAt),
      ),
    )
    .limit(1);
  if (!account) {
    throw new Error("Account not found for this business");
  }

  const conditions = [eq(ledgerEntries.accountId, accountId), isNull(ledgerEntries.deletedAt)];
  if (options?.sinceEntryId) {
    conditions.push(gt(ledgerEntries.id, options.sinceEntryId));
  }

  return db
    .select({
      id: ledgerEntries.id,
      entryType: ledgerEntries.entryType,
      amount: ledgerEntries.amount,
      balanceAfter: ledgerEntries.balanceAfter,
      transactionType: ledgerEntries.transactionType,
      transactionId: ledgerEntries.transactionId,
      description: ledgerEntries.description,
      refNo: ledgerEntries.refNo,
      entryDate: ledgerEntries.entryDate,
      createdAt: ledgerEntries.createdAt,
    })
    .from(ledgerEntries)
    .where(and(...conditions))
    .orderBy(ledgerEntries.id)
    .limit(limit);
}

/**
 * List bills for FinaBill pull sync. Includes line items and external linkage
 * so FinaBill can skip bills that originated from FinaBill itself.
 */
export async function listBills(businessId: number, options?: { updatedSince?: string }) {
  const db = getDb();
  const conditions = [eq(bills.businessId, businessId), isNull(bills.deletedAt)];
  if (options?.updatedSince) {
    conditions.push(gt(bills.updatedAt, new Date(options.updatedSince)));
  }

  const billRows = await db
    .select({
      id: bills.id,
      billNumber: bills.billNumber,
      description: bills.description,
      supplierId: bills.supplierId,
      supplierName: suppliers.name,
      amount: bills.amount,
      amountPaid: bills.amountPaid,
      balanceDue: bills.balanceDue,
      issueDate: bills.issueDate,
      dueDate: bills.dueDate,
      status: bills.status,
      externalId: bills.externalId,
      externalSystem: bills.externalSystem,
      updatedAt: bills.updatedAt,
    })
    .from(bills)
    .leftJoin(suppliers, eq(bills.supplierId, suppliers.id))
    .where(and(...conditions))
    .orderBy(bills.id);

  if (billRows.length === 0) return [];

  const itemRows = await db
    .select({
      billId: billItems.billId,
      itemName: billItems.itemName,
      quantity: billItems.quantity,
      unitPrice: billItems.unitPrice,
      totalPrice: billItems.totalPrice,
      notes: billItems.notes,
    })
    .from(billItems)
    .where(and(inArray(billItems.billId, billRows.map((b) => b.id)), isNull(billItems.deletedAt)));

  const itemsByBill = new Map<number, typeof itemRows>();
  for (const item of itemRows) {
    const list = itemsByBill.get(item.billId) ?? [];
    list.push(item);
    itemsByBill.set(item.billId, list);
  }

  return billRows.map((b) => ({ ...b, items: itemsByBill.get(b.id) ?? [] }));
}

/** List expenses for FinaBill pull sync (billId lets FinaBill skip bill-payment expenses). */
export async function listExpenses(businessId: number, options?: { updatedSince?: string }) {
  const db = getDb();
  const conditions = [eq(expenses.businessId, businessId), isNull(expenses.deletedAt)];
  if (options?.updatedSince) {
    conditions.push(gt(expenses.updatedAt, new Date(options.updatedSince)));
  }

  return db
    .select({
      id: expenses.id,
      expenseNumber: expenses.expenseNumber,
      billId: expenses.billId,
      categoryId: expenses.categoryId,
      categoryName: expenseCategories.name,
      supplierId: expenses.supplierId,
      amount: expenses.amount,
      description: expenses.description,
      expenseDate: expenses.expenseDate,
      paymentMethod: expenses.paymentMethod,
      accountId: expenses.accountId,
      refNo: expenses.refNo,
      updatedAt: expenses.updatedAt,
    })
    .from(expenses)
    .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .where(and(...conditions))
    .orderBy(expenses.id);
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
  const externalId = input.externalId?.trim() || null;

  // Match by stable FinaBill external id first, then by exact name.
  let existing = externalId
    ? await db
        .select()
        .from(suppliers)
        .where(
          and(
            eq(suppliers.businessId, businessId),
            eq(suppliers.externalSystem, "finabill"),
            eq(suppliers.externalId, externalId),
            isNull(suppliers.deletedAt),
          ),
        )
        .limit(1)
    : [];

  if (!existing[0]) {
    existing = await db
      .select()
      .from(suppliers)
      .where(
        and(
          eq(suppliers.businessId, businessId),
          sql`LOWER(${suppliers.name}) = LOWER(${input.name})`,
          isNull(suppliers.deletedAt),
        ),
      )
      .limit(1);
  }

  if (existing[0]) {
    const [updated] = await db
      .update(suppliers)
      .set({
        name: input.name,
        email: input.email ?? existing[0].email,
        phone: input.phone ?? existing[0].phone,
        kraPin: input.taxId ?? existing[0].kraPin,
        externalId: externalId ?? existing[0].externalId,
        externalSystem: externalId ? "finabill" : existing[0].externalSystem,
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
      externalId,
      externalSystem: externalId ? "finabill" : null,
    })
    .returning();
  return { id: created.id, created: true };
}

/**
 * Create or update a Chart of Accounts row pushed from FinaBill.
 * Matches by (externalSystem=finabill, externalId), then accountType+accountCode,
 * then accountType+name. Only CoA rows (accountType required) — never money accounts.
 */
export async function upsertAccount(
  businessId: number,
  input: {
    externalId: string;
    name: string;
    accountCode?: string | null;
    accountType: AccountType;
    accountSubType?: AccountSubType | null;
    description?: string | null;
    isActive?: boolean;
  },
) {
  const db = getDb();
  const externalId = input.externalId.trim();
  if (!externalId) {
    throw new Error("externalId is required");
  }

  let existing = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.businessId, businessId),
        eq(accounts.externalSystem, "finabill"),
        eq(accounts.externalId, externalId),
        isNull(accounts.deletedAt),
      ),
    )
    .limit(1);

  if (!existing[0] && input.accountCode) {
    existing = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.businessId, businessId),
          eq(accounts.accountType, input.accountType),
          eq(accounts.accountCode, input.accountCode),
          isNull(accounts.deletedAt),
        ),
      )
      .limit(1);
  }

  if (!existing[0]) {
    existing = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.businessId, businessId),
          eq(accounts.accountType, input.accountType),
          sql`LOWER(${accounts.name}) = LOWER(${input.name})`,
          isNull(accounts.deletedAt),
        ),
      )
      .limit(1);
  }

  if (existing[0]) {
    const [updated] = await db
      .update(accounts)
      .set({
        name: input.name,
        accountCode: input.accountCode ?? existing[0].accountCode,
        accountSubType: input.accountSubType ?? existing[0].accountSubType,
        description: input.description ?? existing[0].description,
        isActive: input.isActive ?? existing[0].isActive,
        externalId,
        externalSystem: "finabill",
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, existing[0].id))
      .returning();
    return { id: updated.id, created: false, name: updated.name, accountType: updated.accountType };
  }

  const [created] = await db
    .insert(accounts)
    .values({
      businessId,
      name: input.name,
      type: "bank_account",
      accountCode: input.accountCode ?? null,
      accountType: input.accountType,
      accountSubType: input.accountSubType ?? null,
      description: input.description ?? null,
      isActive: input.isActive ?? true,
      externalId,
      externalSystem: "finabill",
      lastSyncedAt: new Date(),
    })
    .returning();
  return { id: created.id, created: true, name: created.name, accountType: created.accountType };
}

/**
 * Create or update a purchase bill pushed from FinaBill (matched by externalId).
 * Records the bill + line items only — GL postings flow through the journal push
 * path, so no ledger entries are written here.
 */
export async function upsertBill(
  businessId: number,
  input: {
    externalId: string;
    billNumber?: string | null;
    description: string;
    amount: string;
    amountPaid?: string | null;
    issueDate: string;
    dueDate: string;
    status: "draft" | "received" | "partial" | "paid" | "void";
    locationId?: number | null;
    supplier?: { externalId?: string | null; name: string; email?: string | null; phone?: string | null; taxId?: string | null } | null;
    items?: Array<{ itemName: string; quantity?: string | null; unitPrice: string; totalPrice: string; notes?: string | null }>;
  },
) {
  const db = getDb();
  const externalId = input.externalId.trim();
  if (!externalId) {
    throw new Error("externalId is required");
  }

  // Resolve location — bills require one; default to the business's first active location.
  let locationId = input.locationId ?? null;
  if (locationId) {
    const [loc] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.id, locationId), eq(locations.businessId, businessId), isNull(locations.deletedAt)))
      .limit(1);
    if (!loc) throw new Error("locationId does not belong to this business");
  } else {
    const [loc] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.businessId, businessId), eq(locations.isActive, true), isNull(locations.deletedAt)))
      .orderBy(locations.id)
      .limit(1);
    if (!loc) throw new Error("Business has no active location to attach the bill to");
    locationId = loc.id;
  }

  let supplierId: number | null = null;
  if (input.supplier) {
    const result = await upsertSupplier(businessId, {
      externalId: input.supplier.externalId ?? undefined,
      name: input.supplier.name,
      email: input.supplier.email,
      phone: input.supplier.phone,
      taxId: input.supplier.taxId,
    });
    supplierId = result.id;
  }

  const statusMap = {
    draft: "pending",
    received: "pending",
    partial: "partial",
    paid: "paid",
    void: "cancelled",
  } as const;
  const status = statusMap[input.status];
  const amountPaid = input.amountPaid ?? "0.00";
  const balanceDue = (Number(input.amount) - Number(amountPaid)).toFixed(2);

  const existing = await db
    .select()
    .from(bills)
    .where(
      and(
        eq(bills.businessId, businessId),
        eq(bills.externalSystem, "finabill"),
        eq(bills.externalId, externalId),
        isNull(bills.deletedAt),
      ),
    )
    .limit(1);

  const billValues = {
    billNumber: input.billNumber ?? null,
    description: input.description,
    // Only touch the supplier link when the push carries supplier info —
    // an update without it must not orphan the existing linkage.
    ...(input.supplier ? { supplierId } : {}),
    amount: input.amount,
    amountPaid,
    balanceDue,
    issueDate: new Date(input.issueDate).toISOString().split("T")[0],
    dueDate: new Date(input.dueDate).toISOString().split("T")[0],
    status,
  };

  const billId = await db.transaction(async (tx) => {
    let id: number;
    if (existing[0]) {
      const [updated] = await tx
        .update(bills)
        .set({ ...billValues, updatedAt: new Date() })
        .where(eq(bills.id, existing[0].id))
        .returning();
      id = updated.id;
    } else {
      const [created] = await tx
        .insert(bills)
        .values({
          ...billValues,
          businessId,
          locationId: locationId!,
          externalId,
          externalSystem: "finabill",
        })
        .returning();
      id = created.id;
    }

    if (input.items) {
      // Replace line items wholesale — FinaBill owns this bill's content.
      await tx.update(billItems).set({ deletedAt: new Date() }).where(eq(billItems.billId, id));
      if (input.items.length > 0) {
        await tx.insert(billItems).values(
          input.items.map((item) => ({
            billId: id,
            itemName: item.itemName,
            quantity: item.quantity ?? "1.000",
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            notes: item.notes ?? null,
          })),
        );
      }
    }

    return id;
  });

  return { id: billId, created: !existing[0], status };
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