import pg from "pg";
import fs from "fs";
import path from "path";

const pool = new pg.Pool({
  connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/finaflow",
});

async function runSqlFile(filePath) {
  const sql = fs.readFileSync(filePath, "utf8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`\n=== Applying: ${path.basename(filePath)} ===`);
  console.log(`Found ${statements.length} statements`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      const preview = stmt.substring(0, 80).replace(/\n/g, " ");
      await pool.query(stmt);
      console.log(`[${i + 1}/${statements.length}] OK`);
    } catch (err) {
      console.error(`[${i + 1}/${statements.length}] ERROR: ${err.message}`);
    }
  }
}

try {
  const migrationDir = path.resolve("db/migrations");

  // Apply the idempotent migration FIRST (creates customer_accounts + backfill)
  await runSqlFile(path.join(migrationDir, "0001_account_level_subscriptions.sql"));

  // Apply the generated migration SECOND (creates business_logos + FK constraints)
  await runSqlFile(path.join(migrationDir, "0001_odd_susan_delgado.sql"));

  // Verify
  const tables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  console.log("\n=== Tables after migration ===");
  console.log(tables.rows.map(r => r.table_name).join(", "));

  const ca = await pool.query(
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'customer_accounts') AS e"
  );
  console.log("\ncustomer_accounts exists:", ca.rows[0].e);

  const bl = await pool.query(
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'business_logos') AS e"
  );
  console.log("business_logos exists:", bl.rows[0].e);

  const ba = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'businesses' ORDER BY ordinal_position`
  );
  console.log("businesses columns:", ba.rows.map(r => r.column_name).join(", "));

  const ua = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`
  );
  console.log("users columns:", ua.rows.map(r => r.column_name).join(", "));

  const count = await pool.query("SELECT COUNT(*) AS cnt FROM customer_accounts");
  console.log("\ncustomer_accounts rows:", count.rows[0].cnt);

} catch (e) {
  console.error("Fatal:", e.message);
}
await pool.end();
