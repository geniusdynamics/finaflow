// ABOUTME: Defines the abstract base class and shared types for all mobile wallet provider implementations.
// ABOUTME: All wallet providers (M-PESA, Airtel Money, Sasapay) must extend BaseWalletProvider.

import { d, Decimal } from "../decimal";

export type WalletTxnType =
  | "payment"
  | "disbursement"
  | "transfer"
  | "topup"
  | "withdrawal"
  | "airtime"
  | "utility"
  | "bank_transfer"
  | "refund";

export type WalletDirection = "in" | "out";

export type WalletTxnStatus = "pending" | "completed" | "failed" | "refunded";

export interface WalletTransactionRequest {
  amount: number | string;
  currency: string;
  partyIdentifier: string;
  reference: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface WalletTransactionResult {
  success: boolean;
  providerTxnId: string;
  providerRef?: string;
  status: WalletTxnStatus;
  amount: string;
  currency: string;
  fee?: string;
  balance?: string;
  errorMessage?: string;
  rawResponse?: Record<string, unknown>;
}

export interface WalletStatusResult {
  providerTxnId: string;
  status: WalletTxnStatus;
  amount: string;
  currency: string;
  fee?: string;
  balance?: string;
  errorMessage?: string;
}

export interface WalletWebhookPayload {
  provider: string;
  rawBody: string;
  headers: Record<string, string>;
  signature?: string;
}

export interface WalletWebhookResult {
  processed: boolean;
  transaction?: WalletTransactionResult;
  error?: string;
}

export interface WalletBalanceResult {
  provider: string;
  accountId: number;
  balance: string;
  currency: string;
  asOf: Date;
}

export interface ParsedWalletSms {
  providerTxnId: string;
  date: string;
  time?: string;
  amount: string;
  currency: string;
  txnType: WalletTxnType;
  direction: WalletDirection;
  partyName?: string;
  partyIdentifier?: string;
  balance?: string;
  txnFee?: string;
  rawText: string;
}

export interface ProviderFeatures {
  initiatePayment: boolean;
  queryStatus: boolean;
  processWebhook: boolean;
  refund: boolean;
  balanceInquiry: boolean;
  smsImport: boolean;
}

export abstract class BaseWalletProvider {
  abstract readonly code: string;
  abstract readonly displayName: string;
  abstract readonly supportedCurrencies: string[];
  abstract readonly features: ProviderFeatures;

  abstract initiatePayment(request: WalletTransactionRequest): Promise<WalletTransactionResult>;
  abstract queryStatus(providerTxnId: string): Promise<WalletStatusResult>;
  abstract processWebhook(payload: WalletWebhookPayload): Promise<WalletWebhookResult>;
  abstract processRefund(providerTxnId: string, amount?: string): Promise<WalletTransactionResult>;
  abstract balanceInquiry(accountId: number): Promise<WalletBalanceResult>;

  abstract parseSms?(text: string, options?: Record<string, unknown>): Promise<ParsedWalletSms[]>;
  abstract generateSmsPreview?(text: string, options?: Record<string, unknown>): Promise<ParsedWalletSms[]>;

  protected parseDecimal(value: string | number): Decimal {
    return d(value);
  }

  protected validateCurrency(currency: string): void {
    if (!this.supportedCurrencies.includes(currency)) {
      throw new Error(
        `Currency ${currency} not supported by ${this.displayName}. Supported: ${this.supportedCurrencies.join(", ")}`
      );
    }
  }

  abstract logError(context: string, error: unknown, metadata?: Record<string, unknown>): void;
}
