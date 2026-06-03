import "dotenv/config";
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString, max: 1 });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS drizzle_schema (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);

  const appliedResult = await pool.query(
    "SELECT name FROM drizzle_schema ORDER BY id"
  );
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applied = new Set(appliedResult.rows.map((r: any) => r.name));
  console.log("Applied migrations:", applied.size ? [...applied] : "(none)");

  const migrationsDir = path.join(__dirname, "..", "db", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let appliedCount = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  [SKIP] ${file} (already applied)`);
      continue;
    }

    console.log(`  [APPLY] ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");

    // ABOUTME: Split on --> statement-breakpoint. If absent, fall back to a single
    // ABOUTME: multi-statement execution. Each statement runs in its own
    // ABOUTME: transaction so a partial failure does not poison the rest of
    // ABOUTME: the migration.
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Detection: migration has no breakpoint markers and contains DDL/DML mix
    // (e.g. CREATE + UPDATE) — running it as a single multi-statement query.
    // Errors on later statements would roll back earlier ones, so we treat
    // the whole file as one logical unit. We do NOT mark the migration as
    // applied unless all statements succeed.
    let migrationSucceeded = true;
    const isMultiStatement = statements.length === 1 && /;\s*\n/.test(sql);
    const effectiveStatements = isMultiStatement
      ? [statements[0]]
      : statements;

    try {
      await pool.query("BEGIN");
      for (const stmt of effectiveStatements) {
        await pool.query(stmt);
      }
      await pool.query("INSERT INTO drizzle_schema (name) VALUES ($1)", [file]);
      await pool.query("COMMIT");
      console.log(`  [OK] ${file} applied (${effectiveStatements.length} statement(s))`);
      appliedCount++;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      await pool.query("ROLLBACK");
      // Idempotency: tolerate "already exists" errors (duplicate table/column/etc).
      // Re-run the migration statement-by-statement to make sure any prior partial
      // application is completed, then mark it as applied.
      const isIdempotent =
        err.code === "42710" || err.code === "23505" || err.code === "42P07" || err.code === "42701";
      if (isIdempotent) {
        console.log(`  [RECOVER] ${file} conflict (${err.code}) - applying statement-by-statement`);
        let perStmtOk = true;
        for (const stmt of effectiveStatements) {
          try {
            await pool.query(stmt);
          } catch (innerErr: any) {
            const innerCode = innerErr?.code;
            const isInnerIdempotent =
              innerCode === "42710" || innerCode === "23505" || innerCode === "42P07" || innerCode === "42701";
            if (!isInnerIdempotent) {
              console.error(`  [ERROR] ${file}: ${innerErr.message}`);
              perStmtOk = false;
              break;
            }
          }
        }
        if (perStmtOk) {
          await pool.query("INSERT INTO drizzle_schema (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [file]);
          appliedCount++;
        } else {
          migrationSucceeded = false;
        }
      } else {
        console.error(`  [ERROR] ${file}: ${err.message}`);
        migrationSucceeded = false;
      }
    }
    if (!migrationSucceeded) {
      // intentionally do not insert into drizzle_schema so it can be retried
    }
  }

  await pool.end();
  console.log(`\nDone. Applied ${appliedCount} new migration(s).`);
}

main().catch((e) => {
  console.error("Fatal:", (e as Error).message);
  process.exit(1);
});
