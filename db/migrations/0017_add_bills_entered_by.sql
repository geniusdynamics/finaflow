-- Add enteredBy to bills so create-only users can be scoped to their own records
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "enteredBy" bigint;
CREATE INDEX IF NOT EXISTS "bills_enteredBy_idx" ON "bills" ("enteredBy");

-- Backfill existing bills with the business owner as a safe default
UPDATE "bills" SET "enteredBy" = (
  SELECT u.id FROM "users" u
  JOIN "businesses" b ON b."accountId" = u."accountId"
  WHERE b.id = "bills"."businessId" AND u.role = 'owner'
  LIMIT 1
) WHERE "enteredBy" IS NULL;
