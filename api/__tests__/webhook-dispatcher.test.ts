import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import {
  businesses,
  webhooks,
  webhookDeliveries,
  integrationConnections,
} from "@db/schema";
import {
  dispatchWebhook,
  signWebhookPayload,
} from "../lib/webhook-dispatcher";
import { encryptString } from "../lib/crypto";

let testBusinessId: number;

beforeAll(async () => {
  const db = getDb();
  const [business] = await db
    .insert(businesses)
    .values({
      accountId: `WEBHOOK-BIZ-${Date.now()}`,
      name: "Webhook Test Business",
      slug: `webhook-test-${Date.now()}`,
      plan: "pro",
      isActive: true,
    } as any)
    .returning();
  testBusinessId = business.id;
}, 60_000);

afterEach(async () => {
  vi.restoreAllMocks();

  const db = getDb();
  const businessWebhooks = await db
    .select({ id: webhooks.id })
    .from(webhooks)
    .where(eq(webhooks.businessId, testBusinessId));
  const webhookIds = businessWebhooks.map((w) => w.id);
  if (webhookIds.length > 0) {
    await db.delete(webhookDeliveries).where(eq(webhookDeliveries.webhookId, webhookIds[0]));
    for (let i = 1; i < webhookIds.length; i++) {
      await db.delete(webhookDeliveries).where(eq(webhookDeliveries.webhookId, webhookIds[i]));
    }
    for (const id of webhookIds) {
      await db.delete(webhooks).where(eq(webhooks.id, id));
    }
  }
  await db
    .delete(integrationConnections)
    .where(eq(integrationConnections.businessId, testBusinessId));
});

describe("outgoing webhook dispatcher", () => {
  it("signs payloads with HMAC-SHA256", () => {
    const signature = signWebhookPayload('{"event":"test"}', "secret");
    expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("records a successful delivery and sends X-Fina-Signature", async () => {
    const db = getDb();
    const secret = "whsec_test_123";
    const [webhook] = await db
      .insert(webhooks)
      .values({
        businessId: testBusinessId,
        name: "Test Webhook",
        url: "https://example.com/webhook",
        events: ["sale.recorded"],
        secret: encryptString(secret),
        isActive: true,
      } as any)
      .returning();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "ok",
    });
    globalThis.fetch = fetchMock;

    await dispatchWebhook(testBusinessId, "sale.recorded", {
      dailySaleId: 123,
      netSales: "100.00",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const body = typeof init?.body === "string" ? init.body : "";
    const headers = (init?.headers as Record<string, string>) ?? {};
    expect(headers["X-Fina-Signature"]).toBe(signWebhookPayload(body, secret));

    const deliveries = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, webhook.id));
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].status).toBe("success");
    expect(deliveries[0].statusCode).toBe(200);
  });

  it("retries failed deliveries and records each attempt", async () => {
    const db = getDb();
    const [webhook] = await db
      .insert(webhooks)
      .values({
        businessId: testBusinessId,
        name: "Retry Webhook",
        url: "https://example.com/webhook",
        events: ["journal.created"],
        secret: encryptString("secret"),
        isActive: true,
      } as any)
      .returning();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "error",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "ok",
      });
    globalThis.fetch = fetchMock;

    await dispatchWebhook(testBusinessId, "journal.created", {
      journalEntryId: 456,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const deliveries = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, webhook.id))
      .orderBy(webhookDeliveries.id);
    expect(deliveries).toHaveLength(2);
    expect(deliveries[0].status).toBe("failed");
    expect(deliveries[1].status).toBe("success");
  });
});

describe("incoming FinaBill webhook route", () => {
  async function loadApp() {
    process.env.NODE_ENV = "development";
    const { default: app } = await import("../boot");
    return app;
  }

  it("accepts a valid X-Fina-Signature", async () => {
    const db = getDb();
    const secret = "finabill_incoming_secret";
    await db.insert(integrationConnections).values({
      businessId: testBusinessId,
      targetSystem: "finabill",
      webhookSecret: encryptString(secret),
      isActive: true,
    } as any);

    const payload = {
      event: "supplier.updated",
      businessId: testBusinessId,
      data: { name: "Acme Suppliers", email: "acme@example.com" },
    };
    const body = JSON.stringify(payload);
    const signature = signWebhookPayload(body, secret);

    const app = await loadApp();
    const res = await app.fetch(
      new Request("http://localhost/api/v1/webhooks/finabill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Fina-Signature": signature,
        },
        body,
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.received).toBe(true);
    expect(json.data.event).toBe("supplier.updated");
  }, 120_000);

  it("rejects an invalid X-Fina-Signature", async () => {
    const db = getDb();
    const secret = "finabill_incoming_secret";
    await db.insert(integrationConnections).values({
      businessId: testBusinessId,
      targetSystem: "finabill",
      webhookSecret: encryptString(secret),
      isActive: true,
    } as any);

    const payload = {
      event: "supplier.updated",
      businessId: testBusinessId,
      data: { name: "Acme Suppliers" },
    };
    const body = JSON.stringify(payload);

    const app = await loadApp();
    const res = await app.fetch(
      new Request("http://localhost/api/v1/webhooks/finabill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Fina-Signature": "sha256=invalid",
        },
        body,
      })
    );

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.message).toMatch(/Invalid signature/);
  });

  it("returns 501 for unimplemented providers", async () => {
    const app = await loadApp();
    const res = await app.fetch(
      new Request("http://localhost/api/webhooks/xero", {
        method: "POST",
        body: JSON.stringify({ event: "test" }),
      })
    );
    expect(res.status).toBe(501);
  });
});
