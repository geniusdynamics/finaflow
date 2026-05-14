-- Migration: Accounting Schema Enhancement
-- Description: Adds accounting classification, journal entries, items, depreciation tracking, and financial reporting

-- Add new enums
CREATE TYPE "accountType" AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
CREATE TYPE "accountSubType" AS ENUM (
  'cash', 'bank', 'accounts_receivable', 'inventory', 'prepaid_expense',
  'fixed_asset', 'accumulated_depreciation', 'intangible_asset', 'other_asset',
  'accounts_payable', 'accrued_expense', 'current_loan', 'long_term_loan',
  'capital', 'retained_earnings', 'drawings', 'current_year_earnings',
  'sales_revenue', 'service_revenue', 'subscription_revenue', 'other_income',
  'cogs', 'operating_expense', 'admin_expense', 'marketing_expense', 'depreciation_expense'
);
CREATE TYPE "itemType" AS ENUM ('inventory', 'fixed_asset', 'service', 'non_inventory');
CREATE TYPE "depreciationMethod" AS ENUM ('straight_line', 'declining_balance');
CREATE TYPE "accountingClass" AS ENUM ('cogs', 'operating_expense', 'admin_expense', 'marketing', 'depreciation', 'other');
CREATE TYPE "revenueCategoryType" AS ENUM ('product_sales', 'service_revenue', 'subscription', 'membership', 'other');

-- Update transactionTypeEnum to add new types
ALTER TYPE "transactionType" ADD VALUE IF NOT EXISTS 'journal';
ALTER TYPE "transactionType" ADD VALUE IF NOT EXISTS 'depreciation';
ALTER TYPE "transactionType" ADD VALUE IF NOT EXISTS 'asset_disposal';

-- Add accounting fields to accounts table
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "businessId" BIGINT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "accountCode" VARCHAR(20) UNIQUE;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "accountType" "accountType";
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "accountSubType" "accountSubType";
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "isContra" BOOLEAN DEFAULT false;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "parentAccountId" BIGINT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "externalId" VARCHAR(255);
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "externalSystem" VARCHAR(50);
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP;

CREATE INDEX IF NOT EXISTS "idx_accounts_code" ON "accounts" ("accountCode");
CREATE INDEX IF NOT EXISTS "idx_accounts_type" ON "accounts" ("accountType");
CREATE INDEX IF NOT EXISTS "idx_accounts_business" ON "accounts" ("businessId");

-- Add fields to expense_categories
ALTER TABLE "expense_categories" ADD COLUMN IF NOT EXISTS "businessId" BIGINT;
ALTER TABLE "expense_categories" ADD COLUMN IF NOT EXISTS "locationId" BIGINT;
ALTER TABLE "expense_categories" ADD COLUMN IF NOT EXISTS "accountingClass" "accountingClass" DEFAULT 'operating_expense';
ALTER TABLE "expense_categories" ADD COLUMN IF NOT EXISTS "defaultAccountId" BIGINT;
ALTER TABLE "expense_categories" ADD COLUMN IF NOT EXISTS "externalAccountCode" VARCHAR(50);
ALTER TABLE "expense_categories" ADD COLUMN IF NOT EXISTS "externalSystem" VARCHAR(50);

CREATE INDEX IF NOT EXISTS "idx_expense_category_business" ON "expense_categories" ("businessId");

-- Add fields to expenses table
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "businessId" BIGINT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "isFixedAsset" BOOLEAN DEFAULT false;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "fixedAssetItemId" BIGINT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "usefulLifeMonths" INTEGER;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "depreciationMethod" "depreciationMethod";
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "salvageValue" DECIMAL(15, 2);
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "journalEntryId" BIGINT;

-- Add fields to bills table
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "businessId" BIGINT;
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "journalEntryId" BIGINT;

-- Add fields to bill_payments table
ALTER TABLE "bill_payments" ADD COLUMN IF NOT EXISTS "journalEntryId" BIGINT;

