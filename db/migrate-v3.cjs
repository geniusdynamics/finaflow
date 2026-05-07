const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host: 'ep-t4ni387b5e83b7519dc8.epsrv-t4n281l4mrmemi4zls9a.ap-southeast-1.privatelink.aliyuncs.com',
    port: 4000,
    user: 'ts2P9rEnvs3jwc8.root',
    password: 'lFaecisNfFcU87rN1J9KohoInNoJmndJ',
    database: '19dec97d-bb42-8702-8000-09d6a5730a0c',
  });

  const tables = [
    ["role_permissions", `CREATE TABLE IF NOT EXISTS role_permissions (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      roleKey VARCHAR(50) NOT NULL,
      roleLabel VARCHAR(100) NOT NULL,
      permissions JSON NOT NULL,
      isActive BOOLEAN DEFAULT TRUE NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
    )`],
    ["bill_items", `CREATE TABLE IF NOT EXISTS bill_items (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      billId BIGINT UNSIGNED NOT NULL,
      itemName VARCHAR(255) NOT NULL,
      quantity DECIMAL(10,3) DEFAULT 1.000 NOT NULL,
      unitPrice DECIMAL(15,2) NOT NULL,
      totalPrice DECIMAL(15,2) NOT NULL,
      categoryId BIGINT UNSIGNED,
      notes TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      deletedAt TIMESTAMP NULL
    )`],
    ["daily_mpesa_ledger", `CREATE TABLE IF NOT EXISTS daily_mpesa_ledger (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      locationId BIGINT UNSIGNED NOT NULL,
      ledgerDate DATE NOT NULL,
      openingBalance DECIMAL(15,2) NOT NULL,
      totalTopups DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
      totalExpenditures DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
      totalFees DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
      closingBalance DECIMAL(15,2) NOT NULL,
      transactionCount INT DEFAULT 0 NOT NULL,
      notes TEXT,
      enteredBy BIGINT UNSIGNED NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      deletedAt TIMESTAMP NULL
    )`],
  ];

  for (const [name, sql] of tables) {
    try {
      await conn.execute(sql);
      console.log(`CREATED: ${name}`);
    } catch (e) {
      console.log(`SKIP ${name}: ${e.message}`);
    }
  }

  // Check if expense_categories exists
  const [rows] = await conn.execute("SHOW TABLES LIKE 'expense_categories'");
  if (rows.length === 0) {
    try {
      await conn.execute(`CREATE TABLE IF NOT EXISTS expense_categories (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        color VARCHAR(20) DEFAULT '#C73E1D',
        isActive BOOLEAN DEFAULT TRUE NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        deletedAt TIMESTAMP NULL
      )`);
      console.log("CREATED: expense_categories");
    } catch (e) {
      console.log(`SKIP expense_categories: ${e.message}`);
    }
  } else {
    console.log("EXISTS: expense_categories");
  }

  // Alter users.role to include 'viewer'
  try {
    await conn.execute(`ALTER TABLE users MODIFY COLUMN role ENUM('owner','admin','manager','employee','viewer') DEFAULT 'viewer' NOT NULL`);
    console.log("ALTERED: users.role (added viewer)");
  } catch (e) {
    console.log(`SKIP users.role: ${e.message}`);
  }

  // Check daily_sales columns exist
  const [cols] = await conn.execute("SHOW COLUMNS FROM daily_sales LIKE 'familyBankTotal'");
  if (cols.length === 0) {
    // Add missing columns
    const adds = [
      "ALTER TABLE daily_sales ADD COLUMN familyBankTotal DECIMAL(15,2) DEFAULT 0.00 NOT NULL",
      "ALTER TABLE daily_sales ADD COLUMN coopBankTotal DECIMAL(15,2) DEFAULT 0.00 NOT NULL",
      "ALTER TABLE daily_sales ADD COLUMN equityBankTotal DECIMAL(15,2) DEFAULT 0.00 NOT NULL",
      "ALTER TABLE daily_sales ADD COLUMN boltTotal DECIMAL(15,2) DEFAULT 0.00 NOT NULL",
      "ALTER TABLE daily_sales ADD COLUMN glovoTotal DECIMAL(15,2) DEFAULT 0.00 NOT NULL",
      "ALTER TABLE daily_sales ADD COLUMN creditCardTotal DECIMAL(15,2) DEFAULT 0.00 NOT NULL",
      "ALTER TABLE daily_sales ADD COLUMN deliveryPartnerTotal DECIMAL(15,2) DEFAULT 0.00 NOT NULL",
    ];
    for (const sql of adds) {
      try { await conn.execute(sql); } catch (e) { /* skip */ }
    }
    console.log("ADDED: daily_sales columns");
  }

  await conn.end();
  console.log("\nMigration complete!");
}

migrate().catch(console.error);
