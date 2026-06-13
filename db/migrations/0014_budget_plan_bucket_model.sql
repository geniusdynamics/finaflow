-- ABOUTME: Creates budget_plans, budget_plan_buckets, and budget_bucket_lines tables with budget_period and budget_plan_status enums.
-- ABOUTME: Backfills legacy budgets rows into plan/bucket/line model. Idempotent — safe to re-run.

-- ── Enums (idempotent via DO $$) ─────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budget_period') THEN
    CREATE TYPE "budget_period" AS ENUM ('monthly', 'quarterly', 'half-yearly', 'annual');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budget_plan_status') THEN
    CREATE TYPE "budget_plan_status" AS ENUM ('draft', 'active', 'locked', 'archived');
  END IF;
END $$;

-- ── Tables (CREATE IF NOT EXISTS + ALTER ADD COLUMN IF NOT EXISTS repair) ──

-- budget_plans
CREATE TABLE IF NOT EXISTS "budget_plans" (
  "id" SERIAL PRIMARY KEY,
  "locationId" BIGINT,
  "fiscalYearStart" INTEGER NOT NULL,
  "period" "budget_period" DEFAULT 'monthly' NOT NULL,
  "name" VARCHAR(255),
  "notes" TEXT,
  "status" "budget_plan_status" DEFAULT 'draft' NOT NULL,
  "createdById" BIGINT,
  "legacyGroupKey" VARCHAR(64),
  "lockedAt" TIMESTAMP,
  "lockedById" BIGINT,
  "archivedAt" TIMESTAMP,
  "archivedById" BIGINT,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "deletedAt" TIMESTAMP
);

-- Idempotent column repair for budget_plans (in case table existed partially)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_plans' AND column_name='locationId') THEN
    ALTER TABLE "budget_plans" ADD COLUMN "locationId" BIGINT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_plans' AND column_name='fiscalYearStart') THEN
    ALTER TABLE "budget_plans" ADD COLUMN "fiscalYearStart" INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::INT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_plans' AND column_name='period') THEN
    ALTER TABLE "budget_plans" ADD COLUMN "period" "budget_period" DEFAULT 'monthly' NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_plans' AND column_name='name') THEN
    ALTER TABLE "budget_plans" ADD COLUMN "name" VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_plans' AND column_name='notes') THEN
    ALTER TABLE "budget_plans" ADD COLUMN "notes" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_plans' AND column_name='status') THEN
    ALTER TABLE "budget_plans" ADD COLUMN "status" "budget_plan_status" DEFAULT 'draft' NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_plans' AND column_name='createdById') THEN
    ALTER TABLE "budget_plans" ADD COLUMN "createdById" BIGINT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_plans' AND column_name='legacyGroupKey') THEN
    ALTER TABLE "budget_plans" ADD COLUMN "legacyGroupKey" VARCHAR(64);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_plans' AND column_name='lockedAt') THEN
    ALTER TABLE "budget_plans" ADD COLUMN "lockedAt" TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_plans' AND column_name='lockedById') THEN
    ALTER TABLE "budget_plans" ADD COLUMN "lockedById" BIGINT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_plans' AND column_name='archivedAt') THEN
    ALTER TABLE "budget_plans" ADD COLUMN "archivedAt" TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_plans' AND column_name='archivedById') THEN
    ALTER TABLE "budget_plans" ADD COLUMN "archivedById" BIGINT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_plans' AND column_name='createdAt') THEN
    ALTER TABLE "budget_plans" ADD COLUMN "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_plans' AND column_name='updatedAt') THEN
    ALTER TABLE "budget_plans" ADD COLUMN "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_plans' AND column_name='deletedAt') THEN
    ALTER TABLE "budget_plans" ADD COLUMN "deletedAt" TIMESTAMP;
  END IF;
END $$;

-- Indexes for budget_plans
CREATE INDEX IF NOT EXISTS "idx_budget_plans_locationId" ON "budget_plans" ("locationId");
CREATE INDEX IF NOT EXISTS "idx_budget_plans_fiscalYearStart" ON "budget_plans" ("fiscalYearStart");
CREATE INDEX IF NOT EXISTS "idx_budget_plans_period" ON "budget_plans" ("period");
CREATE INDEX IF NOT EXISTS "idx_budget_plans_status" ON "budget_plans" ("status");
CREATE INDEX IF NOT EXISTS "idx_budget_plans_legacyGroupKey" ON "budget_plans" ("legacyGroupKey");
CREATE INDEX IF NOT EXISTS "idx_budget_plans_deletedAt" ON "budget_plans" ("deletedAt");

