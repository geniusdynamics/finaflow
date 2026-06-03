-- ABOUTME: Adds coa_id FK to accounts, renames M-Pesa CoA entry to Wallet Account,
-- ABOUTME: creates coa_subtypes reference table, and backfills legacy accounts.
-- ABOUTME: Idempotent — safe to re-run; uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS throughout.

-- ── 1. Create coa_subtypes reference table ────────────────────────────
CREATE TABLE IF NOT EXISTS "coa_subtypes" (
  "id" serial PRIMARY KEY NOT NULL,
  "subtypeKey" varchar(50) NOT NULL UNIQUE,
  "displayName" varchar(100) NOT NULL,
  "accountType" varchar(20) NOT NULL,
  "walletSupport" boolean DEFAULT FALSE NOT NULL,
  "isActive" boolean DEFAULT TRUE NOT NULL,
  "createdAt" timestamp DEFAULT NOW() NOT NULL,
  "updatedAt" timestamp DEFAULT NOW() NOT NULL
);--> statement-breakpoint

-- ── 2. Seed coa_subtypes with all existing enum values ────────────────
INSERT INTO "coa_subtypes" ("subtypeKey", "displayName", "accountType", "walletSupport")
VALUES
  ('cash', 'Cash', 'asset', TRUE),
  ('bank', 'Bank', 'asset', FALSE),
  ('accounts_receivable', 'Accounts Receivable', 'asset', FALSE),
  ('inventory', 'Inventory', 'asset', FALSE),
  ('prepaid_expense', 'Prepaid Expenses', 'asset', FALSE),
  ('fixed_asset', 'Fixed Assets', 'asset', FALSE),
  ('accumulated_depreciation', 'Accumulated Depreciation', 'asset', FALSE),
  ('intangible_asset', 'Intangible Assets', 'asset', FALSE),
  ('other_asset', 'Other Assets', 'asset', FALSE),
  ('accounts_payable', 'Accounts Payable', 'liability', FALSE),
  ('accrued_expense', 'Accrued Expenses', 'liability', FALSE),
  ('current_loan', 'Short-term Loans', 'liability', FALSE),
  ('long_term_loan', 'Long-term Loans', 'liability', FALSE),
  ('capital', 'Capital', 'equity', FALSE),
  ('retained_earnings', 'Retained Earnings', 'equity', FALSE),
  ('drawings', 'Drawings', 'equity', FALSE),
  ('current_year_earnings', 'Current Year Earnings', 'equity', FALSE),
  ('sales_revenue', 'Sales Revenue', 'revenue', FALSE),
  ('service_revenue', 'Service Revenue', 'revenue', FALSE),
  ('subscription_revenue', 'Subscription Revenue', 'revenue', FALSE),
  ('other_income', 'Other Income', 'revenue', FALSE),
  ('cogs', 'Cost of Goods Sold', 'expense', FALSE),
  ('operating_expense', 'Operating Expenses', 'expense', FALSE),
  ('admin_expense', 'Admin Expenses', 'expense', FALSE),
  ('marketing_expense', 'Marketing Expenses', 'expense', FALSE),
  ('depreciation_expense', 'Depreciation Expense', 'expense', FALSE),
  ('bank_charges', 'Bank Charges', 'expense', FALSE)
ON CONFLICT ("subtypeKey") DO NOTHING;--> statement-breakpoint

-- ── 3. Add coa_id column to accounts (nullable initially for backfill) ─
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "coaId" BIGINT;--> statement-breakpoint

-- ── 4. Rename the M-Pesa CoA entry to Wallet Account ──────────────────
UPDATE "accounts"
SET "name" = '1200 - Wallet Account (Cash)',
    "description" = CASE WHEN "description" IS NOT NULL
      THEN REPLACE("description", 'M-Pesa', 'Wallet')
      ELSE 'System-managed asset account for Wallet Accounts'
    END
