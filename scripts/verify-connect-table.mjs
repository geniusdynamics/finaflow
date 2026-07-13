// ABOUTME: One-off local helper to verify FinaFlow connect-session table exists.
// ABOUTME: Prints table name and columns for integration_connect_sessions.
import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const r = await pool.query(
  "SELECT to_regclass('public.integration_connect_sessions') AS t"
);
console.log("table:", r.rows[0].t);
const c = await pool.query(
  `SELECT column_name
   FROM information_schema.columns
   WHERE table_name = 'integration_connect_sessions'
   ORDER BY ordinal_position`
);
console.log("columns:", c.rows.map((x) => x.column_name).join(", "));
await pool.end();
