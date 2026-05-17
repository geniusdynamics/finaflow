// ABOUTME: Check bills and their businessId/locationId to diagnose expense creation issue
require("dotenv/config");
const pg = require("pg");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL not set!");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });

async function run() {
  const client = await pool.connect();
  
  try {
    // Check bills with their location and business info
    const bills = await client.query(`
      SELECT b.id, b."billNumber", b.description, b."businessId", b."locationId", b.status, b.amount
      FROM "bills" b
      ORDER BY b.id DESC
      LIMIT 10
    `);
    
    console.log("=== BILLS ===");
    bills.rows.forEach(b => {
      console.log(`Bill ID: ${b.id}, Number: ${b.billNumber}, BizID: ${b.businessId}, LocID: ${b.locationId}, Desc: ${b.description}`);
    });
    
    // Check locations and their businessIds
    const locations = await client.query(`
      SELECT l.id, l.name, l."businessId" 
      FROM "locations" l 
      ORDER BY l.id DESC
      LIMIT 10
    `);
    
    console.log("\n=== LOCATIONS ===");
    locations.rows.forEach(l => {
      console.log(`Loc ID: ${l.id}, Name: ${l.name}, BusinessID: ${l.businessId}`);
    });
    
    // Check the latest payment
    const latestPayment = await client.query(`
      SELECT bp.id, bp."billId", bp.amount, bp."paymentDate", b.description as bill_desc, b."businessId", b."locationId"
      FROM "bill_payments" bp
      JOIN "bills" b ON b.id = bp."billId"
      ORDER BY bp.id DESC
      LIMIT 3
    `);
    
    console.log("\n=== LATEST BILL PAYMENTS ===");
    latestPayment.rows.forEach(p => {
      console.log(`Payment ID: ${p.id}, Bill: ${p.bill_desc}, Amount: ${p.amount}, BizID: ${p.businessId}, LocID: ${p.locationId}`);
    });
    
    // Check expense_categories to see what category IDs exist
    const categories = await client.query(`
      SELECT id, name, "defaultAccountId" 
      FROM "expense_categories" 
      ORDER BY id ASC
      LIMIT 10
    `);
    
    console.log("\n=== EXPENSE CATEGORIES ===");
    categories.rows.forEach(c => {
      console.log(`Cat ID: ${c.id}, Name: ${c.name}, DefaultAccountID: ${c.defaultAccountId}`);
    });
    
    // Check expense_categories that have businessId = NULL (global)
    const globalCategories = await client.query(`
      SELECT id, name, "defaultAccountId", "businessId" 
      FROM "expense_categories" 
      WHERE "businessId" IS NULL
      ORDER BY id ASC
      LIMIT 10
    `);
    
    console.log("\n=== GLOBAL EXPENSE CATEGORIES (businessId = NULL) ===");
    globalCategories.rows.forEach(c => {
      console.log(`Cat ID: ${c.id}, Name: ${c.name}, DefaultAccountID: ${c.defaultAccountId}`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);