// ABOUTME: Concrete Sasapay wallet provider implementing the BaseWalletProvider interface.
// ABOUTME: REST API-based integration with HMAC signature verification for webhooks.
// ABOUTME: Supports C2B payments, B2C disbursements, refunds, and balance inquiries.

import { createHmac } from "node:crypto";
import {
  BaseWalletProvider,
  ParsedWalletSms,
  WalletTransactionRequest,
  WalletTransactionResult,
  WalletStatusResult,
  WalletWebhookPayload,
  WalletWebhookResult,
  WalletBalanceResult,
  ProviderFeatures,
} from "../provider-interface";

export interface SasapayConfig {
  baseUrl?: string;
  apiKey: string;
  apiSecret: string;
  merchantCode?: string;
  callbackUrl?: string;
}

export class SasapayProvider extends BaseWalletProvider {
  readonly code = "sasapay";
  readonly displayName = "Sasapay";
  readonly supportedCurrencies = ["KES"];
  readonly features: ProviderFeatures = {
    initiatePayment: true,
    queryStatus: true,
    processWebhook: true,
    refund: true,
    balanceInquiry: true,
    smsImport: false,
  };

  private baseUrl: string;
  private apiKey: string;
  private apiSecret: string;
  private merchantCode: string;
  private callbackUrl: string;

  constructor(config: SasapayConfig) {
    super();
    this.baseUrl = config.baseUrl ?? "https://api.sasapay.com/api/v1";
    this.apiKey = config.apiKey ?? "";
    this.apiSecret = config.apiSecret ?? "";
    this.merchantCode = config.merchantCode ?? "";
    this.callbackUrl = config.callbackUrl ?? "";
  }

  private computeHmac(payload: string): string {
    return createHmac("sha256", this.apiSecret).update(payload).digest("hex");
  }

