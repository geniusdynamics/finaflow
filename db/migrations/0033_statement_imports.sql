-- ABOUTME: Adds statement import history, best-effort category classification on wallet rows, and learned merchant rules.
-- ABOUTME: Idempotent DDL: safe to re-run on dev and test databases.

CREATE TABLE IF NOT EXISTS "statement_imports" (
  "id" serial PRIMARY KEY,
  "businessId" bigint NOT NULL,
  "locationId" bigint NOT NULL,
  "provider" varchar(20) NOT NULL,
  "sourceType" varchar(20) NOT NULL,
  "kind" varchar(40) NOT NULL,
  "fileName" text,
  "fileSize" integer,
  "fileHash" varchar(64),
  "batchRef" varchar(36),
  "parserId" varchar(50),
  "parserVersion" varchar(20),
  "currency" varchar(3) DEFAULT 'KES' NOT NULL,
  "periodStart" date,
  "periodEnd" date,
  "openingBalance" numeric(15,2),
  "closingBalance" numeric(15,2),
  "rowCount" integer DEFAULT 0 NOT NULL,
  "importedCount" integer DEFAULT 0 NOT NULL,
  "skippedCount" integer DEFAULT 0 NOT NULL,
  "duplicateCount" integer DEFAULT 0 NOT NULL,
  "status" varchar(20) DEFAULT 'parsed' NOT NULL,
  "errorMessage" text,
  "warnings" jsonb,
  "analysis" jsonb,
  "passwordProtected" boolean DEFAULT false NOT NULL,
  "importedBy" bigint,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "deletedAt" timestamp
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_statement_imports_business_created"
  ON "statement_imports" ("businessId", "createdAt");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_statement_imports_location_provider"
  ON "statement_imports" ("locationId", "provider");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_statement_imports_file_hash"
  ON "statement_imports" ("fileHash");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_statement_imports_batch"
  ON "statement_imports" ("batchRef");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "wallet_category_rules" (
  "id" serial PRIMARY KEY,
  "businessId" bigint NOT NULL,
  "provider" varchar(20),
  "matchType" varchar(10) DEFAULT 'contains' NOT NULL,
  "pattern" varchar(255) NOT NULL,
  "categoryId" bigint NOT NULL REFERENCES "expense_categories"("id") ON DELETE CASCADE,
  "priority" integer DEFAULT 1000 NOT NULL,
  "source" varchar(10) DEFAULT 'user' NOT NULL,
  "hitCount" integer DEFAULT 0 NOT NULL,
  "isActive" boolean DEFAULT true NOT NULL,
  "createdBy" bigint,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "deletedAt" timestamp
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_wallet_category_rules_business"
  ON "wallet_category_rules" ("businessId", "isActive");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "idx_wallet_category_rules_unique"
  ON "wallet_category_rules" ("businessId", "provider", "matchType", "pattern")
  WHERE "deletedAt" IS NULL;
--> statement-breakpoint

ALTER TABLE "mobile_wallet_transactions"
  ADD COLUMN IF NOT EXISTS "categoryId" bigint;
--> statement-breakpoint

ALTER TABLE "mobile_wallet_transactions"
  ADD COLUMN IF NOT EXISTS "classificationSource" varchar(20) DEFAULT 'none' NOT NULL;
--> statement-breakpoint

ALTER TABLE "mobile_wallet_transactions"
  ADD COLUMN IF NOT EXISTS "classificationConfidence" numeric(4,3);
--> statement-breakpoint

ALTER TABLE "mobile_wallet_transactions"
  ADD COLUMN IF NOT EXISTS "statementImportId" bigint;
--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mobile_wallet_transactions_categoryId_fkey'
  ) THEN
    ALTER TABLE "mobile_wallet_transactions"
      ADD CONSTRAINT "mobile_wallet_transactions_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mobile_wallet_transactions_statementImportId_fkey'
  ) THEN
    ALTER TABLE "mobile_wallet_transactions"
      ADD CONSTRAINT "mobile_wallet_transactions_statementImportId_fkey"
      FOREIGN KEY ("statementImportId") REFERENCES "statement_imports"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_wallet_txn_statement_import"
  ON "mobile_wallet_transactions" ("statementImportId");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_wallet_txn_category"
  ON "mobile_wallet_transactions" ("categoryId");
--> statement-breakpoint

COMMENT ON TABLE "statement_imports" IS 'Statement import history; the original file and password are never stored';
--> statement-breakpoint

COMMENT ON COLUMN "mobile_wallet_transactions"."classificationSource" IS 'none | rule | learned | manual';
--> statement-breakpoint

COMMENT ON TABLE "wallet_category_rules" IS 'User/learned merchant-to-category rules; system rules live in code';
