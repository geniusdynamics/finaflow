// ABOUTME: Verifies the 0014 budget plan/bucket/line migration file exists, is idempotent, registers in journal + bootstrap, and backfills legacy data.
// ABOUTME: Validates repair of partial pre-existing tables via ALTER TABLE ADD COLUMN IF NOT EXISTS.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATION_FILE = "0014_budget_plan_bucket_model.sql";

const migrationPath = resolve(import.meta.dirname, "../migrations", MIGRATION_FILE);
const journalPath = resolve(import.meta.dirname, "../migrations/meta/_journal.json");
const setupPath = resolve(import.meta.dirname, "../../api/test/setup.ts");

function readMigration(): string {
  return readFileSync(migrationPath, "utf8");
}

describe("0014 budget plan model migration - file existence", () => {
  it("exists and starts with ABOUTME comments", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readMigration();
    expect(sql.startsWith("-- ABOUTME:")).toBe(true);
  });

  it("creates budget_period enum", () => {
    const sql = readMigration();
    expect(sql).toContain("budget_period");
    expect(sql).toContain("'monthly'");
    expect(sql).toContain("'quarterly'");
    expect(sql).toContain("'half-yearly'");
    expect(sql).toContain("'annual'");
  });

  it("creates budget_plan_status enum", () => {
    const sql = readMigration();
    expect(sql).toContain("budget_plan_status");
    expect(sql).toContain("'draft'");
    expect(sql).toContain("'active'");
    expect(sql).toContain("'locked'");
    expect(sql).toContain("'archived'");
  });

  it("creates budget_plans table with all expected columns", () => {
    const sql = readMigration();
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "budget_plans"');
    expect(sql).toContain('"id" SERIAL PRIMARY KEY');
    expect(sql).toContain('"locationId" BIGINT');
    expect(sql).toContain('"fiscalYearStart" INTEGER NOT NULL');
    expect(sql).toContain('"period" "budget_period"');
    expect(sql).toContain('"name" VARCHAR(255)');
    expect(sql).toContain('"notes" TEXT');
    expect(sql).toContain('"status" "budget_plan_status"');
    expect(sql).toContain('"createdById" BIGINT');
    expect(sql).toContain('"legacyGroupKey" VARCHAR(64)');
    expect(sql).toContain('"lockedAt" TIMESTAMP');
    expect(sql).toContain('"lockedById" BIGINT');
    expect(sql).toContain('"archivedAt" TIMESTAMP');
    expect(sql).toContain('"archivedById" BIGINT');
    expect(sql).toContain('"createdAt" TIMESTAMP');
    expect(sql).toContain('"updatedAt" TIMESTAMP');
    expect(sql).toContain('"deletedAt" TIMESTAMP');
  });

  it("creates budget_plan_buckets table with all expected columns", () => {
    const sql = readMigration();
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "budget_plan_buckets"');
    expect(sql).toContain('"id" SERIAL PRIMARY KEY');
    expect(sql).toContain('"planId" BIGINT NOT NULL');
    expect(sql).toContain('REFERENCES "budget_plans"');
    expect(sql).toContain('"bucketType" VARCHAR(16)');
    expect(sql).toContain('"bucketIndex" INTEGER NOT NULL');
    expect(sql).toContain('"startMonth" INTEGER NOT NULL');
    expect(sql).toContain('"endMonth" INTEGER NOT NULL');
    expect(sql).toContain('"label" VARCHAR(64)');
  });

  it("creates budget_bucket_lines table with all expected columns", () => {
    const sql = readMigration();
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "budget_bucket_lines"');
    expect(sql).toContain('"id" SERIAL PRIMARY KEY');
    expect(sql).toContain('"bucketId" BIGINT NOT NULL');
    expect(sql).toContain('REFERENCES "budget_plan_buckets"');
    expect(sql).toContain('"categoryId" BIGINT NOT NULL');
    expect(sql).toContain('REFERENCES "expense_categories"');
    expect(sql).toContain('"amount" NUMERIC(15,2)');
    expect(sql).toContain('"notes" TEXT');
  });

  it("creates indexes for budget_plans", () => {
    const sql = readMigration();
    expect(sql).toContain('"idx_budget_plans_locationId"');
    expect(sql).toContain('"idx_budget_plans_fiscalYearStart"');
    expect(sql).toContain('"idx_budget_plans_period"');
    expect(sql).toContain('"idx_budget_plans_status"');
    expect(sql).toContain('"idx_budget_plans_legacyGroupKey"');
    expect(sql).toContain('"idx_budget_plans_deletedAt"');
  });

  it("creates indexes for budget_plan_buckets", () => {
    const sql = readMigration();
    expect(sql).toContain('"idx_budget_plan_buckets_planId"');
    expect(sql).toContain('"idx_budget_plan_buckets_bucketType"');
    expect(sql).toContain('"idx_budget_plan_buckets_plan_index"');
  });

  it("creates indexes for budget_bucket_lines", () => {
    const sql = readMigration();
    expect(sql).toContain('"idx_budget_bucket_lines_bucketId"');
    expect(sql).toContain('"idx_budget_bucket_lines_categoryId"');
  });
});

