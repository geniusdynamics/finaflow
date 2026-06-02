// ABOUTME: One-time remediation script that merges duplicate Accounts Payable accounts
// ABOUTME: and backfills missing systemKey values on all seeded chart accounts.
import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixDuplicateApAccounts() {
  const client = await pool.connect();

  try {
    console.log("=== DUPLICATE AP ACCOUNT FIX ===\n");

    // Step 1: Find all businesses
    const businesses = await client.query(`SELECT id, name FROM businesses ORDER BY id`);

    if (businesses.rows.length === 0) {
      console.log("No businesses found. Nothing to fix.");
      return;
    }

    console.log(`Found ${businesses.rows.length} businesses.\n`);

    for (const business of businesses.rows) {
      const businessId = business.id;
      console.log(`--- Processing business ${businessId}: ${business.name} ---`);

      // Step 2: Find all active Accounts Payable accounts for this business
      const apAccounts = await client.query(
        `SELECT id, name, "accountCode", "systemKey", "currentBalance", "isSystemGenerated", "openingBalance"
         FROM accounts
         WHERE "businessId" = $1
           AND "accountSubType" = 'accounts_payable'
           AND "deletedAt" IS NULL
         ORDER BY "systemKey" NULLS FIRST, id`,
        [businessId],
      );

      console.log(`  Found ${apAccounts.rows.length} AP account(s):`);
      for (const acct of apAccounts.rows) {
        console.log(`    ID=${acct.id} Code=${acct.accountCode || "N/A"} Name="${acct.name}" systemKey=${acct.systemKey || "NULL"} Balance=${acct.currentBalance} SystemGen=${acct.isSystemGenerated}`);
      }

      if (apAccounts.rows.length === 0) {
        console.log("  No AP accounts found for this business.\n");
        continue;
      }

      if (apAccounts.rows.length === 1) {
        // Single account - backfill systemKey if missing, and accountCode if needed
        const acct = apAccounts.rows[0];
        if (!acct.systemKey) {
          await client.query(
            `UPDATE accounts SET "systemKey" = 'liability:accounts_payable' WHERE id = $1`,
            [acct.id],
          );
          console.log(`  ✓ Backfilled systemKey on account ${acct.id} (${acct.name})`);
        }
        if (!acct.accountCode) {
          await client.query(
            `UPDATE accounts SET "accountCode" = '2000' WHERE id = $1`,
            [acct.id],
          );
          console.log(`  ✓ Backfilled accountCode '2000' on account ${acct.id} (${acct.name})`);
        }
        console.log();
        continue;
      }

      // Step 3: Multiple AP accounts found — identify the survivor and orphan(s)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seededAccount = apAccounts.rows.find((a: any) => a.accountCode === "2000" && !a.systemKey);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const systemAccount = apAccounts.rows.find((a: any) => a.systemKey === "liability:accounts_payable" && a.isSystemGenerated);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const others = apAccounts.rows.filter((a: any) => a !== seededAccount && a !== systemAccount);

      let survivorId: number;
      let orphanIds: number[];

      if (seededAccount && systemAccount) {
        // Classic case: seeded account (code 2000, no systemKey) + system-generated (systemKey, no code)
        survivorId = seededAccount.id;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        orphanIds = [systemAccount.id, ...others.map((a: any) => a.id)];
        console.log(`  Classic duplicate: seeded account ${seededAccount.id} + system account ${systemAccount.id}`);
      } else if (seededAccount && !systemAccount) {
        // Multiple seeded accounts or mixed — use the one with code 2000
        survivorId = seededAccount.id;
        orphanIds = apAccounts.rows
// eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((a: any) => a.id !== survivorId)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((a: any) => a.id);
        console.log(`  Multiple AP accounts without systemKey — using seeded ${survivorId}`);
      } else if (systemAccount && !seededAccount) {
        // System account exists but no seeded account
        survivorId = systemAccount.id;
        orphanIds = apAccounts.rows
// eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((a: any) => a.id !== survivorId)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((a: any) => a.id);
        console.log(`  System account exists without seeded — using system ${survivorId}`);
      } else {
        // Fallback: use the first one
        survivorId = apAccounts.rows[0].id;
        orphanIds = apAccounts.rows
// eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((a: any) => a.id !== survivorId)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((a: any) => a.id);
        console.log(`  Fallback — using account ${survivorId} as survivor`);
      }

      console.log(`  Survivor: ID=${survivorId}`);
      console.log(`  Orphans: ${orphanIds.length > 0 ? orphanIds.join(", ") : "none"}`);

      if (orphanIds.length === 0) {
        // Just backfill systemKey on survivor if needed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const survivor = apAccounts.rows.find((a: any) => a.id === survivorId);
        if (survivor && !survivor.systemKey) {
          await client.query(
            `UPDATE accounts SET "systemKey" = 'liability:accounts_payable' WHERE id = $1`,
            [survivorId],
          );
          console.log(`  ✓ Backfilled systemKey on survivor account ${survivorId}`);
        }
        console.log();
        continue;
      }

      // Step 4: Merge balances from orphans into survivor (only if orphan still has entries)
      for (const orphanId of orphanIds) {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const orphan = apAccounts.rows.find((a: any) => a.id === orphanId);
        if (orphan) {
          // Check if orphan still has ledger entries (idempotency guard)
          const entryCheck = await client.query(
            `SELECT COUNT(*)::int as cnt FROM ledger_entries WHERE "accountId" = $1`,
            [orphanId],
          );
          if (entryCheck.rows[0].cnt === 0) {
            console.log(`  ⏭ Orphan ${orphanId} has no entries — balance likely already merged, skipping`);
            continue;
          }
          const orphanBalance = orphan.currentBalance || "0";
          if (parseFloat(orphanBalance) !== 0) {
            await client.query(
              `UPDATE accounts
               SET "currentBalance" = COALESCE("currentBalance", 0) + $1::numeric
               WHERE id = $2`,
              [orphanBalance, survivorId],
            );
            console.log(`  ✓ Merged balance ${orphanBalance} from orphan ${orphanId} into survivor ${survivorId}`);
          }
        }
      }

      // Step 5: Reassign ledger entries from orphans to survivor
      for (const orphanId of orphanIds) {
        const reassignResult = await client.query(
          `UPDATE ledger_entries
           SET "accountId" = $1
           WHERE "accountId" = $2`,
          [survivorId, orphanId],
        );
        if (reassignResult.rowCount > 0) {
          console.log(`  ✓ Reassigned ${reassignResult.rowCount} ledger entries from orphan ${orphanId} to survivor ${survivorId}`);
        }
      }

      // Step 6: Reassign journal lines from orphans to survivor
      for (const orphanId of orphanIds) {
        const reassignResult = await client.query(
          `UPDATE journal_lines
           SET "accountId" = $1
           WHERE "accountId" = $2`,
          [survivorId, orphanId],
        );
        if (reassignResult.rowCount > 0) {
          console.log(`  ✓ Reassigned ${reassignResult.rowCount} journal lines from orphan ${orphanId} to survivor ${survivorId}`);
        }
      }

      // Step 7: Clear orphan systemKeys before setting survivor's (avoid unique constraint violation)
      for (const orphanId of orphanIds) {
        await client.query(
          `UPDATE accounts SET "systemKey" = NULL WHERE id = $1`,
          [orphanId],
        );
      }

      // Step 8: Set systemKey on survivor if missing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const survivor = apAccounts.rows.find((a: any) => a.id === survivorId);
      if (survivor && !survivor.systemKey) {
        await client.query(
          `UPDATE accounts SET "systemKey" = 'liability:accounts_payable' WHERE id = $1`,
          [survivorId],
        );
        console.log(`  ✓ Set systemKey on survivor account ${survivorId}`);
      }

      // Also ensure survivor has an accountCode
      if (survivor && !survivor.accountCode) {
        await client.query(
          `UPDATE accounts SET "accountCode" = '2000' WHERE id = $1`,
          [survivorId],
        );
        console.log(`  ✓ Backfilled accountCode '2000' on survivor account ${survivorId}`);
      }

      // Step 9: Soft-delete orphans
      for (const orphanId of orphanIds) {
        await client.query(
          `UPDATE accounts SET "deletedAt" = NOW() WHERE id = $1`,
          [orphanId],
        );
        console.log(`  ✓ Soft-deleted orphan account ${orphanId}`);
      }

      // Step 10: Verify the fix
      const remainingAp = await client.query(
        `SELECT id, name, "accountCode", "systemKey", "currentBalance"
         FROM accounts
         WHERE "businessId" = $1
           AND "accountSubType" = 'accounts_payable'
           AND "deletedAt" IS NULL`,
        [businessId],
      );

      const combinedBalance = remainingAp.rows.reduce(
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sum: number, a: any) => sum + parseFloat(a.currentBalance || "0"),
        0,
      );
      console.log(`\n  ✅ After fix: ${remainingAp.rows.length} AP account(s), combined balance = ${combinedBalance.toFixed(2)}`);
      for (const acct of remainingAp.rows) {
        console.log(`     ID=${acct.id} Code=${acct.accountCode || "N/A"} Name="${acct.name}" systemKey=${acct.systemKey} Balance=${acct.currentBalance}`);
      }
      console.log();
    }

    // Step 10: Backfill systemKey on seeded chart accounts that are missing it
    // Only targets accounts with accountCodes (seeded chart accounts), excluding operational accounts
    console.log("=== BACKFILLING SYSTEM KEYS FOR SEEDED CHART ACCOUNTS ===\n");

    const accountsMissingKeys = await client.query(
      `SELECT id, name, "accountType", "accountSubType", "accountCode"
       FROM accounts
       WHERE "systemKey" IS NULL
         AND "accountCode" IS NOT NULL
         AND "accountType" IS NOT NULL
         AND "accountSubType" IS NOT NULL
         AND "deletedAt" IS NULL
       ORDER BY "accountType", "accountSubType"`,
    );

    if (accountsMissingKeys.rows.length > 0) {
      console.log(`Found ${accountsMissingKeys.rows.length} chart accounts missing systemKey:`);
      let backfilled = 0;
      let skipped = 0;
      for (const acct of accountsMissingKeys.rows) {
        const systemKey = `${acct.accountType}:${acct.accountSubType}`;
        try {
          await client.query(
            `UPDATE accounts SET "systemKey" = $1 WHERE id = $2 AND "systemKey" IS NULL`,
            [systemKey, acct.id],
          );
          console.log(`  ✓ Set systemKey="${systemKey}" on account ${acct.id} (${acct.name})`);
          backfilled++;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          if (err.code === "23505") {
            console.log(`  ⏭ Skipped account ${acct.id} (${acct.name}) — systemKey "${systemKey}" already exists for another account`);
            skipped++;
          } else {
            throw err;
          }
        }
      }
      console.log(`\n  Summary: ${backfilled} backfilled, ${skipped} skipped due to duplicate keys`);
    } else {
      console.log("All accounts already have systemKey set.");
    }

    // Step 11: Verify no more duplicate systemKeys exist
    console.log("\n=== VERIFYING NO DUPLICATE SYSTEM KEYS ===\n");
    const duplicates = await client.query(
      `SELECT "businessId", "systemKey", COUNT(*) as cnt
       FROM accounts
       WHERE "systemKey" IS NOT NULL
         AND "deletedAt" IS NULL
       GROUP BY "businessId", "systemKey"
       HAVING COUNT(*) > 1`,
    );

    if (duplicates.rows.length > 0) {
      console.log("⚠️  WARNING: Still found duplicate systemKeys:");
      for (const dup of duplicates.rows) {
        console.log(`  Business ${dup.businessId}: systemKey="${dup.systemKey}" appears ${dup.cnt} times`);
      }
    } else {
      console.log("✅ No duplicate systemKeys found. All clear!");
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

fixDuplicateApAccounts();
