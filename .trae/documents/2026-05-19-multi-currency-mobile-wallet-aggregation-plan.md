# Multi-Currency & Mobile Wallet Aggregation Framework — Implementation Plan

## Executive Summary

This plan covers two interconnected initiatives:

1. **Multi-Currency Support** — System-wide currency architecture with ISO 4217 compliance, real-time exchange rates, and M-Pesa KES-lock
2. **Mobile Wallet Aggregation** — Refactor the monolithic M-Pesa integration into a generalized provider framework supporting M-Pesa, Airtel Money, Sasapay, and future providers

Both initiatives share foundational changes (monetary schema, payment provider abstraction) and are planned sequentially across three phases.

***

## Current Architecture Assessment

### Monetary Value Handling

* All `numeric` columns use fixed `(15, 2)` — KES-centric with 2 decimal places

* Only `accounts.currency` column tracks currency (default `'KES'`, unused for conversion)

* Zero exchange rate infrastructure

* Frontend has hardcoded `formatKES()` — no currency-aware formatting

* Backend uses `decimal.js` at 15-digit precision, `ROUND_HALF_UP`

### M-Pesa Integration

* **SMS-based** (not Daraja API) — parser handles 7 SMS patterns

* Tightly coupled: `mpesaTransactions` table, `mpesa-parser.ts` (duplicated server/client), `mpesa-router.ts`

* Hardcoded enums: `typeEnum = ["cash", "mpesa", "bank_account"]`, `paymentMethodEnum = ["cash", "mpesa", "bank_transfer"]`

* No Daraja webhook integration; general webhook system exists in `integrations-router.ts` (unwired)

* SMS parser duplicated across `api/mpesa-parser.ts` and `src/lib/mpesa-parser.ts`

* M-PESA is referenced in 25+ files across the codebase

***

## Phase 1: Foundation (Core Data Models & Abstraction Layer)

### Goal

Establish the shared schema, abstract interfaces, and utility infrastructure that both initiatives depend on, with 90%+ unit test coverage.

### 1.1 Multi-Currency: Database Schema Changes

#### 1.1.1 New Tables

**`supported_currencies`**

```typescript
// db/schema.ts
export const supportedCurrencies = pgTable("supported_currencies", {
  code: varchar("code", { length: 3 }).primaryKey(),          // ISO 4217: KES, USD, UGX, TZS, EUR, GBP, JPY, KWD, etc.
  name: varchar("name", { length: 100 }).notNull(),            // Kenyan Shilling
  symbol: varchar("symbol", { length: 10 }).notNull(),         // KSh, $, €, £
  decimalPlaces: integer("decimal_places").notNull().default(2),// 0 (JPY), 2 (KES/USD), 3 (KWD)
  isActive: boolean("is_active").default(true).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),   // Only one per system
  createdAt, updatedAt,
});
```

**`exchange_rates`**

```typescript
export const exchangeRates = pgTable("exchange_rates", {
  id: serial("id").primaryKey(),
  fromCurrency: varchar("from_currency", { length: 3 }).notNull().references(() => supportedCurrencies.code),
  toCurrency: varchar("to_currency", { length: 3 }).notNull().references(() => supportedCurrencies.code),
  rate: numeric("rate", { precision: 18, scale: 8 }).notNull(), // e.g., 0.0075 for KES→USD
  source: varchar("source", { length: 50 }).default("manual"),  // 'manual', 'exchange_rate_api', 'open_exchange_rates'
  validFrom: timestamp("valid_from").notNull().defaultNow(),
  validUntil: timestamp("valid_until"),                          // NULL = current
  createdAt,
});
// Unique composite: same from→to can't have overlapping validity ranges without explicit versioning
```

**`business_currencies`** (per-business currency configuration)

```typescript
export const businessCurrencies = pgTable("business_currencies", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number" }).notNull().references(() => businesses.id),
  currency: varchar("currency", { length: 3 }).notNull().references(() => supportedCurrencies.code),
  isBaseCurrency: boolean("is_base_currency").default(false).notNull(), // Reporting currency
  isActive: boolean("is_active").default(true).notNull(),
  createdAt, updatedAt,
});
```

#### 1.1.2 Schema Migrations for Existing Tables

Add `currency` column to all monetary tables. For KES-only existing data, default to `'KES'`:

| Table                      | Columns to Add               | New Columns                |
| -------------------------- | ---------------------------- | -------------------------- |
| `accounts`                 | *(already has* *`currency`)* | —                          |
| `expenses`                 | `currency`                   | `varchar(3) default 'KES'` |
| `expense_items`            | `currency`                   | `varchar(3) default 'KES'` |
| `bills`                    | `currency`                   | `varchar(3) default 'KES'` |
| `bill_items`               | `currency`                   | `varchar(3) default 'KES'` |
| `bill_payments`            | `currency`                   | `varchar(3) default 'KES'` |
| `daily_sales`              | `currency`                   | `varchar(3) default 'KES'` |
| `daily_sale_payments`      | `currency`                   | `varchar(3) default 'KES'` |
| `journal_lines`            | `currency`                   | `varchar(3) default 'KES'` |
| `ledger_entries`           | `currency`                   | `varchar(3) default 'KES'` |
| `payroll_entries`          | `currency`                   | `varchar(3) default 'KES'` |
| `payroll_advances`         | `currency`                   | `varchar(3) default 'KES'` |
| `suppliers`                | `currency`                   | `varchar(3) default 'KES'` |
| `budgets`                  | `currency`                   | `varchar(3) default 'KES'` |
| `purchase_orders`          | `currency`                   | `varchar(3) default 'KES'` |
| `purchase_order_items`     | `currency`                   | `varchar(3) default 'KES'` |
| `items`                    | `currency`                   | `varchar(3) default 'KES'` |
| `fixed_asset_depreciation` | `currency`                   | `varchar(3) default 'KES'` |
| `partner_commissions`      | `currency`                   | `varchar(3) default 'KES'` |

Add `baseCurrency` and `baseAmount` columns to core reporting tables (for cross-currency aggregation):

| Table           | New Columns                                         |
| --------------- | --------------------------------------------------- |
| `daily_sales`   | `baseCurrency varchar(3), baseAmount numeric(15,2)` |
| `journal_lines` | `baseCurrency varchar(3), baseAmount numeric(15,2)` |
| `expenses`      | `baseCurrency varchar(3), baseAmount numeric(15,2)` |
| `bills`         | `baseCurrency varchar(3), baseAmount numeric(15,2)` |

