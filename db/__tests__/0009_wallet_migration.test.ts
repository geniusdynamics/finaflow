// ABOUTME: Sanity tests for the wallet data-quality migration 0009.
// ABOUTME: Verifies the migration file is well-formed, contains the partial-index conversion, and backfills all expected columns.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const MIGRATION_PATH = join(
  process.cwd(),
  "db",
  "migrations",
  "0009_wallet_data_quality_and_partial_unique.sql",
);

describe("Migration 0009 - wallet data quality + partial unique index", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf-8");

  it("starts with ABOUTME comments", () => {
    expect(sql).toMatch(/^-- ABOUTME:/);
  });

  it("converts idx_wallet_txn_provider_txn to a partial unique index", () => {
    expect(sql).toMatch(/DROP INDEX "idx_wallet_txn_provider_txn"/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX "idx_wallet_txn_provider_txn"/);
    expect(sql).toMatch(/WHERE "deletedAt" IS NULL/);
  });

  it("backfills description for NULL rows", () => {
    expect(sql).toMatch(/UPDATE "mobile_wallet_transactions"\s*SET "description"/);
    expect(sql).toMatch(/WHERE "description" IS NULL/);
  });

  it("backfills partyName for NULL rows", () => {
    expect(sql).toMatch(/SET "partyName"/);
    expect(sql).toMatch(/WHERE "partyName" IS NULL/);
  });

  it("normalizes direction from amount sign", () => {
    expect(sql).toMatch(/"direction" = CASE WHEN "amount" >= 0 THEN 'in' ELSE 'out' END/);
  });

  it("stores amount as absolute value", () => {
    expect(sql).toMatch(/SET "amount" = ABS\("amount"\)/);
  });

  it("backfills txnType, currency, txnFee, base_currency defensively", () => {
    expect(sql).toMatch(/"txn_type" = 'transfer'/);
    expect(sql).toMatch(/"currency" = 'KES'/);
    expect(sql).toMatch(/"txnFee" = '0\.00'/);
    expect(sql).toMatch(/"base_currency" = "currency"/);
  });

  it("is idempotent (uses IF EXISTS / IF NOT EXISTS / DO $$ guards)", () => {
    expect(sql).toMatch(/IF EXISTS/);
    expect(sql).toMatch(/IF NOT EXISTS/);
    expect(sql).toMatch(/DO \$\$ BEGIN/);
  });

  it("mentions mobile_wallet_transactions by exact table name", () => {
    expect(sql).toContain('"mobile_wallet_transactions"');
  });
});

describe("scripts/fix-mobile-wallet-transactions.ts", () => {
  const ts = readFileSync(
    join(process.cwd(), "scripts", "fix-mobile-wallet-transactions.ts"),
    "utf-8",
  );

  it("starts with ABOUTME comments", () => {
    expect(ts).toMatch(/^\/\/ ABOUTME:/);
  });

  it("uses dotenv/config and pg Pool", () => {
    expect(ts).toContain('import "dotenv/config"');
    expect(ts).toContain('import { Pool } from "pg"');
  });

  it("defaults to dry-run (PURGE_SOFT_DELETED = false)", () => {
    expect(ts).toMatch(/const PURGE_SOFT_DELETED = false/);
  });

  it("checks for the partial unique index", () => {
    expect(ts).toContain("idx_wallet_txn_provider_txn");
    expect(ts).toContain("PARTIAL");
  });

  it("audits null data fields after migration 0009", () => {
    expect(ts).toContain("Null-data audit");
    expect(ts).toContain('"description" IS NULL');
    expect(ts).toContain('"partyName" IS NULL');
  });

  it("releases client and ends pool in a finally block", () => {
    expect(ts).toContain("client.release()");
    expect(ts).toContain("pool.end()");
  });
});

describe("Dockerfile and package.json wiring", () => {
  const dockerfile = readFileSync(join(process.cwd(), "Dockerfile"), "utf-8");
  const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"));

  it("Dockerfile copies the new fix script into the runner image", () => {
    expect(dockerfile).toContain("fix-mobile-wallet-transactions.ts");
  });

  it("Dockerfile CMD chain runs the new fix script after AP fix and before app boot", () => {
    const cmdMatch = dockerfile.match(/CMD \[\s*"sh",\s*"-c",\s*"([^"]+)"\s*\]/);
    expect(cmdMatch).toBeTruthy();
    const chain = cmdMatch![1];
    const apIdx = chain.indexOf("fix-duplicate-ap-accounts.ts");
    const walletIdx = chain.indexOf("fix-mobile-wallet-transactions.ts");
    const bootIdx = chain.indexOf("node dist/boot.js");
    expect(apIdx).toBeGreaterThan(-1);
    expect(walletIdx).toBeGreaterThan(apIdx);
    expect(bootIdx).toBeGreaterThan(walletIdx);
  });

  it("package.json exposes db:fix:wallet script", () => {
    expect(pkg.scripts["db:fix:wallet"]).toBe("tsx scripts/fix-mobile-wallet-transactions.ts");
  });
});

describe("Journal entry for migration 0009", () => {
  const journal = JSON.parse(
    readFileSync(join(process.cwd(), "db", "migrations", "meta", "_journal.json"), "utf-8"),
  );

  it("contains an entry for tag 0009_wallet_data_quality_and_partial_unique", () => {
    const entry = journal.entries.find(
      (e: { tag: string }) => e.tag === "0009_wallet_data_quality_and_partial_unique",
    );
    expect(entry).toBeTruthy();
    expect(entry.idx).toBe(3);
    expect(entry.breakpoints).toBe(true);
  });
});
