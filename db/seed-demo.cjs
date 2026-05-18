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

function toIsoDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

async function run() {
  const pool = new Pool({ connectionString: uri });
  const conn = await pool.connect();
  console.log("[seed-demo] Connected.");

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;

  await conn.query("BEGIN");

  try {
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

    const mainLocId = locIds["HQ / Main Branch"];
    const malindiLocId = locIds["Malindi Branch"];

    // 3. Create demo accounts with proper types and accounting classification
    const demoAccts = [
      { name: "Cash Drawer", type: "cash", locId: mainLocId, balance: "50000.00", accountType: "asset", accountSubType: "cash" },
      { name: "M-PESA Till", type: "mpesa", locId: mainLocId, balance: "75000.00", accountType: "asset", accountSubType: "cash" },
      { name: "Bank (KCB)", type: "bank_account", locId: mainLocId, balance: "200000.00", accountType: "asset", accountSubType: "bank" },
      { name: "Accounts Receivable", type: "bank_account", locId: mainLocId, balance: "0.00", accountType: "asset", accountSubType: "accounts_receivable" },
      { name: "Cash Drawer (Malindi)", type: "cash", locId: malindiLocId, balance: "30000.00", accountType: "asset", accountSubType: "cash" },
      { name: "M-PESA Till (Malindi)", type: "mpesa", locId: malindiLocId, balance: "45000.00", accountType: "asset", accountSubType: "cash" },
    ];

    const accountIdMap = {};
    for (const acct of demoAccts) {
      const { rows: existing } = await conn.query(
        "SELECT id FROM accounts WHERE \"locationId\" = $1 AND name = $2 AND \"deletedAt\" IS NULL",
        [acct.locId, acct.name]
      );
      let acctId;
      if (existing.length === 0) {
        const { rows } = await conn.query(
          `INSERT INTO accounts (name, type, "locationId", "businessId", "accountType", "accountSubType", "openingBalance", "currentBalance", "isActive", "isPaymentMethod", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING id`,
          [acct.name, acct.type, acct.locId, demoBizId, acct.accountType, acct.accountSubType, acct.balance, acct.balance, true, true]
        );
        acctId = rows[0].id;
        console.log(`[seed-demo] Created account: ${acct.name} (id=${acctId})`);
      } else {
        acctId = existing[0].id;
        console.log(`[seed-demo] Account exists: ${acct.name}`);
      }
      accountIdMap[`${acct.locId}:${acct.name}`] = acctId;
      accountIdMap[acct.name] = acctId;
    }

    // 4. Create expense accounts
    const { rows: expenseAccountRows } = await conn.query('SELECT id FROM accounts WHERE name = $1 LIMIT 1', ["Operating Expenses"]);
    let expenseAccountId = expenseAccountRows.length > 0 ? expenseAccountRows[0].id : null;
    if (!expenseAccountId) {
      const { rows } = await conn.query(
        `INSERT INTO accounts (name, type, "businessId", "accountType", "accountSubType", "openingBalance", "currentBalance", "isActive", "isPaymentMethod", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING id`,
        ["Operating Expenses", "bank_account", demoBizId, "expense", "operating_expense", "0.00", "0.00", true, false]
      );
      expenseAccountId = rows[0].id;
      console.log(`[seed-demo] Created expense account: Operating Expenses (id=${expenseAccountId})`);
    }

    // 5. Create revenue account
    let revenueAccountId;
    const { rows: revenueAccountRows } = await conn.query('SELECT id FROM accounts WHERE name = $1 LIMIT 1', ["Sales Revenue"]);
    revenueAccountId = revenueAccountRows.length > 0 ? revenueAccountRows[0].id : null;
    if (!revenueAccountId) {
      const { rows } = await conn.query(
        `INSERT INTO accounts (name, type, "businessId", "accountType", "accountSubType", "openingBalance", "currentBalance", "isActive", "isPaymentMethod", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING id`,
        ["Sales Revenue", "bank_account", demoBizId, "revenue", "sales_revenue", "0.00", "0.00", true, false]
      );
      revenueAccountId = rows[0].id;
      console.log(`[seed-demo] Created revenue account: Sales Revenue (id=${revenueAccountId})`);
    }

    // 6. Create default users linked to DEMO
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
          `INSERT INTO users (username, "passwordHash", name, role, "userType", "isActive", "currentBusinessId", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
          [u.username, pwdHash, u.name, u.role, "standard", true, demoBizId]
        );
        userId = rows[0].id;
        console.log(`[seed-demo] Created user: ${u.username} (id=${userId})`);
      } else {
        userId = existing[0].id;
        await conn.query(
          `UPDATE users SET "passwordHash" = $1, name = $2, role = $3, "isActive" = true, "deletedAt" = NULL WHERE id = $4`,
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
      }

      await conn.query("UPDATE users SET \"currentBusinessId\" = $1 WHERE id = $2", [demoBizId, userId]);
    }

    // 7. Create expense categories
    const categories = [
      { name: "Food & Beverage", color: "#2E7D32" },
      { name: "Utilities", color: "#D4A854" },
      { name: "Salaries", color: "#C73E1D" },
      { name: "Rent", color: "#8D8A87" },
      { name: "Supplies", color: "#ED6C02" },
      { name: "Marketing", color: "#2D2A26" },
    ];
    const categoryIdMap = {};
    for (const cat of categories) {
      const { rows: existing } = await conn.query("SELECT id FROM expense_categories WHERE name = $1 AND \"deletedAt\" IS NULL", [cat.name]);
      if (existing.length === 0) {
        const { rows } = await conn.query(
          `INSERT INTO expense_categories ("businessId", name, color, "defaultAccountId", "accountingClass", "isActive", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
          [demoBizId, cat.name, cat.color, expenseAccountId, "operating_expense", true]
        );
        categoryIdMap[cat.name] = rows[0].id;
        console.log(`[seed-demo] Created category: ${cat.name}`);
      } else {
        categoryIdMap[cat.name] = existing[0].id;
      }
    }

    // 8. Create demo suppliers
    const suppliers = [
      { name: "Sunset Properties", phone: "+254700100001", email: "rent@sunset.demo", contactPerson: "Grace Mwangi", paymentTermsDays: 15, notes: "Primary landlord" },
      { name: "Coast Fuel Supplies", phone: "+254700100002", email: "orders@coastfuel.demo", contactPerson: "Ali Hassan", paymentTermsDays: 14, notes: "Fuel and emergency logistics" },
      { name: "KPLC & Water Services", phone: "+254700100003", email: "billing@utilities.demo", contactPerson: "Utility Desk", paymentTermsDays: 10, notes: "Electricity and water" },
      { name: "Papertrail Packaging", phone: "+254700100004", email: "sales@papertrail.demo", contactPerson: "Winnie Kariuki", paymentTermsDays: 21, notes: "Packaging and stationery" },
    ];
    const supplierIdMap = {};
    for (const supplier of suppliers) {
      const { rows: existing } = await conn.query('SELECT id FROM suppliers WHERE name = $1 AND "deletedAt" IS NULL', [supplier.name]);
      if (existing.length === 0) {
        const { rows } = await conn.query(
          `INSERT INTO suppliers ("businessId", name, phone, email, "contactPerson", "paymentTermsDays", notes, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id`,
          [demoBizId, supplier.name, supplier.phone, supplier.email, supplier.contactPerson, supplier.paymentTermsDays, supplier.notes]
        );
        supplierIdMap[supplier.name] = rows[0].id;
        console.log(`[seed-demo] Created supplier: ${supplier.name}`);
      } else {
        supplierIdMap[supplier.name] = existing[0].id;
      }
    }

    // 9. Create demo payment methods WITH location linking
    const methods = [
      { name: "Cash", code: "CASH", color: "#22C55E" },
      { name: "M-PESA", code: "MPESA", color: "#00A86B" },
      { name: "Bank Transfer", code: "BANK", color: "#3B82F6" },
      { name: "Card", code: "CARD", color: "#8B5CF6" },
    ];
    const paymentMethodIdMap = {};
    for (const m of methods) {
      const { rows: existing } = await conn.query(
        'SELECT id FROM payment_methods WHERE "businessId" = $1 AND name = $2 AND "deletedAt" IS NULL',
        [demoBizId, m.name]
      );
      if (existing.length === 0) {
        const { rows } = await conn.query(
          `INSERT INTO payment_methods ("businessId", name, code, color, "isActive", "createdAt") VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`,
          [demoBizId, m.name, m.code, m.color, true]
        );
        paymentMethodIdMap[m.name] = rows[0].id;
        console.log(`[seed-demo] Created payment method: ${m.name}`);
      } else {
        paymentMethodIdMap[m.name] = existing[0].id;
      }
    }

    // 10. Link payment methods to locations with their corresponding accounts
    const cashAccountId = accountIdMap[`${mainLocId}:Cash Drawer`];
    const mpesaAccountId = accountIdMap[`${mainLocId}:M-PESA Till`];
    const bankAccountId = accountIdMap[`${mainLocId}:Bank (KCB)`];
    const malindiCashAccountId = accountIdMap[`${malindiLocId}:Cash Drawer (Malindi)`];
    const malindiMpesaAccountId = accountIdMap[`${malindiLocId}:M-PESA Till (Malindi)`];

    const locationPaymentMethodMappings = [
      { locId: mainLocId, methodName: "Cash", accountId: cashAccountId },
      { locId: mainLocId, methodName: "M-PESA", accountId: mpesaAccountId },
      { locId: mainLocId, methodName: "Bank Transfer", accountId: bankAccountId },
      { locId: mainLocId, methodName: "Card", accountId: bankAccountId },
      { locId: malindiLocId, methodName: "Cash", accountId: malindiCashAccountId },
      { locId: malindiLocId, methodName: "M-PESA", accountId: malindiMpesaAccountId },
    ];

    for (const mapping of locationPaymentMethodMappings) {
      const methodId = paymentMethodIdMap[mapping.methodName];
      if (!methodId || !mapping.accountId) continue;
      
      const { rows: existing } = await conn.query(
        'SELECT id FROM location_payment_methods WHERE "locationId" = $1 AND "paymentMethodId" = $2',
        [mapping.locId, methodId]
      );
      if (existing.length === 0) {
        await conn.query(
          `INSERT INTO location_payment_methods ("locationId", "paymentMethodId", "linkedAccountId", "isActive", "createdAt") VALUES ($1, $2, $3, $4, NOW())`,
          [mapping.locId, methodId, mapping.accountId, true]
        );
        console.log(`[seed-demo] Linked ${mapping.methodName} to location ${mapping.locId} -> account ${mapping.accountId}`);
      }
    }

    // 11. Create employees
    const employees = [
      { fullName: "James Mwangi", phone: "+254711000001", idNumber: "12345678", salaryType: "monthly", basicSalary: "85000.00", employmentDate: toIsoDate(2023, 3, 1) },
      { fullName: "Grace Wanjiku", phone: "+254711000002", idNumber: "23456789", salaryType: "monthly", basicSalary: "65000.00", employmentDate: toIsoDate(2023, 6, 15) },
      { fullName: "Peter Ochieng", phone: "+254711000003", idNumber: "34567890", salaryType: "monthly", basicSalary: "45000.00", employmentDate: toIsoDate(2024, 1, 10) },
      { fullName: "Faith Akinyi", phone: "+254711000004", idNumber: "45678901", salaryType: "monthly", basicSalary: "38000.00", employmentDate: toIsoDate(2024, 4, 1) },
      { fullName: "David Kimani", phone: "+254711000005", idNumber: "56789012", salaryType: "monthly", basicSalary: "42000.00", employmentDate: toIsoDate(2024, 7, 1) },
    ];
    const employeeIdMap = {};
    for (const emp of employees) {
      const { rows: existing } = await conn.query(
        'SELECT id FROM employees WHERE "fullName" = $1 AND "phone" = $2 AND "deletedAt" IS NULL',
        [emp.fullName, emp.phone]
      );
      if (existing.length === 0) {
        const { rows } = await conn.query(
          `INSERT INTO employees ("locationId", "fullName", "phone", "idNumber", "salaryType", "basicSalary", "employmentDate", "isActive", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING id`,
          [mainLocId, emp.fullName, emp.phone, emp.idNumber, emp.salaryType, emp.basicSalary, emp.employmentDate, true]
        );
        employeeIdMap[emp.fullName] = rows[0].id;
        console.log(`[seed-demo] Created employee: ${emp.fullName}`);
      } else {
        employeeIdMap[emp.fullName] = existing[0].id;
      }
    }

    // 12. Create payroll settings for the location
    const { rows: existingPayrollSettings } = await conn.query('SELECT id FROM payroll_settings WHERE "locationId" = $1', [mainLocId]);
    if (existingPayrollSettings.length === 0) {
      await conn.query(
        `INSERT INTO payroll_settings ("locationId", "nhifRate", "nssfTier1Limit", "nssfTier1Employee", "nssfTier1Employer", "nssfTier2Limit", "nssfTier2Employee", "nssfTier2Employer", "personalRelief", "insuranceRelief", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
        [mainLocId, "2.75", "7000.00", "420.00", "420.00", "36000.00", "1740.00", "1740.00", "2400.00", "0.00"]
      );
      console.log(`[seed-demo] Created payroll settings for HQ`);
    }

    // 13. Create COGS targets
    const { rows: existingCogsTargets } = await conn.query('SELECT id FROM cogs_targets WHERE "locationId" = $1', [mainLocId]);
    if (existingCogsTargets.length === 0) {
      await conn.query(
        `INSERT INTO cogs_targets ("locationId", "targetFoodCostPercent", "alertThresholdPercent", "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW())`,
        [mainLocId, "35.00", "38.00"]
      );
      await conn.query(
        `INSERT INTO cogs_targets ("locationId", "targetFoodCostPercent", "alertThresholdPercent", "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW())`,
        [malindiLocId, "33.00", "36.00"]
      );
      console.log(`[seed-demo] Created COGS targets for both locations`);
    }

    // 14. Create payroll periods and entries for the last 3 months
    const payrollMonths = [
      { monthOffset: 2, month: currentMonth - 2 <= 0 ? currentMonth - 2 + 12 : currentMonth - 2, year: currentMonth - 2 <= 0 ? currentYear - 1 : currentYear },
      { monthOffset: 1, month: currentMonth - 1 <= 0 ? currentMonth - 1 + 12 : currentMonth - 1, year: currentMonth - 1 <= 0 ? currentYear - 1 : currentYear },
      { monthOffset: 0, month: currentMonth, year: currentYear },
    ];

    for (const pm of payrollMonths) {
      const periodStart = toIsoDate(pm.year, pm.month, 1);
      const lastDay = new Date(Date.UTC(pm.year, pm.month, 0)).getDate();
      const periodEnd = toIsoDate(pm.year, pm.month, lastDay);
      const paymentDate = toIsoDate(pm.year, pm.month, lastDay - 2);
      const periodName = `${new Date(Date.UTC(pm.year, pm.month - 1)).toLocaleString('en-US', { month: 'long' })} ${pm.year} Payroll`;
      
      const { rows: existingPeriod } = await conn.query(
        `SELECT id FROM payroll_periods WHERE "locationId" = $1 AND "periodName" = $2 AND "deletedAt" IS NULL`,
        [mainLocId, periodName]
      );
      
      let periodId;
      if (existingPeriod.length === 0) {
        const { rows } = await conn.query(
          `INSERT INTO payroll_periods ("locationId", "periodName", "startDate", "endDate", "paymentDate", status, "totalNetPay", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
          [mainLocId, periodName, periodStart, periodEnd, paymentDate, "paid", "275000.00"]
        );
        periodId = rows[0].id;
        console.log(`[seed-demo] Created payroll period: ${periodName}`);
      } else {
        periodId = existingPeriod[0].id;
      }

      // Create payroll entries for each employee
      for (const emp of employees) {
        const empId = employeeIdMap[emp.fullName];
        const basicPay = parseFloat(emp.basicSalary);
        const tax = Math.max(0, (basicPay - 2400) * 0.3);
        const nhif = basicPay * 0.0275;
        const nssf = Math.min(basicPay * 0.06, 2160);
        const netPay = basicPay - tax - nhif - nssf;

        const { rows: existingEntry } = await conn.query(
          `SELECT id FROM payroll_entries WHERE "periodId" = $1 AND "employeeId" = $2`,
          [periodId, empId]
        );
        if (existingEntry.length === 0) {
          await conn.query(
            `INSERT INTO payroll_entries ("periodId", "employeeId", "basicPay", "deductions", "payeDeducted", "nhifDeducted", "nssfDeducted", "netPay", "paidAt", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
            [periodId, empId, emp.basicSalary, "0.00", tax.toFixed(2), nhif.toFixed(2), nssf.toFixed(2), netPay.toFixed(2)]
          );
        }
      }
    }

    // 15. Build reporting data plan
    const demoLocationIds = Object.values(locIds);
    const accountIds = {
      cash: cashAccountId,
      mpesa: mpesaAccountId,
      bank: bankAccountId,
    };

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

    // 16. Clear old reporting data
    await conn.query('DELETE FROM "daily_sale_payments" WHERE "dailySaleId" IN (SELECT id FROM "daily_sales" WHERE "locationId" = ANY($1::bigint[]))', [demoLocationIds]);
    await conn.query('DELETE FROM "daily_sales" WHERE "locationId" = ANY($1::bigint[])', [demoLocationIds]);
    await conn.query('DELETE FROM "expenses" WHERE "locationId" = ANY($1::bigint[])', [demoLocationIds]);
    await conn.query('DELETE FROM "mpesa_transactions" WHERE "locationId" = ANY($1::bigint[])', [demoLocationIds]);
    await conn.query('DELETE FROM "budgets" WHERE "locationId" = ANY($1::bigint[])', [demoLocationIds]);
    await conn.query('DELETE FROM "bill_payments" WHERE "billId" IN (SELECT id FROM "bills" WHERE "locationId" = ANY($1::bigint[]))', [demoLocationIds]);
    await conn.query('DELETE FROM "bill_items" WHERE "billId" IN (SELECT id FROM "bills" WHERE "locationId" = ANY($1::bigint[]))', [demoLocationIds]);
    await conn.query('DELETE FROM "bills" WHERE "locationId" = ANY($1::bigint[])', [demoLocationIds]);
    await conn.query('DELETE FROM "ledger_entries" WHERE "accountId" = ANY($1::bigint[])', [Object.values(accountIdMap)]);

    // 17. Insert budgets
    for (const budget of plan.budgets) {
      await conn.query(
        `INSERT INTO budgets ("locationId", "categoryId", month, year, amount, notes, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [budget.locationId, budget.categoryId, budget.month, budget.year, budget.amount, budget.notes]
      );
    }
    console.log(`[seed-demo] Created ${plan.budgets.length} budget entries`);

    // 18. Insert daily sales and their payment breakdowns
    const saleIdByKey = new Map();
    for (const sale of plan.sales) {
      const { rows } = await conn.query(
        `INSERT INTO daily_sales ("locationId", "saleDate", "cashTotal", "cardTotal", "mpesaTotal", "familyBankTotal", "coopBankTotal", "equityBankTotal", "boltTotal", "glovoTotal", "creditCardTotal", "deliveryPartnerTotal", "netSales", "discountAmount", "voidAmount", "unpaidAmount", "ticketCount", "orderCount", "voidCount", "giftCount", notes, "unpaidNotes", "enteredBy", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW(), NOW()) RETURNING id`,
        [
          sale.locationId, sale.saleDate, sale.cashTotal, sale.cardTotal, sale.mpesaTotal,
          sale.familyBankTotal, sale.coopBankTotal, sale.equityBankTotal, sale.boltTotal,
          sale.glovoTotal, sale.creditCardTotal, sale.deliveryPartnerTotal, sale.netSales,
          sale.discountAmount, sale.voidAmount, sale.unpaidAmount, sale.ticketCount,
          sale.orderCount, sale.voidCount, sale.giftCount, sale.notes, sale.unpaidNotes, sale.enteredBy,
        ]
      );
      saleIdByKey.set(sale.saleKey, rows[0].id);
    }
    console.log(`[seed-demo] Created ${plan.sales.length} daily sales records`);

    // 19. Insert daily sale payments (links payments to sale records)
    for (const payment of plan.salePayments) {
      await conn.query(
        `INSERT INTO daily_sale_payments ("dailySaleId", "paymentMethodId", amount, "createdAt") VALUES ($1, $2, $3, NOW())`,
        [requiredId(Object.fromEntries(saleIdByKey), payment.saleKey, "sale"), payment.paymentMethodId, payment.amount]
      );
    }
    console.log(`[seed-demo] Created ${plan.salePayments.length} daily sale payment records`);

    // 20. Insert expenses with proper payment method mapping
    for (const expense of plan.expenses) {
      await conn.query(
        `INSERT INTO expenses ("locationId", "categoryId", "supplierId", "expenseNumber", "billId", "refNo", amount, description, "expenseDate", "paymentMethod", "accountId", "receiptImageUrl", "mpesaTxnId", "expenseRef", "isReimbursable", "reimbursedTo", "enteredBy", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())`,
        [
          expense.locationId, expense.categoryId, expense.supplierId, expense.expenseNumber,
          expense.billId, expense.refNo, expense.amount, expense.description, expense.expenseDate,
          expense.paymentMethod, expense.accountId, expense.receiptImageUrl, expense.mpesaTxnId,
          expense.expenseRef, expense.isReimbursable, expense.reimbursedTo, expense.enteredBy,
        ]
      );
    }
    console.log(`[seed-demo] Created ${plan.expenses.length} expense records`);

    // 21. Insert M-PESA transactions
    for (const txn of plan.mpesaTransactions) {
      await conn.query(
        `INSERT INTO mpesa_transactions ("locationId", "txnId", "txnDate", "txnTime", "txnType", "partyName", amount, "txnFee", balance, description, "rawText", "isLinked", "linkedExpenseId", "linkedBillId", "linkedSupplierId", "sourceAccountId", "destinationAccountId", "importedBy", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())`,
        [
          txn.locationId, txn.txnId, txn.txnDate, txn.txnTime, txn.txnType, txn.partyName,
          txn.amount, txn.txnFee, txn.balance, txn.description, txn.rawText, txn.isLinked,
          txn.linkedExpenseId, txn.linkedBillId, txn.linkedSupplierId, txn.sourceAccountId,
          txn.destinationAccountId, txn.importedBy,
        ]
      );
    }
    console.log(`[seed-demo] Created ${plan.mpesaTransactions.length} M-PESA transactions`);

    // 22. Insert future bills
    for (const bill of plan.futureBills) {
      await conn.query(
        `INSERT INTO bills ("locationId", "supplierId", "billNumber", description, amount, "amountPaid", "balanceDue", "issueDate", "dueDate", status, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
        [bill.locationId, bill.supplierId, bill.billNumber, bill.description, bill.amount, bill.amountPaid, bill.balanceDue, bill.issueDate, bill.dueDate, bill.status]
      );
    }
    console.log(`[seed-demo] Created ${plan.futureBills.length} future bills`);

    // 23. Create ledger entries for account money movement
    const ledgerEntries = [];
    
    // Opening balance entries for all accounts
    for (const acct of demoAccts) {
      const acctId = accountIdMap[`${acct.locId}:${acct.name}`];
      if (acctId && parseFloat(acct.balance) > 0) {
        ledgerEntries.push({
          accountId: acctId,
          transactionType: "opening_balance",
          transactionId: 0,
          entryType: "debit",
          amount: acct.balance,
          balanceAfter: acct.balance,
          description: "Opening balance",
          entryDate: toIsoDate(currentYear, currentMonth, 1),
          createdBy: userIds.owner,
        });
      }
    }

    // Sales entries - money flowing into accounts
    for (const sale of plan.sales) {
      const saleId = saleIdByKey.get(sale.saleKey);
      if (!saleId) continue;
      
      // Cash sales
      if (parseFloat(sale.cashTotal) > 0) {
        const cashAcctId = sale.locationId === mainLocId ? cashAccountId : malindiCashAccountId;
        ledgerEntries.push({
          accountId: cashAcctId,
          transactionType: "sale",
          transactionId: saleId,
          entryType: "debit",
          amount: sale.cashTotal,
          balanceAfter: "0.00",
          description: "Cash sales",
          entryDate: sale.saleDate,
          createdBy: sale.enteredBy,
        });
        ledgerEntries.push({
          accountId: revenueAccountId,
          transactionType: "sale",
          transactionId: saleId,
          entryType: "credit",
          amount: sale.cashTotal,
          balanceAfter: "0.00",
          description: "Sales revenue",
          entryDate: sale.saleDate,
          createdBy: sale.enteredBy,
        });
      }

      // M-PESA sales
      if (parseFloat(sale.mpesaTotal) > 0) {
        const mpesaAcctId = sale.locationId === mainLocId ? mpesaAccountId : malindiMpesaAccountId;
        ledgerEntries.push({
          accountId: mpesaAcctId,
          transactionType: "sale",
          transactionId: saleId,
          entryType: "debit",
          amount: sale.mpesaTotal,
          balanceAfter: "0.00",
          description: "M-PESA sales",
          entryDate: sale.saleDate,
          createdBy: sale.enteredBy,
        });
      }
    }

    // Expense entries - money flowing out
    for (const expense of plan.expenses) {
      if (expense.accountId) {
        ledgerEntries.push({
          accountId: expense.accountId,
          transactionType: "expense",
          transactionId: 0,
          entryType: "credit",
          amount: expense.amount,
          balanceAfter: "0.00",
          description: expense.description,
          entryDate: expense.expenseDate,
          createdBy: expense.enteredBy,
        });
      }
    }

    // M-PESA topups - money transfer between accounts
    for (const txn of plan.mpesaTransactions) {
      if (txn.sourceAccountId && txn.destinationAccountId) {
        const isTopup = parseFloat(txn.amount) > 0;
        if (isTopup) {
          ledgerEntries.push({
            accountId: txn.sourceAccountId,
            transactionType: "transfer",
            transactionId: 0,
            entryType: "credit",
            amount: txn.amount,
            balanceAfter: txn.balance,
            description: txn.description,
            entryDate: txn.txnDate,
            createdBy: txn.importedBy,
          });
          ledgerEntries.push({
            accountId: txn.destinationAccountId,
            transactionType: "mpesa_topup",
            transactionId: 0,
            entryType: "debit",
            amount: txn.amount,
            balanceAfter: txn.balance,
            description: txn.description,
            entryDate: txn.txnDate,
            createdBy: txn.importedBy,
          });
        }
      }
    }

    // Insert all ledger entries
    for (const entry of ledgerEntries) {
      await conn.query(
        `INSERT INTO ledger_entries ("accountId", "transactionType", "transactionId", "entryType", amount, "balanceAfter", description, "entryDate", "createdBy", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [entry.accountId, entry.transactionType, entry.transactionId, entry.entryType, entry.amount, entry.balanceAfter, entry.description, entry.entryDate, entry.createdBy]
      );
    }
    console.log(`[seed-demo] Created ${ledgerEntries.length} ledger entries`);

    await conn.query("COMMIT");

    console.log(`[seed-demo] Seeded: ${plan.sales.length} sales, ${plan.expenses.length} expenses, ${plan.budgets.length} budgets, ${plan.mpesaTransactions.length} mpesa txns, ${plan.futureBills.length} bills, ${employees.length} employees, ${payrollMonths.length} payroll periods`);

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
  } catch (error) {
    await conn.query("ROLLBACK");
    throw error;
  }
}

run().catch(e => { console.error("[seed-demo] Failed:", e); process.exit(1); });