/**
 * Migration v13: Add default locations + accounts to businesses that have none
 * Fixes the 400K phantom balance bug where businesses without locations
 * caused queries to return ALL accounts globally.
 */
const mysql = require("mysql2/promise");
require("dotenv").config();

const uri = process.env.DATABASE_URL;
if (!uri) { console.error("DATABASE_URL not set"); process.exit(1); }

async function run() {
  const conn = await mysql.createConnection(uri);
  console.log("[v13] Connected.");

  // Find all businesses with no active locations
  const [bizWithoutLocs] = await conn.execute(`
    SELECT b.id, b.name, b.accountId 
    FROM businesses b 
    WHERE b.deletedAt IS NULL 
    AND b.id NOT IN (SELECT DISTINCT businessId FROM locations WHERE deletedAt IS NULL)
  `);

  console.log(`[v13] Found ${bizWithoutLocs.length} businesses without locations.`);

  for (const biz of bizWithoutLocs) {
    const slug = `main-${biz.id}`;
    // Create default location with unique slug
    const [locR] = await conn.execute(
      "INSERT INTO locations (businessId, name, slug, isActive, createdAt) VALUES (?, ?, ?, ?, NOW())",
      [biz.id, "Main Branch", slug, true]
    );
    const locationId = locR.insertId;
    console.log(`[v13] Created location for ${biz.name} (id=${biz.id}, locId=${locationId})`);

    // Check if accounts already exist for this business via other means
    const [existingAccts] = await conn.execute(
      "SELECT id FROM accounts WHERE locationId = ? AND deletedAt IS NULL",
      [locationId]
    );
    if (existingAccts.length === 0) {
      await conn.execute(
        "INSERT INTO accounts (name, type, locationId, openingBalance, currentBalance, isActive, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())",
        ["Cash Drawer", "cash", locationId, "0.00", "0.00", true]
      );
      await conn.execute(
        "INSERT INTO accounts (name, type, locationId, openingBalance, currentBalance, isActive, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())",
        ["M-PESA Till", "mpesa", locationId, "0.00", "0.00", true]
      );
      await conn.execute(
        "INSERT INTO accounts (name, type, locationId, openingBalance, currentBalance, isActive, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())",
        ["Bank Account", "bank_account", locationId, "0.00", "0.00", true]
      );
      console.log(`[v13] Created default accounts for ${biz.name}`);
    }
  }

  await conn.end();
  console.log("[v13] Done.");
}

run().catch((e) => { console.error("[v13] Failed:", e); process.exit(1); });
