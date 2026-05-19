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
      "../../db/migrations/0000_flawless_jack_murdock.sql",
    );
    if (!(await tableExists(testPool, "users"))) {
      let sql = fs.readFileSync(baseSchemaPath, "utf8");
      // Strip the DOWN migration section (everything from the "Drops all tables" comment onward)
      const downMarker = "-- Drops all tables and enums created by this migration";
      const downIdx = sql.indexOf(downMarker);
      if (downIdx !== -1) {
        sql = sql.slice(0, downIdx);
      }
      sql = sql.replaceAll("--> statement-breakpoint", "");
      const statements = sql.split(";").filter((s) => s.trim());
      for (const stmt of statements) {
        try {
          await testPool.query(stmt);
        } catch {
          // Individual DDL statements may fail if already applied;
          // continue with the next statement for idempotent setup.
        }
      }
    }

    const constraintsPath = path.resolve(
      import.meta.dirname,
      "../../db/migrations/0001_gifted_secret_warriors.sql",
    );
    let constraintSql = fs.readFileSync(constraintsPath, "utf8").replaceAll("--> statement-breakpoint", "");
    const constraintStatements = constraintSql.split(";").filter((s) => s.trim());
    for (const stmt of constraintStatements) {
      try {
        await testPool.query(stmt);
      } catch {
        // Individual FK constraints may already exist;
        // continue with the next statement for idempotent setup.
      }
    }

    const migration2Path = path.resolve(
      import.meta.dirname,
      "../../db/migrations/0002_soft_flamingo.sql",
    );
    let migration2Sql = fs.readFileSync(migration2Path, "utf8").replaceAll("--> statement-breakpoint", "");
    const migration2Statements = migration2Sql.split(";").filter((s) => s.trim());
    for (const stmt of migration2Statements) {
      try {
        await testPool.query(stmt);
      } catch {
        // Individual DDL statements may already exist;
        // continue with the next statement for idempotent setup.
      }
    }
  } finally {
    await testPool.end();
  }
}

beforeAll(async () => {
  clearRateLimitStore();
  if (skipTestDatabaseBootstrap) {
    return;
  }
  await ensureTestDatabase();
}, BOOTSTRAP_TIMEOUT);

// Pool is not explicitly closed here because this is a shared setup file loaded for every test suite.
// Closing the singleton pool in afterAll while other suites are still running causes connection errors.
// Connections are cleaned up when the Node process exits after all tests complete.
