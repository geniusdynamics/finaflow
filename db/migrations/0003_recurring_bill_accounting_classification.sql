-- Migration: Add businessId, categoryId, and liabilityAccountId to recurring_bill_templates
-- This enables proper accounting classification for recurring bills with dedicated liability accounts

BEGIN;

-- Add businessId to recurring_bill_templates
ALTER TABLE "recurring_bill_templates" ADD COLUMN IF NOT EXISTS "businessId" BIGINT;

-- Add categoryId to link recurring bills to expense categories for accounting classification
ALTER TABLE "recurring_bill_templates" ADD COLUMN IF NOT EXISTS "categoryId" BIGINT;

-- Add liabilityAccountId to specify dedicated liability accounts (rent payable, insurance payable, etc.)
ALTER TABLE "recurring_bill_templates" ADD COLUMN IF NOT EXISTS "liabilityAccountId" BIGINT;

-- Add foreign key constraints (will fail gracefully if already exist)
DO $$
BEGIN
  ALTER TABLE "recurring_bill_templates" ADD CONSTRAINT "fk_recurring_bill_business" 
    FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "recurring_bill_templates" ADD CONSTRAINT "fk_recurring_bill_category" 
    FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "recurring_bill_templates" ADD CONSTRAINT "fk_recurring_bill_liability_account" 
    FOREIGN KEY ("liabilityAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS "idx_recurring_bill_business" ON "recurring_bill_templates" ("businessId");
CREATE INDEX IF NOT EXISTS "idx_recurring_bill_category" ON "recurring_bill_templates" ("categoryId");
CREATE INDEX IF NOT EXISTS "idx_recurring_bill_liability_account" ON "recurring_bill_templates" ("liabilityAccountId");

-- Add new dedicated liability accounts for recurring bills (codes 2110-2140, 2600, 2700)
DO $$
DECLARE
  v_location_id INTEGER;
  v_business_id INTEGER;
BEGIN
  -- Get first business with a location
  SELECT b.id, l.id INTO v_business_id, v_location_id
  FROM businesses b
  JOIN locations l ON l."businessId" = b.id
  LIMIT 1;
  
  -- If no location found, just use first business
  IF v_business_id IS NULL THEN
    SELECT id INTO v_business_id FROM businesses LIMIT 1;
    SELECT id INTO v_location_id FROM locations LIMIT 1;
  END IF;
  
  -- Rent Payable (2110)
  IF NOT EXISTS (SELECT 1 FROM "accounts" WHERE "businessId" = v_business_id AND "accountCode" = '2110') AND v_location_id IS NOT NULL THEN
    INSERT INTO "accounts" ("locationId", "businessId", "name", "accountCode", "type", "openingBalance", "currentBalance", "isPaymentMethod", "isActive")
    VALUES (v_location_id, v_business_id, 'Rent Payable', '2110', 'bank_account'::type, '0.00', '0.00', false, true);
  END IF;
  
  -- Insurance Premiums Payable (2120)
  IF NOT EXISTS (SELECT 1 FROM "accounts" WHERE "businessId" = v_business_id AND "accountCode" = '2120') AND v_location_id IS NOT NULL THEN
    INSERT INTO "accounts" ("locationId", "businessId", "name", "accountCode", "type", "openingBalance", "currentBalance", "isPaymentMethod", "isActive")
    VALUES (v_location_id, v_business_id, 'Insurance Premiums Payable', '2120', 'bank_account'::type, '0.00', '0.00', false, true);
  END IF;
  
  -- Subscriptions Payable (2130)
  IF NOT EXISTS (SELECT 1 FROM "accounts" WHERE "businessId" = v_business_id AND "accountCode" = '2130') AND v_location_id IS NOT NULL THEN
    INSERT INTO "accounts" ("locationId", "businessId", "name", "accountCode", "type", "openingBalance", "currentBalance", "isPaymentMethod", "isActive")
    VALUES (v_location_id, v_business_id, 'Subscriptions Payable', '2130', 'bank_account'::type, '0.00', '0.00', false, true);
  END IF;
  
  -- Utilities Payable (2140)
  IF NOT EXISTS (SELECT 1 FROM "accounts" WHERE "businessId" = v_business_id AND "accountCode" = '2140') AND v_location_id IS NOT NULL THEN
    INSERT INTO "accounts" ("locationId", "businessId", "name", "accountCode", "type", "openingBalance", "currentBalance", "isPaymentMethod", "isActive")
    VALUES (v_location_id, v_business_id, 'Utilities Payable', '2140', 'bank_account'::type, '0.00', '0.00', false, true);
  END IF;
  
  -- Current Loan Payable (2600)
  IF NOT EXISTS (SELECT 1 FROM "accounts" WHERE "businessId" = v_business_id AND "accountCode" = '2600') AND v_location_id IS NOT NULL THEN
    INSERT INTO "accounts" ("locationId", "businessId", "name", "accountCode", "type", "openingBalance", "currentBalance", "isPaymentMethod", "isActive")
    VALUES (v_location_id, v_business_id, 'Current Loan Payable', '2600', 'bank_account'::type, '0.00', '0.00', false, true);
  END IF;
  
  -- Long-Term Loan Payable (2700)
  IF NOT EXISTS (SELECT 1 FROM "accounts" WHERE "businessId" = v_business_id AND "accountCode" = '2700') AND v_location_id IS NOT NULL THEN
    INSERT INTO "accounts" ("locationId", "businessId", "name", "accountCode", "type", "openingBalance", "currentBalance", "isPaymentMethod", "isActive")
    VALUES (v_location_id, v_business_id, 'Long-Term Loan Payable', '2700', 'bank_account'::type, '0.00', '0.00', false, true);
  END IF;
END $$;

COMMIT;
