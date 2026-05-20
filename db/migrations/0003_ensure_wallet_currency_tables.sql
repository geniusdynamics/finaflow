-- ABOUTME: Safety-net migration ensuring all wallet and currency tables exist.
-- ABOUTME: Uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS for safe re-runs.

-- ── supported_currencies ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "supported_currencies" (
  "code" varchar(3) PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL,
  "symbol" varchar(10) NOT NULL,
  "decimal_places" integer DEFAULT 2 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

-- ── exchange_rates ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "exchange_rates" (
  "id" serial PRIMARY KEY NOT NULL,
  "from_currency" varchar(3) NOT NULL,
  "to_currency" varchar(3) NOT NULL,
  "rate" numeric(18, 8) NOT NULL,
  "source" varchar(50) DEFAULT 'manual',
  "valid_from" timestamp DEFAULT now() NOT NULL,
  "valid_until" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

-- ── business_currencies ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "business_currencies" (
  "id" serial PRIMARY KEY NOT NULL,
  "businessId" bigint NOT NULL,
  "currency" varchar(3) NOT NULL,
  "is_base_currency" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

-- ── mobile_wallet_providers ───────────────────────────────────
CREATE TABLE IF NOT EXISTS "mobile_wallet_providers" (
  "code" varchar(20) PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL,
  "display_name" varchar(100),
  "brand_color" varchar(7),
  "logo_url" varchar(255),
  "supported_currencies" varchar(100),
  "is_active" boolean DEFAULT true NOT NULL,
  "requires_provisioning" boolean DEFAULT false,
  "config_schema" jsonb,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "deletedAt" timestamp
);

-- ── mobile_wallet_transactions ────────────────────────────────
CREATE TABLE IF NOT EXISTS "mobile_wallet_transactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "locationId" bigint NOT NULL,
  "provider" varchar(20) NOT NULL,
  "provider_txn_id" varchar(100) NOT NULL,
  "provider_ref" varchar(100),
  "txnDate" date NOT NULL,
  "txnTime" varchar(10),
  "txn_type" varchar(30) NOT NULL,
  "direction" varchar(5) NOT NULL,
  "partyName" varchar(255),
  "party_identifier" varchar(100),
  "amount" numeric(15, 2) NOT NULL,
  "currency" varchar(3) DEFAULT 'KES' NOT NULL,
  "txnFee" numeric(15, 2) DEFAULT '0.00' NOT NULL,
  "balance" numeric(15, 2),
  "description" text,
  "rawText" text,
  "raw_payload" jsonb,
  "status" varchar(20) DEFAULT 'completed' NOT NULL,
  "is_reconciled" boolean DEFAULT false NOT NULL,
  "is_linked" boolean DEFAULT false NOT NULL,
  "linkedExpenseId" bigint,
  "linkedBillId" bigint,
  "linkedSupplierId" bigint,
  "sourceAccountId" bigint,
  "destinationAccountId" bigint,
  "importedBy" bigint,
  "base_currency" varchar(3),
  "base_amount" numeric(15, 2),
  "conversion_rate" numeric(18, 8),
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "deletedAt" timestamp
);

-- ── mobile_wallet_daily_ledger ────────────────────────────────
CREATE TABLE IF NOT EXISTS "mobile_wallet_daily_ledger" (
  "id" serial PRIMARY KEY NOT NULL,
  "locationId" bigint NOT NULL,
  "provider" varchar(20) NOT NULL,
  "accountId" bigint NOT NULL,
  "ledgerDate" date NOT NULL,
  "openingBalance" numeric(15, 2) NOT NULL,
  "totalInflow" numeric(15, 2) DEFAULT '0.00' NOT NULL,
  "totalOutflow" numeric(15, 2) DEFAULT '0.00' NOT NULL,
  "totalFees" numeric(15, 2) DEFAULT '0.00' NOT NULL,
  "closingBalance" numeric(15, 2) NOT NULL,
  "transactionCount" integer DEFAULT 0,
  "notes" text,
  "base_currency" varchar(3),
  "base_closing_balance" numeric(15, 2),
  "enteredBy" bigint,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "deletedAt" timestamp
);

-- ── mobile_wallet_reconciliation ──────────────────────────────
CREATE TABLE IF NOT EXISTS "mobile_wallet_reconciliation" (
  "id" serial PRIMARY KEY NOT NULL,
  "provider" varchar(20) NOT NULL,
  "txnDate" date NOT NULL,
  "orphanCount" integer DEFAULT 0,
  "orphanTotal" numeric(15, 2) DEFAULT '0.00',
  "matchedCount" integer DEFAULT 0,
  "matchedTotal" numeric(15, 2) DEFAULT '0.00',
  "status" varchar(20) DEFAULT 'open' NOT NULL,
  "notes" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "resolvedAt" timestamp
);

-- ── provider_configs ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "provider_configs" (
  "id" serial PRIMARY KEY NOT NULL,
  "locationId" bigint NOT NULL,
  "provider" varchar(20) NOT NULL,
  "accountId" bigint NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "config" jsonb,
  "is_active" boolean DEFAULT true NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "deletedAt" timestamp
);

-- ── Foreign keys (safe: only add if constraint doesn't exist) ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exchange_rates_from_currency_supported_currencies_code_fk') THEN
    ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_from_currency_supported_currencies_code_fk"
      FOREIGN KEY ("from_currency") REFERENCES "supported_currencies"("code") ON DELETE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exchange_rates_to_currency_supported_currencies_code_fk') THEN
    ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_to_currency_supported_currencies_code_fk"
      FOREIGN KEY ("to_currency") REFERENCES "supported_currencies"("code") ON DELETE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_currencies_businessId_businesses_id_fk') THEN
    ALTER TABLE "business_currencies" ADD CONSTRAINT "business_currencies_businessId_businesses_id_fk"
      FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_currencies_currency_supported_currencies_code_fk') THEN
    ALTER TABLE "business_currencies" ADD CONSTRAINT "business_currencies_currency_supported_currencies_code_fk"
      FOREIGN KEY ("currency") REFERENCES "supported_currencies"("code") ON DELETE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mobile_wallet_transactions_provider_mobile_wallet_providers_code_fk') THEN
    ALTER TABLE "mobile_wallet_transactions" ADD CONSTRAINT "mobile_wallet_transactions_provider_mobile_wallet_providers_code_fk"
      FOREIGN KEY ("provider") REFERENCES "mobile_wallet_providers"("code") ON DELETE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mobile_wallet_daily_ledger_provider_mobile_wallet_providers_code_fk') THEN
    ALTER TABLE "mobile_wallet_daily_ledger" ADD CONSTRAINT "mobile_wallet_daily_ledger_provider_mobile_wallet_providers_code_fk"
      FOREIGN KEY ("provider") REFERENCES "mobile_wallet_providers"("code") ON DELETE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mobile_wallet_reconciliation_provider_mobile_wallet_providers_code_fk') THEN
    ALTER TABLE "mobile_wallet_reconciliation" ADD CONSTRAINT "mobile_wallet_reconciliation_provider_mobile_wallet_providers_code_fk"
      FOREIGN KEY ("provider") REFERENCES "mobile_wallet_providers"("code") ON DELETE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'provider_configs_provider_mobile_wallet_providers_code_fk') THEN
    ALTER TABLE "provider_configs" ADD CONSTRAINT "provider_configs_provider_mobile_wallet_providers_code_fk"
      FOREIGN KEY ("provider") REFERENCES "mobile_wallet_providers"("code") ON DELETE no action;
  END IF;
END $$;

-- ── Indexes (safe: IF NOT EXISTS) ─────────────────────────────
CREATE INDEX IF NOT EXISTS "idx_wallet_txn_provider_txn" ON "mobile_wallet_transactions" ("provider", "provider_txn_id");
CREATE INDEX IF NOT EXISTS "idx_wallet_txn_location" ON "mobile_wallet_transactions" ("locationId");
CREATE INDEX IF NOT EXISTS "idx_wallet_txn_status" ON "mobile_wallet_transactions" ("status");
CREATE INDEX IF NOT EXISTS "idx_wallet_ledger_provider_date" ON "mobile_wallet_daily_ledger" ("locationId", "provider", "accountId", "ledgerDate");
CREATE INDEX IF NOT EXISTS "idx_provider_config_loc_prov_acct" ON "provider_configs" ("locationId", "provider", "accountId");
