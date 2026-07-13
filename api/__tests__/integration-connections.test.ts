import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, and } from "drizzle-orm";
import { getDb } from "../queries/connection";
import {
  businesses,
  users,
  userBusinesses,
  integrationConnections,
} from "@db/schema";
import { appRouter } from "../router";
import { listAdapters, clearAdapters } from "../lib/integrations";
import { finabillAdapter } from "../lib/integrations/adapters/finabill";

let testBusinessId: number;
let testUserId: number;

function createCaller(businessId?: number) {
  return appRouter.createCaller({
    req: new Request("http://localhost"),
    resHeaders: new Headers(),
    user: businessId
      ? {
          id: testUserId,
          email: "owner@test.com",
          name: "Test Owner",
          role: "owner",
          currentBusinessId: businessId,
          currentBusiness: { id: businessId } as any,
          businessIds: [businessId],
        }
      : undefined,
  });
}

beforeAll(async () => {
  const db = getDb();

  const [business] = await db
    .insert(businesses)
    .values({
      accountId: `INTEGRATION-CONN-${Date.now()}`,
      name: "Integration Connections Test",
      slug: `integration-conn-${Date.now()}`,
      plan: "pro",
      isActive: true,
    } as any)
    .returning();
  testBusinessId = business.id;

  const [user] = await db
    .insert(users)
    .values({
      accountId: business.accountId,
      username: `owner-${Date.now()}`,
      email: `owner-${Date.now()}@test.com`,
      passwordHash: "hashed-password",
      name: "Test Owner",
      role: "owner",
      currentBusinessId: testBusinessId,
    } as any)
    .returning();
  testUserId = user.id;

  await db.insert(userBusinesses).values({
    userId: testUserId,
    businessId: testBusinessId,
    role: "owner",
  } as any);
});

afterAll(async () => {
  const db = getDb();
  await db.delete(integrationConnections).where(eq(integrationConnections.businessId, testBusinessId));
  await db.delete(userBusinesses).where(
    and(eq(userBusinesses.userId, testUserId), eq(userBusinesses.businessId, testBusinessId))
  );
  await db.delete(users).where(eq(users.id, testUserId));
  await db.delete(businesses).where(eq(businesses.id, testBusinessId));
});

describe("integration adapter registry", () => {
  it("lists the FinaBill adapter", () => {
    const adapters = listAdapters();
    const finabill = adapters.find((a) => a.targetSystem === "finabill");
    expect(finabill).toBeDefined();
    expect(finabill?.features).toContain("daily_sales.ingest");
    expect(finabill?.features).toContain("webhook.incoming");
  });
});

describe("integration connections router", () => {
  it("lists adapters via tRPC", async () => {
    const caller = createCaller(testBusinessId);
    const adapters = await caller.integrations.listAdapters();
    const finabill = adapters.find((a) => a.targetSystem === "finabill");
    expect(finabill).toBeDefined();
    expect(finabill?.credentialFields.length).toBeGreaterThan(0);
  });

  it("saves a FinaBill connection", async () => {
    const caller = createCaller(testBusinessId);

    const result = await caller.integrations.saveConnection({
      targetSystem: "finabill",
      targetUrl: "https://api.finabill.example",
      webhookSecret: "secret-123",
      scopes: ["read", "sales"],
    });

    expect(result.targetSystem).toBe("finabill");
    expect(result.isActive).toBe(true);

    const db = getDb();
    const [row] = await db
      .select()
      .from(integrationConnections)
      .where(
        eq(integrationConnections.businessId, testBusinessId)
      );
    expect(row).toBeDefined();
    expect(row.targetSystem).toBe("finabill");
    expect(row.webhookSecret).not.toBeNull();
  });

  it("returns status for the saved connection", async () => {
    const caller = createCaller(testBusinessId);
    const status = await caller.integrations.status({ targetSystem: "finabill" });
    expect(status.configured).toBe(true);
    expect(status.connected).toBe(true);
    expect(status.isActive).toBe(true);
    expect(status.targetSystem).toBe("finabill");
  });

  it("returns the connection without exposing the secret", async () => {
    const caller = createCaller(testBusinessId);
    const connection = await caller.integrations.getConnection({ targetSystem: "finabill" });
    expect(connection.targetSystem).toBe("finabill");
    expect(connection.webhookSecret).toBeNull();
  });

  it("toggles the connection off", async () => {
    const caller = createCaller(testBusinessId);
    const result = await caller.integrations.toggleConnection({ targetSystem: "finabill" });
    expect(result.isActive).toBe(false);

    const status = await caller.integrations.status({ targetSystem: "finabill" });
    expect(status.connected).toBe(false);
    expect(status.isActive).toBe(false);
  });

  it("toggles the connection back on", async () => {
    const caller = createCaller(testBusinessId);
    const result = await caller.integrations.toggleConnection({ targetSystem: "finabill" });
    expect(result.isActive).toBe(true);
  });

  it("updates connection keeping existing secret when not provided", async () => {
    const caller = createCaller(testBusinessId);

    await caller.integrations.saveConnection({
      targetSystem: "finabill",
      targetUrl: "https://updated.finabill.example",
    });

    const db = getDb();
    const [row] = await db
      .select()
      .from(integrationConnections)
      .where(
        and(eq(integrationConnections.businessId, testBusinessId), eq(integrationConnections.targetSystem, "finabill"))
      );
    expect(row).toBeDefined();
    expect(row.webhookSecret).not.toBeNull();
    const authData = row.authData as Record<string, unknown>;
    expect(authData.url).toBe("https://updated.finabill.example");
  });
});

