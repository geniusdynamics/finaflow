-- Migration: Add accounting columns to existing tables
-- Run this after existing migrations

-- Add accounting columns to expense_categories
ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS businessId BIGINT;
ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS locationId BIGINT;
ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS accountingClass VARCHAR(50) DEFAULT 'operating_expense';
ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS defaultAccountId BIGINT;
ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS externalAccountCode VARCHAR(50);
ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS externalSystem VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_expense_category_business ON expense_categories (businessId);

-- Add accounting columns to expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS businessId BIGINT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS isFixedAsset BOOLEAN DEFAULT false;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS fixedAssetItemId BIGINT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS usefulLifeMonths INTEGER;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS depreciationMethod VARCHAR(50);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS salvageValue DECIMAL(15, 2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS journalEntryId BIGINT;

-- Add accounting columns to bills
ALTER TABLE bills ADD COLUMN IF NOT EXISTS businessId BIGINT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS journalEntryId BIGINT;

-- Add journal entry column to bill_payments
ALTER TABLE bill_payments ADD COLUMN IF NOT EXISTS journalEntryId BIGINT;

-- Add accounting columns to accounts
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS businessId BIGINT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS accountCode VARCHAR(20);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS accountType VARCHAR(50);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS accountSubType VARCHAR(50);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS isContra BOOLEAN DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS parentAccountId BIGINT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS externalId VARCHAR(255);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS externalSystem VARCHAR(50);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS lastSyncedAt TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_code ON accounts (accountCode);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts (accountType);
CREATE INDEX IF NOT EXISTS idx_accounts_business ON accounts (businessId);

-- Add unique constraint to accounts.accountCode if column exists and has unique values
-- Note: Only run this after data is cleaned up if there are duplicates
-- ALTER TABLE accounts ADD CONSTRAINT unique_account_code UNIQUE (accountCode) WHERE accountCode IS NOT NULL;

-- Create journal_entries table
CREATE TABLE IF NOT EXISTS journal_entries (
  id SERIAL PRIMARY KEY,
  businessId BIGINT,
  entryNumber VARCHAR(50) UNIQUE,
  entryDate DATE NOT NULL,
  description TEXT NOT NULL,
  reference VARCHAR(100),
  sourceType VARCHAR(50),
  sourceId BIGINT,
  isPosted BOOLEAN DEFAULT false,
  postedBy BIGINT,
  postedAt TIMESTAMP,
  isReversed BOOLEAN DEFAULT false,
  reversedBy BIGINT,
  reversalOf BIGINT,
  externalId VARCHAR(255),
  externalSystem VARCHAR(50),
  createdBy BIGINT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  deletedAt TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_journal_entry_number ON journal_entries (entryNumber);
CREATE INDEX IF NOT EXISTS idx_journal_entry_date ON journal_entries (entryDate);
CREATE INDEX IF NOT EXISTS idx_journal_entry_source ON journal_entries (sourceType, sourceId);
CREATE INDEX IF NOT EXISTS idx_journal_entry_business ON journal_entries (businessId);

-- Create journal_lines table
CREATE TABLE IF NOT EXISTS journal_lines (
  id SERIAL PRIMARY KEY,
  journalEntryId BIGINT NOT NULL,
  accountId BIGINT NOT NULL,
  debit DECIMAL(15, 2) DEFAULT 0.00,
  credit DECIMAL(15, 2) DEFAULT 0.00,
  description TEXT,
  lineNumber INTEGER,
  createdAt TIMESTAMP DEFAULT NOW(),
  deletedAt TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_journal_line_entry ON journal_lines (journalEntryId);
CREATE INDEX IF NOT EXISTS idx_journal_line_account ON journal_lines (accountId);

-- Create items table
CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  businessId BIGINT,
  locationId BIGINT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sku VARCHAR(50) UNIQUE,
  itemType VARCHAR(50) NOT NULL,
  incomeAccountId BIGINT,
  expenseAccountId BIGINT,
  assetAccountId BIGINT,
  isFixedAsset BOOLEAN DEFAULT false,
  purchaseDate DATE,
  purchasePrice DECIMAL(15, 2),
  usefulLifeMonths INTEGER,
  depreciationMethod VARCHAR(50),
  salvageValue DECIMAL(15, 2) DEFAULT 0.00,
  accumulatedDepreciation DECIMAL(15, 2) DEFAULT 0.00,
  currentBookValue DECIMAL(15, 2),
  disposalDate DATE,
  disposalValue DECIMAL(15, 2),
  notes TEXT,
  unitCost DECIMAL(15, 2),
  unitPrice DECIMAL(15, 2),
  currentStock DECIMAL(15, 2) DEFAULT 0,
  reorderLevel DECIMAL(15, 2),
  taxRate DECIMAL(5, 2),
  externalId VARCHAR(255),
  externalSystem VARCHAR(50),
  lastSyncedAt TIMESTAMP,
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  deletedAt TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_items_sku ON items (sku);
CREATE INDEX IF NOT EXISTS idx_items_business ON items (businessId);
CREATE INDEX IF NOT EXISTS idx_items_type ON items (itemType);

-- Create fixed_asset_depreciation table
CREATE TABLE IF NOT EXISTS fixed_asset_depreciation (
  id SERIAL PRIMARY KEY,
  itemId BIGINT NOT NULL,
  journalEntryId BIGINT,
  periodYear INTEGER NOT NULL,
  periodMonth INTEGER NOT NULL,
  depreciationAmount DECIMAL(15, 2) NOT NULL,
  accumulatedAfter DECIMAL(15, 2) NOT NULL,
  bookValueAfter DECIMAL(15, 2) NOT NULL,
  isPosted BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_depreciation_item ON fixed_asset_depreciation (itemId);
CREATE INDEX IF NOT EXISTS idx_depreciation_period ON fixed_asset_depreciation (periodYear, periodMonth);
CREATE UNIQUE INDEX IF NOT EXISTS idx_depreciation_item_period ON fixed_asset_depreciation (itemId, periodYear, periodMonth);

-- Create revenue_categories table
CREATE TABLE IF NOT EXISTS revenue_categories (
  id SERIAL PRIMARY KEY,
  businessId BIGINT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  incomeAccountId BIGINT,
  accountCode VARCHAR(20),
  categoryType VARCHAR(50) DEFAULT 'other',
  externalId VARCHAR(255),
  externalSystem VARCHAR(50),
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  deletedAt TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_revenue_category_business ON revenue_categories (businessId);

-- Create financial_reports table
CREATE TABLE IF NOT EXISTS financial_reports (
  id SERIAL PRIMARY KEY,
  businessId BIGINT,
  reportType VARCHAR(50) NOT NULL,
  periodStart DATE NOT NULL,
  periodEnd DATE NOT NULL,
  reportData JSONB NOT NULL,
  reportMetadata JSONB,
  generatedBy BIGINT,
  generatedAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_report_business ON financial_reports (businessId);
CREATE INDEX IF NOT EXISTS idx_financial_report_type_period ON financial_reports (reportType, periodStart, periodEnd);

-- Create external_sync_config table
CREATE TABLE IF NOT EXISTS external_sync_config (
  id SERIAL PRIMARY KEY,
  businessId BIGINT NOT NULL,
  systemName VARCHAR(50) NOT NULL,
  config JSONB NOT NULL,
  lastSyncAt TIMESTAMP,
  syncStatus VARCHAR(20) DEFAULT 'idle',
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_config_business_system ON external_sync_config (businessId, systemName);

-- Add foreign keys for journal_lines
ALTER TABLE journal_lines ADD CONSTRAINT fk_journal_line_entry 
  FOREIGN KEY (journalEntryId) REFERENCES journal_entries(id);

ALTER TABLE journal_lines ADD CONSTRAINT fk_journal_line_account 
  FOREIGN KEY (accountId) REFERENCES accounts(id);

-- Add foreign key for fixed_asset_depreciation
ALTER TABLE fixed_asset_depreciation ADD CONSTRAINT fk_depreciation_item 
  FOREIGN KEY (itemId) REFERENCES items(id);

-- Add foreign key for journal_entries reversal
ALTER TABLE journal_entries ADD CONSTRAINT fk_journal_reversal 
  FOREIGN KEY (reversalOf) REFERENCES journal_entries(id);
