/**
 * Seed Demo Environment - creates demo business with pre-loaded data
 * Run: node db/seed-demo.cjs
 */
const mysql = require("mysql2/promise");
require("dotenv").config();

const uri = process.env.DATABASE_URL;
if (!uri) { console.error("DATABASE_URL not set"); process.exit(1); }

async function hashPassword(password) {
  const crypto = require("crypto");
  const secret = process.env.APP_SECRET || "finaflow-local-auth-secret-key-2025";
  return crypto.createHash("sha256").update(password + secret).digest("hex");
}

async function run() {
  const conn = await mysql.createConnection(uri);
  console.log("[seed-demo] Connected.");

  // 1. Create DEMO business if not exists
  const [existingDemo] = await conn.execute("SELECT id FROM businesses WHERE accountId = 'DEMO' AND deletedAt IS NULL");
  let demoBizId;
  if (existingDemo.length === 0) {
    const [r] = await conn.execute(
      "INSERT INTO businesses (accountId, name, slug, plan, maxBranches, maxUsers, isDemo, isActive, referralCode, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
      ["DEMO", "Finaflow Demo Restaurant", "finaflow-demo", "pro", 99, 99, true, true, "FINADEMO1"]
    );
    demoBizId = r.insertId;
    console.log(`[seed-demo] Created DEMO business (id=${demoBizId})`);
  } else {
    demoBizId = existingDemo[0].id;
    await conn.execute("UPDATE businesses SET isDemo = 1, isActive = 1, deletedAt = NULL WHERE id = ?", [demoBizId]);
    console.log(`[seed-demo] Using existing DEMO business (id=${demoBizId})`);
  }

  // 2. Create demo locations
  const locs = [
    { name: "HQ / Main Branch", slug: "hq-main" },
    { name: "Malindi Branch", slug: "malindi" },
  ];
  const locIds = {};
  for (const loc of locs) {
    const [existing] = await conn.execute(
      "SELECT id FROM locations WHERE businessId = ? AND name = ? AND deletedAt IS NULL",
      [demoBizId, loc.name]
    );
    if (existing.length === 0) {
      const [r] = await conn.execute(
        "INSERT INTO locations (businessId, name, slug, isActive, createdAt) VALUES (?, ?, ?, ?, NOW())",
        [demoBizId, loc.name, loc.slug, true]
      );
      locIds[loc.name] = r.insertId;
      console.log(`[seed-demo] Created location: ${loc.name} (id=${r.insertId})`);
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
    const [existing] = await conn.execute(
      "SELECT id FROM accounts WHERE locationId = ? AND name = ? AND deletedAt IS NULL",
      [acct.locId, acct.name]
    );
    if (existing.length === 0) {
      await conn.execute(
        "INSERT INTO accounts (name, type, locationId, openingBalance, currentBalance, isActive, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())",
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

  for (const u of defaultUsers) {
    const [existing] = await conn.execute("SELECT id, currentBusinessId FROM users WHERE username = ?", [u.username]);
    let userId;
    const pwdHash = await hashPassword(u.password);
    if (existing.length === 0) {
      const [r] = await conn.execute(
        "INSERT INTO users (username, passwordHash, name, role, isActive, currentBusinessId, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())",
        [u.username, pwdHash, u.name, u.role, true, demoBizId]
      );
      userId = r.insertId;
      console.log(`[seed-demo] Created user: ${u.username} (id=${userId})`);
    } else {
      userId = existing[0].id;
      await conn.execute(
        "UPDATE users SET passwordHash = ?, name = ?, role = ?, isActive = 1, deletedAt = NULL WHERE id = ?",
        [pwdHash, u.name, u.role, userId]
      );
      console.log(`[seed-demo] Updated user: ${u.username} (id=${userId})`);
    }

    // Link to demo business
    const [junction] = await conn.execute(
      "SELECT id FROM user_businesses WHERE userId = ? AND businessId = ?",
      [userId, demoBizId]
    );
    if (junction.length === 0) {
      await conn.execute(
        "INSERT INTO user_businesses (userId, businessId, role, isActive, createdAt) VALUES (?, ?, ?, ?, NOW())",
        [userId, demoBizId, u.role, true]
      );
      console.log(`[seed-demo] Linked ${u.username} to DEMO business`);
    } else {
      await conn.execute(
        "UPDATE user_businesses SET isActive = 1, role = ? WHERE id = ?",
        [u.role, junction[0].id]
      );
      console.log(`[seed-demo] Re-linked ${u.username} to DEMO business`);
    }

    // Set current business to demo
    await conn.execute("UPDATE users SET currentBusinessId = ? WHERE id = ?", [demoBizId, userId]);
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
    const [existing] = await conn.execute("SELECT id FROM expense_categories WHERE name = ? AND deletedAt IS NULL", [cat.name]);
    if (existing.length === 0) {
      await conn.execute(
        "INSERT INTO expense_categories (name, color, isActive, isLocationSpecific, createdAt) VALUES (?, ?, ?, ?, NOW())",
        [cat.name, cat.color, true, false]
      );
      console.log(`[seed-demo] Created category: ${cat.name}`);
    }
  }

  // 6. Create demo payment methods
  const methods = [
    { name: "Cash", code: "CASH" },
    { name: "M-PESA", code: "MPESA" },
    { name: "Bank Transfer", code: "BANK" },
    { name: "Card", code: "CARD" },
  ];
  for (const m of methods) {
    const [existing] = await conn.execute("SELECT id FROM payment_methods WHERE name = ? AND deletedAt IS NULL", [m.name]);
    if (existing.length === 0) {
      await conn.execute(
        "INSERT INTO payment_methods (businessId, name, code, isActive, createdAt) VALUES (?, ?, ?, ?, NOW())",
        [demoBizId, m.name, m.code, true]
      );
      console.log(`[seed-demo] Created payment method: ${m.name}`);
    }
  }

  await conn.end();
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