#### 1.1.3 Frontend Types Update

* Update `src/lib/utils.ts`: Replace `formatKES()` with `formatCurrency(amount, currency, options?)` — currency-aware formatter using `Intl.NumberFormat` with the currency code

* Add `SUPPORTED_CURRENCIES` constant in `src/const.ts` (derived from API on mount, with static fallback)

* Add currency selector UI component (`CurrencySelect.tsx`)

### 1.2 Multi-Currency: Core Services

#### 1.2.1 Currency Conversion Service

**File:** `api/lib/currency-converter.ts`

```typescript
// Core interface
interface CurrencyConverterConfig {
  cacheTTL: number;             // milliseconds (default: 5 minutes)
  defaultProvider: 'exchange_rate_api' | 'open_exchange_rates' | 'manual';
  apiKey?: string;
  baseCurrency: string;         // System base (default: KES)
}

// Public API
class CurrencyConverter {
  constructor(config: CurrencyConverterConfig);
  
  // Fetch latest rate with caching
  async getRate(from: string, to: string): Promise<Decimal>;
  
  // Convert amount with optional rounding
  async convert(amount: Decimal, from: string, to: string, options?: {
    round?: boolean;
    decimalPlaces?: number;
  }): Promise<{ converted: Decimal; rate: Decimal; fee?: Decimal }>;

  // Batch convert for report aggregation
  async batchConvert(amounts: Array<{ amount: Decimal; currency: string }>, toCurrency: string): Promise<Decimal>;

  // Refresh all cached rates from provider
  async refreshRates(): Promise<void>;

  // Retrieve latest exchange rates for admin
  async getLatestRates(): Promise<ExchangeRate[]>;
}
```

**Key behaviors:**

* In-memory cache with configurable TTL (default 300s)

* Cache-busting on admin rate update

* Stale-data safeguard: rates > 24h old trigger warning log

* Fallback chain: cache → DB → external provider

* For KES→KES, return 1.0 instantly (no DB hit)

* All conversions return `Decimal` (not `number`) per codebase convention

#### 1.2.2 Exchange Rate Sync Service

**File:** `api/lib/exchange-rate-sync.ts`

* Background job (runs hourly via `boot.ts` timer or cron endpoint)

* Fetches from configured provider (ExchangeRate-API, Open Exchange Rates)

* Upserts into `exchange_rates` table with `source`, `validFrom`/`validUntil`

* Logs sync failures to audit log

* Configurable via environment variables:

  ```
  EXCHANGE_RATE_PROVIDER=exchange_rate_api|open_exchange_rates|manual
  EXCHANGE_RATE_API_KEY=your_key
  EXCHANGE_RATE_BASE_CURRENCY=KES
  EXCHANGE_RATE_SYNC_INTERVAL=3600000
  ```

### 1.3 Mobile Wallet: Database Schema Changes

#### 1.3.1 New Tables

**`mobile_wallet_providers`** (registry)

```typescript
export const mobileWalletProviders = pgTable("mobile_wallet_providers", {
  code: varchar("code", { length: 20 }).primaryKey(),     // 'mpesa', 'airtel_money', 'sasapay'
  name: varchar("name", { length: 100 }).notNull(),       // 'M-PESA', 'Airtel Money', 'Sasapay'
  displayName: varchar("display_name", { length: 100 }),
  brandColor: varchar("brand_color", { length: 7 }),      // '#C73E1D'
  logoUrl: varchar("logo_url", { length: 255 }),
  supportedCurrencies: varchar("supported_currencies", { length: 100 }), // Comma-separated: 'KES','KES,UGX,TZS'
  isActive: boolean("is_active").default(true).notNull(),
  requiresProvisioning: boolean("requires_provisioning").default(false),
  configSchema: jsonb("config_schema"),                    // JSON Schema for provider-specific config
  createdAt, updatedAt, deletedAt,
});
```

**`mobile_wallet_transactions`** (replaces `mpesaTransactions`)

```typescript
export const mobileWalletTransactions = pgTable("mobile_wallet_transactions", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number" }).notNull(),
  provider: varchar("provider", { length: 20 }).notNull().references(() => mobileWalletProviders.code),
  providerTxnId: varchar("provider_txn_id", { length: 100 }).notNull(), // Provider's transaction ID
  providerRef: varchar("provider_ref", { length: 100 }),                // Additional reference (e.g., till number)
  txnDate: date("txnDate").notNull(),
  txnTime: varchar("txnTime", { length: 10 }),
  txnType: varchar("txn_type", { length: 30 }).notNull(),              // Unified type taxonomy
  direction: varchar("direction", { length: 5 }).notNull(),            // 'in' | 'out'
  partyName: varchar("partyName", { length: 255 }),
  partyIdentifier: varchar("party_identifier", { length: 100 }),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("KES").notNull(),
  txnFee: numeric("txnFee", { precision: 15, scale: 2 }).default("0.00").notNull(),
  balance: numeric("balance", { precision: 15, scale: 2 }),
  description: text("description"),
  rawText: text("rawText"),                                            // For SMS-based providers
  rawPayload: jsonb("raw_payload"),                                    // For API-based providers (webhook payload)
  status: varchar("status", { length: 20 }).default("completed").notNull(), // 'pending','completed','failed','refunded'
  isReconciled: boolean("is_reconciled").default(false).notNull(),
  isLinked: boolean("is_linked").default(false).notNull(),
  linkedExpenseId: bigint("linkedExpenseId", { mode: "number" }),
  linkedBillId: bigint("linkedBillId", { mode: "number" }),
  linkedSupplierId: bigint("linkedSupplierId", { mode: "number" }),
  sourceAccountId: bigint("sourceAccountId", { mode: "number" }).references(() => accounts.id),
  destinationAccountId: bigint("destinationAccountId", { mode: "number" }).references(() => accounts.id),
  importedBy: bigint("importedBy", { mode: "number" }),
  // Multi-currency fields
  baseCurrency: varchar("base_currency", { length: 3 }),
  baseAmount: numeric("base_amount", { precision: 15, scale: 2 }),
  conversionRate: numeric("conversion_rate", { precision: 18, scale: 8 }),
  createdAt, updatedAt, deletedAt,
});
// Unique: per-provider transaction ID must be unique
// Unique constraint on (provider, providerTxnId)
```

**`mobile_wallet_daily_ledger`** (replaces `dailyMpesaLedger`)

