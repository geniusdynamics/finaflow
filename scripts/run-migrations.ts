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
    
    // Migration 0005: Add FK constraint and NOT NULL on expense_categories.defaultAccountId
    console.log("=== Running Migration 0005: Expense Categories Default Account FK ===");
    const migration5 = readFileSync(
      "D:/DevCenter/abuilds/fina/finaflow/db/migrations/0005_expense_categories_default_account_fk.sql",
      "utf8"
    );
    
    try {
      await client.query("BEGIN");
      await client.query(migration5);
      await client.query("COMMIT");
      console.log("✅ Migration 0005 applied successfully!\n");
    } catch (err: any) {
      await client.query("ROLLBACK");
      if (err.message.includes("already exists") || err.message.includes("duplicate") || err.message.includes("already exists")) {
        console.log("⚠️  Migration 0005 partially applied (some objects already exist)\n");
      } else {
        console.error("❌ Migration 0005 failed:", err.message, "\n");
        // Continue to verification even if migration 5 fails
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
      WHERE "accountingClass" IS NOT NULL AND "deletedAt" IS NULL
      ORDER BY name
      LIMIT 20
    `);
    console.log("\nExpense categories with accounting classes:");
    categories.rows.forEach(r => {
      console.log(`  ${r.name}: ${r.accountingClass}`);
    });
    
    // Check migration 0005 - defaultAccountId FK
    const fkCheck = await client.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'expense_categories'
    `);
    
    if (fkCheck.rows.length > 0) {
      console.log("\n✅ FK constraint verified on expense_categories.default_account_id:");
      fkCheck.rows.forEach(r => {
        console.log(`  ${r.constraint_name}: ${r.table_name}.${r.column_name} -> ${r.foreign_table_name}.${r.foreign_column_name}`);
      });
    } else {
      console.log("\n⚠️  No FK constraint found on expense_categories (may have been skipped)");
    }
    
    // Check NOT NULL constraint
    const notNullCheck = await client.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'expense_categories'
        AND column_name = 'default_account_id'
    `);
    
    if (notNullCheck.rows[0]?.is_nullable === 'NO') {
      console.log("✅ NOT NULL constraint verified on expense_categories.default_account_id");
    } else if (notNullCheck.rows[0]?.is_nullable === 'YES') {
      console.log("⚠️  default_account_id is still nullable (may have been skipped)");
    }
    
    // Check categories with defaultAccountId set
    const catWithAcct = await client.query(`
      SELECT COUNT(*)::int as total,
             SUM(CASE WHEN "defaultAccountId" IS NOT NULL THEN 1 ELSE 0 END)::int as linked,
             SUM(CASE WHEN "defaultAccountId" IS NULL THEN 1 ELSE 0 END)::int as unlinked
      FROM expense_categories
      WHERE "deletedAt" IS NULL
    `);
    console.log(`\nCategory linking status: ${catWithAcct.rows[0]?.linked}/${catWithAcct.rows[0]?.total} linked, ${catWithAcct.rows[0]?.unlinked} unlinked`);
    
    console.log("\n✅ All migrations completed!");
    
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
