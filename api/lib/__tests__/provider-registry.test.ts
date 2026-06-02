// ABOUTME: Unit tests for the WalletProviderRegistry — registration, lookup, currency validation.
// ABOUTME: Validates singleton behavior and all registry query methods.

import { describe, it, expect, beforeEach } from "vitest";
import { WalletProviderRegistry } from "../mobile-wallet/provider-registry";
import { BaseWalletProvider, ProviderFeatures, WalletTransactionRequest, WalletTransactionResult, WalletStatusResult, WalletWebhookPayload, WalletWebhookResult, WalletBalanceResult } from "../mobile-wallet/provider-interface";

class MockProvider extends BaseWalletProvider {
  readonly code = "mock";
  readonly displayName = "Mock Provider";
  readonly supportedCurrencies = ["KES", "USD"];
  readonly features: ProviderFeatures = {
    initiatePayment: true,
    queryStatus: true,
    processWebhook: false,
    refund: false,
    balanceInquiry: false,
    smsImport: true,
  };

  async initiatePayment(_request: WalletTransactionRequest): Promise<WalletTransactionResult> {
    return { success: true, providerTxnId: "MOCK123", status: "completed", amount: "100", currency: "KES" };
  }
  async queryStatus(_providerTxnId: string): Promise<WalletStatusResult> {
    return { providerTxnId: "MOCK123", status: "completed", amount: "100", currency: "KES" };
  }
  async processWebhook(_payload: WalletWebhookPayload): Promise<WalletWebhookResult> {
    return { processed: false, error: "Not supported" };
  }
  async processRefund(_providerTxnId: string, _amount?: string): Promise<WalletTransactionResult> {
    throw new Error("Not supported");
  }
  async balanceInquiry(_accountId: number): Promise<WalletBalanceResult> {
    throw new Error("Not supported");
  }
  logError(_context: string, _error: unknown, _metadata?: Record<string, unknown>): void {}
}

class MockProvider2 extends BaseWalletProvider {
  readonly code = "mock2";
  readonly displayName = "Mock Provider 2";
  readonly supportedCurrencies = ["UGX", "TZS"];
  readonly features: ProviderFeatures = {
    initiatePayment: false,
    queryStatus: false,
    processWebhook: false,
    refund: false,
    balanceInquiry: false,
    smsImport: true,
  };

  async initiatePayment(): Promise<WalletTransactionResult> { throw new Error("N/A"); }
  async queryStatus(): Promise<WalletStatusResult> { throw new Error("N/A"); }
  async processWebhook(): Promise<WalletWebhookResult> { return { processed: false }; }
  async processRefund(): Promise<WalletTransactionResult> { throw new Error("N/A"); }
  async balanceInquiry(): Promise<WalletBalanceResult> { throw new Error("N/A"); }
  logError(_context: string, _error: unknown, _metadata?: Record<string, unknown>): void {}
}

describe("WalletProviderRegistry", () => {
  let registry: WalletProviderRegistry;

  beforeEach(() => {
    registry = new WalletProviderRegistry();
  });

  it("is initially empty", () => {
    expect(registry.getAll()).toHaveLength(0);
  });

  it("registers a provider", () => {
    registry.register(new MockProvider());
    expect(registry.getAll()).toHaveLength(1);
  });

  it("gets a registered provider by code", () => {
    registry.register(new MockProvider());
    const p = registry.get("mock");
    expect(p.code).toBe("mock");
    expect(p.displayName).toBe("Mock Provider");
  });

  it("throws for unknown provider", () => {
    expect(() => registry.get("unknown")).toThrow("not registered");
  });

  it("returns active providers only", () => {
    registry.register(new MockProvider());
    registry.register(new MockProvider2());
    expect(registry.getActive()).toHaveLength(2);
  });

  it("filters by currency", () => {
    registry.register(new MockProvider());
    registry.register(new MockProvider2());
    const kesProviders = registry.getByCurrency("KES");
    expect(kesProviders).toHaveLength(1);
    expect(kesProviders[0].code).toBe("mock");
  });

  it("validates currency constraint", () => {
    registry.register(new MockProvider());
    expect(registry.validateCurrencyConstraint("mock", "KES")).toBe(true);
    expect(registry.validateCurrencyConstraint("mock", "UGX")).toBe(false);
  });

  it("returns false for unknown provider currency validation", () => {
    expect(registry.validateCurrencyConstraint("unknown", "KES")).toBe(false);
  });
});
