// ABOUTME: Local diagnostic for Fina Connect reverse-complete path and schema.
// ABOUTME: Prints integration_connections columns and tries a dry-run style inspect.
import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

const cols = await pool.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'integration_connections'
  ORDER BY ordinal_position
`);
console.log("integration_connections columns:");
for (const r of cols.rows) console.log(" -", r.column_name, r.data_type);

const biz = await pool.query(`SELECT id, name FROM businesses WHERE "deletedAt" IS NULL ORDER BY id LIMIT 5`);
console.log("businesses:", biz.rows);

const conn = await pool.query(`SELECT id, "businessId", "targetSystem", "authMode", "isActive", "authData" IS NOT NULL AS has_auth, "webhookSecret" IS NOT NULL AS has_secret FROM integration_connections ORDER BY id DESC LIMIT 10`);
console.log("connections:", conn.rows);

const keys = await pool.query(`SELECT id, "businessId", name, "keyPrefix", "isActive" FROM api_keys WHERE name ILIKE '%connect%' OR name ILIKE '%FinaBill%' OR name ILIKE '%FinaFlow%' ORDER BY id DESC LIMIT 10`);
console.log("connect keys:", keys.rows);

// probe complete endpoint
try {
  const res = await fetch("http://localhost:3200/api/connect/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ partnerBusinessId: 0 }),
  });
  const text = await res.text();
  console.log("complete probe status", res.status, "body", text.slice(0, 300));
} catch (e) {
  console.log("complete probe failed", e);
}

try {
  const res = await fetch("http://localhost:3100/api/connect/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ partnerBusinessId: 0 }),
  });
  const text = await res.text();
  console.log("finabill complete probe status", res.status, "body", text.slice(0, 300));
} catch (e) {
  console.log("finabill complete probe failed", e);
}

await pool.end();
