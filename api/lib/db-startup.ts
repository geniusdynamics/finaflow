// ABOUTME: Applies pending SQL migrations and validates required accounting schema before serving traffic.
// ABOUTME: Prevents stale databases from causing blank modules and failed financial reports at runtime.
import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

import { formatSchemaIssues, hasBlockingSchemaIssues, inspectRequiredSchemaColumns } from "./schema-readiness";

function resolveMigrationsDir(): string {
  const envDir = process.env.MIGRATIONS_DIR;
  if (envDir && fs.existsSync(envDir)) return envDir;

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const fromApiLib = path.resolve(__dirname, "../../db/migrations");
  const fromDist = path.resolve(__dirname, "../db/migrations");

  if (fs.existsSync(fromApiLib)) return fromApiLib;
  if (fs.existsSync(fromDist)) return fromDist;

  return fromApiLib;
}

const migrationsDir = resolveMigrationsDir();

function splitSqlStatements(sql: string): string[] {
  const stmts: string[] = [];
  let current = "";
  let inDollar = false;
  let dollarTag = "";
  let inQuote = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = i + 1 < sql.length ? sql[i + 1] : "";

    if (!inDollar && !inQuote && ch === "'" && next === "'") {
      current += ch + next;
      i++;
      continue;
    }

    if (!inDollar && !inQuote && ch === "'") {
      inQuote = !inQuote;
      current += ch;
      continue;
    }

    if (inQuote) {
      if (ch === "'" && !inDollar) {
        inQuote = false;
      }
      current += ch;
      continue;
    }

    if (ch === "$" && next === "$") {
      if (!inDollar) {
        inDollar = true;
        dollarTag = "";
        current += "$$";
        i++;
        continue;
      } else {
        inDollar = false;
        dollarTag = "";
        current += "$$";
        i++;
        continue;
      }
    }

    if (inDollar) {
      current += ch;
      if (dollarTag.length < 64) dollarTag += ch;
      if (dollarTag === "$$" || (dollarTag.startsWith("$") && dollarTag.endsWith("$") && dollarTag.length > 2)) {
        dollarTag = "";
      }
      continue;
    }

    if (ch === "-" && next === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      current += "\n";
      continue;
    }

    if (ch === ";" && !inDollar && !inQuote) {
      stmts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }

  const remaining = current.trim();
  if (remaining) {
    stmts.push(remaining);
  }

  return stmts.filter(Boolean);
}

async function ensureMigrationTable(pool: pg.Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drizzle_schema (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function runPendingMigrations(pool: pg.Pool) {
  await ensureMigrationTable(pool);

  const appliedResult = await pool.query<{ name: string }>("SELECT name FROM drizzle_schema ORDER BY id");
  const applied = new Set(appliedResult.rows.map((row) => row.name));
  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sqlText = fs.readFileSync(path.join(migrationsDir, file), "utf8");

    const statements = splitSqlStatements(sqlText);

    try {
      for (const stmt of statements) {
        if (stmt.trim()) {
          try {
            await pool.query(stmt);
          } catch (stmtError: any) {
            if (
              stmtError?.code === "42710" ||
              stmtError?.code === "23505" ||
              stmtError?.code === "42P07" ||
              stmtError?.code === "42701"
            ) {
              continue;
            }
            throw stmtError;
          }
        }
      }
      await pool.query("INSERT INTO drizzle_schema (name) VALUES ($1)", [file]);
      console.log(`[db] applied migration ${file}`);
    } catch (error: any) {
      if (error?.code === "42710" || error?.code === "23505" || error?.code === "42P07" || error?.code === "42701") {
        console.log(`[db] migration ${file} already exists; marking as applied`);
        await pool.query("INSERT INTO drizzle_schema (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [file]);
      } else {
        throw error;
      }
    }
  }
}

let startupPromise: Promise<void> | null = null;

export async function ensureDatabaseReady(connectionString: string): Promise<void> {
  if (!startupPromise) {
    startupPromise = (async () => {
      const pool = new pg.Pool({ connectionString, max: 1 });

      try {
        if (process.env.AUTO_RUN_MIGRATIONS !== "0") {
          await runPendingMigrations(pool);
        }

        const report = await inspectRequiredSchemaColumns(pool);
        if (hasBlockingSchemaIssues(report)) {
          throw new Error(`Database schema is missing required columns: ${formatSchemaIssues(report)}`);
        }
      } finally {
        await pool.end();
      }
    })();
  }

  return startupPromise;
}
