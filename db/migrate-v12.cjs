/**
 * Migration v12: Add accountId, referral tracking, and business assignment columns
 */
const mysql = require("mysql2/promise");
require("dotenv").config();

const uri = process.env.DATABASE_URL;
if (!uri) { console.error("DATABASE_URL not set"); process.exit(1); }

async function run() {
  const conn = await mysql.createConnection(uri);
  console.log("[v12] Connected.");

  const cols = await conn.execute("SHOW COLUMNS FROM businesses");
  const existing = new Set(cols[0].map((c) => c.Field));

  if (!existing.has("accountId")) {
    await conn.execute(`ALTER TABLE businesses ADD COLUMN accountId VARCHAR(100) NOT NULL DEFAULT '' AFTER id`);
    console.log("[v12] Added accountId column.");
  }
  if (!existing.has("referralCode")) {
    await conn.execute(`ALTER TABLE businesses ADD COLUMN referralCode VARCHAR(50) NULL AFTER whiteLabelDomain`);
    console.log("[v12] Added referralCode column.");
  }
  if (!existing.has("referredByBusinessId")) {
    await conn.execute(`ALTER TABLE businesses ADD COLUMN referredByBusinessId BIGINT UNSIGNED NULL AFTER referralCode`);
    console.log("[v12] Added referredByBusinessId column.");
  }
  if (!existing.has("referredByUserId")) {
    await conn.execute(`ALTER TABLE businesses ADD COLUMN referredByUserId BIGINT UNSIGNED NULL AFTER referredByBusinessId`);
    console.log("[v12] Added referredByUserId column.");
  }
  if (!existing.has("firstMonthDiscountApplied")) {
    await conn.execute(`ALTER TABLE businesses ADD COLUMN firstMonthDiscountApplied TINYINT(1) NOT NULL DEFAULT 0 AFTER referredByUserId`);
    console.log("[v12] Added firstMonthDiscountApplied column.");
  }

  // Backfill accountId from slug for existing rows
  const [rows] = await conn.execute("SELECT id, slug FROM businesses WHERE accountId = '' OR accountId IS NULL");
  for (const r of rows) {
    const acctId = r.slug.replace(/^[^a-zA-Z0-9]+/, "").toUpperCase().substring(0, 30) || `ACCT${r.id}`;
    await conn.execute("UPDATE businesses SET accountId = ? WHERE id = ?", [acctId, r.id]);
  }
  console.log(`[v12] Backfilled accountId for ${rows.length} businesses.`);

  // Add unique index on accountId
  try {
    await conn.execute("ALTER TABLE businesses ADD UNIQUE INDEX idx_account_id (accountId)");
    console.log("[v12] Added unique index on accountId.");
  } catch (e) {
    if (e.message.includes("Duplicate")) {
      console.log("[v12] Unique index on accountId already exists or duplicate values found.");
    } else {
      console.log("[v12] Note:", e.message);
    }
  }

  // Add unique index on referralCode (allow NULL duplicates)
  try {
    await conn.execute("ALTER TABLE businesses ADD UNIQUE INDEX idx_referral_code (referralCode)");
    console.log("[v12] Added unique index on referralCode.");
  } catch (e) {
    if (e.message.includes("Duplicate")) {
      console.log("[v12] Unique index on referralCode already exists.");
    } else {
      console.log("[v12] Note:", e.message);
    }
  }

  // Add index on referredByBusinessId
  try {
    await conn.execute("ALTER TABLE businesses ADD INDEX idx_referred_by_biz (referredByBusinessId)");
    console.log("[v12] Added index on referredByBusinessId.");
  } catch (e) {
    console.log("[v12] Note:", e.message);
  }

  await conn.end();
  console.log("[v12] Done.");
}

run().catch((e) => { console.error("[v12] Failed:", e); process.exit(1); });