```typescript
export const mobileWalletDailyLedger = pgTable("mobile_wallet_daily_ledger", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number" }).notNull(),
  provider: varchar("provider", { length: 20 }).notNull().references(() => mobileWalletProviders.code),
  accountId: bigint("accountId", { mode: "number" }).notNull().references(() => accounts.id),
  ledgerDate: date("ledgerDate").notNull(),
  openingBalance: numeric("openingBalance", { precision: 15, scale: 2 }).notNull(),
  totalInflow: numeric("totalInflow", { precision: 15, scale: 2 }).default("0.00").notNull(),
  totalOutflow: numeric("totalOutflow", { precision: 15, scale: 2 }).default("0.00").notNull(),
  totalFees: numeric("totalFees", { precision: 15, scale: 2 }).default("0.00").notNull(),
  closingBalance: numeric("closingBalance", { precision: 15, scale: 2 }).notNull(),
  transactionCount: integer("transactionCount").default(0),
  notes: text("notes"),
  // Multi-currency base amounts for cross-provider reporting
  baseCurrency: varchar("base_currency", { length: 3 }),
  baseClosingBalance: numeric("base_closing_balance", { precision: 15, scale: 2 }),
  enteredBy: bigint("enteredBy", { mode: "number" }),
  createdAt, updatedAt, deletedAt,
});
// Unique: one ledger entry per location+provider+account+date
```

**`mobile_wallet_reconciliation`** (replaces `mpesaReconciliation`)

```typescript
export const mobileWalletReconciliation = pgTable("mobile_wallet_reconciliation", {
  id: serial("id").primaryKey(),
  provider: varchar("provider", { length: 20 }).notNull().references(() => mobileWalletProviders.code),
  txnDate: date("txnDate").notNull(),
  orphanCount: integer("orphanCount").default(0),
  orphanTotal: numeric("orphanTotal", { precision: 15, scale: 2 }).default("0.00"),
  matchedCount: integer("matchedCount").default(0),
  matchedTotal: numeric("matchedTotal", { precision: 15, scale: 2 }).default("0.00"),
  status: statusEnum("status").default("open").notNull(),
  notes: text("notes"),
  createdAt, resolvedAt,
});
```

**`provider_configs`** (per-location provider configuration)

```typescript
export const providerConfigs = pgTable("provider_configs", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number" }).notNull(),
  provider: varchar("provider", { length: 20 }).notNull().references(() => mobileWalletProviders.code),
  accountId: bigint("accountId", { mode: "number" }).notNull().references(() => accounts.id),
  isDefault: boolean("is_default").default(false).notNull(),
  config: jsonb("config"),          // Provider-specific config (API keys, till numbers, etc.)
  isActive: boolean("is_active").default(true).notNull(),
  createdAt, updatedAt, deletedAt,
});
// Unique: one config per location+provider+account
```

#### 1.3.2 Enum Changes

**`typeEnum`**: Add new account types for each mobile wallet provider

```typescript
// Before: ["cash", "mpesa", "bank_account"]
// After:  ["cash", "mpesa", "airtel_money", "sasapay", "bank_account"]
```

**`paymentMethodEnum`**: Add new payment methods

```typescript
// Before: ["cash", "mpesa", "bank_transfer"]
// After:  ["cash", "mpesa", "airtel_money", "sasapay", "bank_transfer"]
```

**`paymentMethod2Enum`**:

```typescript
// Before: ["cash", "mpesa", "bank_transfer", "card"]
// After:  ["cash", "mpesa", "airtel_money", "sasapay", "bank_transfer", "card"]
```

#### 1.3.3 Data Migration Strategy

Create migration script `scripts/migrate-mpesa-to-provider-framework.ts`:

1. Seed `mobile_wallet_providers` with `{ code: 'mpesa', name: 'M-PESA', brandColor: '#C73E1D', ... }`
2. Seed `supported_currencies` with 10-15 common African currencies
3. Migrate `mpesaTransactions` → `mobile_wallet_transactions` (provider = 'mpesa', currency = 'KES')
4. Migrate `dailyMpesaLedger` → `mobile_wallet_daily_ledger` (provider = 'mpesa')
5. Migrate `mpesaReconciliation` → `mobile_wallet_reconciliation` (provider = 'mpesa')
6. Migrate `locations.defaultMpesaAccountId` → `provider_configs` (provider = 'mpesa')
7. Verify row counts match between old and new tables
8. Backfill `baseCurrency`/`baseAmount` = 'KES'/amount for all migrated rows
9. Update `business-reset.ts` to reference new tables

### 1.4 Mobile Wallet: Abstract Provider Layer

#### 1.4.1 Abstract Base Class & Interface

**File:** `api/lib/mobile-wallet/provider-interface.ts`

```typescript
// Unified type taxonomy for mobile wallet transactions
export type WalletTxnType =
  | "payment"       // Payment to a business (C2B)
  | "disbursement"  // Business payout to customer (B2C)
  | "transfer"      // Person-to-person transfer
  | "topup"         // Wallet funding from bank
  | "withdrawal"    // Cash withdrawal from agent
  | "airtime"       // Airtime purchase
  | "utility"       // Utility bill payment (KPLC, etc.)
  | "bank_transfer" // Transfer to/from bank account
  | "refund";       // Reversed/refunded transaction

export type WalletDirection = "in" | "out";
export type WalletTxnStatus = "pending" | "completed" | "failed" | "refunded";

export interface WalletTransactionRequest {
  amount: number | string;
  currency: string;
  partyIdentifier: string;    // Phone number, till number, paybill
  reference: string;          // Your internal reference
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

export abstract class BaseWalletProvider {
  abstract readonly code: string;
  abstract readonly displayName: string;
  abstract readonly supportedCurrencies: string[];
  abstract readonly features: {
    initiatePayment: boolean;
    queryStatus: boolean;
    processWebhook: boolean;
    refund: boolean;
    balanceInquiry: boolean;
    smsImport: boolean;
  };

  // Core operations
  abstract initiatePayment(request: WalletTransactionRequest): Promise<WalletTransactionResult>;
  abstract queryStatus(providerTxnId: string): Promise<WalletStatusResult>;
  abstract processWebhook(payload: WalletWebhookPayload): Promise<WalletWebhookResult>;
  abstract processRefund(providerTxnId: string, amount?: string): Promise<WalletTransactionResult>;
  abstract balanceInquiry(accountId: number): Promise<WalletBalanceResult>;

  // SMS import (supported by M-PESA, not by API-based providers)
  abstract parseSms?(text: string, options?: Record<string, unknown>): Promise<ParsedWalletSms[]>;
  abstract generateSmsPreview?(text: string, options?: Record<string, unknown>): Promise<ParsedWalletSms[]>;

  // Common utilities
  protected parseDecimal(value: string | number): Decimal { return d(value); }
  protected validateCurrency(currency: string): void {
    if (!this.supportedCurrencies.includes(currency)) {
      throw new Error(`Currency ${currency} not supported by ${this.displayName}. Supported: ${this.supportedCurrencies.join(', ')}`);
    }
  }

  // Logger
  abstract logError(context: string, error: unknown, metadata?: Record<string, unknown>): void;
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
```

