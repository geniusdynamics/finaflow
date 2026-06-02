/**
 * Fix script to handle orphaned M-PESA transactions
 * This script can:
 * 1. Show orphaned transactions (locationId points to non-existent or deleted location)
 * 2. Optionally reassign them to a valid location
 * 3. Optionally delete them
 */
import { getDb } from "../api/queries/connection";
import { mpesaTransactions, locations } from "../db/schema";
import { sql, eq } from "drizzle-orm";

async function fixOrphanedTransactions() {
  const db = getDb();
  
  console.log("=== M-PESA Orphaned Transaction Fixer ===\n");
  
  // Find orphaned transactions
  const orphaned = await db
    .select({
      id: mpesaTransactions.id,
      txnId: mpesaTransactions.txnId,
      txnDate: mpesaTransactions.txnDate,
      amount: mpesaTransactions.amount,
      locationId: mpesaTransactions.locationId,
      partyName: mpesaTransactions.partyName,
    })
    .from(mpesaTransactions)
    .leftJoin(locations, eq(mpesaTransactions.locationId, locations.id))
    .where(sql`${locations.id} IS NULL AND ${mpesaTransactions.deletedAt} IS NULL`);
  
  if (orphaned.length === 0) {
    console.log("✓ No orphaned transactions found. All transactions have valid locations.");
    process.exit(0);
  }
  
  console.log(`Found ${orphaned.length} orphaned transactions:\n`);
  orphaned.forEach(txn => {
    console.log(`  ${txn.txnId} | Date: ${txn.txnDate} | Amount: ${txn.amount} | Invalid LocationID: ${txn.locationId} | Party: ${txn.partyName}`);
  });
  
  console.log("\n=== Options ===");
  console.log("To fix these transactions, you can:");
  console.log("1. Reassign to a valid location (edit this script and set TARGET_LOCATION_ID)");
  console.log("2. Soft delete them (edit this script and set DELETE_ORPHANS = true)");
  console.log("3. Hard delete them from database (use with caution!)");
  
  // Configuration - EDIT THESE VALUES
  const TARGET_LOCATION_ID: number | null = null; // Set to a valid location ID to reassign
  const DELETE_ORPHANS = false; // Set to true to soft-delete orphaned transactions
  const HARD_DELETE = false; // Set to true to permanently delete (DANGEROUS!)
  
  if (TARGET_LOCATION_ID) {
    // Verify target location exists
    const targetLoc = await db.select().from(locations).where(eq(locations.id, TARGET_LOCATION_ID)).limit(1);
    if (targetLoc.length === 0) {
      console.error(`\n❌ Error: Target location ID ${TARGET_LOCATION_ID} does not exist!`);
      process.exit(1);
    }
    
    console.log(`\n→ Reassigning ${orphaned.length} transactions to location: ${targetLoc[0].name} (ID: ${TARGET_LOCATION_ID})`);
    
    for (const txn of orphaned) {
      await db.update(mpesaTransactions)
        .set({ locationId: TARGET_LOCATION_ID })
        .where(eq(mpesaTransactions.id, txn.id));
      console.log(`  ✓ Reassigned ${txn.txnId}`);
    }
    
    console.log(`\n✓ Successfully reassigned ${orphaned.length} transactions`);
  } else if (DELETE_ORPHANS) {
    if (HARD_DELETE) {
      console.log(`\n→ HARD DELETING ${orphaned.length} transactions (PERMANENT!)`);
      for (const txn of orphaned) {
        await db.delete(mpesaTransactions).where(eq(mpesaTransactions.id, txn.id));
        console.log(`  ✓ Deleted ${txn.txnId}`);
      }
    } else {
      console.log(`\n→ Soft deleting ${orphaned.length} transactions`);
      for (const txn of orphaned) {
        await db.update(mpesaTransactions)
          .set({ deletedAt: new Date() })
          .where(eq(mpesaTransactions.id, txn.id));
        console.log(`  ✓ Soft deleted ${txn.txnId}`);
      }
    }
    console.log(`\n✓ Successfully deleted ${orphaned.length} transactions`);
  } else {
    console.log("\n⚠ No action taken. Edit the script to set TARGET_LOCATION_ID or DELETE_ORPHANS.");
  }
  
  process.exit(0);
}

fixOrphanedTransactions().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
