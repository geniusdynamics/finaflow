// ABOUTME: Integration tests for the v1 write endpoints added to close the API gap audit.
// ABOUTME: Covers bill payments, account update, category archive and daily-sales detail/delete.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { getDb } from "../queries/connection";
import {
  accounts,
  apiKeys,
  billPayments,
  bills,
  businesses,
  dailySalePayments,
  dailySales,
  expenseCategories,
  expenses,
  ledgerEntries,
  locationPaymentMethods,
  locations,
  paymentMethods,
  users,
  userBusinesses,
} from "@db/schema";
import { ingestDailySales } from "../lib/daily-sales-ingestion";
import { generateApiKey, getKeyPrefix, hashApiKey } from "../lib/api-key-auth";
import type { ApiKeyVariables } from "../lib/api-key-middleware";
import accountsV1 from "../routes/v1/accounts";
import billsV1 from "../routes/v1/bills";
import categoriesV1 from "../routes/v1/categories";
import dailySalesV1 from "../routes/v1/daily-sales";

const db = getDb();

let businessId = 0;
let locationId = 0;
let ownerId = 0;
let cashAccountId = 0;
let categoryId = 0;
let rawKey = "";
let billId = 0;
let dailySaleId = 0;

function auth() {
  return { Authorization: `Bearer ${rawKey}`, "Content-Type": "application/json" };
}

beforeAll(async () => {
  const suffix = Date.now();
  const [business] = await db
    .insert(businesses)
    .values({
      accountId: `V1WRITE-${suffix}`,
      name: "V1 Write Test",
      slug: `v1-write-${suffix}`,
      plan: "pro",
      isActive: true,
    } as never)
    .returning();
  businessId = business.id;

  const [location] = await db
    .insert(locations)
    .values({ businessId, name: "Main", slug: `v1-write-main-${suffix}`, isActive: true } as never)
    .returning();
  locationId = location.id;

  const [owner] = await db
    .insert(users)
    .values({
      username: `v1-write-${suffix}`,
      email: `v1-write-${suffix}@test.com`,
      name: "V1 Write Owner",
      role: "owner",
      currentBusinessId: businessId,
      isActive: true,
    } as never)
    .returning();
  ownerId = owner.id;

  await db.insert(userBusinesses).values({ userId: ownerId, businessId, role: "owner", isActive: true } as never);

  const [cash] = (await db
    .insert(accounts)
    .values({
      businessId,
      locationId,
      name: "Cash",
      type: "cash",
      accountType: "asset",
      accountSubType: "cash",
      currentBalance: "1000.00",
      isActive: true,
    })
    .returning()) as Array<typeof accounts.$inferSelect>;
  cashAccountId = cash.id;

  const [category] = (await db
    .insert(expenseCategories)
    .values({ businessId, name: "Office Supplies", accountingClass: "operating_expense", isActive: true })
    .returning()) as Array<typeof expenseCategories.$inferSelect>;
  categoryId = category.id;

  const [cashMethod] = (await db
    .insert(paymentMethods)
    .values({ businessId, name: "Cash", code: "cash", isActive: true })
    .returning()) as Array<typeof paymentMethods.$inferSelect>;
  await db.insert(locationPaymentMethods).values({
    locationId,
    paymentMethodId: cashMethod.id,
    linkedAccountId: cashAccountId,
    isActive: true,
  } as never);

  rawKey = generateApiKey();
  await db.insert(apiKeys).values({
    businessId,
    name: "V1 Write Key",
    keyHash: await hashApiKey(rawKey, 4),
    keyPrefix: getKeyPrefix(rawKey),
    scopes: ["bills:read", "bills:write", "accounts:read", "accounts:write", "categories:read", "categories:write", "sales:read", "sales:write"],
  } as never);
}, 120_000);

afterAll(async () => {
  const businessAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.businessId, businessId));
  if (businessAccounts.length > 0) {
    await db.delete(ledgerEntries).where(inArray(ledgerEntries.accountId, businessAccounts.map((row) => row.id)));
  }
  await db.delete(expenses).where(eq(expenses.businessId, businessId));
  await db.delete(billPayments).where(
    inArray(billPayments.billId, db.select({ id: bills.id }).from(bills).where(eq(bills.businessId, businessId))),
  );
  await db.delete(bills).where(eq(bills.businessId, businessId));
  if (dailySaleId) {
    await db.delete(dailySalePayments).where(eq(dailySalePayments.dailySaleId, dailySaleId));
  }
  await db.delete(dailySales).where(eq(dailySales.locationId, locationId));
  await db.delete(expenseCategories).where(eq(expenseCategories.businessId, businessId));
  await db.delete(locationPaymentMethods).where(eq(locationPaymentMethods.locationId, locationId));
  await db.delete(paymentMethods).where(eq(paymentMethods.businessId, businessId));
  await db.delete(accounts).where(eq(accounts.businessId, businessId));
  await db.delete(apiKeys).where(eq(apiKeys.businessId, businessId));
  await db.delete(userBusinesses).where(eq(userBusinesses.businessId, businessId));
  await db.delete(locations).where(eq(locations.businessId, businessId));
  await db.delete(users).where(eq(users.id, ownerId));
  await db.delete(businesses).where(eq(businesses.id, businessId));
});

