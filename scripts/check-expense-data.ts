import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkData() {
  const client = await pool.connect();
  
  try {
    console.log("=== CHECKING DATA ===\n");
    
    // Check expenses business context
    const exp = await client.query(`
      SELECT e.id, e."businessId", e."locationId", e.description, e.amount
      FROM expenses e
      WHERE e."journalEntryId" IS NULL
      AND e."deletedAt" IS NULL
      LIMIT 3
    `);
    console.log("Sample orphaned expenses:");
    exp.rows.forEach(r => console.log(`  ID ${r.id}: Business=${r.businessId}, Location=${r.locationId}, Amount=${r.amount}`));
    
    // Check accounts
    const acc = await client.query(`
      SELECT id, "businessId", "accountCode", name, "accountType", "accountSubType"
      FROM accounts
      WHERE "deletedAt" IS NULL
      LIMIT 20
    `);
    console.log("\nSample accounts:");
    acc.rows.forEach(r => console.log(`  ID ${r.id}: ${r.accountCode || 'N/A'} - ${r.name} (${r.accountType})`));
    
    // Count by account type
    const counts = await client.query(`
      SELECT "accountType", COUNT(*) as count
      FROM accounts
      WHERE "deletedAt" IS NULL
      GROUP BY "accountType"
    `);
    console.log("\nAccount counts by type:");
    counts.rows.forEach(r => console.log(`  ${r.accountType}: ${r.count}`));
    
    // Check for expense accounts
    const expenseAccounts = await client.query(`
      SELECT id, "businessId", "accountCode", name
      FROM accounts
      WHERE "accountType" = 'expense'
      AND "deletedAt" IS NULL
    `);
    console.log("\nExpense accounts:");
    expenseAccounts.rows.forEach(r => console.log(`  ID ${r.id}: ${r.accountCode || 'N/A'} - ${r.name} (Business ${r.businessId})`));
    
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkData();
