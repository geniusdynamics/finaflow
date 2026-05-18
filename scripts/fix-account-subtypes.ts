import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixAccountSubTypes() {
  const client = await pool.connect();
  
  try {
    console.log("Fixing accountSubType for new liability accounts...\n");
    
    const updates = [
      { code: '2110', subtype: 'accrued_expense', name: 'Rent Payable' },
      { code: '2120', subtype: 'accrued_expense', name: 'Insurance Premiums Payable' },
      { code: '2130', subtype: 'accrued_expense', name: 'Subscriptions Payable' },
      { code: '2140', subtype: 'accrued_expense', name: 'Utilities Payable' },
      { code: '2600', subtype: 'current_loan', name: 'Current Loan Payable' },
      { code: '2700', subtype: 'long_term_loan', name: 'Long-Term Loan Payable' },
    ];
    
    for (const acc of updates) {
      const result = await client.query(`
        UPDATE accounts 
        SET "accountSubType" = $1, "accountType" = 'liability'
        WHERE "accountCode" = $2
      `, [acc.subtype, acc.code]);
      console.log(`  ${acc.code} - ${acc.name}: ${result.rowCount} rows updated`);
    }
    
    console.log("\n✅ Account subtypes fixed!\n");
    
    // Verify
    const accounts = await client.query(`
      SELECT "accountCode", name, "accountType", "accountSubType" 
      FROM accounts 
      WHERE "accountCode" IN ('2110', '2120', '2130', '2140', '2600', '2700')
      ORDER BY "accountCode"
    `);
    
    console.log("Updated liability accounts:");
    accounts.rows.forEach(r => {
      console.log(`  ${r.accountCode} - ${r.name}`);
      console.log(`    Type: ${r.accountType}, SubType: ${r.accountSubType}`);
    });
    
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixAccountSubTypes();
