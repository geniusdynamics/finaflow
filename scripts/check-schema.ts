import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkSchema() {
  const client = await pool.connect();
  
  try {
    // Get column info
    const cols = await client.query(`
      SELECT column_name, data_type, udt_name, column_default
      FROM information_schema.columns 
      WHERE table_name = 'expense_categories'
      ORDER BY ordinal_position
    `);
    
    console.log("expense_categories columns:");
    cols.rows.forEach(r => {
      console.log(`  ${r.column_name}: ${r.data_type} (${r.udt_name}) default: ${r.column_default}`);
    });
    
    // Check current values
    const cats = await client.query(`SELECT id, name, accountingclass FROM expense_categories LIMIT 10`);
    console.log("\nCurrent categories:");
    cats.rows.forEach(r => {
      console.log(`  ${r.name}: "${r.accountingclass}"`);
    });
    
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSchema();
