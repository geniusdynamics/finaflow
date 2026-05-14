import "dotenv/config";
import { Pool } from "pg";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log("Connected to database. Running migrations...\n");
    
    // Migration 0003: Add fields to recurring_bill_templates and create liability accounts
    console.log("=== Running Migration 0003: Recurring Bill Accounting Classification ===");
    const migration3 = readFileSync(
      "D:/DevCenter/abuilds/fina/finaflow/db/migrations/0003_recurring_bill_accounting_classification.sql",
      "utf8"
    );
    
    try {
      await client.query("BEGIN");
      await client.query(migration3);
      await client.query("COMMIT");
      console.log("✅ Migration 0003 applied successfully!\n");
    } catch (err: any) {
      await client.query("ROLLBACK");
      if (err.message.includes("already exists") || err.message.includes("duplicate")) {
        console.log("⚠️  Migration 0003 partially applied (some objects already exist)\n");
      } else {
        console.error("❌ Migration 0003 failed:", err.message, "\n");
      }
    }
    
    // Migration 0004: Assign accounting classes to existing expense categories
    console.log("=== Running Migration 0004: Expense Category Accounting Class Assignment ===");
    const migration4 = readFileSync(
      "D:/DevCenter/abuilds/fina/finaflow/db/migrations/0004_expense_category_accounting_class_assignment.sql",
      "utf8"
    );
    
    try {
      await client.query("BEGIN");
      await client.query(migration4);
      await client.query("COMMIT");
      console.log("✅ Migration 0004 applied successfully!\n");
    } catch (err: any) {
      await client.query("ROLLBACK");
      if (err.message.includes("already exists") || err.message.includes("duplicate")) {
        console.log("⚠️  Migration 0004 partially applied (some objects already exist)\n");
      } else {
        console.error("❌ Migration 0004 failed:", err.message, "\n");
      }
    }
    
    // Verify the changes
    console.log("=== Verification ===");
    
    // Check recurring_bill_templates columns
    const templateCols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'recurring_bill_templates' 
      AND column_name IN ('businessId', 'categoryId', 'liabilityAccountId')
    `);
    console.log("Recurring bill templates columns added:", templateCols.rows.map(r => r.column_name).join(", ") || "none");
    
    // Check new liability accounts
    const liabilityAccounts = await client.query(`
      SELECT "accountCode", name 
      FROM accounts 
      WHERE "accountCode" IN ('2110', '2120', '2130', '2140', '2600', '2700')
      ORDER BY "accountCode"
    `);
    console.log("\nNew liability accounts created:");
    liabilityAccounts.rows.forEach(r => {
      console.log(`  ${r.accountCode} - ${r.name}`);
    });
    
    // Check expense categories accounting classes
    const categories = await client.query(`
      SELECT name, "accountingClass" 
      FROM expense_categories 
      WHERE "accountingClass" IS NOT NULL
      ORDER BY name
      LIMIT 20
    `);
    console.log("\nExpense categories with accounting classes:");
    categories.rows.forEach(r => {
      console.log(`  ${r.name}: ${r.accountingClass}`);
    });
    
    console.log("\n✅ All migrations completed!");
    
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