  private async apiRequest<T>(method: string, endpoint: string, body?: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const bodyStr = body ? JSON.stringify(body) : "";
    const timestamp = new Date().toISOString();
    const signature = this.computeHmac(`${method}${endpoint}${timestamp}${bodyStr}`);

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": this.apiKey,
        "X-Timestamp": timestamp,
        "X-Signature": signature,
        "X-Merchant-Code": this.merchantCode,
      },
      body: bodyStr || undefined,
    } as RequestInit);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Sasapay API error ${response.status}: ${errorText}`);
    }

    const data = await response.json() as T;
    return data;
  }

  async initiatePayment(request: WalletTransactionRequest): Promise<WalletTransactionResult> {
    this.validateCurrency(request.currency);
    try {
      const payload = {
        amount: request.amount,
        currency: request.currency,
        phone_number: request.partyIdentifier,
        merchant_reference: request.reference,
        description: request.description ?? "",
        callback_url: this.callbackUrl,
        ...(request.metadata ?? {}),
      };

      const response = await this.apiRequest<{
        transaction_reference: string;
        status: string;
        message: string;
        checkout_url?: string;
      }>("POST", "/payments", payload);

      return {
        success: response.status === "success" || response.status === "pending",
        providerTxnId: response.transaction_reference ?? "",
        providerRef: response.checkout_url,
        status: this.mapStatus(response.status),
        amount: String(request.amount),
        currency: request.currency,
        errorMessage: response.status !== "success" ? response.message : undefined,
        rawResponse: response as unknown as Record<string, unknown>,
      };
    } catch (err) {
      this.logError("initiatePayment", err, { request: { ...request, amount: "***" } });
      return {
        success: false,
        providerTxnId: "",
        status: "failed",
        amount: String(request.amount),
        currency: request.currency,
        errorMessage: err instanceof Error ? err.message : "Payment initiation failed",
      };
    }
  }

  async queryStatus(providerTxnId: string): Promise<WalletStatusResult> {
    try {
      const response = await this.apiRequest<{
        transaction_reference: string;
        status: string;
        amount: string;
        currency: string;
        balance?: string;
        fee?: string;
        message?: string;
      }>("GET", `/payments/${providerTxnId}/status`);

      return {
        providerTxnId: response.transaction_reference,
        status: this.mapStatus(response.status),
        amount: response.amount ?? "0",
        currency: response.currency ?? "KES",
        fee: response.fee,
        balance: response.balance,
        errorMessage: response.status !== "success" ? response.message : undefined,
      };
    } catch (err) {
      this.logError("queryStatus", err, { providerTxnId });
      return {
        providerTxnId,
        status: "pending",
        amount: "0",
        currency: "KES",
        errorMessage: err instanceof Error ? err.message : "Status query failed",
      };
    }
  }

  async processWebhook(payload: WalletWebhookPayload): Promise<WalletWebhookResult> {
    try {
      const signature = payload.headers?.["x-sasapay-signature"] ?? payload.headers?.["x-signature"];
      if (!signature) {
        return { processed: false, error: "Missing Sasapay webhook signature" };
      }

      const expectedSignature = this.computeHmac(payload.rawBody);
      if (signature !== expectedSignature) {
        this.logError("processWebhook", new Error("Invalid HMAC signature"), { received: signature, expected: expectedSignature });
        return { processed: false, error: "Invalid webhook signature" };
      }

      const data = JSON.parse(payload.rawBody);
      const eventType = data.event ?? data.status ?? "payment";

      if (eventType === "payment.completed" || eventType === "success" || eventType === "Transaction Successful") {
        return {
          processed: true,
          transaction: {
            success: true,
            providerTxnId: data.transaction_reference ?? data.reference ?? data.id ?? "",
            providerRef: data.checkout_url ?? "",
            status: "completed",
            amount: String(data.amount ?? data.total_amount ?? "0"),
            currency: data.currency ?? "KES",
            fee: data.fee ? String(data.fee) : undefined,
            balance: data.balance,
            rawResponse: data as Record<string, unknown>,
          },
        };
      }

      if (eventType === "payment.failed" || eventType === "failed" || eventType === "Transaction Failed") {
        return {
          processed: true,
          transaction: {
            success: false,
            providerTxnId: data.transaction_reference ?? data.reference ?? "",
            status: "failed",
            amount: String(data.amount ?? "0"),
            currency: data.currency ?? "KES",
            errorMessage: data.reason ?? data.message ?? "Payment failed",
            rawResponse: data as Record<string, unknown>,
          },
        };
      }

      return { processed: false, error: `Unhandled webhook event type: ${eventType}` };
    } catch (err) {
      this.logError("processWebhook", err);
      return {
        processed: false,
        error: err instanceof Error ? err.message : "Webhook processing error",
      };
    }
  }

  async processRefund(providerTxnId: string, amount?: string): Promise<WalletTransactionResult> {
    try {
      const payload: Record<string, unknown> = {
        transaction_reference: providerTxnId,
      };
      if (amount) payload.amount = amount;

      const response = await this.apiRequest<{
        status: string;
        refund_reference: string;
        message: string;
      }>("POST", `/payments/${providerTxnId}/refund`, payload);

      return {
        success: response.status === "success" || response.status === "refund_initiated",
        providerTxnId: providerTxnId,
        providerRef: response.refund_reference,
        status: this.mapStatus(response.status),
        amount: amount ?? "0",
        currency: "KES",
        errorMessage: response.status !== "success" ? response.message : undefined,
        rawResponse: response as unknown as Record<string, unknown>,
      };
    } catch (err) {
      this.logError("processRefund", err, { providerTxnId, amount });
      return {
        success: false,
        providerTxnId,
        status: "failed",
        amount: amount ?? "0",
        currency: "KES",
        errorMessage: err instanceof Error ? err.message : "Refund failed",
      };
    }
  }

  async balanceInquiry(_accountId: number): Promise<WalletBalanceResult> {
    try {
      const response = await this.apiRequest<{
        available_balance: string;
        currency: string;
        account_name?: string;
        account_number?: string;
      }>("GET", "/account/balance");

      return {
        provider: this.code,
        accountId: _accountId,
        balance: response.available_balance ?? "0",
        currency: response.currency ?? "KES",
        asOf: new Date(),
      };
    } catch (err) {
      this.logError("balanceInquiry", err, { accountId: _accountId });
      return {
        provider: this.code,
        accountId: _accountId,
        balance: "0",
        currency: "KES",
        asOf: new Date(),
      };
    }
  }

  public mapStatus(raw: string): WalletStatusResult["status"] {
    const s = (raw ?? "").toLowerCase();
    if (s.includes("success") || s.includes("completed") || s.includes("successful")) return "completed";
    if (s.includes("pending") || s.includes("processing") || s.includes("initiated")) return "pending";
    if (s.includes("fail") || s.includes("error") || s.includes("reject")) return "failed";
    if (s.includes("refund")) return "refunded";
    return "pending";
  }

  logError(context: string, error: unknown, metadata?: Record<string, unknown>): void {
    console.error(`[SasapayProvider] ${context}:`, error, metadata ?? "");
  }
}