#### 1.4.2 Provider Registry

**File:** `api/lib/mobile-wallet/provider-registry.ts`

```typescript
class WalletProviderRegistry {
  private providers = new Map<string, BaseWalletProvider>();

  register(provider: BaseWalletProvider): void;
  get(code: string): BaseWalletProvider;
  getAll(): BaseWalletProvider[];
  getActive(): BaseWalletProvider[];
  getByCurrency(currency: string): BaseWalletProvider[];

  // Load provider config for a location
  getProviderConfig(locationId: number, provider: string): Promise<ProviderConfig | null>;

  // Validate that a transaction's currency is supported by the provider
  validateCurrencyConstraint(provider: string, currency: string): boolean;
}

export const walletRegistry = new WalletProviderRegistry();
```

#### 1.4.3 Concrete M-PESA Provider

**File:** `api/lib/mobile-wallet/providers/mpesa-provider.ts`

```typescript
export class MpesaProvider extends BaseWalletProvider {
  readonly code = 'mpesa';
  readonly displayName = 'M-PESA';
  readonly supportedCurrencies = ['KES'];  // KES-only lock enforced
  readonly features = {
    initiatePayment: false,     // SMS-based, no API initiation
    queryStatus: false,
    processWebhook: false,
    refund: false,              // Manual via SMS
    balanceInquiry: false,
    smsImport: true,            // This is M-PESA's main integration mechanism
  };

  // Implement SMS parsing (migrated from mpesa-parser.ts)
  async parseSms(text: string): Promise<ParsedWalletSms[]>;
  async generateSmsPreview(text: string): Promise<ParsedWalletSms[]>;

  // For future Daraja API integration - stubs return "not implemented"
  async initiatePayment(): Promise<WalletTransactionResult> { throw new Error('Not implemented in SMS mode'); }
  async queryStatus(): Promise<WalletStatusResult> { throw new Error('Not implemented in SMS mode'); }
  async processWebhook(): Promise<WalletWebhookResult> { throw new Error('Not implemented in SMS mode'); }
  async processRefund(): Promise<WalletTransactionResult> { throw new Error('Not implemented in SMS mode'); }
  async balanceInquiry(): Promise<WalletBalanceResult> { throw new Error('Not implemented in SMS mode'); }
}
```

**Key behavior — KES-only currency lock:**

```typescript
// In the provider's request validation
validateCurrencyConstraint(provider: string, currency: string): boolean {
  if (provider === 'mpesa' && currency !== 'KES') {
    return false; // Block non-KES M-PESA transactions
  }
  return true;
}
```

The M-PESA SMS parser logic is migrated from `api/mpesa-parser.ts` into this class, with:

* All 7 SMS pattern recognizers preserved

* Currency field defaults to 'KES'

* `ParsedWalletSms` output type replaces old `ParsedMpesaSms`

* Server-side and client-side parsers now unified via shared import

#### 1.4.4 Provider Templates (Boilerplate)

**File:** `api/lib/mobile-wallet/providers/_template-provider.ts`

A boilerplate template for adding new providers:

```typescript
import { BaseWalletProvider, WalletTransactionRequest, WalletTransactionResult, ... } from '../provider-interface';

export class NewProvider extends BaseWalletProvider {
  readonly code = 'new_provider_code';
  readonly displayName = 'Provider Display Name';
  readonly supportedCurrencies = ['KES'];
  readonly features = {
    initiatePayment: true,
    queryStatus: true,
    processWebhook: true,
    refund: false,
    balanceInquiry: false,
    smsImport: false,
  };

  async initiatePayment(request: WalletTransactionRequest): Promise<WalletTransactionResult> {
    this.validateCurrency(request.currency);
    // 1. Authenticate with provider API
    // 2. Send payment request
    // 3. Parse response
    // 4. Return standardized result
    throw new Error('Not implemented');
  }

  async queryStatus(providerTxnId: string): Promise<WalletStatusResult> {
    throw new Error('Not implemented');
  }

  async processWebhook(payload: WalletWebhookPayload): Promise<WalletWebhookResult> {
    // 1. Verify signature
    // 2. Parse webhook payload
    // 3. Return standardized result or error
    throw new Error('Not implemented');
  }

  // ... other methods
}
```

### 1.5 Unified Transaction Logging

**File:** `api/lib/mobile-wallet/transaction-logger.ts`

Centralized logging for all mobile wallet operations:

```typescript
// Records all mobile wallet transactions with consistent fields
async function logWalletTransaction(params: {
  locationId: number;
  provider: string;
  providerTxnId: string;
  amount: string;
  currency: string;
  direction: WalletDirection;
  txnType: WalletTxnType;
  status: WalletTxnStatus;
  partyName?: string;
  fee?: string;
  rawPayload?: object;
  errorMessage?: string;
  sourceAccountId?: number;
  destinationAccountId?: number;
  // Multi-currency
  baseCurrency?: string;
  baseAmount?: string;
  conversionRate?: string;
}): Promise<number>; // Returns transaction ID

// Retrieve transactions with cross-provider filtering
async function listWalletTransactions(filters: {
  locationId: number;
  provider?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: WalletTxnStatus;
  direction?: WalletDirection;
  currency?: string;
  unlinkedOnly?: boolean;
}): Promise<WalletTransactionResult[]>;

// Aggregate stats across all providers
async function getWalletStats(filters: {
  locationId: number;
  provider?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{
  totalInflow: Record<string, string>;  // by currency
  totalOutflow: Record<string, string>; // by currency
  totalFees: Record<string, string>;    // by currency
  transactionCount: number;
  byProvider: Array<{
    provider: string;
    totalIn: string;
    totalOut: string;
    count: number;
  }>;
}>;
```

