import pg from "pg";
const pool = new pg.Pool({
  connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/finaflow",
});
try {
  const cols = await pool.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'suppliers' ORDER BY ordinal_position`
  );
  console.log("suppliers columns:");
  for (const c of cols.rows) {
    console.log(`  ${c.column_name} ${c.data_type} nullable=${c.is_nullable}`);
  }
  const count = await pool.query("SELECT COUNT(*) AS cnt FROM suppliers");
  console.log(`\nsuppliers row count: ${count.rows[0].cnt}`);

  const samp = await pool.query("SELECT id, name, \"businessId\", \"locationId\", \"deletedAt\" FROM suppliers LIMIT 3");
  console.log("sample:", JSON.stringify(samp.rows, null, 2));
} catch (e) {
  console.error(e.message);
}
await pool.end();
