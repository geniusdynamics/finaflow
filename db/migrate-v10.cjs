const mysql = require("mysql2/promise");
require("dotenv").config();

const DATABASE_URL = process.env.DATABASE_URL || "mysql://root@localhost:4000/karafuu_cashflow";

async function migrate() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log("Connected to database.");

  // 1. Add expenseNumber to expenses
  const [expCols] = await conn.execute("SHOW COLUMNS FROM expenses");
  if (!expCols.find(c => c.Field === "expenseNumber")) {
    await conn.execute("ALTER TABLE expenses ADD COLUMN expenseNumber VARCHAR(50)");
    console.log("Added expenseNumber to expenses.");
  }
  if (!expCols.find(c => c.Field === "billId")) {
    await conn.execute("ALTER TABLE expenses ADD COLUMN billId INT UNSIGNED");
    console.log("Added billId to expenses.");
  }
  if (!expCols.find(c => c.Field === "refNo")) {
    await conn.execute("ALTER TABLE expenses ADD COLUMN refNo VARCHAR(50)");
    console.log("Added refNo to expenses.");
  }

  // 2. Add nextExpenseNumber to locations (for auto-numbering)
  const [locCols] = await conn.execute("SHOW COLUMNS FROM locations");
  if (!locCols.find(c => c.Field === "nextExpenseNumber")) {
    await conn.execute("ALTER TABLE locations ADD COLUMN nextExpenseNumber INT UNSIGNED DEFAULT 1 NOT NULL");
    console.log("Added nextExpenseNumber to locations.");
  }

  // 3. Auto-generate expense numbers for existing expenses
  const [existingExp] = await conn.execute("SELECT id, locationId FROM expenses WHERE expenseNumber IS NULL AND deletedAt IS NULL ORDER BY id");
  if (existingExp.length > 0) {
    const locCounters = {};
    for (const e of existingExp) {
      if (!locCounters[e.locationId]) {
        const [locRow] = await conn.execute("SELECT nextExpenseNumber FROM locations WHERE id = ?", [e.locationId]);
        locCounters[e.locationId] = locRow[0]?.nextExpenseNumber ?? 1;
      }
      const num = locCounters[e.locationId]++;
      const expNo = `EXP-${String(num).padStart(4, "0")}`;
      await conn.execute("UPDATE expenses SET expenseNumber = ? WHERE id = ?", [expNo, e.id]);
    }
    // Update location counters
    for (const [locId, nextNum] of Object.entries(locCounters)) {
      await conn.execute("UPDATE locations SET nextExpenseNumber = ? WHERE id = ?", [nextNum, locId]);
    }
    console.log(`Generated expense numbers for ${existingExp.length} existing expenses.`);
  }

  // 4. Ensure billNumber exists on all bills
  const [billCols] = await conn.execute("SHOW COLUMNS FROM bills");
  if (!billCols.find(c => c.Field === "billNumber")) {
    await conn.execute("ALTER TABLE bills ADD COLUMN billNumber VARCHAR(50)");
    console.log("Added billNumber to bills.");
  }

  // 5. Generate bill numbers for existing bills without one
  const [existingBills] = await conn.execute("SELECT id, locationId FROM bills WHERE billNumber IS NULL AND deletedAt IS NULL ORDER BY id");
  if (existingBills.length > 0) {
    const locBillCounters = {};
    for (const b of existingBills) {
      if (!locBillCounters[b.locationId]) {
        const [locRow] = await conn.execute("SELECT nextBillNumber FROM locations WHERE id = ?", [b.locationId]);
        locBillCounters[b.locationId] = locRow[0]?.nextBillNumber ?? 1;
      }
      const num = locBillCounters[b.locationId]++;
      const billNo = `BILL-${String(num).padStart(4, "0")}`;
      await conn.execute("UPDATE bills SET billNumber = ? WHERE id = ?", [billNo, b.id]);
    }
    for (const [locId, nextNum] of Object.entries(locBillCounters)) {
      await conn.execute("UPDATE locations SET nextBillNumber = ? WHERE id = ?", [nextNum, locId]);
    }
    console.log(`Generated bill numbers for ${existingBills.length} existing bills.`);
  }

  // 6. Add refNo to ledger_entries
  const [ledgerCols] = await conn.execute("SHOW COLUMNS FROM ledger_entries");
  if (!ledgerCols.find(c => c.Field === "refNo")) {
    await conn.execute("ALTER TABLE ledger_entries ADD COLUMN refNo VARCHAR(50)");
    console.log("Added refNo to ledger_entries.");
  }

  // 7. Backfill ledger refNo from related tables
  const [ledgerRows] = await conn.execute("SELECT id, transactionType, transactionId FROM ledger_entries WHERE refNo IS NULL AND deletedAt IS NULL");
  for (const le of ledgerRows) {
    let refNo = null;
    if (le.transactionType === "sale") {
      const [rows] = await conn.execute("SELECT id FROM daily_sales WHERE id = ?", [le.transactionId]);
      if (rows.length > 0) refNo = `SALE-${String(rows[0].id).padStart(4, "0")}`;
    } else if (le.transactionType === "expense") {
      const [rows] = await conn.execute("SELECT expenseNumber FROM expenses WHERE id = ?", [le.transactionId]);
      if (rows.length > 0) refNo = rows[0].expenseNumber;
    } else if (le.transactionType === "bill_payment") {
      const [rows] = await conn.execute("SELECT billNumber FROM bills WHERE id = (SELECT billId FROM bill_payments WHERE id = ?)", [le.transactionId]);
      if (rows.length > 0) refNo = rows[0].billNumber;
    } else if (le.transactionType === "payroll") {
      const [rows] = await conn.execute("SELECT periodName FROM payroll_periods WHERE id = ?", [le.transactionId]);
      if (rows.length > 0) refNo = `PAY-${rows[0].periodName}`;
    }
    if (refNo) {
      await conn.execute("UPDATE ledger_entries SET refNo = ? WHERE id = ?", [refNo, le.id]);
    }
  }
  console.log(`Backfilled ${ledgerRows.length} ledger entries with refNo.`);

  await conn.end();
  console.log("Migration v10 completed.");
}

migrate().catch(console.error);