-- budget_plan_buckets
CREATE TABLE IF NOT EXISTS "budget_plan_buckets" (
  "id" SERIAL PRIMARY KEY,
  "planId" BIGINT NOT NULL REFERENCES "budget_plans"("id") ON DELETE CASCADE,
  "bucketType" VARCHAR(16) NOT NULL,
  "bucketIndex" INTEGER NOT NULL,
  "startMonth" INTEGER NOT NULL,
  "endMonth" INTEGER NOT NULL,
  "label" VARCHAR(64),
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Idempotent column repair for budget_plan_buckets
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_plan_buckets' AND column_name='planId') THEN
    ALTER TABLE "budget_plan_buckets" ADD COLUMN "planId" BIGINT NOT NULL REFERENCES "budget_plans"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_plan_buckets' AND column_name='bucketType') THEN
    ALTER TABLE "budget_plan_buckets" ADD COLUMN "bucketType" VARCHAR(16) NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_plan_buckets' AND column_name='bucketIndex') THEN
    ALTER TABLE "budget_plan_buckets" ADD COLUMN "bucketIndex" INTEGER NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_plan_buckets' AND column_name='startMonth') THEN
    ALTER TABLE "budget_plan_buckets" ADD COLUMN "startMonth" INTEGER NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_plan_buckets' AND column_name='endMonth') THEN
    ALTER TABLE "budget_plan_buckets" ADD COLUMN "endMonth" INTEGER NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_plan_buckets' AND column_name='label') THEN
    ALTER TABLE "budget_plan_buckets" ADD COLUMN "label" VARCHAR(64);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_plan_buckets' AND column_name='createdAt') THEN
    ALTER TABLE "budget_plan_buckets" ADD COLUMN "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_plan_buckets' AND column_name='updatedAt') THEN
    ALTER TABLE "budget_plan_buckets" ADD COLUMN "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL;
  END IF;
END $$;

-- Indexes for budget_plan_buckets
CREATE INDEX IF NOT EXISTS "idx_budget_plan_buckets_planId" ON "budget_plan_buckets" ("planId");
CREATE INDEX IF NOT EXISTS "idx_budget_plan_buckets_bucketType" ON "budget_plan_buckets" ("bucketType");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_budget_plan_buckets_plan_index" ON "budget_plan_buckets" ("planId", "bucketType", "bucketIndex");

-- budget_bucket_lines
CREATE TABLE IF NOT EXISTS "budget_bucket_lines" (
  "id" SERIAL PRIMARY KEY,
  "bucketId" BIGINT NOT NULL REFERENCES "budget_plan_buckets"("id") ON DELETE CASCADE,
  "categoryId" BIGINT NOT NULL REFERENCES "expense_categories"("id") ON DELETE NO ACTION,
  "amount" NUMERIC(15,2) NOT NULL DEFAULT '0.00',
  "notes" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Idempotent column repair for budget_bucket_lines
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_bucket_lines' AND column_name='bucketId') THEN
    ALTER TABLE "budget_bucket_lines" ADD COLUMN "bucketId" BIGINT NOT NULL REFERENCES "budget_plan_buckets"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_bucket_lines' AND column_name='categoryId') THEN
    ALTER TABLE "budget_bucket_lines" ADD COLUMN "categoryId" BIGINT NOT NULL REFERENCES "expense_categories"("id") ON DELETE NO ACTION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_bucket_lines' AND column_name='amount') THEN
    ALTER TABLE "budget_bucket_lines" ADD COLUMN "amount" NUMERIC(15,2) NOT NULL DEFAULT '0.00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_bucket_lines' AND column_name='notes') THEN
    ALTER TABLE "budget_bucket_lines" ADD COLUMN "notes" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_bucket_lines' AND column_name='createdAt') THEN
    ALTER TABLE "budget_bucket_lines" ADD COLUMN "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budget_bucket_lines' AND column_name='updatedAt') THEN
    ALTER TABLE "budget_bucket_lines" ADD COLUMN "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL;
  END IF;
END $$;

-- Indexes for budget_bucket_lines
CREATE INDEX IF NOT EXISTS "idx_budget_bucket_lines_bucketId" ON "budget_bucket_lines" ("bucketId");
CREATE INDEX IF NOT EXISTS "idx_budget_bucket_lines_categoryId" ON "budget_bucket_lines" ("categoryId");

-- ── Backfill from legacy budgets table ─────────────────────────────────
-- Group legacy budgets by (locationId, year) to create monthly plans.
-- Each group gets a legacyGroupKey = 'legacy:' || min(budget.id) in that group.
-- For each plan, create 12 monthly buckets (bucketIndex = month).
-- For each legacy budget row, create a bucket line under the matching bucket.

DO $$ DECLARE
  legacy_rec RECORD;
  plan_rec RECORD;
  bucket_rec RECORD;
  plan_id BIGINT;
  bucket_id BIGINT;
  group_min_id BIGINT;
  group_location_id BIGINT;
  group_year INTEGER;
  m INTEGER;
BEGIN
  -- Iterate over distinct (locationId, year) groups from legacy budgets
  FOR group_rec IN
    SELECT DISTINCT b."locationId", b."year",
      MIN(b."id") AS min_id
    FROM "budgets" b
    WHERE b."deletedAt" IS NULL
      AND b."locationId" IS NOT NULL
    GROUP BY b."locationId", b."year"
    ORDER BY b."locationId", b."year"
  LOOP
    group_location_id := group_rec."locationId";
    group_year := group_rec."year";
    group_min_id := group_rec.min_id;

    -- Create budget_plan if not already exists for this legacy group
    SELECT "id" INTO plan_id
    FROM "budget_plans"
    WHERE "legacyGroupKey" = 'legacy:' || group_min_id
    LIMIT 1;

    IF plan_id IS NULL THEN
      INSERT INTO "budget_plans" ("locationId", "fiscalYearStart", "period", "name", "legacyGroupKey", "createdAt", "updatedAt")
      VALUES (group_location_id, group_year, 'monthly', 'Legacy Budget ' || group_year, 'legacy:' || group_min_id, NOW(), NOW())
      RETURNING "id" INTO plan_id;
    END IF;

    -- Create 12 monthly buckets if not already exist
    FOR m IN 1..12 LOOP
      SELECT "id" INTO bucket_id
      FROM "budget_plan_buckets"
      WHERE "planId" = plan_id AND "bucketType" = 'monthly' AND "bucketIndex" = m
      LIMIT 1;

      IF bucket_id IS NULL THEN
        INSERT INTO "budget_plan_buckets" ("planId", "bucketType", "bucketIndex", "startMonth", "endMonth", "label", "createdAt", "updatedAt")
        VALUES (plan_id, 'monthly', m, m, m, 'Month ' || m, NOW(), NOW())
        RETURNING "id" INTO bucket_id;
      END IF;

      -- Insert bucket lines for each legacy budget row matching this plan + month
      INSERT INTO "budget_bucket_lines" ("bucketId", "categoryId", "amount", "notes", "createdAt", "updatedAt")
      SELECT bucket_id, b."categoryId", b."amount", b."notes", COALESCE(b."createdAt", NOW()), COALESCE(b."updatedAt", NOW())
      FROM "budgets" b
      WHERE b."locationId" = group_location_id
        AND b."year" = group_year
        AND b."month" = m
        AND b."deletedAt" IS NULL
        AND b."categoryId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "budget_bucket_lines" bbl
          WHERE bbl."bucketId" = bucket_id AND bbl."categoryId" = b."categoryId"
        )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Add comments for documentation
