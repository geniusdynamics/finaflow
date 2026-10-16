-- ABOUTME: Subscription Management schema — subscriptions + subscription_payments tables, subscription enums,
-- ABOUTME: the subscription_paid notification clear reason, and a merge of subscription permissions into role_permissions.

DO $$ BEGIN
  CREATE TYPE "subscription_cycle" AS ENUM('day', 'week', 'month', 'year');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "subscription_status" AS ENUM('active', 'paused', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "subscription_posting" AS ENUM('none', 'expense', 'bill');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "notification_cleared_reason" ADD VALUE IF NOT EXISTS 'subscription_paid';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "email_log_type" ADD VALUE IF NOT EXISTS 'subscription_due_digest';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" SERIAL PRIMARY KEY,
  "businessId" BIGINT NOT NULL,
  "locationId" BIGINT REFERENCES "locations"("id") ON DELETE SET NULL,
  "postingLocationId" BIGINT REFERENCES "locations"("id") ON DELETE SET NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "vendorId" BIGINT REFERENCES "suppliers"("id") ON DELETE SET NULL,
  "categoryId" BIGINT REFERENCES "expense_categories"("id") ON DELETE SET NULL,
  "amount" NUMERIC(15, 2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'KES',
  "cycleUnit" "subscription_cycle" NOT NULL,
  "cycleCount" INTEGER NOT NULL DEFAULT 1,
  "isOneTime" BOOLEAN NOT NULL DEFAULT false,
  "startDate" DATE NOT NULL,
  "nextDueDate" DATE NOT NULL,
  "autoRenew" BOOLEAN NOT NULL DEFAULT false,
  "status" "subscription_status" NOT NULL DEFAULT 'active',
  "cancellationDate" DATE,
  "cancelledAt" TIMESTAMP,
  "cancelReason" VARCHAR(255),
  "replacedBySubscriptionId" BIGINT,
  "trialEndsAt" DATE,
  "defaultAccountId" BIGINT REFERENCES "accounts"("id") ON DELETE SET NULL,
  "postingMode" "subscription_posting" NOT NULL DEFAULT 'expense',
  "externalSystem" VARCHAR(50),
  "externalId" VARCHAR(100),
  "url" VARCHAR(255),
  "logoUrl" TEXT,
  "notifyEnabled" BOOLEAN NOT NULL DEFAULT true,
  "notifyDaysBefore" INTEGER,
  "notes" TEXT,
  "createdBy" BIGINT REFERENCES "users"("id") ON DELETE NO ACTION,
  "updatedBy" BIGINT REFERENCES "users"("id") ON DELETE NO ACTION,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMP
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_replaced_by_fk') THEN
    ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_replaced_by_fk" FOREIGN KEY ("replacedBySubscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_payments" (
  "id" SERIAL PRIMARY KEY,
  "subscriptionId" BIGINT NOT NULL REFERENCES "subscriptions"("id") ON DELETE NO ACTION,
  "businessId" BIGINT NOT NULL,
  "locationId" BIGINT,
  "cycleDueDate" DATE NOT NULL,
  "amount" NUMERIC(15, 2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "paidDate" DATE,
  "accountId" BIGINT REFERENCES "accounts"("id") ON DELETE NO ACTION,
  "paymentMethod" "paymentMethod2",
  "reference" VARCHAR(100),
  "confirmed" BOOLEAN NOT NULL DEFAULT true,
  "expenseId" BIGINT REFERENCES "expenses"("id") ON DELETE SET NULL,
  "billId" BIGINT REFERENCES "bills"("id") ON DELETE SET NULL,
  "journalEntryId" BIGINT REFERENCES "journal_entries"("id") ON DELETE SET NULL,
  "notes" TEXT,
  "recordedBy" BIGINT REFERENCES "users"("id") ON DELETE NO ACTION,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_business_deleted" ON "subscriptions" ("businessId", "deletedAt") WHERE "deletedAt" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_location_deleted" ON "subscriptions" ("locationId", "deletedAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_next_due" ON "subscriptions" ("businessId", "nextDueDate", "status") WHERE "deletedAt" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_category" ON "subscriptions" ("categoryId");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_subscriptions_business_external" ON "subscriptions" ("businessId", "externalSystem", "externalId") WHERE "externalId" IS NOT NULL AND "deletedAt" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sub_payments_subscription" ON "subscription_payments" ("subscriptionId", "cycleDueDate");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_sub_payments_cycle" ON "subscription_payments" ("subscriptionId", "cycleDueDate") WHERE "deletedAt" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sub_payments_business_date" ON "subscription_payments" ("businessId", "paidDate");
--> statement-breakpoint
-- Merge subscription permissions into existing DB-backed role permission matrices.
-- owner/admin/manager gain all three; viewer gains view only; employee stays untouched
-- (the employee role is deliberately minimal). Idempotent: sets are unioned with dedupe
-- and rows already carrying the key permission are skipped.
UPDATE "role_permissions"
SET "permissions" = (
  SELECT COALESCE(jsonb_agg(DISTINCT v), '[]'::jsonb)
  FROM (
    SELECT jsonb_array_elements("permissions"::jsonb) AS v
    UNION
    SELECT to_jsonb(x) FROM unnest(ARRAY['subscriptions:view', 'subscriptions:manage', 'subscriptions:pay']) AS x
  ) AS merged
)
WHERE "isActive" = true
  AND "roleKey" IN ('owner', 'admin', 'manager')
  AND NOT ("permissions"::jsonb @> '["subscriptions:manage"]');
--> statement-breakpoint
UPDATE "role_permissions"
SET "permissions" = (
  SELECT COALESCE(jsonb_agg(DISTINCT v), '[]'::jsonb)
  FROM (
    SELECT jsonb_array_elements("permissions"::jsonb) AS v
    UNION
    SELECT to_jsonb(x) FROM unnest(ARRAY['subscriptions:view']) AS x
  ) AS merged
)
WHERE "isActive" = true
  AND "roleKey" = 'viewer'
  AND NOT ("permissions"::jsonb @> '["subscriptions:view"]');
--> statement-breakpoint
COMMENT ON TABLE "subscriptions" IS 'Recurring software/service subscriptions (Wallos-inspired), branch-scoped via locationId (NULL = whole business)';
--> statement-breakpoint
COMMENT ON COLUMN "subscriptions"."postingLocationId" IS 'Branch used for expense/bill posting when the subscription is business-wide (locationId IS NULL) and postingMode != none';
--> statement-breakpoint
COMMENT ON TABLE "subscription_payments" IS 'Subscription payment history; (subscriptionId, cycleDueDate) is the idempotency key per cycle';
--> statement-breakpoint
COMMENT ON COLUMN "subscription_payments"."paidDate" IS 'NULL while confirmed=false (scheduler-created pending row is not yet paid)';
