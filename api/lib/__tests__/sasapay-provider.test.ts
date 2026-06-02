// ABOUTME: Unit tests for Sasapay provider — HMAC verification, status mapping, and API request structure.
// ABOUTME: Tests webhook signature verification, status enum mapping, and feature flags.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SasapayProvider } from "../mobile-wallet/providers/sasapay-provider";

const mockFetch = vi.fn();

global.fetch = mockFetch;

describe("SasapayProvider", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: "success", data: "mock" }),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it("has correct code and displayName", () => {
    const provider = new SasapayProvider({ apiKey: "test-key", apiSecret: "test-secret" });
    expect(provider.code).toBe("sasapay");
    expect(provider.displayName).toBe("Sasapay");
  });

  it("supports KES only", () => {
    const provider = new SasapayProvider({ apiKey: "k", apiSecret: "s" });
    expect(provider.supportedCurrencies).toEqual(["KES"]);
  });

  it("SMS feature is false, API features are true", () => {
    const provider = new SasapayProvider({ apiKey: "k", apiSecret: "s" });
    expect(provider.features.initiatePayment).toBe(true);
    expect(provider.features.queryStatus).toBe(true);
    expect(provider.features.processWebhook).toBe(true);
    expect(provider.features.refund).toBe(true);
    expect(provider.features.balanceInquiry).toBe(true);
    expect(provider.features.smsImport).toBe(false);
  });

  it("processWebhook rejects missing signature", async () => {
    const provider = new SasapayProvider({ apiKey: "k", apiSecret: "secret" });
    const result = await provider.processWebhook({ provider: "sasapay", rawBody: '{"test": true}', headers: {} });
    expect(result.processed).toBe(false);
    expect(result.error).toContain("Missing");
  });

  it("processWebhook rejects invalid HMAC", async () => {
    const provider = new SasapayProvider({ apiKey: "k", apiSecret: "secret" });
    const result = await provider.processWebhook({
      provider: "sasapay",
      rawBody: '{"amount": 100}',
      headers: { "x-sasapay-signature": "wrong-signature" },
    });
    expect(result.processed).toBe(false);
    expect(result.error).toContain("Invalid");
  });

  it("processWebhook handles successful payment event", async () => {
    const secret = "my-secret";
    const body = JSON.stringify({ transaction_reference: "TX123", amount: "1000", status: "success" });
    const { createHmac } = await import("node:crypto");
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    const provider = new SasapayProvider({ apiKey: "k", apiSecret: secret });
    const result = await provider.processWebhook({
      provider: "sasapay",
      rawBody: body,
      headers: { "x-sasapay-signature": sig },
    });
    expect(result.processed).toBe(true);
    expect(result.transaction).toBeDefined();
    expect(result.transaction?.success).toBe(true);
    expect(result.transaction?.providerTxnId).toBe("TX123");
  });

  it("processWebhook handles failed transaction", async () => {
    const secret = "secret2";
    const body = JSON.stringify({ reference: "TX999", status: "failed", reason: "Insufficient funds" });
    const { createHmac } = await import("node:crypto");
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    const provider = new SasapayProvider({ apiKey: "k", apiSecret: secret });
    const result = await provider.processWebhook({
      provider: "sasapay",
      rawBody: body,
      headers: { "x-sasapay-signature": sig },
    });
    expect(result.processed).toBe(true);
    expect(result.transaction?.success).toBe(false);
  });

  it("mapStatus handles all expected values", async () => {
    const provider = new SasapayProvider({ apiKey: "k", apiSecret: "s" });
    expect(provider.mapStatus?.("success")).toBe("completed");
    expect(provider.mapStatus?.("completed")).toBe("completed");
    expect(provider.mapStatus?.("pending")).toBe("pending");
    expect(provider.mapStatus?.("failed")).toBe("failed");
  });
});