COMMENT ON TABLE "budget_plans" IS 'Budget plans per fiscal year with period-aware bucket model. Replaces the legacy budgets table.';
COMMENT ON TABLE "budget_plan_buckets" IS 'Tracked time-period buckets within a budget plan (e.g. 12 months, 4 quarters, 2 half-years, 1 annual).';
COMMENT ON TABLE "budget_bucket_lines" IS 'Per-category budget amount lines within a tracked bucket.';
COMMENT ON COLUMN "budget_plans"."period" IS 'Monthly, quarterly, half-yearly, or annual budget period granularity';
COMMENT ON COLUMN "budget_plans"."status" IS 'Lifecycle state: draft, active, locked, archived';
COMMENT ON COLUMN "budget_plan_buckets"."bucketType" IS 'Type label: monthly, quarterly, half-yearly, annual';
COMMENT ON COLUMN "budget_plan_buckets"."bucketIndex" IS '1-based index within the plan (1-12 for monthly, 1-4 for quarterly, 1-2 for half-yearly, 1 for annual)';
COMMENT ON COLUMN "budget_plan_buckets"."startMonth" IS 'Calendar month number (1-12) this bucket starts on';
COMMENT ON COLUMN "budget_plan_buckets"."endMonth" IS 'Calendar month number (1-12) this bucket ends on';
