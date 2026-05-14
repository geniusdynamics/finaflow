import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration0004() {
  const client = await pool.connect();
  
  try {
    console.log("Running Migration 0004 directly...\n");
    
    await client.query("BEGIN");
    
    // COGS categories (Cost of Goods Sold)
    const cogsResult = await client.query(`
      UPDATE expense_categories 
      SET "accountingClass" = 'cogs'
      WHERE (LOWER(name) LIKE '%food%' 
         OR LOWER(name) LIKE '%beverage%' 
         OR LOWER(name) LIKE '%cost%'
         OR LOWER(name) LIKE '%groceries%'
         OR LOWER(name) LIKE '%ingredients%')
         AND ("accountingClass" IS NULL OR "accountingClass" = 'operating_expense')
    `);
    console.log(`  Updated ${cogsResult.rowCount} COGS categories`);
    
    // Operating Expenses
    const opResult = await client.query(`
      UPDATE expense_categories 
      SET "accountingClass" = 'operating_expense'
      WHERE (LOWER(name) LIKE '%rent%'
         OR LOWER(name) LIKE '%utility%'
         OR LOWER(name) LIKE '%electricity%'
         OR LOWER(name) LIKE '%water%'
         OR LOWER(name) LIKE '%internet%'
         OR LOWER(name) LIKE '%phone%'
         OR LOWER(name) LIKE '%transport%'
         OR LOWER(name) LIKE '%delivery%'
         OR LOWER(name) LIKE '%fuel%'
         OR LOWER(name) LIKE '%maintenance%'
         OR LOWER(name) LIKE '%repair%'
         OR LOWER(name) LIKE '%salary%'
         OR LOWER(name) LIKE '%wage%'
         OR LOWER(name) LIKE '%commission%'
         OR LOWER(name) LIKE '%airtime%'
         OR LOWER(name) LIKE '%data%'
         OR LOWER(name) LIKE '%software%'
         OR LOWER(name) LIKE '%subscription%'
         OR (LOWER(name) LIKE '%marketing%' AND LOWER(name) NOT LIKE '%social media%')
         OR LOWER(name) LIKE '%advertising%'
         OR LOWER(name) LIKE '%packaging%'
         OR LOWER(name) LIKE '%cleaning%')
         AND ("accountingClass" IS NULL OR "accountingClass" = 'cogs')
    `);
    console.log(`  Updated ${opResult.rowCount} Operating Expense categories`);
    
    // Administrative Expenses
    const adminResult = await client.query(`
      UPDATE expense_categories 
      SET "accountingClass" = 'admin_expense'
      WHERE (LOWER(name) LIKE '%office%'
         OR LOWER(name) LIKE '%admin%'
         OR LOWER(name) LIKE '%management%'
         OR LOWER(name) LIKE '%license%'
         OR LOWER(name) LIKE '%permit%'
         OR LOWER(name) LIKE '%insurance%'
         OR LOWER(name) LIKE '%legal%'
         OR LOWER(name) LIKE '%professional%'
         OR LOWER(name) LIKE '%consulting%'
         OR LOWER(name) LIKE '%accounting%'
         OR LOWER(name) LIKE '%bank charge%'
         OR LOWER(name) LIKE '%interest%'
         OR LOWER(name) LIKE '%depreciation%')
         AND ("accountingClass" IS NULL)
    `);
    console.log(`  Updated ${adminResult.rowCount} Admin Expense categories`);
    
    // Marketing Expenses
    const mktResult = await client.query(`
      UPDATE expense_categories 
      SET "accountingClass" = 'marketing'
      WHERE (LOWER(name) LIKE '%marketing%'
         OR LOWER(name) LIKE '%advertising%'
         OR LOWER(name) LIKE '%promotion%'
         OR LOWER(name) LIKE '%social media%'
         OR LOWER(name) LIKE '%seo%'
         OR LOWER(name) LIKE '%branding%'
         OR LOWER(name) LIKE '%pr%'
         OR LOWER(name) LIKE '%public relations%'
         OR LOWER(name) LIKE '%print%'
         OR LOWER(name) LIKE '%media%')
         AND ("accountingClass" IS NULL)
    `);
    console.log(`  Updated ${mktResult.rowCount} Marketing categories`);
    
    // Other Expenses
    const otherResult = await client.query(`
      UPDATE expense_categories 
      SET "accountingClass" = 'other'
      WHERE (LOWER(name) LIKE '%misc%'
         OR LOWER(name) LIKE '%other%'
         OR LOWER(name) LIKE '%donation%'
         OR LOWER(name) LIKE '%charity%'
         OR LOWER(name) LIKE '%penalty%'
         OR LOWER(name) LIKE '%fine%'
         OR LOWER(name) LIKE '%bad debt%')
         AND ("accountingClass" IS NULL)
    `);
    console.log(`  Updated ${otherResult.rowCount} Other Expense categories`);
    
    // Default for remaining
    const defaultResult = await client.query(`
      UPDATE expense_categories 
      SET "accountingClass" = 'operating_expense'
      WHERE "accountingClass" IS NULL 
         OR "accountingClass" NOT IN ('cogs', 'operating_expense', 'admin_expense', 'marketing', 'depreciation', 'other')
    `);
    console.log(`  Updated ${defaultResult.rowCount} categories to default (operating_expense)`);
    
    await client.query("COMMIT");
    
    console.log("\n✅ Migration 0004 applied successfully!\n");
    
    // Verify the results
    const categories = await client.query(`
      SELECT name, "accountingClass" 
      FROM expense_categories 
      WHERE "accountingClass" IS NOT NULL
      ORDER BY name
    `);
    
    console.log("=== Updated Expense Categories ===");
    categories.rows.forEach(r => {
      console.log(`  ${r.name}: ${r.accountingClass}`);
    });
    
    // Count by class
    const counts = await client.query(`
      SELECT "accountingClass", COUNT(*) as count 
      FROM expense_categories 
      GROUP BY "accountingClass"
      ORDER BY "accountingClass"
    `);
    
    console.log("\n=== Summary by Accounting Class ===");
    counts.rows.forEach(r => {
      console.log(`  ${r.accountingClass}: ${r.count}`);
    });
    
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Migration 0004 failed:", err.message);
    console.error(err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration0004();
