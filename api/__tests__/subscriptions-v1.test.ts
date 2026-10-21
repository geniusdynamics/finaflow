// ABOUTME: Integration tests for the v1 REST subscriptions API — API-key auth, scopes, list endpoints,
// ABOUTME: payment recording with the write scope, and cross-tenant isolation.
import { describe, expect, it, beforeAll } from "vitest";
import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import {
  accounts,
  apiKeys,
  businesses,
  expenseCategories,
  locations,
  subscriptionPayments,
  subscriptions,
  userBusinesses,
  users,
} from "@db/schema";
import {
  generateApiKey,
  getKeyPrefix,
  hashApiKey,
} from "../lib/api-key-auth";
import type { ApiKeyVariables } from "../lib/api-key-middleware";
import subscriptionsV1 from "../routes/v1/subscriptions";

async function createTestApiKey(businessId: number, scopes: string[]): Promise<string> {
  const db = getDb();
  const rawKey = generateApiKey();
  const [row] = await db
    .insert(apiKeys)
    .values({
      businessId,
      name: "Subs V1 Test Key",
      keyHash: await hashApiKey(rawKey, 4),
      keyPrefix: getKeyPrefix(rawKey),
      scopes,
    } as never)
    .returning();
  expect(row.id).toBeGreaterThan(0);
  return rawKey;
}

describe("v1 subscriptions REST API", () => {
  let db: ReturnType<typeof getDb>;
  let bizA: typeof businesses.$inferSelect;
  let bizB: typeof businesses.$inferSelect;
  let ownerA: typeof users.$inferSelect;
  let subA: typeof subscriptions.$inferSelect;
  let app: Hono<{ Variables: ApiKeyVariables }>;

  beforeAll(async () => {
    db = getDb();

    for (const prefix of ["SUBV1_A", "SUBV1_B"]) {
      const existingBiz = await db.select({ id: businesses.id }).from(businesses).where(sql`${businesses.slug} LIKE ${prefix + "%"}`);
      for (const b of existingBiz) {
        await db.delete(subscriptionPayments).where(eq(subscriptionPayments.businessId, b.id));
        await db.delete(subscriptions).where(eq(subscriptions.businessId, b.id));
        await db.delete(expenseCategories).where(eq(expenseCategories.businessId, b.id));
        await db.delete(accounts).where(eq(accounts.businessId, b.id));
        await db.delete(locations).where(eq(locations.businessId, b.id));
        await db.delete(userBusinesses).where(eq(userBusinesses.businessId, b.id));
        await db.delete(apiKeys).where(eq(apiKeys.businessId, b.id));
        await db.delete(businesses).where(eq(businesses.id, b.id));
      }
      await db.delete(users).where(sql`${users.username} LIKE 'sub-v1-%'`);
    }

    [bizA] = await db.insert(businesses).values({ accountId: "SUBV1_A", name: "Subs V1 A", slug: "SUBV1_A_main", plan: "pro", isActive: true } as never).returning();
    [bizB] = await db.insert(businesses).values({ accountId: "SUBV1_B", name: "Subs V1 B", slug: "SUBV1_B_main", plan: "pro", isActive: true } as never).returning();
    const [locA] = await db.insert(locations).values({ businessId: bizA.id, name: "V1 Branch", slug: "subv1-a-b1", isActive: true } as never).returning();
    [ownerA] = await db.insert(users).values({ username: "sub-v1-owner", name: "V1 Owner", role: "owner", isActive: true, currentBusinessId: bizA.id } as never).returning();
    await db.insert(userBusinesses).values({ userId: ownerA.id, businessId: bizA.id, role: "owner", isActive: true } as never);

    [subA] = await db
      .insert(subscriptions)
      .values({
        businessId: bizA.id,
        locationId: locA.id,
        name: "V1 Sub",
        amount: "250.00",
        currency: "KES",
        cycleUnit: "month",
        cycleCount: 1,
        isOneTime: false,
        startDate: "2027-01-01",
        nextDueDate: "2027-08-01",
        autoRenew: false,
        status: "active",
        postingMode: "none",
        notifyEnabled: true,
        createdBy: ownerA.id,
      } as never)
      .returning();

    app = new Hono<{ Variables: ApiKeyVariables }>();
    app.route("/api/v1/subscriptions", subscriptionsV1);
  });

  const get = (path: string, rawKey?: string) =>
    app.fetch(
      new Request(`http://localhost/api/v1/subscriptions${path}`, {
        method: "GET",
        headers: rawKey ? { Authorization: `Bearer ${rawKey}` } : {},
      }),
    );

  it("rejects requests without a valid API key", async () => {
    const res = await get("");
    expect(res.status).toBe(401);
  });

  it("rejects read access without the subscriptions:read scope", async () => {
    const rawKey = await createTestApiKey(bizA.id, ["subscriptions:write"]);
    const res = await get("", rawKey);
    expect(res.status).toBe(403);
  });

  it("lists subscriptions and payments with the read scope in the unified envelope", async () => {
    const rawKey = await createTestApiKey(bizA.id, ["subscriptions:read"]);

    const listRes = await get("", rawKey);
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { data: { id: number; name: string }[]; meta: { requestId?: string; pagination?: unknown } };
    expect(listBody.data.find((s) => s.id === subA.id)).toBeTruthy();
    expect(listBody.meta.pagination).toBeTruthy();

    const paymentsRes = await get("/payments", rawKey);
    expect(paymentsRes.status).toBe(200);
    const paymentsBody = (await paymentsRes.json()) as { data: unknown[] };
    expect(Array.isArray(paymentsBody.data)).toBe(true);
  });

  it("records a payment with the write scope and rejects duplicates with 409", async () => {
    const rawKey = await createTestApiKey(bizA.id, ["subscriptions:write"]);
    const post = (body: unknown) =>
      app.fetch(
        new Request(`http://localhost/api/v1/subscriptions/${subA.id}/payments`, {
          method: "POST",
          headers: { Authorization: `Bearer ${rawKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );

    const res = await post({ paymentMethod: "bank_transfer", paidDate: "2027-08-01" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { paymentId: number; subscriptionId: number } };
    expect(body.data.paymentId).toBeGreaterThan(0);
    expect(body.data.subscriptionId).toBe(subA.id);

    const payments = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.subscriptionId, subA.id));
    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe("250.00");

    // Same cycle again -> conflict
    const dupRes = await post({ paymentMethod: "bank_transfer", cycleDueDate: "2027-08-01", advance: false });
    expect(dupRes.status).toBe(409);

    // The schedule advanced one cycle after the first payment
    const [after] = await db.select().from(subscriptions).where(eq(subscriptions.id, subA.id));
    expect(after.nextDueDate).toBe("2027-09-01");
  });

  it("returns 404 for another business's subscription", async () => {
    const rawKeyB = await createTestApiKey(bizB.id, ["subscriptions:write"]);
    const res = await app.fetch(
      new Request(`http://localhost/api/v1/subscriptions/${subA.id}/payments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${rawKeyB}`, "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: "cash" }),
      }),
    );
    expect(res.status).toBe(404);

    const rawKeyBRead = await createTestApiKey(bizB.id, ["subscriptions:read"]);
    const listB = await get("", rawKeyBRead);
    const bodyB = (await listB.json()) as { data: { id: number }[] };
    expect(bodyB.data.find((s) => s.id === subA.id)).toBeUndefined();
  });
});
