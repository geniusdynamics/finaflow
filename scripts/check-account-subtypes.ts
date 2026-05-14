const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const res = await pool.query(`
    SELECT DISTINCT account_sub_type 
    FROM accounts 
    WHERE account_type = 'expense'
    ORDER BY account_sub_type
  `);
  console.log('Expense Account Subtypes in Database:');
  res.rows.forEach(r => console.log('  -', r.account_sub_type));
  
  const rev = await pool.query(`
    SELECT DISTINCT account_sub_type 
    FROM accounts 
    WHERE account_type = 'revenue'
    ORDER BY account_sub_type
  `);
  console.log('\nRevenue Account Subtypes in Database:');
  rev.rows.forEach(r => console.log('  -', r.account_sub_type));
  
  const assets = await pool.query(`
    SELECT account_code, name, account_type, account_sub_type, current_balance
    FROM accounts
    WHERE account_type IN ('asset', 'liability', 'equity')
    ORDER BY account_code
    LIMIT 20
  `);
  console.log('\nSample Asset/Liability/Equity Accounts:');
  assets.rows.forEach(r => {
    console.log(`  ${r.account_code} | ${r.name} | ${r.account_type}/${r.account_sub_type} | Balance: ${r.current_balance}`);
  });
  
  await pool.end();
}

main().catch(console.error);
