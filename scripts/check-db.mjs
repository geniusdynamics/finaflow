import pg from "pg";
const pool = new pg.Pool({
  connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/finaflow",
});
try {
  const ta = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  console.log("Tables:", ta.rows.map(r => r.table_name).join(", "));

  const ca = await pool.query(
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'customer_accounts') AS e"
  );
  console.log("customer_accounts exists:", ca.rows[0].e);

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

  const bizData = await pool.query(
    `SELECT id, "accountId", "accountRefId", plan, "subscriptionStatus", name FROM businesses WHERE "deletedAt" IS NULL LIMIT 3`
  );
  console.log("Existing businesses:", JSON.stringify(bizData.rows, null, 2));

  const userData = await pool.query(
    `SELECT id, username, "accountId", "accountRefId", "currentBusinessId" FROM users WHERE "deletedAt" IS NULL LIMIT 3`
  );
  console.log("Existing users:", JSON.stringify(userData.rows, null, 2));
} catch (e) {
  console.error("Error:", e.message);
}
await pool.end();
