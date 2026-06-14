-- ABOUTME: Adds fiscalYearStartMonth column to the businesses table for configurable fiscal year start.
-- ABOUTME: Default is 4 (April) matching the Kenyan financial year convention.

-- Add fiscalYearStartMonth to businesses table (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='businesses' AND column_name='fiscalYearStartMonth') THEN
    ALTER TABLE "businesses" ADD COLUMN "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 4;
  END IF;
END $$;

-- Add check constraint for valid month range (1-12)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'ck_businesses_fiscalYearStartMonth_range') THEN
    ALTER TABLE "businesses" ADD CONSTRAINT "ck_businesses_fiscalYearStartMonth_range" CHECK ("fiscalYearStartMonth" >= 1 AND "fiscalYearStartMonth" <= 12);
  END IF;
END $$;

COMMENT ON COLUMN "businesses"."fiscalYearStartMonth" IS 'Month number (1=Jan, 12=Dec) when the fiscal year starts. Default 4=April.';
