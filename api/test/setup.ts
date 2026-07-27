// ABOUTME: Boots the isolated PostgreSQL test database and applies required SQL migrations for integration tests.
// ABOUTME: Runs once per process, applies migrations idempotently, and never wipes shared seed data between suites.
import { beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

// Set test environment variables before any app modules resolve DATABASE_URL.
// Always pin to the dedicated test DB (override Vite/.env DATABASE_URL which
// often points at the developer `finaflow` database). CI uses the same URL.
process.env.NODE_ENV = "test";
process.env.APP_ID = process.env.APP_ID || "test-app";
process.env.APP_SECRET = process.env.APP_SECRET || "test-secret-key-not-for-production";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:5432/finaflow_test";

process.env.NHIF_RATE = "2.75";
process.env.BCRYPT_ROUNDS = "4";

import { clearRateLimitStore } from "../lib/rate-limit";
import { walletRegistry } from "../lib/mobile-wallet/provider-registry";
import { mpesaProvider } from "../lib/mobile-wallet/providers/mpesa-provider";
import { airtelMoneyProvider } from "../lib/mobile-wallet/providers/airtel-money-provider";

const skipTestDatabaseBootstrap = process.env.SKIP_API_TEST_DB === "1";

// Increase timeout for database bootstrapping since it involves DDL operations
const BOOTSTRAP_TIMEOUT = 120_000;

// setupFiles run once per worker process. Guard so repeated beforeAll hooks
// (and accidental multi-worker configs) do not re-apply destructive DDL.
let bootstrapPromise: Promise<void> | null = null;

async function tableExists(testPool: pg.Pool, tableName: string): Promise<boolean> {
  const result = await testPool.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS "exists"
    `,
    [tableName],
  );

  return Boolean(result.rows[0]?.exists);
}

/**
 * Split a SQL file into individual statements while respecting PostgreSQL syntax:
 *  - `--` line comments
 *  - `/* ... *​/` block comments
 *  - `'...'` single-quoted strings (with `''` escape)
 *  - `$$ ... $$` dollar-quoted strings (any tag, including `$tag$ ... $tag$`)
 *  - `"..."` double-quoted identifiers
 *  - `;` outside any of the above ends a statement
 */
function splitSqlStatements(sql: string): string[] {
  const stmts: string[] = [];
  let buf = "";
  let i = 0;
  let inLineComment = false;
  let inBlockComment = false;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let dollarTag: string | null = null;
  const n = sql.length;

  while (i < n) {
    const ch = sql[i];
    const next = i + 1 < n ? sql[i + 1] : "";

    if (inLineComment) {
      buf += ch;
      if (ch === "\n") inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      buf += ch;
      if (ch === "*" && next === "/") {
        buf += "/";
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (inSingleQuote) {
      buf += ch;
      if (ch === "'") {
        if (next === "'") { buf += "'"; i += 2; continue; }
        inSingleQuote = false;
      }
      i++;
      continue;
    }
    if (inDoubleQuote) {
      buf += ch;
      if (ch === '"') inDoubleQuote = false;
      i++;
      continue;
    }
    if (dollarTag !== null) {
      if (sql.startsWith(dollarTag, i)) {
        buf += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      buf += ch;
      i++;
      continue;
    }
    if (ch === "-" && next === "-") { buf += "--"; inLineComment = true; i += 2; continue; }
    if (ch === "/" && next === "*") { buf += "/*"; inBlockComment = true; i += 2; continue; }
    if (ch === "'") { buf += ch; inSingleQuote = true; i++; continue; }
    if (ch === '"') { buf += ch; inDoubleQuote = true; i++; continue; }
    if (ch === "$") {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(sql[j])) j++;
      if (j < n && sql[j] === "$") {
        const tag = sql.slice(i, j + 1);
        buf += tag;
        dollarTag = tag;
        i = j + 1;
        continue;
      }
      buf += ch;
      i++;
      continue;
    }
    if (ch === ";") {
      const trimmed = buf.trim();
      if (trimmed.length > 0) stmts.push(trimmed);
      buf = "";
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  const tail = buf.trim();
  if (tail.length > 0) stmts.push(tail);
  return stmts;
}

async function applyMigrationFile(testPool: pg.Pool, filePath: string): Promise<void> {
  let sql = fs.readFileSync(filePath, "utf8");
  const downMarker = "-- Drops all tables and enums created by this migration";
  const downIdx = sql.indexOf(downMarker);
  if (downIdx !== -1) sql = sql.slice(0, downIdx);
  sql = sql.replaceAll("--> statement-breakpoint", "");
  const statements = splitSqlStatements(sql).filter((s) => s.length > 0);
  for (const stmt of statements) {
    try {
      await testPool.query(stmt);
    } catch (error: unknown) {
      // Idempotent DDL/seed may fail when re-applied on an existing test DB.
      // Ignore known already-applied conflicts; rethrow everything else so real
      // schema breakage still fails the suite instead of being swallowed.
      const err = error as { code?: string; message?: string };
      const msg = (err.message ?? "").toLowerCase();
      const ignorable =
        err.code === "42P07" || // duplicate_table
        err.code === "42710" || // duplicate_object
        err.code === "42P16" || // invalid_table_definition (already exists variants)
        err.code === "42701" || // duplicate_column
        err.code === "42723" || // duplicate_function
        err.code === "23505" || // unique_violation (seed/backfill re-run)
        err.code === "23503" || // foreign_key_violation on optional seed rows
        msg.includes("already exists") ||
        msg.includes("duplicate key");
      if (!ignorable) {
        throw new Error(
          `Migration ${path.basename(filePath)} failed: ${err.message ?? String(error)}`,
        );
      }
    }
  }
}

async function ensureTestDatabase(): Promise<void> {
  const adminPool = new pg.Pool({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    max: 1,
  });

  // Attempt to create the database. Multiple test files may race here
  // in parallel test runs, so we gracefully handle both the standard
  // "42P04" (duplicate_database) and any "duplicate key" errors.
  try {
    await adminPool.query('CREATE DATABASE "finaflow_test"');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const msg = (error?.message ?? "").toLowerCase();
    const isDupDb = error?.code === "42P04" || msg.includes("already exists") || msg.includes("duplicate key");
    if (!isDupDb) {
      throw error;
    }
  }
  await adminPool.end();

  const testPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
  });

  try {
    // Never TRUNCATE/DROP shared tables here. setupFiles can run once per worker,
    // and wiping locations/budget tables races with other suites' beforeAll seeds
    // (integration-finabill location lookups, budgets-router inserts, etc.).
    // Migrations below are idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

    const baseSchemaPath = path.resolve(
      import.meta.dirname,
      "../../db/migrations/0000_outgoing_christian_walker.sql",
    );
    if (!(await tableExists(testPool, "users"))) {
      await applyMigrationFile(testPool, baseSchemaPath);
    }

    // Only rebuild budget plan tables when the 0014 schema is incomplete.
    // Unconditional DROP raced with parallel suites and left budgets-router
    // failing with "relation budget_plan_buckets does not exist".
    const budgetSchemaReady =
      (await tableExists(testPool, "budget_plans")) &&
      (await tableExists(testPool, "budget_plan_buckets")) &&
      (await tableExists(testPool, "budget_bucket_lines"));
    if (!budgetSchemaReady) {
      await testPool.query(`DROP TABLE IF EXISTS "budget_bucket_lines" CASCADE`);
      await testPool.query(`DROP TABLE IF EXISTS "budget_plan_buckets" CASCADE`);
      await testPool.query(`DROP TABLE IF EXISTS "budget_plans" CASCADE`);
    }

    for (const file of [
      "0001_misty_mulholland_black.sql",
      "0002_add_currency_columns.sql",
      "0004_add_wallet_account_type.sql",
      "0010_debt_origination_and_accounting.sql",
      "0011_coa_auto_link_and_wallet_support.sql",
      "0012_notification_highlight_lifecycle.sql",
      "0013_user_locations.sql",
      "0014_budget_plan_bucket_model.sql",
      "0015_fiscal_year_start_month.sql",
      "0016_make_default_account_id_nullable.sql",
      "0017_add_bills_entered_by.sql",
      "0018_user_sessions.sql",
      "0019_user_sessions_cascade.sql",
      "0020_password_reset_tokens.sql",
      "0021_email_logs.sql",
      "0022_owner_broadcasts.sql",
      "0023_notification_priority_and_links.sql",
      "0016_fresh_impossible_man.sql",
      "0018_silent_lorna_dane.sql",
      "0024_api_keys_expires_at.sql",
      "0025_integration_connections_and_channel_maps.sql",
      "0026_fina_connect_sessions.sql",
      "0027_fina_connect_target_business.sql",
      "0028_wallet_reconciliation_tenant_scope.sql",
      "0029_partner_leads.sql",
      "0030_finabill_sync_expansion.sql",
    ]) {
      const p = path.resolve(import.meta.dirname, `../../db/migrations/${file}`);
      if (fs.existsSync(p)) {
        await applyMigrationFile(testPool, p);
      }
    }

    // Fail fast if the budget plan model is still missing after migrations.
    for (const requiredTable of [
      "budget_plans",
      "budget_plan_buckets",
      "budget_bucket_lines",
    ]) {
      if (!(await tableExists(testPool, requiredTable))) {
        throw new Error(
          `Test DB bootstrap incomplete: required table "${requiredTable}" is missing after migrations`,
        );
      }
    }
  } finally {
    await testPool.end();
  }
}

beforeAll(async () => {
  clearRateLimitStore();
  if (walletRegistry.getAll().length === 0) {
    walletRegistry.register(mpesaProvider);
    walletRegistry.register(airtelMoneyProvider);
  }
  if (skipTestDatabaseBootstrap) {
    return;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      // Retry bootstrap once if a transient connection race occurs.
      let lastError: unknown;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await ensureTestDatabase();
          return;
        } catch (error) {
          lastError = error;
          if (attempt === 1) {
            console.warn(
              "Test database bootstrap failed, retrying once:",
              (error as Error)?.message,
            );
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      }
      // Allow a later suite to retry bootstrap if this process-level attempt failed.
      bootstrapPromise = null;
      throw lastError;
    })();
  }

  await bootstrapPromise;
}, BOOTSTRAP_TIMEOUT);

// Pool is not explicitly closed here because this is a shared setup file loaded for every test suite.
// Closing the singleton pool in afterAll while other suites are still running causes connection errors.
// Connections are cleaned up when the Node process exits after all tests complete.

