/**
 * Migration v11: Add deletedAt to attachments table
 * Fixes reset crash where attachments table lacks soft-delete column
 */
const mysql = require("mysql2/promise");
require("dotenv").config();

const uri = process.env.DATABASE_URL;
if (!uri) { console.error("DATABASE_URL not set"); process.exit(1); }

async function run() {
  const conn = await mysql.createConnection(uri);
  console.log("[v11] Connected.");

  // Check if deletedAt already exists
  const [cols] = await conn.execute("SHOW COLUMNS FROM attachments LIKE 'deletedAt'");
  if (cols.length === 0) {
    await conn.execute(`ALTER TABLE attachments ADD COLUMN deletedAt TIMESTAMP NULL DEFAULT NULL AFTER createdAt`);
    console.log("[v11] Added deletedAt to attachments table.");
  } else {
    console.log("[v11] deletedAt already exists on attachments.");
  }

  // Also ensure accounts.openingBalance has a proper default for reset
  // The reset reads openingBalance and writes it to currentBalance
  // If openingBalance is NULL, currentBalance would become NULL
  const [openingCols] = await conn.execute("SHOW COLUMNS FROM accounts LIKE 'openingBalance'");
  if (openingCols.length > 0) {
    // Set any NULL openingBalance to 0.00 so reset works
    await conn.execute(`UPDATE accounts SET openingBalance = '0.00' WHERE openingBalance IS NULL`);
    console.log("[v11] Fixed NULL openingBalance values on accounts.");
  }

  await conn.end();
  console.log("[v11] Done.");
}

run().catch(e => { console.error("[v11] Failed:", e); process.exit(1); });
