const mysql = require("mysql2/promise");
require("dotenv").config();

const DATABASE_URL = process.env.DATABASE_URL || "mysql://root@localhost:4000/karafuu_cashflow";

async function migrate() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log("Connected to database.");

  // 1. Add defaultMpesaAccountId to locations
  try {
    await conn.execute(`ALTER TABLE locations ADD COLUMN IF NOT EXISTS defaultMpesaAccountId BIGINT UNSIGNED`);
    await conn.execute(`ALTER TABLE locations ADD COLUMN IF NOT EXISTS defaultCashAccountId BIGINT UNSIGNED`);
    await conn.execute(`ALTER TABLE locations DROP COLUMN IF EXISTS openingBalance`);
    console.log("Updated locations table.");
  } catch (e) {
    console.log("Locations columns:", e.message);
  }

  // 2. Add generatedBillId and totalNetPay to payroll_periods
  try {
    await conn.execute(`ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS generatedBillId BIGINT UNSIGNED`);
    await conn.execute(`ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS totalNetPay DECIMAL(15,2) DEFAULT '0.00'`);
    console.log("Updated payroll_periods table.");
  } catch (e) {
    console.log("Payroll periods columns:", e.message);
  }

  // 3. Add payrollPeriodId to payroll_advances
  try {
    await conn.execute(`ALTER TABLE payroll_advances ADD COLUMN IF NOT EXISTS payrollPeriodId BIGINT UNSIGNED`);
    console.log("Updated payroll_advances table.");
  } catch (e) {
    console.log("Advances columns:", e.message);
  }

  // 4. Add accountId to daily_mpesa_ledger
  try {
    await conn.execute(`ALTER TABLE daily_mpesa_ledger ADD COLUMN IF NOT EXISTS accountId BIGINT UNSIGNED NOT NULL DEFAULT 0`);
    console.log("Updated daily_mpesa_ledger table.");
  } catch (e) {
    console.log("Daily ledger columns:", e.message);
  }

  // 5. Add destinationAccountId to mpesa_transactions for topup destination wallet
  try {
    await conn.execute(`ALTER TABLE mpesa_transactions ADD COLUMN IF NOT EXISTS destinationAccountId BIGINT UNSIGNED`);
    console.log("Updated mpesa_transactions table.");
  } catch (e) {
    console.log("Mpesa columns:", e.message);
  }

  await conn.end();
  console.log("Migration v5 completed.");
}

migrate().catch(console.error);
