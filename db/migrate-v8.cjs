const mysql = require("mysql2/promise");
require("dotenv").config();

const DATABASE_URL = process.env.DATABASE_URL || "mysql://root@localhost:4000/karafuu_cashflow";

async function migrate() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log("Connected to database.");

  // 1. Payment methods table
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS payment_methods (
      id INT AUTO_INCREMENT PRIMARY KEY,
      businessId INT UNSIGNED,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(50) NOT NULL,
      color VARCHAR(20) DEFAULT '#C73E1D',
      linkedAccountId INT UNSIGNED,
      sortOrder INT DEFAULT 0 NOT NULL,
      isActive TINYINT(1) DEFAULT 1 NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      deletedAt TIMESTAMP NULL
    )
  `);
  console.log("Created payment_methods table.");

  // 2. Location-PaymentMethod junction
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS location_payment_methods (
      id INT AUTO_INCREMENT PRIMARY KEY,
      locationId INT UNSIGNED NOT NULL,
      paymentMethodId INT UNSIGNED NOT NULL,
      isActive TINYINT(1) DEFAULT 1 NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      UNIQUE KEY lpm_unique (locationId, paymentMethodId)
    )
  `);
  console.log("Created location_payment_methods table.");

  // 3. Daily sale payments (child records)
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS daily_sale_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      dailySaleId INT UNSIGNED NOT NULL,
      paymentMethodId INT UNSIGNED NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);
  console.log("Created daily_sale_payments table.");

  // 4. Add nextBillNumber to locations
  const [locCols] = await conn.execute("SHOW COLUMNS FROM locations");
  if (!locCols.find(c => c.Field === "nextBillNumber")) {
    await conn.execute("ALTER TABLE locations ADD COLUMN nextBillNumber INT UNSIGNED DEFAULT 1 NOT NULL");
    console.log("Added nextBillNumber to locations.");
  }

  // 5. Seed default payment methods if empty
  const [pmRows] = await conn.execute("SELECT COUNT(*) as cnt FROM payment_methods");
  if (pmRows[0].cnt === 0) {
    // Get the first business
    const [bizRows] = await conn.execute("SELECT id FROM businesses WHERE deletedAt IS NULL LIMIT 1");
    const businessId = bizRows[0]?.id ?? null;

    // Get accounts for linking
    const [acctRows] = await conn.execute("SELECT id, name, type, locationId FROM accounts WHERE deletedAt IS NULL");
    const findAcct = (type, locId) => acctRows.find(a => a.type === type && a.locationId === locId);

    // Get all locations
    const [locRows] = await conn.execute("SELECT id FROM locations WHERE deletedAt IS NULL");

    const defaults = [
      { name: "Cash", code: "cash", color: "#2E7D32" },
      { name: "Card", code: "card", color: "#3182CE" },
      { name: "M-PESA", code: "mpesa", color: "#2D7D46" },
      { name: "Family Bank", code: "family_bank", color: "#805AD5" },
      { name: "COOP Bank", code: "coop_bank", color: "#C73E1D" },
      { name: "Equity Bank", code: "equity_bank", color: "#D4A854" },
      { name: "Bolt Food", code: "bolt", color: "#4FD1C5" },
      { name: "Glovo", code: "glovo", color: "#ED8936" },
      { name: "Credit Card", code: "credit_card", color: "#9F7AEA" },
      { name: "Delivery Partner", code: "delivery", color: "#718096" },
    ];

    for (const d of defaults) {
      let linkedAccountId = null;

      // Try to link to matching account
      if (d.code === "cash") {
        const acct = acctRows.find(a => a.type === "cash");
        if (acct) linkedAccountId = acct.id;
      } else if (d.code === "mpesa") {
        const acct = acctRows.find(a => a.type === "mpesa");
        if (acct) linkedAccountId = acct.id;
      } else if (["family_bank", "coop_bank", "equity_bank", "card", "credit_card"].includes(d.code)) {
        const acct = acctRows.find(a => a.type === "bank_account");
        if (acct) linkedAccountId = acct.id;
      }

      const [result] = await conn.execute(
        "INSERT INTO payment_methods (businessId, name, code, color, linkedAccountId, sortOrder, isActive) VALUES (?, ?, ?, ?, ?, ?, TRUE)",
        [businessId, d.name, d.code, d.color, linkedAccountId, defaults.indexOf(d)]
      );
      const pmId = result.insertId;

      // Link to all locations
      for (const loc of locRows) {
        await conn.execute(
          "INSERT IGNORE INTO location_payment_methods (locationId, paymentMethodId, isActive) VALUES (?, ?, TRUE)",
          [loc.id, pmId]
        );
      }
    }
    console.log(`Seeded ${defaults.length} default payment methods linked to ${locRows.length} locations.`);
  } else {
    console.log(`payment_methods already has ${pmRows[0].cnt} rows. Skipping seed.`);
  }

  await conn.end();
  console.log("Migration v8 completed.");
}

migrate().catch(console.error);
