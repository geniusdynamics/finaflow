// ABOUTME: Drops and recreates the finaflow_test database, then applies every SQL
// ABOUTME: migration in db/migrations/ in order. Idempotent — the only side effect is
// ABOUTME: the test database ends up with the full schema. Use this when the test
// ABOUTME: bootstrap is in a stale state and integration tests fail with missing-table
// ABOUTME: or missing-column errors that won't clear with a re-run.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

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
  let dollarTag: string | null = null; // active $tag$ opener
  let n = sql.length;

  const peek = (off: number) => sql[i + off];

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
        if (next === "'") {
          buf += "'";
          i += 2;
          continue;
        }
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
      // Looking for the matching $tag$ close.
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

    // Not in any quote/comment.
    if (ch === "-" && next === "-") {
      buf += "--";
      inLineComment = true;
      i += 2;
      continue;
    }
    if (ch === "/" && next === "*") {
      buf += "/*";
      inBlockComment = true;
      i += 2;
      continue;
    }
    if (ch === "'") {
      buf += ch;
      inSingleQuote = true;
      i++;
      continue;
    }
    if (ch === '"') {
      buf += ch;
      inDoubleQuote = true;
      i++;
      continue;
    }
    if (ch === "$") {
      // Try to read a $tag$ opener: $ followed by [A-Za-z_][A-Za-z0-9_]* then $.
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(sql[j])) j++;
      if (j < n && sql[j] === "$") {
        const tag = sql.slice(i, j + 1);
        buf += tag;
        dollarTag = tag;
        i = j + 1;
        continue;
      }
      // Not a dollar-quote opener, just a literal $.
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

async function main() {
  const targetDb = "finaflow_test";
  const adminPool = new pg.Pool({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    max: 1,
  });

  // Force-disconnect any active sessions, then drop the database.
  try {
    await adminPool.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [targetDb],
    );
    await adminPool.query(`DROP DATABASE IF EXISTS "${targetDb}"`);
    await adminPool.query(`CREATE DATABASE "${targetDb}"`);
    console.log(`✓ Dropped and recreated "${targetDb}"`);
  } finally {
    await adminPool.end();
  }

  const pool = new pg.Pool({
    connectionString: `postgresql://postgres:postgres@127.0.0.1:5432/${targetDb}`,
    max: 1,
  });

  try {
    const migrationsDir = path.resolve(import.meta.dirname, "../db/migrations");
    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    console.log(`Found ${files.length} migration files`);

    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      const raw = fs.readFileSync(fullPath, "utf8");
      // Strip drizzle's "breakpoint" markers and any DOWN migration section.
      const downMarker = "-- Drops all tables and enums created by this migration";
      let sql = raw.replaceAll("--> statement-breakpoint", "");
      const downIdx = sql.indexOf(downMarker);
      if (downIdx !== -1) sql = sql.slice(0, downIdx);
      const statements = splitSqlStatements(sql).filter((s) => s.length > 0);

      let applied = 0;
      for (const stmt of statements) {
        try {
          await pool.query(stmt);
          applied++;
        } catch (e) {
          console.error(`✗ ${file}: ${(e as Error).message}`);
          console.error(`  Statement: ${stmt.slice(0, 200)}${stmt.length > 200 ? "..." : ""}`);
          throw e;
        }
      }
      console.log(`✓ ${file} (${applied} statements)`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
