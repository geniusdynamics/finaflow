const mysql = require("mysql2/promise");
require("dotenv").config();

const DATABASE_URL = process.env.DATABASE_URL || "mysql://root@localhost:4000/karafuu_cashflow";

async function migrate() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log("Connected to database.");

  // 1. Create master_items table
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS master_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        lastUnitPrice DECIMAL(15,2),
        lastCategoryId BIGINT UNSIGNED,
        lastSupplierId BIGINT UNSIGNED,
        usageCount INT DEFAULT 1 NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        deletedAt TIMESTAMP NULL
      )
    `);
    console.log("Table master_items created.");
  } catch (e) {
    console.log("master_items table might already exist:", e.message);
  }

  // 2. Add source_account_id to mpesa_transactions
  try {
    await conn.execute(`
      ALTER TABLE mpesa_transactions
      ADD COLUMN IF NOT EXISTS sourceAccountId BIGINT UNSIGNED
    `);
    console.log("Column sourceAccountId added to mpesa_transactions.");
  } catch (e) {
    console.log("sourceAccountId column might already exist:", e.message);
  }

  // 3. Extend ledger_entries transaction_type enum to include drawing and deposit
  try {
    // MySQL requires redefining the entire enum when adding values
    await conn.execute(`
      ALTER TABLE ledger_entries
      MODIFY COLUMN transactionType ENUM(
        'sale', 'expense', 'bill_payment', 'supplier_payment',
        'payroll', 'advance', 'transfer', 'opening_balance', 'mpesa_topup',
        'drawing', 'deposit'
      ) NOT NULL
    `);
    console.log("Extended transactionType enum with drawing and deposit.");
  } catch (e) {
    console.log("Enum update issue:", e.message);
  }

  await conn.end();
  console.log("Migration v4 completed.");
}

migrate().catch(console.error);
