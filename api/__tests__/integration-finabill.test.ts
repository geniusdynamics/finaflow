import { describe, it, expect, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDb } from "../queries/connection";
import {
  businesses,
  locations,
  users,
  userBusinesses,
  paymentMethods,
  locationPaymentMethods,
  accounts,
  dailySales,
  apiKeys,
} from "@db/schema";
import { ingestDailySales } from "../lib/daily-sales-ingestion";
import { appRouter } from "../router";
import {
  generateApiKey,
  hashApiKey,
  getKeyPrefix,
  resolveApiKey,
} from "../lib/api-key-auth";
import { resolveApiKeyMiddleware, type ApiKeyVariables } from "../lib/api-key-middleware";

let testBusinessId: number;
let testLocationId: number;
let testPaymentMethodId: number;
let testAccountId: number;

async function createTestApiKey(
  businessId: number,
  scopes: string[] = ["read", "write"]
): Promise<{ rawKey: string; keyId: number }> {
  const db = getDb();
  const rawKey = generateApiKey();
  const prefix = getKeyPrefix(rawKey);
  const keyHash = await hashApiKey(rawKey, 4);
  const [row] = await db
    .insert(apiKeys)
    .values({
      businessId,
      name: "Test API Key",
      keyHash,
      keyPrefix: prefix,
      scopes,
    } as any)
    .returning();
  return { rawKey, keyId: row.id };
}

beforeAll(async () => {
  const db = getDb();

  const [business] = await db
    .insert(businesses)
    .values({
      accountId: `FINABILL-INT-${Date.now()}`,
      name: "Finabill Integration Test",
      slug: `finabill-int-${Date.now()}`,
      plan: "pro",
      isActive: true,
    } as any)
    .returning();
  testBusinessId = business.id;

  const [location] = await db
    .insert(locations)
    .values({
      businessId: testBusinessId,
      name: "Main Branch",
      slug: `main-branch-${Date.now()}`,
      isActive: true,
    })
    .returning();
  testLocationId = location.id;

  await db
    .insert(accounts)
    .values({
      businessId: testBusinessId,
      locationId: testLocationId,
      name: "Sales Revenue",
      type: "cash",
      accountType: "revenue",
      accountSubType: "sales_revenue",
      isActive: true,
    })
    .returning();

  const [cashAccount] = (await db
    .insert(accounts)
    .values({
      businessId: testBusinessId,
      locationId: testLocationId,
      name: "Cash",
      type: "cash",
      accountType: "asset",
      accountSubType: "cash",
      isActive: true,
    } as any)
    .returning()) as any[];
  testAccountId = cashAccount.id;

  const [mpesaAccount] = (await db
    .insert(accounts)
    .values({
      businessId: testBusinessId,
      locationId: testLocationId,
      name: "M-Pesa",
      type: "mpesa",
      accountType: "asset",
      accountSubType: "cash",
      isActive: true,
    } as any)
    .returning()) as any[];

  const [cashMethod] = await db
    .insert(paymentMethods)
    .values({
      businessId: testBusinessId,
      name: "Cash",
      code: "cash",
      isActive: true,
    })
    .returning();
  testPaymentMethodId = cashMethod.id;

  const [mpesaMethod] = await db
    .insert(paymentMethods)
    .values({
      businessId: testBusinessId,
      name: "M-Pesa",
      code: "mpesa",
      isActive: true,
    })
    .returning();

  await db.insert(locationPaymentMethods).values({
    locationId: testLocationId,
    paymentMethodId: testPaymentMethodId,
    linkedAccountId: testAccountId,
    isActive: true,
  });

  await db.insert(locationPaymentMethods).values({
    locationId: testLocationId,
    paymentMethodId: mpesaMethod.id,
    linkedAccountId: mpesaAccount.id,
    isActive: true,
  });

  // Create an owner user so supplierManage middleware can be used in future tests
  const [user] = await db
    .insert(users)
    .values({
      username: `finabill-int-${Date.now()}`,
      email: `finabill-int-${Date.now()}@test.com`,
      name: "Integration Test",
      role: "owner",
      currentBusinessId: testBusinessId,
      isActive: true,
    })
    .returning();

  await db.insert(userBusinesses).values({
    userId: user.id,
    businessId: testBusinessId,
    isActive: true,
    role: "owner",
  });
}, 60_000);

