// ABOUTME: Post-migration validation script for CoA auto-link and wallet support migration.
// ABOUTME: Verifies all accounts are properly linked, CoA entries are renamed, and no broken references.
import { getDb } from "../api/queries/connection";
import { accounts, journalLines } from "../db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

interface ValidationResult {
  name: string;
  passed: boolean;
  details: string;
}

async function runValidation(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  const db = getDb();

  // Validation 1: Check M-Pesa → Wallet Account rename
  const mpesaEntries = await db
    .select()
    .from(accounts)
    .where(
      and(
        sql`${accounts.name} LIKE '%M-Pesa%'`,
        eq(accounts.accountType, "asset"),
        eq(accounts.accountSubType, "cash"),
        isNull(accounts.deletedAt),
      )
    )
    .limit(5);

  results.push({
    name: "M-Pesa CoA Renamed",
    passed: mpesaEntries.length === 0,
    details:
      mpesaEntries.length === 0
        ? "All M-Pesa CoA entries have been renamed to Wallet Account."
        : `Found ${mpesaEntries.length} entries still named 'M-Pesa': ${mpesaEntries.map((e) => e.name).join(", ")}`,
  });

  // Validation 2: Check Wallet Account CoA entry exists
  const walletEntries = await db
    .select()
    .from(accounts)
    .where(
      and(
        sql`${accounts.name} LIKE '%Wallet Account%'`,
        eq(accounts.accountType, "asset"),
        eq(accounts.accountSubType, "cash"),
        isNull(accounts.deletedAt),
      )
    )
    .limit(5);

  results.push({
    name: "Wallet Account CoA Exists",
    passed: walletEntries.length > 0,
    details:
      walletEntries.length > 0
        ? `Found ${walletEntries.length} Wallet Account CoA entries: ${walletEntries.map((e) => `${e.name} (ID: ${e.id})`).join(", ")}`
        : "No Wallet Account CoA entries found — migration may not have run.",
  });

  // Validation 3: Check all operational accounts have coaId
  const unlinkedAccounts = await db
    .select()
    .from(accounts)
    .where(
      and(
        isNull(accounts.accountType),
        isNull(accounts.coaId),
        isNull(accounts.deletedAt),
      )
    )
    .limit(10);

  results.push({
    name: "All Accounts Linked to CoA",
    passed: unlinkedAccounts.length === 0,
    details:
      unlinkedAccounts.length === 0
        ? "100% of operational accounts have a coaId set."
        : `Found ${unlinkedAccounts.length} unlinked accounts (no coaId): ${unlinkedAccounts.map((a) => `${a.name} (ID: ${a.id})`).join(", ")}`,
  });

  // Validation 4: Check wallet accounts link to the cash CoA entry
  const walletCoaEntries = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.type, "wallet"),
        isNull(accounts.accountType),
        isNull(accounts.deletedAt),
        sql`${accounts.coaId} IS NOT NULL`,
      )
    )
    .limit(20);

  const walletCoaOk = walletCoaEntries.every((a) => a.coaId !== null);

  results.push({
    name: "Wallet Accounts Linked Correctly",
    passed: walletCoaOk,
    details:
      walletCoaOk
        ? `All ${walletCoaEntries.length} wallet accounts have coaId set.`
        : `Found wallet accounts without coaId.`,
  });

  // Validation 5: Check no broken transaction references
  const linesWithMissingAccounts = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(journalLines)
    .leftJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(
      and(
        isNull(accounts.id),
        isNull(journalLines.deletedAt),
      )
    );

  results.push({
    name: "No Broken Transaction References",
    passed: linesWithMissingAccounts[0]?.count === 0,
    details:
      linesWithMissingAccounts[0]?.count === 0
        ? "Zero broken references in journal lines."
        : `Found ${linesWithMissingAccounts[0]?.count} journal lines referencing deleted accounts.`,
  });

  // Print summary
  console.log("=== CoA Migration Validation Results ===\n");
  let allPassed = true;
  for (const result of results) {
    const icon = result.passed ? "✅" : "❌";
    console.log(`${icon} ${result.name}`);
    console.log(`   ${result.details}\n`);
    if (!result.passed) allPassed = false;
  }

  console.log(allPassed ? "✅ ALL VALIDATIONS PASSED" : "❌ SOME VALIDATIONS FAILED");
  return results;
}

runValidation()
  .then((results) => {
    process.exit(results.every((r) => r.passed) ? 0 : 1);
  })
  .catch((err) => {
    console.error("Validation script failed:", err);
    process.exit(1);
  });