### 1.6 Unified Webhook Handler

**File:** `api/lib/mobile-wallet/webhook-handler.ts`

```typescript
export async function handleWalletWebhook(payload: WalletWebhookPayload): Promise<{ status: number; body: string }> {
  const provider = walletRegistry.get(payload.provider);
  if (!provider) {
    return { status: 404, body: JSON.stringify({ error: `Unknown provider: ${payload.provider}` }) };
  }

  if (!provider.features.processWebhook) {
    return { status: 405, body: JSON.stringify({ error: `Webhooks not supported by ${payload.provider}` }) };
  }

  const result = await provider.processWebhook(payload);
  if (result.processed) {
    // Log to mobile_wallet_transactions
    await logWalletTransaction({ ...result.transaction!, ... });
    return { status: 200, body: JSON.stringify({ received: true }) };
  }

  return { status: 400, body: JSON.stringify({ error: result.error }) };
}
```

Mounted in `integrations-router.ts` as a new endpoint:

```
POST /api/integrations/webhooks/wallet/:provider
```

### 1.7 Permissions Update

**File:** `src/lib/permissions.ts`

Refactor M-PESA permissions to wallet-agnostic permissions:

```typescript
// New wallet permissions (replacing MPESA_VIEW, MPESA_IMPORT)
export const WALLET_VIEW = "wallet:view";
export const WALLET_IMPORT = "wallet:import";
export const WALLET_ADMIN = "wallet:admin";  // Manage provider configs

// Legacy aliases for backward compatibility (deprecated)
export const MPESA_VIEW = WALLET_VIEW;
export const MPESA_IMPORT = WALLET_IMPORT;
```

### 1.8 Frontend: Currency Utility & Provider Registry

#### 1.8.1 Shared Currency Formatter

**File:** `src/lib/currency.ts`

```typescript
export const SUPPORTED_CURRENCIES = [
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', decimalPlaces: 2 },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2 },
  { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', decimalPlaces: 0 },
  { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', decimalPlaces: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimalPlaces: 2 },
  // ...
];

export function formatCurrency(
  amount: string | number,
  currency: string = 'KES',
  options?: { showCode?: boolean; compact?: boolean }
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return `${currency} 0.00`;
  
  // Use locale based on currency
  const localeMap: Record<string, string> = {
    KES: 'en-KE', USD: 'en-US', UGX: 'en-UG', TZS: 'en-TZ',
    EUR: 'de-DE', GBP: 'en-GB', JPY: 'ja-JP',
  };
  
  return new Intl.NumberFormat(localeMap[currency] || 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: options?.compact ? 0 : 2,
    maximumFractionDigits: options?.compact ? 0 : 2,
    currencyDisplay: options?.showCode ? 'code' : 'symbol',
  }).format(num);
}

export function getCurrencySymbol(currency: string): string {
  const c = SUPPORTED_CURRENCIES.find(c => c.code === currency);
  return c?.symbol || currency;
}

export function addCurrencySuffix(amount: string, currency: string): string {
  return `${amount} ${currency}`;
}

// Simplified for common use (backward compat)
export function formatKES(amount: string | number): string {
  return formatCurrency(amount, 'KES');
}
```

#### 1.8.2 Provider Constants

**File:** `src/const.ts` (add wallet provider constants)

```typescript
export const WALLET_PROVIDERS = [
  { code: 'mpesa', name: 'M-PESA', brandColor: '#C73E1D', icon: 'Smartphone' },
  { code: 'airtel_money', name: 'Airtel Money', brandColor: '#E30613', icon: 'Smartphone' },
  { code: 'sasapay', name: 'Sasapay', brandColor: '#00A651', icon: 'Wallet' },
] as const;

export type WalletProviderCode = typeof WALLET_PROVIDERS[number]['code'];
```

### 1.9 Unit Tests (Phase 1)

| Module                   | Test File                                      | Coverage Target |
| ------------------------ | ---------------------------------------------- | --------------- |
| `currency-converter.ts`  | `api/lib/__tests__/currency-converter.test.ts` | 95%             |
| `exchange-rate-sync.ts`  | `api/lib/__tests__/exchange-rate-sync.test.ts` | 90%             |
| `provider-interface.ts`  | `api/lib/__tests__/provider-interface.test.ts` | 95%             |
| `provider-registry.ts`   | `api/lib/__tests__/provider-registry.test.ts`  | 95%             |
| `transaction-logger.ts`  | `api/lib/__tests__/transaction-logger.test.ts` | 90%             |
| `webhook-handler.ts`     | `api/lib/__tests__/webhook-handler.test.ts`    | 90%             |
| `mpesa-provider.ts`      | `api/lib/__tests__/mpesa-provider.test.ts`     | 95%             |
| `currency.ts` (frontend) | `src/lib/__tests__/currency.test.ts`           | 95%             |

***

## Phase 2: Migration (M-Pesa Refactoring & M-Pesa KES Lock)

### Goal

Migrate all existing M-Pesa functionality to the new provider framework, enforce KES-only locking, and achieve full backward compatibility with zero regression.

### 2.1 Backend Router Migration

#### 2.1.1 New Wallet Router

**File:** `api/wallet-router.ts` (replaces `api/mpesa-router.ts`)

| Procedure                           | Method   | Purpose                                                             | Provider-Scoped?         |
| ----------------------------------- | -------- | ------------------------------------------------------------------- | ------------------------ |
| `transactions.list`                 | query    | List wallet transactions with provider/location/date/status filters | Yes                      |
| `transactions.stats`                | query    | Aggregated stats by provider and currency                           | Yes                      |
| `transactions.importSms`            | mutation | Parse and import SMS for SMS-capable providers                      | Yes (validates provider) |
| `transactions.tagToSupplier`        | mutation | Link transaction to supplier                                        | Provider-agnostic        |
| `transactions.createExpenseFromTxn` | mutation | Create expense from wallet transaction                              | Provider-agnostic        |
| `transactions.linkToAccount`        | mutation | Link topup to bank account + wallet                                 | Provider-agnostic        |
| `providers.list`                    | query    | List all active providers for a location                            | —                        |
| `providers.getConfig`               | query    | Get provider config for a location                                  | Yes                      |
| `providers.setDefault`              | mutation | Set default wallet provider for location                            | Yes                      |
| `dailyLedger.list`                  | query    | List daily wallet ledger entries                                    | Yes (by provider)        |
| `dailyLedger.create`                | mutation | Upsert daily wallet ledger                                          | Yes (by provider)        |
| `reconciliation.list`               | query    | List reconciliation records                                         | Yes (by provider)        |
| `reconciliation.create`             | mutation | Create reconciliation record                                        | Yes (by provider)        |