describe("daily sales ingestion", () => {
  it("creates a daily sales entry from aggregated channels", async () => {
    const result = await ingestDailySales({
      businessId: testBusinessId,
      saleDate: "2026-07-01",
      sourceSystem: "finabill",
      sourceBatchId: `finabill:business:${testBusinessId}:2026-07-01`,
      payments: [
        { channel: "cash", amount: "12500.00" },
        { channel: "mpesa", amount: "8750.00" },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.created).toBe(true);
    expect(result.netSales).toBe("21250.00");

    const db = getDb();
    const row = await db
      .select()
      .from(dailySales)
      .where(eq(dailySales.id, result.dailySaleId))
      .limit(1);

    expect(row[0]).toBeDefined();
    expect(row[0].netSales).toBe("21250.00");
    expect(row[0].sourceBatchId).toBe(`finabill:business:${testBusinessId}:2026-07-01`);
  });

  it("is idempotent by sourceBatchId", async () => {
    const sourceBatchId = `finabill:business:${testBusinessId}:2026-07-02`;

    const first = await ingestDailySales({
      businessId: testBusinessId,
      saleDate: "2026-07-02",
      sourceSystem: "finabill",
      sourceBatchId,
      payments: [{ channel: "cash", amount: "5000.00" }],
    });

    expect(first.success).toBe(true);
    if (!first.success) return;

    const second = await ingestDailySales({
      businessId: testBusinessId,
      saleDate: "2026-07-02",
      sourceSystem: "finabill",
      sourceBatchId,
      payments: [{ channel: "cash", amount: "9999.00" }],
    });

    expect(second.success).toBe(true);
    if (!second.success) return;

    expect(second.created).toBe(false);
    expect(second.dailySaleId).toBe(first.dailySaleId);
    expect(second.netSales).toBe("5000.00");
  });

  it("returns warnings for unmapped channels but still creates the entry", async () => {
    const result = await ingestDailySales({
      businessId: testBusinessId,
      saleDate: "2026-07-03",
      sourceSystem: "finabill",
      sourceBatchId: `finabill:business:${testBusinessId}:2026-07-03`,
      payments: [
        { channel: "cash", amount: "3000.00" },
        { channel: "unknown_channel", amount: "1000.00" },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.warnings).toContain("Unmapped payment channel: unknown_channel");
    expect(result.netSales).toBe("3000.00");
  });
});

describe("integration API key authentication", () => {
  it("rejects tRPC integration requests without a valid API key", async () => {
    const caller = appRouter.createCaller({
      req: new Request("http://localhost/api/trpc"),
      resHeaders: new Headers(),
    });

    await expect(caller.integrationFinabill.verify()).rejects.toThrow(
      /Valid API key required/
    );
  });

  it("accepts tRPC integration requests with a valid API key", async () => {
    const { rawKey } = await createTestApiKey(testBusinessId, ["read"]);
    const apiKey = await resolveApiKey(rawKey);
    expect(apiKey).not.toBeNull();

    const caller = appRouter.createCaller({
      req: new Request("http://localhost/api/trpc"),
      resHeaders: new Headers(),
      apiKey: apiKey!,
    });

    const result = await caller.integrationFinabill.verify();
    expect(result.ok).toBe(true);
    expect(result.businessId).toBe(testBusinessId);
    expect(result.authMethod).toBe("api_key");
  });

  it("enforces scopes on tRPC integration procedures", async () => {
    const { rawKey } = await createTestApiKey(testBusinessId, ["read"]);
    const apiKey = await resolveApiKey(rawKey);
    expect(apiKey).not.toBeNull();

    const caller = appRouter.createCaller({
      req: new Request("http://localhost/api/trpc"),
      resHeaders: new Headers(),
      apiKey: apiKey!,
    });

    await expect(
      caller.integrationFinabill.upsertSupplier({
        name: "Test Supplier",
      })
    ).rejects.toThrow(/API key missing required scope: write/);
  });

  it("rejects expired API keys", async () => {
    const db = getDb();
    const rawKey = generateApiKey();
    const prefix = getKeyPrefix(rawKey);
    const keyHash = await hashApiKey(rawKey, 4);
    await db.insert(apiKeys).values({
      businessId: testBusinessId,
      name: "Expired Key",
      keyHash,
      keyPrefix: prefix,
      scopes: ["read"],
      expiresAt: new Date(Date.now() - 86_400_000),
    } as any);

    const apiKey = await resolveApiKey(rawKey);
    expect(apiKey).toBeNull();

    const caller = appRouter.createCaller({
      req: new Request("http://localhost/api/trpc"),
      resHeaders: new Headers(),
    });

    await expect(caller.integrationFinabill.verify()).rejects.toThrow(
      /Valid API key required/
    );
  });

  it("rejects the Hono daily-sales endpoint without a valid API key", async () => {
    const app = new Hono<{ Variables: ApiKeyVariables }>();
    app.post("/daily-sales", resolveApiKeyMiddleware, (c) =>
      c.json({ ok: true })
    );

    const res = await app.fetch(
      new Request("http://localhost/daily-sales", { method: "POST" })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/Missing Authorization header/);
  });

  it("accepts the Hono daily-sales endpoint with a valid API key", async () => {
    const { rawKey } = await createTestApiKey(testBusinessId);

    const app = new Hono<{ Variables: ApiKeyVariables }>();
    app.post("/daily-sales", resolveApiKeyMiddleware, (c) => {
      const key = c.get("apiKey");
      return c.json({ ok: true, businessId: key.businessId });
    });

    const res = await app.fetch(
      new Request("http://localhost/daily-sales", {
        method: "POST",
        headers: { Authorization: `Bearer ${rawKey}` },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.businessId).toBe(testBusinessId);
  });
});
