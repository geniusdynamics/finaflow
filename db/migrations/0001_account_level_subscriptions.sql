-- ABOUTME: Creates account-level subscription storage and foreign keys for users, businesses, and payment methods.
-- ABOUTME: Adds an idempotent backfill routine that migrates legacy business subscription state into customer_accounts.
CREATE TABLE IF NOT EXISTS "customer_accounts" (
  "id" serial PRIMARY KEY NOT NULL,
  "accountId" varchar(100) NOT NULL,
  "name" varchar(255) NOT NULL,
  "plan" varchar(20) DEFAULT 'free' NOT NULL,
  "maxBusinesses" integer DEFAULT 1 NOT NULL,
  "maxUsers" integer DEFAULT 1 NOT NULL,
  "maxTransactionsPerMonth" integer DEFAULT 100 NOT NULL,
  "features" json,
  "subscriptionStatus" varchar(20) DEFAULT 'active' NOT NULL,
  "subscriptionExpiry" date,
  "isActive" boolean DEFAULT true NOT NULL,
  "migratedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "deletedAt" timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_customer_accounts_accountId"
  ON "customer_accounts" USING btree ("accountId");
--> statement-breakpoint
ALTER TABLE "businesses" DROP CONSTRAINT IF EXISTS "businesses_accountId_unique";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "accountRefId" bigint;
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "accountRefId" bigint;
--> statement-breakpoint
ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "accountRefId" bigint;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_accountRefId_customer_accounts_id_fk'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_accountRefId_customer_accounts_id_fk"
      FOREIGN KEY ("accountRefId") REFERENCES "customer_accounts"("id");
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'businesses_accountRefId_customer_accounts_id_fk'
  ) THEN
    ALTER TABLE "businesses"
      ADD CONSTRAINT "businesses_accountRefId_customer_accounts_id_fk"
      FOREIGN KEY ("accountRefId") REFERENCES "customer_accounts"("id");
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_methods_accountRefId_customer_accounts_id_fk'
  ) THEN
    ALTER TABLE "payment_methods"
      ADD CONSTRAINT "payment_methods_accountRefId_customer_accounts_id_fk"
      FOREIGN KEY ("accountRefId") REFERENCES "customer_accounts"("id");
  END IF;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION run_account_subscription_backfill()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  account_row record;
BEGIN
  FOR account_row IN
    SELECT
      b."accountId",
      COALESCE(MAX(b.name), b."accountId") AS name
    FROM "businesses" b
    WHERE b."deletedAt" IS NULL
      AND b."accountId" IS NOT NULL
    GROUP BY b."accountId"
  LOOP
    INSERT INTO "customer_accounts" (
      "accountId",
      name,
      plan,
      "subscriptionStatus",
      "subscriptionExpiry",
      "maxBusinesses",
      "maxUsers",
      "maxTransactionsPerMonth",
      features,
      "migratedAt"
    )
    SELECT
      account_row."accountId",
      account_row.name,
      winner.plan,
      winner."subscriptionStatus",
      winner."subscriptionExpiry",
      CASE winner.plan
        WHEN 'free' THEN 1
        WHEN 'starter' THEN 1
        WHEN 'growth' THEN 3
        WHEN 'pro' THEN 10
        ELSE 99
      END,
      COALESCE(
        winner."maxUsers",
        CASE winner.plan
          WHEN 'free' THEN 1
          WHEN 'starter' THEN 3
          WHEN 'growth' THEN 5
          WHEN 'pro' THEN 99
          ELSE 99
        END
      ),
      COALESCE(
        winner."maxTransactionsPerMonth",
        CASE winner.plan
          WHEN 'free' THEN 100
          WHEN 'starter' THEN 5000
          WHEN 'growth' THEN 20000
          ELSE 999999
        END
      ),
      winner.features,
      now()
    FROM (
      SELECT b.*
      FROM "businesses" b
      WHERE b."accountId" = account_row."accountId"
        AND b."deletedAt" IS NULL
      ORDER BY
        CASE WHEN b."subscriptionStatus" IN ('active', 'trial') THEN 0 ELSE 1 END,
        COALESCE(b."updatedAt", b."createdAt") DESC,
        b.id DESC
      LIMIT 1
    ) AS winner
    ON CONFLICT ("accountId") DO UPDATE
    SET
      name = EXCLUDED.name,
      plan = EXCLUDED.plan,
      "subscriptionStatus" = EXCLUDED."subscriptionStatus",
      "subscriptionExpiry" = EXCLUDED."subscriptionExpiry",
      "maxBusinesses" = EXCLUDED."maxBusinesses",
      "maxUsers" = EXCLUDED."maxUsers",
      "maxTransactionsPerMonth" = EXCLUDED."maxTransactionsPerMonth",
      features = EXCLUDED.features,
      "migratedAt" = EXCLUDED."migratedAt",
      "updatedAt" = now();

    UPDATE "users" AS u
    SET "accountRefId" = ca.id
    FROM "customer_accounts" AS ca
    WHERE u."accountId" = ca."accountId"
      AND ca."accountId" = account_row."accountId"
      AND u."accountRefId" IS DISTINCT FROM ca.id;

    UPDATE "businesses" AS b
    SET "accountRefId" = ca.id
    FROM "customer_accounts" AS ca
    WHERE b."accountId" = ca."accountId"
      AND ca."accountId" = account_row."accountId"
      AND b."accountRefId" IS DISTINCT FROM ca.id;

    UPDATE "payment_methods" AS pm
    SET "accountRefId" = ca.id
    FROM "businesses" AS b
    JOIN "customer_accounts" AS ca ON ca.id = b."accountRefId"
    WHERE pm."businessId" = b.id
      AND b."accountId" = account_row."accountId"
      AND pm."accountRefId" IS DISTINCT FROM ca.id;
  END LOOP;
END;
$$;
--> statement-breakpoint
SELECT run_account_subscription_backfill();