#### 2.1.2 M-PESA Router Deprecation

Keep `api/mpesa-router.ts` as a thin proxy that delegates to `wallet-router.ts` with `provider = 'mpesa'`:

```typescript
// Deprecated mpesa-router.ts — delegates to wallet router
export const mpesaRouter = router({
  list: walletRouter.transactions.list,       // Scope to mpesa via middleware
  stats: walletRouter.transactions.stats,
  importSms: walletRouter.transactions.importSms,  // Automatically validates provider='mpesa'
  // ... etc
});
```

This ensures backward compatibility for any existing tRPC references while all new code uses the unified wallet router.

#### 2.1.3 Daily Ledger Router Migration

**File:** `api/daily-ledger-router.ts` → Refactor to delegate to `wallet-router.dailyLedger`:

* Old endpoint continues to work (proxy to wallet router with `provider = 'mpesa'`)

* New unified `dailyLedger.*` procedures available

#### 2.1.4 Dashboard Router Updates

**File:** `api/dashboard-router.ts`

Update M-PESA references in:

* `overview` procedure: Aggregate across all active wallet providers (not just M-PESA)

* `todayPayments` procedure: Include all wallet outflows (not just M-PESA)

* `mpesaFeeAnalysis` → `walletFeeAnalysis`: Multi-provider fee breakdown

### 2.2 Frontend Migration

#### 2.2.1 M-PESA Page → Wallet Page

**File:** `src/pages/Mpesa.tsx` → Partially migrated

The `/mpesa` route continues to work as M-PESA-specific view. A new `/wallet` route provides the unified multi-provider view:

* **`/mpesa`**: Shown when user only uses M-PESA or navigates from legacy link. Fetches M-PESA data only.

* **`/wallet`**: Unified dashboard showing all active wallet providers with provider tabs/filtering.

Key UI changes:

* Provider selector dropdown in transaction list

* Currency column displayed in transaction table

* Provider color-coded badges

* SMS import shows which provider's parser is used

* Stats panel shows per-provider and cross-provider breakdowns

#### 2.2.2 Accounts Page

**File:** `src/pages/Accounts.tsx`

Update account type UI:

* Add `airtel_money` and `sasapay` account types (with brand colors and icons)

* Chart: Show wallet balances grouped by provider

* Account creation: Wire to `mobileWalletProviders` for type validation

#### 2.2.3 Other Frontend Pages

Update references across:

| Page                  | Change                                                                    |
| --------------------- | ------------------------------------------------------------------------- |
| `DailyPayments.tsx`   | Show wallet payments across all providers, not just M-PESA                |
| `Locations.tsx`       | `defaultMpesaAccountId` → generic default wallet provider config          |
| `Businesses.tsx`      | Create default wallet accounts for all active providers (not just M-PESA) |
| `Reports.tsx`         | `exportMpesa` → `exportWalletTransactions(provider?)`                     |
| `ChartOfAccounts.tsx` | Show wallet accounts grouped by provider type                             |

### 2.3 M-Pesa Currency Lock Implementation

#### 2.3.1 Validation Layer

**File:** `api/lib/mobile-wallet/currency-lock.ts`

```typescript
// Centralized currency validation for all wallet providers
export function validateProviderCurrency(
  provider: string,
  currency: string,
  providers: Map<string, BaseWalletProvider>
): { valid: boolean; error?: string; suggestedAction?: string } {
  const providerInstance = providers.get(provider);
  if (!providerInstance) {
    return { valid: false, error: `Unknown provider: ${provider}` };
  }

  if (!providerInstance.supportedCurrencies.includes(currency)) {
    return {
      valid: false,
      error: `${providerInstance.displayName} only supports ${providerInstance.supportedCurrencies.join(', ')}. ${currency} transactions cannot be processed through this provider.`,
      suggestedAction: `Convert ${currency} to ${providerInstance.supportedCurrencies[0]} before initiating payment through ${providerInstance.displayName}.`,
    };
  }

  return { valid: true };
}

// Auto-conversion with disclosure
export async function ensureProviderCurrency(
  amount: Decimal,
  fromCurrency: string,
  toCurrency: string,
  converter: CurrencyConverter
): Promise<{
  originalAmount: Decimal;
  originalCurrency: string;
  convertedAmount: Decimal;
  convertedCurrency: string;
  rate: Decimal;
  fee?: Decimal;
  disclosure: string;
}> {
  if (fromCurrency === toCurrency) {
    return {
      originalAmount: amount,
      originalCurrency: fromCurrency,
      convertedAmount: amount,
      convertedCurrency: toCurrency,
      rate: d(1),
      disclosure: `No conversion needed — transaction is already in ${toCurrency}.`,
    };
  }

  const { converted, rate, fee } = await converter.convert(amount, fromCurrency, toCurrency);
  const feeDisplay = fee ? `A conversion fee of ${fee.toFixed(2)} ${fromCurrency} applies.` : '';

  return {
    originalAmount: amount,
    originalCurrency: fromCurrency,
    convertedAmount: converted,
    convertedCurrency: toCurrency,
    rate,
    fee,
    disclosure: `Your ${fromCurrency} ${amount.toFixed(2)} will be converted at ${rate.toFixed(6)} to ${converted.toFixed(2)} ${toCurrency}. ${feeDisplay}`,
  };
}
```

#### 2.3.2 Frontend Currency Lock UX

* When user selects M-PESA as payment method with non-KES currency:

  * Show conversion disclosure modal with rate, converted amount, and any fees

  * Require explicit confirmation before proceeding

  * If no conversion enabled, block with error message: "M-PESA only supports KES transactions. Please convert your funds or use a different provider."

### 2.4 Business Reset Updates

**File:** `api/lib/business-reset.ts`

Update to reset new tables: `mobile_wallet_transactions`, `mobile_wallet_daily_ledger`, `mobile_wallet_reconciliation`

* Preserve `mobile_wallet_providers` and `supported_currencies` (system-level, not tenant data)

* Preserve `provider_configs` (config structure, reset credentials)

### 2.5 Tests (Phase 2)

