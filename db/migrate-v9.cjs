const mysql = require("mysql2/promise");
require("dotenv").config();

const DATABASE_URL = process.env.DATABASE_URL || "mysql://root@localhost:4000/karafuu_cashflow";

async function migrate() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log("Connected to database.");

  // 1. Add linkedAccountId to location_payment_methods
  const [lpmCols] = await conn.execute("SHOW COLUMNS FROM location_payment_methods");
  if (!lpmCols.find(c => c.Field === "linkedAccountId")) {
    await conn.execute("ALTER TABLE location_payment_methods ADD COLUMN linkedAccountId INT UNSIGNED");
    console.log("Added linkedAccountId to location_payment_methods.");

    // Migrate existing data: copy from payment_methods to junction table
    await conn.execute(`
      UPDATE location_payment_methods lpm
      INNER JOIN payment_methods pm ON lpm.paymentMethodId = pm.id
      SET lpm.linkedAccountId = pm.linkedAccountId
      WHERE pm.linkedAccountId IS NOT NULL
    `);
    console.log("Migrated linkedAccountId values to junction table.");
  } else {
    console.log("linkedAccountId already exists on location_payment_methods.");
  }

  // 2. Remove linkedAccountId from payment_methods (set to NULL, then drop if possible)
  const [pmCols] = await conn.execute("SHOW COLUMNS FROM payment_methods");
  if (pmCols.find(c => c.Field === "linkedAccountId")) {
    try {
      await conn.execute("ALTER TABLE payment_methods DROP COLUMN linkedAccountId");
      console.log("Dropped linkedAccountId from payment_methods.");
    } catch (e) {
      console.log("Could not drop column (TiDB limitation), setting to NULL instead:", e.message);
      await conn.execute("UPDATE payment_methods SET linkedAccountId = NULL");
    }
  }

  await conn.end();
  console.log("Migration v9 completed.");
}

migrate().catch(console.error);
