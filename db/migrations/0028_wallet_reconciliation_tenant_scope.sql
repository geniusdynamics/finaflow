-- ABOUTME: Add tenant scope to mobile wallet reconciliation records.
-- ABOUTME: Ensures reconciliation rows are owned by a business and optionally a location.
ALTER TABLE "mobile_wallet_reconciliation" ADD COLUMN IF NOT EXISTS "businessId" bigint;
ALTER TABLE "mobile_wallet_reconciliation" ADD COLUMN IF NOT EXISTS "locationId" bigint;

-- Backfill existing rows with a sentinel business so they remain visible to a real admin.
-- A separate data migration should map historical rows to their correct business where possible.
UPDATE "mobile_wallet_reconciliation" SET "businessId" = -1 WHERE "businessId" IS NULL;

ALTER TABLE "mobile_wallet_reconciliation" ALTER COLUMN "businessId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_wallet_reconciliation_business_provider_date"
  ON "mobile_wallet_reconciliation" ("businessId", "provider", "txnDate");