| Module                        | Test File                                            | Coverage Target |
| ----------------------------- | ---------------------------------------------------- | --------------- |
| `wallet-router.ts`            | `api/__tests__/wallet-router.test.ts`                | 90%             |
| M-PESA backward compat        | `api/__tests__/mpesa-router-backward-compat.test.ts` | 95%             |
| Currency lock validation      | `api/lib/__tests__/currency-lock.test.ts`            | 95%             |
| Frontend Wallet page          | `src/pages/__tests__/Wallet.test.tsx`                | 85%             |
| Mpesa→Wallet migration script | `scripts/__tests__/migrate-mpesa.test.ts`            | 90%             |

### 2.6 End-to-End Testing

* Verify all existing M-PESA flows (list, import SMS, create expense, link topup, daily ledger, reconciliation) work identically after migration

* Verify KES-only lock: attempt to import non-KES M-PESA SMS → blocked with error

* Verify cross-provider aggregation in dashboard

* Verify all routes continue to function (no 404 due to router refactoring)

***

## Phase 3: Scale (Airtel Money & Sasapay Integration)

### Goal

Integrate Airtel Money and Sasapay as first-class providers, complete UAT, and deploy with phased rollout.

### 3.1 Airtel Money Provider

**File:** `api/lib/mobile-wallet/providers/airtel-money-provider.ts`

```typescript
export class AirtelMoneyProvider extends BaseWalletProvider {
  readonly code = 'airtel_money';
  readonly displayName = 'Airtel Money';
  readonly supportedCurrencies = ['KES', 'UGX', 'TZS', 'MWK', 'ZMW', 'RWF'];
  readonly features = {
    initiatePayment: false,   // SMS-based in Phase 3 (MVP)
    queryStatus: false,
    processWebhook: false,
    refund: false,
    balanceInquiry: false,
    smsImport: true,          // SMS parser for Airtel Money messages
  };

  async parseSms(text: string): Promise<ParsedWalletSms[]> {
    // Airtel Money SMS format patterns:
    // "You have received UGX 50,000 from 2567XX XXX XXX"
    // " UGX 5,000 sent to 2567XX XXX XXX. Airtel Money balance: UGX 20,000"
    // etc.
  }
}
```

**SMS parser patterns for Airtel Money:**

| Pattern                                                  | Detection                       | Direction | Type         |
| -------------------------------------------------------- | ------------------------------- | --------- | ------------ |
| "You have received \[CURRENCY] \[amount] from \[sender]" | `includes("you have received")` | `in`      | `payment`    |
| "\[CURRENCY] \[amount] sent to \[recipient]"             | `includes(" sent to ")`         | `out`     | `transfer`   |
| "\[CURRENCY] \[amount] withdrawn"                        | `includes("withdrawn")`         | `out`     | `withdrawal` |
| Airtel Money cash power purchase                         | `includes("cashpower")`         | `out`     | `utility`    |

**Key difference from M-PESA:** Airtel Money operates in multiple East African currencies (KES, UGX, TZS, MWK, ZMW, RWF). The parser must detect the currency code from the SMS text.

### 3.2 Sasapay Provider

**File:** `api/lib/mobile-wallet/providers/sasapay-provider.ts`

```typescript
export class SasapayProvider extends BaseWalletProvider {
  readonly code = 'sasapay';
  readonly displayName = 'Sasapay';
  readonly supportedCurrencies = ['KES'];
  readonly features = {
    initiatePayment: true,    // Sasapay has a REST API
    queryStatus: true,
    processWebhook: true,     // Callback/webhook support
    refund: true,
    balanceInquiry: true,
    smsImport: false,
  };

  // Sasapay API configuration
  private baseUrl: string;
  private apiKey: string;
  private apiSecret: string;

  constructor(config: { baseUrl: string; apiKey: string; apiSecret: string }) {
    super();
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
  }

  async initiatePayment(request: WalletTransactionRequest): Promise<WalletTransactionResult> {
    this.validateCurrency(request.currency);
    // POST /api/v1/payments
    // { amount, currency, phone, reference, description }
    // Returns { transactionId, status, ... }
    // Map to standardized WalletTransactionResult
  }

  async queryStatus(providerTxnId: string): Promise<WalletStatusResult> {
    // GET /api/v1/payments/{id}/status
  }

  async processWebhook(payload: WalletWebhookPayload): Promise<WalletWebhookResult> {
    // 1. Verify HMAC signature from headers
    // 2. Parse JSON payload
    // 3. Return standardized result
  }

  async processRefund(providerTxnId: string, amount?: string): Promise<WalletTransactionResult> {
    // POST /api/v1/payments/{id}/refund
  }

  async balanceInquiry(accountId: number): Promise<WalletBalanceResult> {
    // GET /api/v1/account/balance
  }
}
```

**Sasapay-specific features:**

* REST API with API key + secret authentication

* Webhooks with HMAC signature verification

* Supports both C2B (customer to business) and B2C (business to customer) payments

* Real-time transaction status polling

* Refund support via API

### 3.3 Unified Payment Selection UI

**File:** `src/components/WalletPaymentSelector.tsx`

```typescript
// A reusable component that shows all active wallet providers
// Used in: Expenses, Bills, Payroll, DailySales
interface WalletPaymentSelectorProps {
  value: string;                // Selected provider code
  onChange: (code: string) => void;
  currency: string;             // Current transaction currency
  amount: string;               // For fee disclosure
  className?: string;
}

// Features:
// - Shows all active providers for the current location
// - Provider cards with brand color, logo, supported currencies
// - Disables providers that don't support the current currency
// - Shows fee/processing time disclosures per provider
// - Indicates default provider with badge
```

### 3.4 Admin Dashboard for Wallet Monitoring

**File:** `src/pages/WalletAdmin.tsx` or embedded in existing Settings/Admin

Features:

* Multi-provider transaction feed with real-time filtering

* Provider health status (last successful transaction per provider)

* Daily settlement summaries by provider

* Reconciliation tool: match provider statements against system records

* Provider configuration: activate/deactivate, set API keys, default provider

### 3.5 Provider Configuration API

**File:** `api/wallet-management-router.ts` (admin-only, permission-protected)

| Procedure                  | Method   | Purpose                                                            |
| -------------------------- | -------- | ------------------------------------------------------------------ |
| `providers.configure`      | mutation | Set API keys, endpoints, webhook URLs for a provider at a location |
| `providers.testConnection` | mutation | Test provider API connectivity                                     |
| `providers.activate`       | mutation | Enable/disable a provider for a location                           |
| `rates.manualUpdate`       | mutation | Manually set exchange rate                                         |
| `rates.sync`               | mutation | Force sync rates from external provider                            |
| `rates.history`            | query    | View exchange rate history                                         |

