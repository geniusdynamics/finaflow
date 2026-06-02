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

    try {
      await pool.query("BEGIN");
      await pool.query(sql);
      await pool.query("INSERT INTO drizzle_schema (name) VALUES ($1)", [file]);
      await pool.query("COMMIT");
      console.log(`  [OK] ${file} applied`);
      appliedCount++;
    } catch (err: any) {
      await pool.query("ROLLBACK");
      if (err.code === "42710" || err.code === "23505" || err.code === "42P07" || err.code === "42701") {
        console.log(`  [OK] ${file} already applied (conflict caught)`);
        await pool.query("INSERT INTO drizzle_schema (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [file]);
        appliedCount++;
      } else {
        console.error(`  [ERROR] ${file}: ${err.message}`);
      }
    }
  }

  await pool.end();
  console.log(`\nDone. Applied ${appliedCount} new migration(s).`);
}

main().catch((e) => {
  console.error("Fatal:", (e as Error).message);
  process.exit(1);
});
