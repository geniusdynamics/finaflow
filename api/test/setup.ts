// ABOUTME: Boots the isolated PostgreSQL test database and applies required SQL migrations for integration tests.
// ABOUTME: Keeps test setup idempotent by only loading migrations whose tables are still missing.
import { beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.APP_ID = "test-app";
process.env.APP_SECRET = "test-secret-key-not-for-production";
process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/finaflow_test";

process.env.NHIF_RATE = "2.75";
process.env.BCRYPT_ROUNDS = "4";

import { clearRateLimitStore } from "../lib/rate-limit";
import { walletRegistry } from "../lib/mobile-wallet/provider-registry";
import { mpesaProvider } from "../lib/mobile-wallet/providers/mpesa-provider";
import { airtelMoneyProvider } from "../lib/mobile-wallet/providers/airtel-money-provider";

const skipTestDatabaseBootstrap = process.env.SKIP_API_TEST_DB === "1";

// Increase timeout for database bootstrapping since it involves DDL operations
const BOOTSTRAP_TIMEOUT = 60_000;

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
    } catch {
      // Individual DDL statements may fail if already applied;
      // continue with the next statement for idempotent setup.
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
    const baseSchemaPath = path.resolve(
      import.meta.dirname,
      "../../db/migrations/0000_outgoing_christian_walker.sql",
    );
    if (!(await tableExists(testPool, "users"))) {
      await applyMigrationFile(testPool, baseSchemaPath);
    }

    for (const file of [
      "0001_misty_mulholland_black.sql",
      "0002_add_currency_columns.sql",
      "0004_add_wallet_account_type.sql",
      "0010_debt_origination_and_accounting.sql",
      "0011_coa_auto_link_and_wallet_support.sql",
      "0012_notification_highlight_lifecycle.sql",
      "0013_user_locations.sql",
    ]) {
      const p = path.resolve(import.meta.dirname, `../../db/migrations/${file}`);
      if (fs.existsSync(p)) {
        await applyMigrationFile(testPool, p);
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
  await ensureTestDatabase();
}, BOOTSTRAP_TIMEOUT);

// Pool is not explicitly closed here because this is a shared setup file loaded for every test suite.
// Closing the singleton pool in afterAll while other suites are still running causes connection errors.
// Connections are cleaned up when the Node process exits after all tests complete.
