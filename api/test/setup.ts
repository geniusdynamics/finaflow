// ABOUTME: Boots the isolated PostgreSQL test database and applies required SQL migrations for integration tests.
// ABOUTME: Keeps test setup idempotent by only loading migrations whose tables are still missing.
import { beforeAll, afterAll } from "vitest";
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

  try {
    await adminPool.query('CREATE DATABASE "finaflow_test"');
  } catch (error: any) {
    if (error?.code !== "42P04") {
      throw error;
    }
  } finally {
    await adminPool.end();
  }

  const testPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
  });

  try {
    const migrationFiles = [
      {
        tableName: "users",
        migrationPath: path.resolve(import.meta.dirname, "../../db/migrations/0000_magical_logan.sql"),
      },
      {
        tableName: "customer_accounts",
        migrationPath: path.resolve(import.meta.dirname, "../../db/migrations/0001_account_level_subscriptions.sql"),
      },
      {
        tableName: "customer_accounts",
        migrationPath: path.resolve(import.meta.dirname, "../../db/migrations/0002_add_user_type.sql"),
      },
    ];

    for (const { tableName, migrationPath } of migrationFiles) {
      if (await tableExists(testPool, tableName)) {
        continue;
      }

      let sql = fs.readFileSync(migrationPath, "utf8").replaceAll("--> statement-breakpoint", "");
      if (!migrationPath.includes("0002_add_user_type")) {
        sql = sql.replace(/CREATE TYPE\s+"public"\./g, 'CREATE TYPE IF NOT EXISTS "public".');
      }
      await testPool.query(sql);
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
});

afterAll(async () => {
  clearRateLimitStore();
  if (skipTestDatabaseBootstrap) {
    return;
  }
  const { closePool } = await import("../queries/connection");
  await closePool();
});