-- Create journal_entries table
CREATE TABLE IF NOT EXISTS "journal_entries" (
  "id" SERIAL PRIMARY KEY,
  "businessId" BIGINT,
  "entryNumber" VARCHAR(50) UNIQUE,
  "entryDate" DATE NOT NULL,
  "description" TEXT NOT NULL,
  "reference" VARCHAR(100),
  "sourceType" VARCHAR(50),
  "sourceId" BIGINT,
  "isPosted" BOOLEAN DEFAULT false,
  "postedBy" BIGINT,
  "postedAt" TIMESTAMP,
  "isReversed" BOOLEAN DEFAULT false,
  "reversedBy" BIGINT,
  "reversalOf" BIGINT,
  "externalId" VARCHAR(255),
  "externalSystem" VARCHAR(50),
  "createdBy" BIGINT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  "deletedAt" TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_journal_entry_number" ON "journal_entries" ("entryNumber");
CREATE INDEX IF NOT EXISTS "idx_journal_entry_date" ON "journal_entries" ("entryDate");
CREATE INDEX IF NOT EXISTS "idx_journal_entry_source" ON "journal_entries" ("sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "idx_journal_entry_business" ON "journal_entries" ("businessId");

-- Create journal_lines table
CREATE TABLE IF NOT EXISTS "journal_lines" (
  "id" SERIAL PRIMARY KEY,
  "journalEntryId" BIGINT NOT NULL,
  "accountId" BIGINT NOT NULL,
  "debit" DECIMAL(15, 2) DEFAULT '0.00',
  "credit" DECIMAL(15, 2) DEFAULT '0.00',
  "description" TEXT,
  "lineNumber" INTEGER,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "deletedAt" TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_journal_line_entry" ON "journal_lines" ("journalEntryId");
CREATE INDEX IF NOT EXISTS "idx_journal_line_account" ON "journal_lines" ("accountId");

-- Create items table
CREATE TABLE IF NOT EXISTS "items" (
  "id" SERIAL PRIMARY KEY,
  "businessId" BIGINT,
  "locationId" BIGINT,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "sku" VARCHAR(50) UNIQUE,
  "itemType" "itemType" NOT NULL,
  "incomeAccountId" BIGINT,
  "expenseAccountId" BIGINT,
  "assetAccountId" BIGINT,
  "isFixedAsset" BOOLEAN DEFAULT false,
  "purchaseDate" DATE,
  "purchasePrice" DECIMAL(15, 2),
  "usefulLifeMonths" INTEGER,
  "depreciationMethod" "depreciationMethod",
  "salvageValue" DECIMAL(15, 2) DEFAULT '0.00',
  "accumulatedDepreciation" DECIMAL(15, 2) DEFAULT '0.00',
  "currentBookValue" DECIMAL(15, 2),
  "disposalDate" DATE,
  "disposalValue" DECIMAL(15, 2),
  "notes" TEXT,
  "unitCost" DECIMAL(15, 2),
  "unitPrice" DECIMAL(15, 2),
  "currentStock" DECIMAL(15, 2) DEFAULT '0',
  "reorderLevel" DECIMAL(15, 2),
  "taxRate" DECIMAL(5, 2),
  "externalId" VARCHAR(255),
  "externalSystem" VARCHAR(50),
  "lastSyncedAt" TIMESTAMP,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  "deletedAt" TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_items_sku" ON "items" ("sku");
CREATE INDEX IF NOT EXISTS "idx_items_business" ON "items" ("businessId");
CREATE INDEX IF NOT EXISTS "idx_items_type" ON "items" ("itemType");

-- Create fixed_asset_depreciation table
CREATE TABLE IF NOT EXISTS "fixed_asset_depreciation" (
  "id" SERIAL PRIMARY KEY,
  "itemId" BIGINT NOT NULL,
  "journalEntryId" BIGINT,
  "periodYear" INTEGER NOT NULL,
  "periodMonth" INTEGER NOT NULL,
  "depreciationAmount" DECIMAL(15, 2) NOT NULL,
  "accumulatedAfter" DECIMAL(15, 2) NOT NULL,
  "bookValueAfter" DECIMAL(15, 2) NOT NULL,
  "isPosted" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_depreciation_item" ON "fixed_asset_depreciation" ("itemId");
CREATE INDEX IF NOT EXISTS "idx_depreciation_period" ON "fixed_asset_depreciation" ("periodYear", "periodMonth");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_depreciation_item_period" ON "fixed_asset_depreciation" ("itemId", "periodYear", "periodMonth");

-- Create revenue_categories table
CREATE TABLE IF NOT EXISTS "revenue_categories" (
  "id" SERIAL PRIMARY KEY,
  "businessId" BIGINT,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "incomeAccountId" BIGINT,
  "accountCode" VARCHAR(20),
  "categoryType" "revenueCategoryType" DEFAULT 'other',
  "externalId" VARCHAR(255),
  "externalSystem" VARCHAR(50),
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  "deletedAt" TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_revenue_category_business" ON "revenue_categories" ("businessId");

-- Create financial_reports table
CREATE TABLE IF NOT EXISTS "financial_reports" (
  "id" SERIAL PRIMARY KEY,
  "businessId" BIGINT,
  "reportType" VARCHAR(50) NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "reportData" JSONB NOT NULL,
  "reportMetadata" JSONB,
  "generatedBy" BIGINT,
  "generatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_financial_report_business" ON "financial_reports" ("businessId");
CREATE INDEX IF NOT EXISTS "idx_financial_report_type_period" ON "financial_reports" ("reportType", "periodStart", "periodEnd");

-- Create external_sync_config table
CREATE TABLE IF NOT EXISTS "external_sync_config" (
  "id" SERIAL PRIMARY KEY,
  "businessId" BIGINT NOT NULL,
  "systemName" VARCHAR(50) NOT NULL,
  "config" JSONB NOT NULL,
  "lastSyncAt" TIMESTAMP,
  "syncStatus" VARCHAR(20) DEFAULT 'idle',
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_sync_config_business_system" ON "external_sync_config" ("businessId", "systemName");

-- Add foreign key for journal entry reversal
ALTER TABLE "journal_entries" ADD CONSTRAINT "fk_journal_reversal"
  FOREIGN KEY ("reversalOf") REFERENCES "journal_entries"("id");

-- Add foreign keys for journal_lines
ALTER TABLE "journal_lines" ADD CONSTRAINT "fk_journal_line_entry"
  FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id");

ALTER TABLE "journal_lines" ADD CONSTRAINT "fk_journal_line_account"
  FOREIGN KEY ("accountId") REFERENCES "accounts"("id");

-- Add foreign key for fixed asset depreciation
ALTER TABLE "fixed_asset_depreciation" ADD CONSTRAINT "fk_depreciation_item"
  FOREIGN KEY ("itemId") REFERENCES "items"("id");

-- Comment for documentation
COMMENT ON TABLE "journal_entries" IS 'Double-entry journal for all financial transactions';
COMMENT ON TABLE "journal_lines" IS 'Individual debit/credit lines in a journal entry';
COMMENT ON TABLE "items" IS 'Inventory items, fixed assets, and services';
COMMENT ON TABLE "fixed_asset_depreciation" IS 'Depreciation tracking per period for fixed assets';
COMMENT ON TABLE "revenue_categories" IS 'Revenue classification for FinaBill invoices';
