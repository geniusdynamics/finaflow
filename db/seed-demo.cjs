/**
 * Seed Demo Environment - creates demo business with pre-loaded data
 * Run: node db/seed-demo.cjs
 */
const { Pool } = require("pg");
require("dotenv").config();
const { buildDemoReportingSeedPlan } = require("./seed-demo-plan.cjs");

const uri = process.env.DATABASE_URL;
if (!uri) { console.error("DATABASE_URL not set"); process.exit(1); }

async function hashPassword(password) {
  const crypto = require("crypto");
  const secret = process.env.APP_SECRET || "finaflow-local-auth-secret-key-2025";
  return crypto.createHash("sha256").update(password + secret).digest("hex");
}

function requiredId(map, key, label) {
  const value = map[key];
  if (!value) {
    throw new Error(`Missing ${label}: ${key}`);
  }
  return value;
}

async function run() {
  const pool = new Pool({ connectionString: uri });
  const conn = await pool.connect();
  console.log("[seed-demo] Connected.");

  // 1. Create DEMO business if not exists
  const { rows: existingDemo } = await conn.query("SELECT id FROM businesses WHERE \"accountId\" = 'DEMO' AND \"deletedAt\" IS NULL");
  let demoBizId;
  if (existingDemo.length === 0) {
    const { rows } = await conn.query(
      `INSERT INTO businesses ("accountId", name, slug, plan, "maxBranches", "maxUsers", "isDemo", "isActive", "referralCode", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING id`,
      ["DEMO", "Finaflow Demo Restaurant", "finaflow-demo", "pro", 99, 99, true, true, "FINADEMO1"]
    );
    demoBizId = rows[0].id;
    console.log(`[seed-demo] Created DEMO business (id=${demoBizId})`);
  } else {
    demoBizId = existingDemo[0].id;
    await conn.query("UPDATE businesses SET \"isDemo\" = true, \"isActive\" = true, \"deletedAt\" = NULL WHERE id = $1", [demoBizId]);
    console.log(`[seed-demo] Using existing DEMO business (id=${demoBizId})`);
  }

  // 2. Create demo locations
  const locs = [
    { name: "HQ / Main Branch", slug: "hq-main" },
    { name: "Malindi Branch", slug: "malindi" },
  ];
  const locIds = {};
  for (const loc of locs) {
    const { rows: existing } = await conn.query(
      "SELECT id FROM locations WHERE \"businessId\" = $1 AND name = $2 AND \"deletedAt\" IS NULL",
      [demoBizId, loc.name]
    );
    if (existing.length === 0) {
      const { rows } = await conn.query(
        "INSERT INTO locations (\"businessId\", name, slug, \"isActive\", \"createdAt\") VALUES ($1, $2, $3, $4, NOW()) RETURNING id",
        [demoBizId, loc.name, loc.slug, true]
      );
      locIds[loc.name] = rows[0].id;
      console.log(`[seed-demo] Created location: ${loc.name} (id=${rows[0].id})`);
    } else {
      locIds[loc.name] = existing[0].id;
      console.log(`[seed-demo] Location exists: ${loc.name} (id=${existing[0].id})`);
    }
  }

  // 3. Create demo accounts
  const mainLocId = locIds["HQ / Main Branch"];
  const malindiLocId = locIds["Malindi Branch"];
  const demoAccts = [
    { name: "Cash Drawer", type: "cash", locId: mainLocId, balance: "50000.00" },
    { name: "M-PESA Till", type: "mpesa", locId: mainLocId, balance: "75000.00" },
    { name: "Bank (KCB)", type: "bank_account", locId: mainLocId, balance: "200000.00" },
    { name: "Cash Drawer (Malindi)", type: "cash", locId: malindiLocId, balance: "30000.00" },
    { name: "M-PESA Till (Malindi)", type: "mpesa", locId: malindiLocId, balance: "45000.00" },
  ];
  for (const acct of demoAccts) {
    const { rows: existing } = await conn.query(
      "SELECT id FROM accounts WHERE \"locationId\" = $1 AND name = $2 AND \"deletedAt\" IS NULL",
      [acct.locId, acct.name]
    );
    if (existing.length === 0) {
      await conn.query(
        "INSERT INTO accounts (name, type, \"locationId\", \"openingBalance\", \"currentBalance\", \"isActive\", \"createdAt\") VALUES ($1, $2, $3, $4, $5, $6, NOW())",
        [acct.name, acct.type, acct.locId, acct.balance, acct.balance, true]
      );
      console.log(`[seed-demo] Created account: ${acct.name}`);
    } else {
      console.log(`[seed-demo] Account exists: ${acct.name}`);
    }
  }

  // 4. Create default users linked to DEMO
  const defaultUsers = [
    { username: "owner", password: "finaflow2024", name: "Business Owner", role: "owner" },
    { username: "admin", password: "finaflow2024", name: "System Admin", role: "admin" },
    { username: "manager", password: "finaflow2024", name: "General Manager", role: "manager" },
    { username: "cashier", password: "finaflow2024", name: "Front Desk Cashier", role: "employee" },
    { username: "viewer", password: "finaflow2024", name: "View Only User", role: "viewer" },
  ];
  const userIds = {};

  for (const u of defaultUsers) {
    const { rows: existing } = await conn.query("SELECT id, \"currentBusinessId\" FROM users WHERE username = $1", [u.username]);
    let userId;
    const pwdHash = await hashPassword(u.password);
    if (existing.length === 0) {
      const { rows } = await conn.query(
        "INSERT INTO users (username, \"passwordHash\", name, role, \"isActive\", \"currentBusinessId\", \"createdAt\") VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id",
        [u.username, pwdHash, u.name, u.role, true, demoBizId]
      );
      userId = rows[0].id;
      console.log(`[seed-demo] Created user: ${u.username} (id=${userId})`);
    } else {
      userId = existing[0].id;
      await conn.query(
        "UPDATE users SET \"passwordHash\" = $1, name = $2, role = $3, \"isActive\" = true, \"deletedAt\" = NULL WHERE id = $4",
        [pwdHash, u.name, u.role, userId]
      );
      console.log(`[seed-demo] Updated user: ${u.username} (id=${userId})`);
    }
    userIds[u.username] = userId;

    // Link to demo business
    const { rows: junction } = await conn.query(
      "SELECT id FROM user_businesses WHERE \"userId\" = $1 AND \"businessId\" = $2",
      [userId, demoBizId]
    );
    if (junction.length === 0) {
      await conn.query(
        "INSERT INTO user_businesses (\"userId\", \"businessId\", role, \"isActive\", \"createdAt\") VALUES ($1, $2, $3, $4, NOW())",
        [userId, demoBizId, u.role, true]
      );
      console.log(`[seed-demo] Linked ${u.username} to DEMO business`);
    } else {
      await conn.query(
        "UPDATE user_businesses SET \"isActive\" = true, role = $1 WHERE id = $2",
        [u.role, junction[0].id]
      );
      console.log(`[seed-demo] Re-linked ${u.username} to DEMO business`);
    }

    // Set current business to demo
    await conn.query("UPDATE users SET \"currentBusinessId\" = $1 WHERE id = $2", [demoBizId, userId]);
  }

  // 5. Create demo expense categories
  const categories = [
    { name: "Food & Beverage", color: "#2E7D32" },
    { name: "Utilities", color: "#D4A854" },
    { name: "Salaries", color: "#C73E1D" },
    { name: "Rent", color: "#8D8A87" },
    { name: "Supplies", color: "#ED6C02" },
    { name: "Marketing", color: "#2D2A26" },
  ];
  for (const cat of categories) {
    const { rows: existing } = await conn.query("SELECT id FROM expense_categories WHERE name = $1 AND \"deletedAt\" IS NULL", [cat.name]);
    if (existing.length === 0) {
      await conn.query(
        "INSERT INTO expense_categories (name, color, \"isActive\", \"createdAt\") VALUES ($1, $2, $3, NOW())",
        [cat.name, cat.color, true]
      );
      console.log(`[seed-demo] Created category: ${cat.name}`);
    }
  }

  // 6. Create demo suppliers
  const suppliers = [
    { name: "Sunset Properties", phone: "+254700100001", email: "rent@sunset.demo", contactPerson: "Grace Mwangi", paymentTermsDays: 15, notes: "Primary landlord" },
    { name: "Coast Fuel Supplies", phone: "+254700100002", email: "orders@coastfuel.demo", contactPerson: "Ali Hassan", paymentTermsDays: 14, notes: "Fuel and emergency logistics" },
    { name: "KPLC & Water Services", phone: "+254700100003", email: "billing@utilities.demo", contactPerson: "Utility Desk", paymentTermsDays: 10, notes: "Electricity and water" },
    { name: "Papertrail Packaging", phone: "+254700100004", email: "sales@papertrail.demo", contactPerson: "Winnie Kariuki", paymentTermsDays: 21, notes: "Packaging and stationery" },
  ];
  for (const supplier of suppliers) {
    const { rows: existing } = await conn.query(
      'SELECT id FROM suppliers WHERE name = $1 AND "deletedAt" IS NULL',
      [supplier.name],
    );
    if (existing.length === 0) {
      await conn.query(
        'INSERT INTO suppliers (name, phone, email, "contactPerson", "paymentTermsDays", notes, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())',
        [supplier.name, supplier.phone, supplier.email, supplier.contactPerson, supplier.paymentTermsDays, supplier.notes],
      );
      console.log(`[seed-demo] Created supplier: ${supplier.name}`);
    }
  }

  // 7. Create demo payment methods
  const methods = [
    { name: "Cash", code: "CASH" },
    { name: "M-PESA", code: "MPESA" },
    { name: "Bank Transfer", code: "BANK" },
    { name: "Card", code: "CARD" },
  ];
  for (const m of methods) {
    const { rows: existing } = await conn.query(
      'SELECT id FROM payment_methods WHERE "businessId" = $1 AND name = $2 AND "deletedAt" IS NULL',
      [demoBizId, m.name],
    );
    if (existing.length === 0) {
      await conn.query(
        "INSERT INTO payment_methods (\"businessId\", name, code, \"isActive\", \"createdAt\") VALUES ($1, $2, $3, $4, NOW())",
        [demoBizId, m.name, m.code, true]
      );
      console.log(`[seed-demo] Created payment method: ${m.name}`);
    }
  }

  // 8. Build and apply deterministic reporting data for DEMO
  const demoLocationIds = Object.values(locIds);
  const { rows: accountRows } = await conn.query(
    'SELECT id, name, "locationId" FROM accounts WHERE "locationId" = ANY($1::bigint[]) AND "deletedAt" IS NULL',
    [demoLocationIds],
  );
  const { rows: categoryRows } = await conn.query(
    'SELECT id, name FROM expense_categories WHERE name = ANY($1::text[]) AND "deletedAt" IS NULL',
    [categories.map((cat) => cat.name)],
  );
  const { rows: paymentMethodRows } = await conn.query(
    'SELECT id, name FROM payment_methods WHERE "businessId" = $1 AND name = ANY($2::text[]) AND "deletedAt" IS NULL',
    [demoBizId, methods.map((method) => method.name)],
  );
  const { rows: supplierRows } = await conn.query(
    'SELECT id, name FROM suppliers WHERE name = ANY($1::text[]) AND "deletedAt" IS NULL',
    [suppliers.map((supplier) => supplier.name)],
  );

  const accountIds = {
    cash: requiredId(
      Object.fromEntries(accountRows.map((row) => [`${row.locationId}:${row.name}`, row.id])),
      `${mainLocId}:Cash Drawer`,
      "account",
    ),
    mpesa: requiredId(
      Object.fromEntries(accountRows.map((row) => [`${row.locationId}:${row.name}`, row.id])),
      `${mainLocId}:M-PESA Till`,
      "account",
    ),
    bank: requiredId(
      Object.fromEntries(accountRows.map((row) => [`${row.locationId}:${row.name}`, row.id])),
      `${mainLocId}:Bank (KCB)`,
      "account",
    ),
  };
  const categoryIdMap = Object.fromEntries(categoryRows.map((row) => [row.name, row.id]));
  const paymentMethodIdMap = Object.fromEntries(paymentMethodRows.map((row) => [row.name, row.id]));
  const supplierIdMap = Object.fromEntries(supplierRows.map((row) => [row.name, row.id]));
  const plan = buildDemoReportingSeedPlan({
    anchorDate: new Date().toISOString().slice(0, 10),
    locationIds: {
      main: mainLocId,
      secondary: malindiLocId,
    },
    categoryIds: {
      food: requiredId(categoryIdMap, "Food & Beverage", "category"),
      utilities: requiredId(categoryIdMap, "Utilities", "category"),
      salaries: requiredId(categoryIdMap, "Salaries", "category"),
      rent: requiredId(categoryIdMap, "Rent", "category"),
      supplies: requiredId(categoryIdMap, "Supplies", "category"),
      marketing: requiredId(categoryIdMap, "Marketing", "category"),
    },
    paymentMethodIds: {
      cash: requiredId(paymentMethodIdMap, "Cash", "payment method"),
      mpesa: requiredId(paymentMethodIdMap, "M-PESA", "payment method"),
      bank: requiredId(paymentMethodIdMap, "Bank Transfer", "payment method"),
      card: requiredId(paymentMethodIdMap, "Card", "payment method"),
    },
    accountIds,
    supplierIds: {
      landlord: requiredId(supplierIdMap, "Sunset Properties", "supplier"),
      fuel: requiredId(supplierIdMap, "Coast Fuel Supplies", "supplier"),
      utilities: requiredId(supplierIdMap, "KPLC & Water Services", "supplier"),
      stationery: requiredId(supplierIdMap, "Papertrail Packaging", "supplier"),
    },
    enteredBy: requiredId(userIds, "owner", "user"),
  });

  await conn.query("BEGIN");
  try {
    await conn.query(
      'DELETE FROM "daily_sale_payments" WHERE "dailySaleId" IN (SELECT id FROM "daily_sales" WHERE "locationId" = ANY($1::bigint[]))',
      [demoLocationIds],
    );
    await conn.query('DELETE FROM "daily_sales" WHERE "locationId" = ANY($1::bigint[])', [demoLocationIds]);
    await conn.query('DELETE FROM "expenses" WHERE "locationId" = ANY($1::bigint[])', [demoLocationIds]);
    await conn.query('DELETE FROM "mpesa_transactions" WHERE "locationId" = ANY($1::bigint[])', [demoLocationIds]);
    await conn.query('DELETE FROM "budgets" WHERE "locationId" = ANY($1::bigint[])', [demoLocationIds]);
    await conn.query(
      'DELETE FROM "bill_payments" WHERE "billId" IN (SELECT id FROM "bills" WHERE "locationId" = ANY($1::bigint[]))',
      [demoLocationIds],
    );
    await conn.query(
      'DELETE FROM "bill_items" WHERE "billId" IN (SELECT id FROM "bills" WHERE "locationId" = ANY($1::bigint[]))',
      [demoLocationIds],
    );
    await conn.query('DELETE FROM "bills" WHERE "locationId" = ANY($1::bigint[])', [demoLocationIds]);

    for (const budget of plan.budgets) {
      await conn.query(
        'INSERT INTO budgets ("locationId", "categoryId", month, year, amount, notes, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())',
        [budget.locationId, budget.categoryId, budget.month, budget.year, budget.amount, budget.notes],
      );
    }

    const saleIdByKey = new Map();
    for (const sale of plan.sales) {
      const { rows } = await conn.query(
        'INSERT INTO daily_sales ("locationId", "saleDate", "cashTotal", "cardTotal", "mpesaTotal", "familyBankTotal", "coopBankTotal", "equityBankTotal", "boltTotal", "glovoTotal", "creditCardTotal", "deliveryPartnerTotal", "netSales", "discountAmount", "voidAmount", "unpaidAmount", "ticketCount", "orderCount", "voidCount", "giftCount", notes, "unpaidNotes", "enteredBy", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW(), NOW()) RETURNING id',
        [
          sale.locationId,
          sale.saleDate,
          sale.cashTotal,
          sale.cardTotal,
          sale.mpesaTotal,
          sale.familyBankTotal,
          sale.coopBankTotal,
          sale.equityBankTotal,
          sale.boltTotal,
          sale.glovoTotal,
          sale.creditCardTotal,
          sale.deliveryPartnerTotal,
          sale.netSales,
          sale.discountAmount,
          sale.voidAmount,
          sale.unpaidAmount,
          sale.ticketCount,
          sale.orderCount,
          sale.voidCount,
          sale.giftCount,
          sale.notes,
          sale.unpaidNotes,
          sale.enteredBy,
        ],
      );
      saleIdByKey.set(sale.saleKey, rows[0].id);
    }

    for (const payment of plan.salePayments) {
      await conn.query(
        'INSERT INTO daily_sale_payments ("dailySaleId", "paymentMethodId", amount, "createdAt") VALUES ($1, $2, $3, NOW())',
        [requiredId(Object.fromEntries(saleIdByKey), payment.saleKey, "sale"), payment.paymentMethodId, payment.amount],
      );
    }

    for (const expense of plan.expenses) {
      await conn.query(
        'INSERT INTO expenses ("locationId", "categoryId", "supplierId", "expenseNumber", "billId", "refNo", amount, description, "expenseDate", "paymentMethod", "accountId", "receiptImageUrl", "mpesaTxnId", "expenseRef", "isReimbursable", "reimbursedTo", "enteredBy", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())',
        [
          expense.locationId,
          expense.categoryId,
          expense.supplierId,
          expense.expenseNumber,
          expense.billId,
          expense.refNo,
          expense.amount,
          expense.description,
          expense.expenseDate,
          expense.paymentMethod,
          expense.accountId,
          expense.receiptImageUrl,
          expense.mpesaTxnId,
          expense.expenseRef,
          expense.isReimbursable,
          expense.reimbursedTo,
          expense.enteredBy,
        ],
      );
    }

    for (const txn of plan.mpesaTransactions) {
      await conn.query(
        'INSERT INTO mpesa_transactions ("locationId", "txnId", "txnDate", "txnTime", "txnType", "partyName", amount, "txnFee", balance, description, "rawText", "isLinked", "linkedExpenseId", "linkedBillId", "linkedSupplierId", "sourceAccountId", "destinationAccountId", "importedBy", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())',
        [
          txn.locationId,
          txn.txnId,
          txn.txnDate,
          txn.txnTime,
          txn.txnType,
          txn.partyName,
          txn.amount,
          txn.txnFee,
          txn.balance,
          txn.description,
          txn.rawText,
          txn.isLinked,
          txn.linkedExpenseId,
          txn.linkedBillId,
          txn.linkedSupplierId,
          txn.sourceAccountId,
          txn.destinationAccountId,
          txn.importedBy,
        ],
      );
    }

    for (const bill of plan.futureBills) {
      await conn.query(
        'INSERT INTO bills ("locationId", "supplierId", "billNumber", description, amount, "amountPaid", "balanceDue", "issueDate", "dueDate", status, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())',
        [
          bill.locationId,
          bill.supplierId,
          bill.billNumber,
          bill.description,
          bill.amount,
          bill.amountPaid,
          bill.balanceDue,
          bill.issueDate,
          bill.dueDate,
          bill.status,
        ],
      );
    }

    await conn.query("COMMIT");
    console.log(
      `[seed-demo] Seeded reporting data: ${plan.sales.length} sales, ${plan.expenses.length} expenses, ${plan.budgets.length} budgets, ${plan.mpesaTransactions.length} mpesa txns, ${plan.futureBills.length} future bills`,
    );
  } catch (error) {
    await conn.query("ROLLBACK");
    throw error;
  }

  conn.release();
  await pool.end();
  console.log("\n[seed-demo] === DONE ===");
  console.log("Demo Account ID: DEMO");
  console.log("Logins:");
  console.log("  owner / finaflow2024");
  console.log("  admin / finaflow2024");
  console.log("  manager / finaflow2024");
  console.log("  cashier / finaflow2024");
  console.log("  viewer / finaflow2024");
}

run().catch(e => { console.error("[seed-demo] Failed:", e); process.exit(1); });