describe("v1 write endpoints", () => {
  it("creates a bill and records a payment attributed to a real user", async () => {
    const app = new Hono<{ Variables: ApiKeyVariables }>();
    app.route("/bills", billsV1);

    const created = await app.request("/bills", {
      method: "POST",
      headers: auth(),
      body: JSON.stringify({
        externalId: `v1-write-bill-${Date.now()}`,
        description: "Printer paper",
        amount: "500.00",
        issueDate: "2026-10-01",
        dueDate: "2026-10-31",
        status: "received",
        locationId,
      }),
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as { data: { id: number; created: boolean } };
    billId = createdBody.data.id;
    expect(billId).toBeGreaterThan(0);

    const payment = await app.request(`/bills/${billId}/payments`, {
      method: "POST",
      headers: auth(),
      body: JSON.stringify({
        paymentMethod: "cash",
        amount: "200.00",
        paymentDate: "2026-10-05",
        accountId: cashAccountId,
        categoryId,
        reference: "PAY-1",
      }),
    });
    expect(payment.status).toBe(201);
    const paymentBody = (await payment.json()) as { data: { paymentId: number; status: string; newBalanceDue: string } };
    expect(paymentBody.data).toMatchObject({ status: "partial", newBalanceDue: "300.00" });

    const [stored] = await db
      .select({ enteredBy: billPayments.enteredBy, amount: billPayments.amount })
      .from(billPayments)
      .where(eq(billPayments.id, paymentBody.data.paymentId));
    expect(stored.enteredBy).toBe(ownerId);
    expect(stored.amount).toBe("200.00");

    const list = await app.request(`/bills/${billId}/payments`, { headers: auth() });
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as { data: unknown[] };
    expect(listBody.data).toHaveLength(1);
  });

  it("updates a bank account and archives a category", async () => {
    const app = new Hono<{ Variables: ApiKeyVariables }>();
    app.route("/accounts", accountsV1);
    app.route("/categories", categoriesV1);

    const [bank] = (await db
      .insert(accounts)
      .values({
        businessId,
        locationId,
        name: "KCB Current",
        type: "bank_account",
        accountType: "asset",
        accountSubType: "cash",
        accountNumber: "1234567890",
        currentBalance: "0.00",
        isActive: true,
      })
      .returning()) as Array<typeof accounts.$inferSelect>;

    const detail = await app.request(`/accounts/${bank.id}`, { headers: auth() });
    expect(detail.status).toBe(200);

    const updated = await app.request(`/accounts/${bank.id}`, {
      method: "PATCH",
      headers: auth(),
      body: JSON.stringify({ name: "KCB Current Account", isActive: false }),
    });
    expect(updated.status).toBe(200);
    const updatedBody = (await updated.json()) as { data: { name: string; isActive: boolean } };
    expect(updatedBody.data).toMatchObject({ name: "KCB Current Account", isActive: false });

    const archived = await app.request(`/categories/${categoryId}`, { method: "DELETE", headers: auth() });
    expect(archived.status).toBe(200);

    const [category] = await db
      .select({ isActive: expenseCategories.isActive, deletedAt: expenseCategories.deletedAt })
      .from(expenseCategories)
      .where(eq(expenseCategories.id, categoryId));
    expect(category.isActive).toBe(false);
    expect(category.deletedAt).not.toBeNull();

    const list = await app.request("/categories", { headers: auth() });
    const listBody = (await list.json()) as { data: Array<{ id: number }> };
    expect(listBody.data.some((item) => item.id === categoryId)).toBe(false);
  });

  it("reads and soft-deletes a daily sale", async () => {
    const app = new Hono<{ Variables: ApiKeyVariables }>();
    app.route("/daily-sales", dailySalesV1);

    const created = await ingestDailySales({
      businessId,
      locationId,
      saleDate: "2026-10-06",
      sourceSystem: "finabill",
      sourceBatchId: `v1-write:${businessId}:2026-10-06`,
      payments: [{ channel: "cash", amount: "1200.00" }],
    });
    expect(created.success).toBe(true);
    if (!created.success) return;
    dailySaleId = created.dailySaleId;

    const detail = await app.request(`/daily-sales/${dailySaleId}`, { headers: auth() });
    expect(detail.status).toBe(200);
    const detailBody = (await detail.json()) as { data: { netSales: string; payments: unknown[] } };
    expect(detailBody.data.netSales).toBe("1200.00");
    expect(detailBody.data.payments).toHaveLength(1);

    const deleted = await app.request(`/daily-sales/${dailySaleId}`, { method: "DELETE", headers: auth() });
    expect(deleted.status).toBe(200);

    const gone = await app.request(`/daily-sales/${dailySaleId}`, { headers: auth() });
    expect(gone.status).toBe(404);

    const rows = await db
      .select({ id: dailySales.id })
      .from(dailySales)
      .where(and(eq(dailySales.id, dailySaleId), isNull(dailySales.deletedAt)));
    expect(rows).toHaveLength(0);
  });
});