### 3.6 Multi-Currency Conversion UI

**File:** `src/components/CurrencyConverterDialog.tsx`

A dialog component for manual currency conversion:

* Select from currency (auto-detected from transaction)

* Select to currency (defaults to provider's supported currency)

* Shows live exchange rate with last-updated timestamp

* Shows converted amount

* Shows conversion fee if applicable

* "Apply Conversion" button with confirmation

### 3.7 Tests (Phase 3)

| Module                      | Test File                                                 | Coverage Target           |
| --------------------------- | --------------------------------------------------------- | ------------------------- |
| `airtel-money-provider.ts`  | `api/lib/__tests__/airtel-money-provider.test.ts`         | 90%                       |
| `sasapay-provider.ts`       | `api/lib/__tests__/sasapay-provider.test.ts`              | 90%                       |
| `WalletPaymentSelector.tsx` | `src/components/__tests__/WalletPaymentSelector.test.tsx` | 85%                       |
| `WalletAdmin.tsx`           | `src/pages/__tests__/WalletAdmin.test.tsx`                | 80%                       |
| Airtel Money SMS parser     | `api/lib/__tests__/airtel-sms-parser.test.ts`             | 95%                       |
| Unified webhook (Sasapay)   | `api/__tests__/wallet-webhook.test.ts`                    | 90%                       |
| End-to-end wallet cycle     | `e2e/__tests__/wallet-cycle.test.ts`                      | Coverage of primary flows |

***

## Implementation Order & Dependencies

```
Phase 1: Foundation
├── 1.1 supported_currencies + exchange_rates tables          [DB migration]
├── 1.2 currency-converter.ts + exchange-rate-sync.ts         [Core service]
├── 1.3 mobile_wallet_providers + mobile_wallet_transactions + etc. [DB migration]
├── 1.4 provider-interface.ts + provider-registry.ts          [Abstract layer]
├── 1.5 transaction-logger.ts                                 [Unified logging]
├── 1.6 webhook-handler.ts                                    [Webhook router]
├── 1.7 Permissions update                                    [Backend + frontend]
├── 1.8 Frontend: currency.ts + const.ts                      [Utilities]
├── 1.9 M-PESA provider class (parseSms, generateSmsPreview)  [Concrete provider]
└── 1.10 Unit tests                                            [Coverage 90%+]

Phase 2: Migration
├── 2.1 Data migration: mpesaTransactions → mobile_wallet_transactions  [Script]
├── 2.2 Data migration: dailyMpesaLedger → mobile_wallet_daily_ledger   [Script]
├── 2.3 Data migration: mpesaReconciliation → mobile_wallet_reconciliation [Script]
├── 2.4 Data migration: locations.defaultMpesaAccountId → provider_configs [Script]
├── 2.5 wallet-router.ts creation (replaces mpesa-router.ts) [Backend]
├── 2.6 mpesa-router.ts → proxy pattern                       [Backward compat]
├── 2.7 daily-ledger-router.ts → proxy pattern                [Backward compat]
├── 2.8 dashboard-router.ts → multi-provider aggregation      [Backend]
├── 2.9 Currency lock validation layer                        [Core service]
├── 2.10 Frontend: /wallet page (replaces /mpesa page)        [Frontend]
├── 2.11 Frontend: Legacy /mpesa route preserved              [Frontend]
├── 2.12 Frontend: Accounts, DailyPayments, Locations updates [Frontend]
├── 2.13 Business reset updates                               [Core service]
├── 2.14 Backward compatibility tests + E2E                   [Testing]
└── 2.15 Unit tests (wallet router, currency lock, migration) [Testing]

Phase 3: Scale
├── 3.1 Airtel Money provider + SMS parser                    [Provider]
├── 3.2 Sasapay provider + REST API + webhook handling        [Provider]
├── 3.3 Frontend: WalletPaymentSelector.tsx                   [Component]
├── 3.4 Frontend: CurrencyConverterDialog.tsx                  [Component]
├── 3.5 Admin dashboard for wallet monitoring                 [Frontend]
├── 3.6 Wallet management API (admin router)                  [Backend]
├── 3.7 Full UAT in staging environment                       [Testing]
├── 3.8 Performance/load testing                              [Testing]
├── 3.9 Production deployment: phased rollout                 [DevOps]
└── 3.10 Post-deployment monitoring + documentation           [Operations]
```

***

## Success Criteria Checklist

| Criterion                                                    | Measurement                          | Target            |
| ------------------------------------------------------------ | ------------------------------------ | ----------------- |
| All existing M-PESA functionality operational post-migration | E2E test pass rate                   | 100%              |
| Multi-currency conversion accuracy                           | Rate comparison vs source            | 99.9%             |
| New provider integration time                                | Days from template to production     | < 5 business days |
| Zero-downtime deployment                                     | Rolling update strategy              | Confirmed         |
| Unit test coverage (new modules)                             | Vitest coverage report               | ≥ 90%             |
| Backward compatibility                                       | Old tRPC endpoints still work        | All pass          |
| M-PESA KES lock enforcement                                  | Test: non-KES txns blocked           | 100%              |
| Cross-provider dashboard aggregation                         | Test: sums accurate across providers | Verified          |

***

## Key Design Decisions & Rationale

| Decision                                            | Rationale                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Store original + base currency amounts**          | Enables accurate cross-provider/currency reporting without losing traceability to original transaction |
| **SMS parser stays provider-specific**              | Each provider has unique SMS format; parser TDD per provider makes testing and maintenance easier      |
| **Abstract class over interface**                   | Shared utilities (`parseDecimal`, `validateCurrency`, `logError`) reduce boilerplate across providers  |
| **Provider registry as singleton**                  | Single source of truth for all active providers; simplifies dependency injection in routers            |
| **M-PESA router → proxy pattern**                   | Zero risk of breaking existing API consumers; gradual migration path                                   |
| **`numeric(18, 8)`** **for exchange rates**         | Sufficient precision for all African currency pairs (KES→USD \~0.0075 requires high precision)         |
| **`Intl.NumberFormat`** **for frontend formatting** | Native browser API handles all locale-specific formatting (symbol position, decimal/group separators)  |
| **Per-provider** **`supportedCurrencies`**          | Enables currency constraint validation at the provider level without hardcoding                        |

