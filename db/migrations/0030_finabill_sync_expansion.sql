-- ABOUTME: Adds external system linkage columns to suppliers and bills for FinaBill sync.
-- ABOUTME: Migrates legacy mpesa operational accounts to the wallet type (M-Pesa merged into Wallet).
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "externalId" varchar(255);--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "externalSystem" varchar(50);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_suppliers_business_external" ON "suppliers" ("businessId", "externalSystem", "externalId") WHERE "externalId" IS NOT NULL AND "deletedAt" IS NULL;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "externalId" varchar(255);--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "externalSystem" varchar(50);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_bills_business_external" ON "bills" ("businessId", "externalSystem", "externalId") WHERE "externalId" IS NOT NULL AND "deletedAt" IS NULL;--> statement-breakpoint
UPDATE "accounts" SET "type" = 'wallet' WHERE "type" = 'mpesa';
