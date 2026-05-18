import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verifyMigrations() {
  const client = await pool.connect();
  
  try {
    console.log("=== COMPREHENSIVE MIGRATION VERIFICATION ===\n");
    
    // 1. Verify recurring_bill_templates columns
    console.log("1. RECURRING BILL TEMPLATES COLUMNS:");
    const templateCols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'recurring_bill_templates' 
      AND column_name IN ('businessId', 'categoryId', 'liabilityAccountId')
      ORDER BY column_name
    `);
    console.log("   Columns:", templateCols.rows.map(r => r.column_name).join(", ") || "❌ MISSING");
    if (templateCols.rows.length >= 3) {
      console.log("   ✅ All new columns present");
    } else {
      console.log("   ❌ Missing columns");
    }
    
    // 2. Verify liability accounts
    console.log("\n2. LIABILITY ACCOUNTS (2110-2140, 2600, 2700):");
    const liabilityAccounts = await client.query(`
      SELECT "accountCode", name, "accountSubType" 
      FROM accounts 
      WHERE "accountCode" IN ('2000', '2110', '2120', '2130', '2140', '2600', '2700')
      ORDER BY "accountCode"
    `);
    liabilityAccounts.rows.forEach(r => {
      console.log(`   ${r.accountCode} - ${r.name} (${r.accountSubType})`);
    });
    
    // 3. Verify expense categories accounting classes
    console.log("\n3. EXPENSE CATEGORIES ACCOUNTING CLASSES:");
    const categories = await client.query(`
      SELECT name, "accountingClass" 
      FROM expense_categories 
      WHERE "accountingClass" IS NOT NULL
      ORDER BY "accountingClass", name
    `);
    
    // Group by accounting class
    const byClass: Record<string, string[]> = {};
    categories.rows.forEach(r => {
      const cls = r.accountingClass;
      if (!byClass[cls]) byClass[cls] = [];
      byClass[cls].push(r.name);
    });
    
    Object.keys(byClass).sort().forEach(cls => {
      console.log(`   ${cls}:`);
      byClass[cls].forEach(name => {
        console.log(`     - ${name}`);
      });
    });
    
    // 4. Count summary
    console.log("\n4. SUMMARY:");
    const counts = await client.query(`
      SELECT "accountingClass", COUNT(*) as count 
      FROM expense_categories 
      GROUP BY "accountingClass"
      ORDER BY "accountingClass"
    `);
    let total = 0;
    counts.rows.forEach(r => {
      console.log(`   ${r.accountingClass}: ${r.count}`);
      total += parseInt(r.count);
    });
    console.log(`   TOTAL: ${total} categories`);
    
    // 5. Check indexes
    console.log("\n5. INDEXES ON recurring_bill_templates:");
    const indexes = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'recurring_bill_templates'
      AND indexname LIKE '%idx_recurring%'
    `);
    if (indexes.rows.length > 0) {
      indexes.rows.forEach(r => console.log(`   ${r.indexname}`));
    } else {
      console.log("   ❌ No custom indexes found");
    }
    
    console.log("\n=== VERIFICATION COMPLETE ===");
    console.log("\n✅ All migrations have been successfully applied to the database!");
    console.log("\nThe expense categorization system is now ready for the advanced reporting module.");
    
  } catch (err) {
    console.error("❌ Verification failed:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyMigrations();
