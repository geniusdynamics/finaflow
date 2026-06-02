// ABOUTME: Boilerplate template for integrating new mobile wallet providers into the aggregation framework.
// ABOUTME: Copy this file, rename the class, implement the abstract methods, and register via walletRegistry.

import {
  BaseWalletProvider,
  ProviderFeatures,
  WalletTransactionRequest,
  WalletTransactionResult,
  WalletStatusResult,
  WalletWebhookPayload,
  WalletWebhookResult,
  WalletBalanceResult,
} from "../provider-interface";

export class NewWalletProvider extends BaseWalletProvider {
  readonly code = "new_provider";
  readonly displayName = "New Wallet Provider";
  readonly supportedCurrencies = ["KES"];
  readonly features: ProviderFeatures = {
    initiatePayment: true,
    queryStatus: true,
    processWebhook: true,
    refund: false,
    balanceInquiry: false,
    smsImport: false,
  };

  private baseUrl = "";
  private apiKey = "";
  private apiSecret = "";

  constructor(config?: { baseUrl?: string; apiKey?: string; apiSecret?: string }) {
    super();
    if (config) {
      this.baseUrl = config.baseUrl ?? this.baseUrl;
      this.apiKey = config.apiKey ?? this.apiKey;
      this.apiSecret = config.apiSecret ?? this.apiSecret;
    }
  }

  async initiatePayment(request: WalletTransactionRequest): Promise<WalletTransactionResult> {
    this.validateCurrency(request.currency);
    try {
      // 1. Build request payload
      // 2. Send authenticated request to provider API
      // 3. Parse response
      // 4. Return standardized result
      throw new Error("Not implemented");
    } catch (err) {
      this.logError("initiatePayment", err, { request: { ...request, amount: "***" } });
      throw err;
    }
  }

  async queryStatus(providerTxnId: string): Promise<WalletStatusResult> {
    try {
      // GET /api/v1/payments/{id}/status
      throw new Error("Not implemented");
    } catch (err) {
      this.logError("queryStatus", err, { providerTxnId });
      throw err;
    }
  }

  async processWebhook(
    _payload: WalletWebhookPayload,
  ): Promise<WalletWebhookResult> {
    try {
      // 1. Verify HMAC signature using this.apiSecret
      // 2. Parse JSON payload
      // 3. Map to WalletTransactionResult
      // 4. Return processed result
      throw new Error("Not implemented");
    } catch (err) {
      this.logError("processWebhook", err);
      return { processed: false, error: err instanceof Error ? err.message : "Webhook processing error" };
    }
  }

  async processRefund(providerTxnId: string, amount?: string): Promise<WalletTransactionResult> {
    try {
      // POST /api/v1/payments/{id}/refund
      throw new Error("Not implemented");
    } catch (err) {
      this.logError("processRefund", err, { providerTxnId, amount });
      throw err;
    }
  }

  async balanceInquiry(accountId: number): Promise<WalletBalanceResult> {
    try {
      // GET /api/v1/account/balance
      throw new Error("Not implemented");
    } catch (err) {
      this.logError("balanceInquiry", err, { accountId });
      throw err;
    }
  }

  logError(context: string, error: unknown, metadata?: Record<string, unknown>): void {
    console.error(`[${this.displayName}] ${context}:`, error, metadata ?? "");
  }
}
