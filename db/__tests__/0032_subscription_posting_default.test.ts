// ABOUTME: File-content tests for the 0032 subscription posting default migration and its wiring.
// ABOUTME: Mirrors db/__tests__/0014_budget_plan_model_migration.test.ts (no DB required).
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATION_FILE = "0032_subscription_posting_default_bill.sql";
const migrationPath = resolve(import.meta.dirname, "../migrations", MIGRATION_FILE);
const journalPath = resolve(import.meta.dirname, "../migrations/meta/_journal.json");
const setupPath = resolve(import.meta.dirname, "../../api/test/setup.ts");
const schemaPath = resolve(import.meta.dirname, "../schema.ts");

function readMigration(): string {
  return readFileSync(migrationPath, "utf8");
}

describe("0032 subscription posting default migration", () => {
  it("exists, starts with ABOUTME comments and sets the bill default", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readMigration();
    expect(sql.startsWith("-- ABOUTME:")).toBe(true);
    expect(sql).toContain(`ALTER TABLE "subscriptions" ALTER COLUMN "postingMode" SET DEFAULT 'bill'`);
  });

  it("matches the schema default", () => {
    const schema = readFileSync(schemaPath, "utf8");
    expect(schema).toContain('subscriptionPostingEnum("postingMode").default("bill")');
  });

  it("is registered in the migration journal and applied by the test bootstrap", () => {
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: { idx: number; tag: string }[] };
    const entry = journal.entries.find((e) => e.tag === "0032_subscription_posting_default_bill");
    expect(entry).toBeDefined();
    const previous = journal.entries.find((e) => e.tag === "0031_subscription_management");
    if (previous) expect(entry!.idx).toBeGreaterThan(previous.idx);
    expect(journal.entries.filter((e) => e.idx === entry!.idx)).toHaveLength(1);
    expect(readFileSync(setupPath, "utf8")).toContain(`"${MIGRATION_FILE}"`);
  });
});