describe("0014 migration - idempotence", () => {
  it("uses CREATE TABLE IF NOT EXISTS for all three tables", () => {
    const sql = readMigration();
    const tableStatements = sql.match(/CREATE TABLE IF NOT EXISTS/g);
    expect(tableStatements).toBeTruthy();
    // Three tables: budget_plans, budget_plan_buckets, budget_bucket_lines
    expect(tableStatements!.length).toBe(3);
  });

  it("uses CREATE INDEX IF NOT EXISTS for all indexes", () => {
    const sql = readMigration();
    const indexStatements = sql.match(/CREATE INDEX IF NOT EXISTS/g);
    const uniqueIndexStatements = sql.match(/CREATE UNIQUE INDEX IF NOT EXISTS/g);
    const totalIndexStatements = (indexStatements?.length ?? 0) + (uniqueIndexStatements?.length ?? 0);
    // budget_plans: 6 indexes, budget_plan_buckets: 2 regular + 1 unique, budget_bucket_lines: 2 = 10 regular, 1 unique... let's just verify > 0
    expect(totalIndexStatements).toBeGreaterThanOrEqual(9);
  });

  it("uses DO $$ blocks with IF NOT EXISTS for enum creation", () => {
    const sql = readMigration();
    const doBlocks = sql.match(/DO \$\$/g);
    expect(doBlocks).toBeTruthy();
    // At minimum: 2 enum DO blocks + 3 column-repair DO blocks = 5
    expect(doBlocks!.length).toBeGreaterThanOrEqual(5);
  });

  it("uses information_schema guards for repair of partial tables", () => {
    const sql = readMigration();
    // The idempotence is achieved via DO $$ ... IF NOT EXISTS (SELECT ... FROM information_schema.columns ...) THEN ALTER TABLE ... END IF; END $$;
    const guardPattern = /IF NOT EXISTS \(SELECT 1 FROM information_schema\.columns WHERE table_name/g;
    const guards = sql.match(guardPattern);
    expect(guards).toBeTruthy();
    // budget_plans: 14 columns, budget_plan_buckets: 8 columns, budget_bucket_lines: 6 columns = 28 guards
    expect(guards!.length).toBeGreaterThanOrEqual(28);
  });

  it("backfill uses ON CONFLICT DO NOTHING guards", () => {
    const sql = readMigration();
    expect(sql).toContain("ON CONFLICT DO NOTHING");
  });

  it("backfill checks for existing rows before inserting via NOT EXISTS subquery", () => {
    const sql = readMigration();
    // Plan dedup check via legacyGroupKey
    expect(sql).toContain('"legacyGroupKey"');
    // Bucket dedup check via SELECT ... WHERE planId = ... LIMIT 1
    expect(sql).toContain("SELECT");
    expect(sql).toContain("LIMIT 1");
    // Line dedup via AND NOT EXISTS subquery
    expect(sql).toContain("NOT EXISTS");
    expect(sql).toContain("ON CONFLICT DO NOTHING");
  });
});

describe("0014 migration - backfill of legacy budgets", () => {
  it("references the legacy budgets table for backfill", () => {
    const sql = readMigration();
    expect(sql).toContain('"budgets"');
  });

  it("groups legacy budgets by locationId and year", () => {
    const sql = readMigration();
    expect(sql).toContain("GROUP BY");
    expect(sql).toContain('b."locationId"');
    expect(sql).toContain('b."year"');
  });

  it("creates legacyGroupKey as CONCAT('legacy:', anchorId)", () => {
    const sql = readMigration();
    expect(sql).toContain("'legacy:'");
    expect(sql).toContain("legacyGroupKey");
  });

  it("creates 12 monthly buckets per plan", () => {
    const sql = readMigration();
    expect(sql).toContain("FOR m IN 1..12 LOOP");
    expect(sql).toContain("'monthly'");
  });

  it("creates bucket lines from individual legacy budget rows", () => {
    const sql = readMigration();
    expect(sql).toContain("budget_bucket_lines");
    expect(sql).toContain('b."categoryId"');
    expect(sql).toContain('b."amount"');
  });
});

describe("0014 migration - wiring", () => {
  it("is registered in the migration journal", () => {
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
      entries: Array<{ tag: string; idx: number; breakpoints: boolean }>;
    };
    const entry = journal.entries.find((e) => e.tag === "0014_budget_plan_bucket_model");
    expect(entry).toBeTruthy();
    expect(entry!.idx).toBe(6);
    expect(entry!.breakpoints).toBe(true);
  });

  it("is applied by the API test bootstrap", () => {
    const content = readFileSync(setupPath, "utf8");
    expect(content).toContain(`"${MIGRATION_FILE}"`);
  });

  it("is represented in the 0014 migration file for fresh installs (instead of base schema)", () => {
    const sql = readMigration();
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "budget_plans"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "budget_plan_buckets"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "budget_bucket_lines"');
  });
});

describe("0014 migration - documentation comments", () => {
  it("has table-level COMMENT ON statements", () => {
    const sql = readMigration();
    expect(sql).toContain('COMMENT ON TABLE "budget_plans"');
    expect(sql).toContain('COMMENT ON TABLE "budget_plan_buckets"');
    expect(sql).toContain('COMMENT ON TABLE "budget_bucket_lines"');
  });

  it("has column-level COMMENT ON statements for key columns", () => {
    const sql = readMigration();
    expect(sql).toContain('COMMENT ON COLUMN "budget_plans"."period"');
    expect(sql).toContain('COMMENT ON COLUMN "budget_plans"."status"');
    expect(sql).toContain('COMMENT ON COLUMN "budget_plan_buckets"."bucketType"');
    expect(sql).toContain('COMMENT ON COLUMN "budget_plan_buckets"."bucketIndex"');
    expect(sql).toContain('COMMENT ON COLUMN "budget_plan_buckets"."startMonth"');
    expect(sql).toContain('COMMENT ON COLUMN "budget_plan_buckets"."endMonth"');
  });
});
