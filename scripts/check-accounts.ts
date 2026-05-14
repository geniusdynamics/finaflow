import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkAndCreateAccounts() {
  const client = await pool.connect();
  
  try {
    console.log("=== CHECKING ACCOUNTS ===\n");
    
    // Get all accounts
    const accounts = await client.query(`
      SELECT id, "accountCode", name, "accountType", "accountSubType" 
      FROM accounts 
      WHERE "deletedAt" IS NULL
      ORDER BY "accountCode"
    `);
    
    console.log("All accounts:");
    accounts.rows.forEach(r => {
      console.log(`  ${r.accountCode || 'N/A'}: ${r.name} (${r.accountType}/${r.accountSubType || 'N/A'})`);
    });
    
    if (accounts.rows.length === 0) {
      console.log("\n❌ No accounts found! Creating default accounts...");
      
      // Get first business and location
      const business = await client.query(`SELECT id FROM businesses LIMIT 1`);
      const location = await client.query(`SELECT id FROM locations LIMIT 1`);
      
      if (!business.rows[0] || !location.rows[0]) {
        throw new Error("No business or location found!");
      }
      
      const businessId = business.rows[0].id;
      const locationId = location.rows[0].id;
      
      // Create default accounts
      const defaultAccounts = [
        { code: '1000', name: 'Cash', subtype: 'cash', type: 'asset' },
        { code: '2000', name: 'Accounts Payable', subtype: 'accounts_payable', type: 'liability' },
        { code: '5000', name: 'Operating Expenses', subtype: 'operating_expense', type: 'expense' },
      ];
      
      for (const acc of defaultAccounts) {
        await client.query(`
          INSERT INTO accounts ("locationId", "businessId", name, "accountCode", "accountType", "accountSubType", type, "openingBalance", "currentBalance", "isActive")
          VALUES ($1, $2, $3, $4, $5, $6, 'bank_account', '0.00', '0.00', true)
        `, [locationId, businessId, acc.name, acc.code, acc.type, acc.subtype]);
        console.log(`  Created: ${acc.code} - ${acc.name}`);
      }
      
      console.log("\n✅ Default accounts created!");
    }
    
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkAndCreateAccounts();
