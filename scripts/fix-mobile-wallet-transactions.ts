// ABOUTME: One-time remediation for the mobile_wallet_transactions table.
// ABOUTME: Purges soft-deleted rows that would otherwise permanently occupy the (provider, provider_txn_id) unique slot,
// ABOUTME: and audits the post-migration state of the table.
// ABOUTME: Most data-quality backfills are done in migration 0009 (idempotent DML); this script is the
// ABOUTME: interactive auditor + soft-delete purger for environments where you want a confirmation step
// ABOUTME: before destroying soft-deleted rows.

import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// SAFETY: Set this to true to actually delete soft-deleted rows. Default false = dry-run only.
const PURGE_SOFT_DELETED = false;

interface CountRow { count: string }

async function fixMobileWalletTransactions() {
  const client = await pool.connect();

  try {
    console.log("=== MOBILE WALLET DATA-QUALITY FIX ===\n");
    console.log(`Mode: ${PURGE_SOFT_DELETED ? "🔴 PURGE (destructive)" : "🟢 DRY-RUN (no destructive operations)"}`);
    console.log(`Set PURGE_SOFT_DELETED = true at the top of this file to enable purging.\n`);

    // Step 1: Overall row counts
    console.log("--- Current state of mobile_wallet_transactions ---");
    const total = await client.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM "mobile_wallet_transactions"`,
    );
    const live = await client.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM "mobile_wallet_transactions" WHERE "deletedAt" IS NULL`,
    );
    const softDeleted = await client.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM "mobile_wallet_transactions" WHERE "deletedAt" IS NOT NULL`,
    );
    console.log(`  Total rows:                ${total.rows[0].count}`);
    console.log(`  Live rows (deletedAt null): ${live.rows[0].count}`);
    console.log(`  Soft-deleted rows:         ${softDeleted.rows[0].count}`);

    // Step 2: Check for the partial unique index
    console.log("\n--- Unique index health ---");
    const indexInfo = await client.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
       WHERE schemaname = current_schema()
         AND tablename = 'mobile_wallet_transactions'
         AND indexname = 'idx_wallet_txn_provider_txn'`,
    );
    if (indexInfo.rows.length === 0) {
      console.log("  ❌ idx_wallet_txn_provider_txn is MISSING — run migration 0009");
    } else if (indexInfo.rows[0].indexdef.includes("WHERE")) {
      console.log("  ✓ idx_wallet_txn_provider_txn is a PARTIAL unique index (correct)");
      console.log(`     ${indexInfo.rows[0].indexdef}`);
    } else {
      console.log("  ❌ idx_wallet_txn_provider_txn is a NON-PARTIAL unique index");
      console.log("     → Soft-deleted rows still block re-imports. Run migration 0009 to fix.");
    }

    // Step 3: Identify (provider, provider_txn_id) collisions on live rows
    console.log("\n--- Duplicate live (provider, provider_txn_id) check ---");
    const liveDuplicates = await client.query<{ provider: string; provider_txn_id: string; cnt: string }>(
      `SELECT "provider", "provider_txn_id", COUNT(*)::text AS cnt
       FROM "mobile_wallet_transactions"
       WHERE "deletedAt" IS NULL
       GROUP BY "provider", "provider_txn_id"
       HAVING COUNT(*) > 1
       ORDER BY COUNT(*) DESC
       LIMIT 20`,
    );
    if (liveDuplicates.rows.length === 0) {
      console.log("  ✓ No duplicate live rows");
    } else {
      console.log(`  ⚠️  Found ${liveDuplicates.rows.length} duplicate (provider, provider_txn_id) groups on live rows:`);
      for (const dup of liveDuplicates.rows) {
        console.log(`     provider=${dup.provider} provider_txn_id=${dup.provider_txn_id} count=${dup.cnt}`);
      }
    }

    // Step 4: Identify soft-deleted rows whose (provider, provider_txn_id) slot has a live row too
    console.log("\n--- Soft-deleted rows blocking re-imports ---");
    const blockingRows = await client.query<{
      provider: string;
      provider_txn_id: string;
      soft_deleted_count: string;
      live_count: string;
    }>(
      `SELECT * FROM (
         SELECT t1."provider", t1."provider_txn_id",
                (SELECT COUNT(*) FROM "mobile_wallet_transactions" t2
                  WHERE t2."provider" = t1."provider"
                    AND t2."provider_txn_id" = t1."provider_txn_id"
                    AND t2."deletedAt" IS NOT NULL)::text AS soft_deleted_count,
                (SELECT COUNT(*) FROM "mobile_wallet_transactions" t3
                  WHERE t3."provider" = t1."provider"
                    AND t3."provider_txn_id" = t1."provider_txn_id"
                    AND t3."deletedAt" IS NULL)::text AS live_count
         FROM "mobile_wallet_transactions" t1
         WHERE t1."deletedAt" IS NOT NULL
         GROUP BY t1."provider", t1."provider_txn_id"
         HAVING (SELECT COUNT(*) FROM "mobile_wallet_transactions" t3
                  WHERE t3."provider" = t1."provider"
                    AND t3."provider_txn_id" = t1."provider_txn_id"
                    AND t3."deletedAt" IS NULL) = 0
       ) AS blocking
       ORDER BY blocking.soft_deleted_count::int DESC
       LIMIT 20`,
    );
    if (blockingRows.rows.length === 0) {
      console.log("  ✓ No soft-deleted rows blocking re-imports (after partial index migration)");
    } else {
      console.log(`  ℹ️  Found ${blockingRows.rows.length} (provider, provider_txn_id) groups that have ONLY soft-deleted rows:`);
      for (const row of blockingRows.rows) {
        console.log(`     provider=${row.provider} provider_txn_id=${row.provider_txn_id} soft_deleted=${row.soft_deleted_count}`);
      }
      console.log("  → These soft-deleted rows are still occupying unique slots.");
      console.log("  → With the partial index, new imports of the same provider_txn_id will succeed.");
      console.log("  → The partial index makes purging OPTIONAL rather than REQUIRED for new imports.");
    }

    // Step 5: Null-data audit (should be zero after migration 0009)
    console.log("\n--- Null-data audit (should all be 0 after migration 0009) ---");
    const nullDesc = await client.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM "mobile_wallet_transactions" WHERE "description" IS NULL`,
    );
    const nullParty = await client.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM "mobile_wallet_transactions" WHERE "partyName" IS NULL`,
    );
    const badDir = await client.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM "mobile_wallet_transactions" WHERE "direction" NOT IN ('in', 'out')`,
    );
    const negAmount = await client.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM "mobile_wallet_transactions" WHERE "amount" < 0`,
    );
    const nullType = await client.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM "mobile_wallet_transactions" WHERE "txn_type" IS NULL OR LENGTH(TRIM("txn_type")) = 0`,
    );
    const nullCcy = await client.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM "mobile_wallet_transactions" WHERE "currency" IS NULL OR LENGTH(TRIM("currency")) = 0`,
    );
    console.log(`  NULL description:  ${nullDesc.rows[0].count}`);
    console.log(`  NULL partyName:    ${nullParty.rows[0].count}`);
    console.log(`  Bad direction:     ${badDir.rows[0].count}`);
    console.log(`  Negative amount:   ${negAmount.rows[0].count}`);
    console.log(`  NULL/empty type:   ${nullType.rows[0].count}`);
    console.log(`  NULL/empty ccy:    ${nullCcy.rows[0].count}`);

    // Step 6: Optional purge of soft-deleted rows (only if explicitly enabled)
    if (PURGE_SOFT_DELETED) {
      console.log("\n--- PURGING soft-deleted rows ---");
      const beforeCount = await client.query<CountRow>(
        `SELECT COUNT(*)::text AS count FROM "mobile_wallet_transactions" WHERE "deletedAt" IS NOT NULL`,
      );
      console.log(`  Soft-deleted rows before: ${beforeCount.rows[0].count}`);

      const deleteResult = await client.query(
        `DELETE FROM "mobile_wallet_transactions" WHERE "deletedAt" IS NOT NULL`,
      );
      console.log(`  ✓ Purged ${deleteResult.rowCount} soft-deleted rows`);

      const afterCount = await client.query<CountRow>(
        `SELECT COUNT(*)::text AS count FROM "mobile_wallet_transactions" WHERE "deletedAt" IS NOT NULL`,
      );
      console.log(`  Soft-deleted rows after:  ${afterCount.rows[0].count}`);
    } else {
      console.log("\n--- Soft-delete purge: SKIPPED (dry-run mode) ---");
      console.log(`  To purge soft-deleted rows, set PURGE_SOFT_DELETED = true at the top of this file.`);
    }

    console.log("\n=== FIX COMPLETE ===");
  } catch (err) {
    console.error("❌ Error:", err instanceof Error ? err.message : err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

fixMobileWalletTransactions();
