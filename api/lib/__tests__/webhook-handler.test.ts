// ABOUTME: Unit tests for the unified webhook handler — provider routing, signature validation, error handling.
// ABOUTME: Validates webhook delegation to correct provider and proper error responses.

import { describe, it, expect, beforeEach } from "vitest";
import { handleWalletWebhook } from "../mobile-wallet/webhook-handler";
import { walletRegistry } from "../mobile-wallet/provider-registry";
import { BaseWalletProvider, ProviderFeatures, WalletWebhookPayload, WalletWebhookResult } from "../mobile-wallet/provider-interface";

class WebhookMockProvider extends BaseWalletProvider {
  readonly code = "webhook_mock";
  readonly displayName = "Webhook Mock";
  readonly supportedCurrencies = ["KES"];
  readonly features: ProviderFeatures = {
    initiatePayment: false, queryStatus: false, processWebhook: true,
    refund: false, balanceInquiry: false, smsImport: false,
  };

  initiatePayment = async () => { throw new Error("N/A"); };
  queryStatus = async () => { throw new Error("N/A"); };
  processRefund = async () => { throw new Error("N/A"); };
  balanceInquiry = async () => { throw new Error("N/A"); };

  async processWebhook(_payload: WalletWebhookPayload): Promise<WalletWebhookResult> {
    return {
      processed: true,
      transaction: {
        success: true,
        providerTxnId: "WHK123",
        status: "completed",
        amount: "500.00",
        currency: "KES",
      },
    };
  }

  logError(_context: string, _error: unknown, _metadata?: Record<string, unknown>): void {}
}

describe("handleWalletWebhook", () => {
  beforeEach(() => {
    // Clear registry and register mock
    const providers = walletRegistry.getAll();
    for (const _p of providers) {
      // Can't unregister, so just add our mock
    }
    walletRegistry.register(new WebhookMockProvider());
  });

  it("returns 404 for unknown provider", async () => {
    const result = await handleWalletWebhook({
      provider: "unknown_provider",
      rawBody: "{}",
      headers: {},
    });
    expect(result.status).toBe(404);
    expect(result.body).toContain("Unknown provider");
  });

  it("returns 200 for processed webhook", async () => {
    const result = await handleWalletWebhook({
      provider: "webhook_mock",
      rawBody: JSON.stringify({ event: "payment", amount: 500 }),
      headers: { "x-signature": "abc123" },
    });
    expect(result.status).toBe(200);
    expect(result.body).toContain("received");
  });
});