WHERE "accountType" = 'asset'
  AND "accountSubType" = 'cash'
  AND ("name" LIKE '%M-Pesa%' OR "name" LIKE '%Wallet Account%')
  AND "deletedAt" IS NULL;--> statement-breakpoint

-- ── 5. Backfill coa_id for existing operational accounts ──────────────
-- Link cash-type accounts to the Cash CoA entry (systemKey = 'asset:cash')
UPDATE "accounts" AS op
SET "coaId" = coa."id"
FROM "accounts" AS coa
WHERE op."coaId" IS NULL
  AND op."type" = 'cash'
  AND op."deletedAt" IS NULL
  AND op."accountType" IS NULL
  AND coa."systemKey" = 'asset:cash'
  AND coa."deletedAt" IS NULL;--> statement-breakpoint

-- Link wallet-type accounts to the Wallet CoA entry (systemKey = 'asset:cash')
UPDATE "accounts" AS op
SET "coaId" = coa."id"
FROM "accounts" AS coa
WHERE op."coaId" IS NULL
  AND op."type" = 'wallet'
  AND op."deletedAt" IS NULL
  AND op."accountType" IS NULL
  AND coa."systemKey" = 'asset:cash'
  AND coa."deletedAt" IS NULL;--> statement-breakpoint

-- Link legacy mpesa-type accounts to the Cash CoA entry (systemKey = 'asset:cash')
UPDATE "accounts" AS op
SET "coaId" = coa."id"
FROM "accounts" AS coa
WHERE op."coaId" IS NULL
  AND op."type" = 'mpesa'
  AND op."deletedAt" IS NULL
  AND op."accountType" IS NULL
  AND coa."systemKey" = 'asset:cash'
  AND coa."deletedAt" IS NULL;--> statement-breakpoint

-- Link bank_account-type accounts to the Bank CoA entry (systemKey = 'asset:bank')
UPDATE "accounts" AS op
SET "coaId" = coa."id"
FROM "accounts" AS coa
WHERE op."coaId" IS NULL
  AND op."type" = 'bank_account'
  AND op."deletedAt" IS NULL
  AND op."accountType" IS NULL
  AND coa."systemKey" = 'asset:bank'
  AND coa."deletedAt" IS NULL;--> statement-breakpoint

-- Link any remaining operational accounts via their location's business CoA entry
UPDATE "accounts" AS op
SET "coaId" = coa."id"
FROM "locations" AS l, "accounts" AS coa
WHERE op."coaId" IS NULL
  AND op."accountType" IS NULL
  AND op."deletedAt" IS NULL
  AND op."locationId" = l."id"
  AND l."deletedAt" IS NULL
  AND l."businessId" = coa."businessId"
  AND coa."systemKey" IN ('asset:cash', 'asset:bank')
  AND coa."accountType" = 'asset'
  AND coa."accountSubType" IN ('cash', 'bank')
  AND coa."deletedAt" IS NULL
  AND (
    (op."type" IN ('cash', 'wallet', 'mpesa') AND coa."systemKey" = 'asset:cash')
    OR (op."type" = 'bank_account' AND coa."systemKey" = 'asset:bank')
  );--> statement-breakpoint

-- ── 6. Add FK constraint and index on coaId ───────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_accounts_coa'
      AND conrelid = 'accounts'::regclass
  ) THEN
    ALTER TABLE "accounts" ADD CONSTRAINT "fk_accounts_coa"
      FOREIGN KEY ("coaId") REFERENCES "accounts"("id") ON DELETE SET NULL;
  END IF;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_accounts_coa" ON "accounts" ("coaId");--> statement-breakpoint

-- ── 7. Update the systemKey for cash CoA entries ──────────────────────
UPDATE "accounts"
SET "systemKey" = 'asset:cash'
WHERE "accountType" = 'asset'
  AND "accountSubType" = 'cash'
  AND "deletedAt" IS NULL
  AND ("systemKey" IS NULL OR "systemKey" = '');
