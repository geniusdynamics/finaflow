// ABOUTME: File-content tests for the 0031 subscription management migration (tables, enums, indexes, wiring).
// ABOUTME: Mirrors the structure of db/__tests__/0014_budget_plan_model_migration.test.ts (no DB required).
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATION_FILE = "0031_subscription_management.sql";
const migrationPath = resolve(import.meta.dirname, "../migrations", MIGRATION_FILE);
const journalPath = resolve(import.meta.dirname, "../migrations/meta/_journal.json");
const setupPath = resolve(import.meta.dirname, "../../api/test/setup.ts");
const schemaPath = resolve(import.meta.dirname, "../schema.ts");

function readMigration(): string {
  return readFileSync(migrationPath, "utf8");
}

describe("0031 subscription management migration - file existence", () => {
  it("exists and starts with ABOUTME comments", () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(readMigration().startsWith("-- ABOUTME:")).toBe(true);
  });

  it("creates the subscriptions table with all expected columns", () => {
    const sql = readMigration();
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "subscriptions"');
    for (const col of [
      '"businessId" BIGINT NOT NULL',
      '"locationId" BIGINT',
      '"postingLocationId" BIGINT',
      '"name" VARCHAR(255) NOT NULL',
      '"vendorId" BIGINT',
      '"categoryId" BIGINT',
      '"amount" NUMERIC(15, 2) NOT NULL',
      '"cycleUnit" "subscription_cycle" NOT NULL',
      '"cycleCount" INTEGER NOT NULL DEFAULT 1',
      '"isOneTime" BOOLEAN NOT NULL DEFAULT false',
      '"nextDueDate" DATE NOT NULL',
      '"autoRenew" BOOLEAN NOT NULL DEFAULT false',
      '"status" "subscription_status" NOT NULL DEFAULT \'active\'',
      '"cancellationDate" DATE',
      '"cancelReason" VARCHAR(255)',
      '"replacedBySubscriptionId" BIGINT',
      '"trialEndsAt" DATE',
      '"postingMode" "subscription_posting" NOT NULL DEFAULT \'expense\'',
      '"externalSystem" VARCHAR(50)',
      '"externalId" VARCHAR(100)',
      '"notifyEnabled" BOOLEAN NOT NULL DEFAULT true',
      '"notifyDaysBefore" INTEGER',
    ]) {
      expect(sql, `missing column: ${col}`).toContain(col);
    }
  });

  it("creates the subscription_payments table with all expected columns", () => {
    const sql = readMigration();
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "subscription_payments"');
    for (const col of [
      '"subscriptionId" BIGINT NOT NULL',
      '"cycleDueDate" DATE NOT NULL',
      '"paidDate" DATE',
      '"confirmed" BOOLEAN NOT NULL DEFAULT true',
      '"expenseId" BIGINT',
      '"billId" BIGINT',
      '"journalEntryId" BIGINT',
      '"paymentMethod" "paymentMethod2"',
    ]) {
      expect(sql, `missing column: ${col}`).toContain(col);
    }
  });

  it("creates the three subscription enums with guarded DO blocks", () => {
    const sql = readMigration();
    expect(sql).toContain('CREATE TYPE "subscription_cycle" AS ENUM(\'day\', \'week\', \'month\', \'year\')');
    expect(sql).toContain('CREATE TYPE "subscription_status" AS ENUM(\'active\', \'paused\', \'cancelled\', \'expired\')');
    expect(sql).toContain('CREATE TYPE "subscription_posting" AS ENUM(\'none\', \'expense\', \'bill\')');
    const guards = sql.match(/EXCEPTION WHEN duplicate_object THEN NULL/g) ?? [];
    expect(guards.length).toBeGreaterThanOrEqual(3);
  });

  it("adds the subscription_paid notification clear reason idempotently", () => {
    const sql = readMigration();
    expect(sql).toContain(
      `ALTER TYPE "notification_cleared_reason" ADD VALUE IF NOT EXISTS 'subscription_paid'`,
    );
  });
});

describe("0031 migration - idempotence", () => {
  it("uses CREATE TABLE IF NOT EXISTS for both tables", () => {
    const sql = readMigration();
    const tables = sql.match(/CREATE TABLE IF NOT EXISTS/g) ?? [];
    expect(tables.length).toBe(2);
  });

  it("uses CREATE INDEX IF NOT EXISTS for every index", () => {
    const sql = readMigration();
    const creates = (sql.match(/CREATE (?:UNIQUE )?INDEX/g) ?? []).length;
    const ifNotExists = (sql.match(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS/g) ?? []).length;
    expect(creates).toBe(ifNotExists);
    expect(ifNotExists).toBeGreaterThanOrEqual(8);
  });

  it("guards the self-FK constraint behind a pg_constraint check", () => {
    const sql = readMigration();
    expect(sql).toContain("subscriptions_replaced_by_fk");
    expect(sql).toContain("pg_constraint");
    expect(sql).toContain('FOREIGN KEY ("replacedBySubscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL');
  });

  it("declares the unique partial cycle guard on subscription_payments", () => {
    const sql = readMigration();
    expect(sql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "uq_sub_payments_cycle" ON "subscription_payments" ("subscriptionId", "cycleDueDate") WHERE "deletedAt" IS NULL',
    );
    expect(sql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "uq_subscriptions_business_external" ON "subscriptions" ("businessId", "externalSystem", "externalId") WHERE "externalId" IS NOT NULL AND "deletedAt" IS NULL',
    );
  });
});

describe("0031 migration - role_permissions merge", () => {
  it("grants all three subscription permissions to owner/admin/manager rows", () => {
    const sql = readMigration();
    expect(sql).toContain("subscriptions:view");
    expect(sql).toContain("subscriptions:manage");
    expect(sql).toContain("subscriptions:pay");
    expect(sql).toContain("IN ('owner', 'admin', 'manager')");
  });

  it("grants viewer read-only access and never touches employee rows", () => {
    const sql = readMigration();
    expect(sql).toContain("AND \"roleKey\" = 'viewer'");
    expect(sql).not.toContain("'employee'");
  });

  it("is idempotent (guarded by @> key-permission checks)", () => {
    const sql = readMigration();
    expect(sql).toContain('@> \'["subscriptions:manage"]\'');
    expect(sql).toContain('@> \'["subscriptions:view"]\'');
  });
});

describe("0031 migration - wiring", () => {
  it("is registered in the migration journal", () => {
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
      entries: { idx: number; tag: string }[];
    };
    const entry = journal.entries.find((e) => e.tag === "0031_subscription_management");
    expect(entry).toBeDefined();
    const maxIdx = Math.max(...journal.entries.map((e) => e.idx));
    expect(entry!.idx).toBe(maxIdx);
  });

  it("is applied by the API test bootstrap", () => {
    const setup = readFileSync(setupPath, "utf8");
    expect(setup).toContain(`"${MIGRATION_FILE}"`);
  });

  it("is picked up by runtime migration runner (filename ordering after 0030)", () => {
    expect(MIGRATION_FILE > "0030_finabill_sync_expansion.sql").toBe(true);
  });

  it("matches the db/schema.ts enum and table definitions", () => {
    const schema = readFileSync(schemaPath, "utf8");
    expect(schema).toContain('pgEnum("subscription_cycle"');
    expect(schema).toContain('pgEnum("subscription_status"');
    expect(schema).toContain('pgEnum("subscription_posting"');
    expect(schema).toContain('pgTable("subscriptions"');
    expect(schema).toContain('pgTable("subscription_payments"');
    expect(schema).toContain('"subscription_paid"');
  });
});
