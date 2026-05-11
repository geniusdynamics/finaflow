/**
 * Diagnostic script to check M-PESA transactions and their location/business relationships
 */
import { getDb } from "../api/queries/connection";
import { mpesaTransactions, locations } from "../db/schema";
import { sql, isNull, eq } from "drizzle-orm";

async function diagnoseMpesaTransactions() {
  const db = getDb();
  
  console.log("=== M-PESA Transaction Diagnostics ===\n");
  
  // 1. Count total transactions
  const totalCount = await db.select({ count: sql<number>`COUNT(*)` })
    .from(mpesaTransactions)
    .where(isNull(mpesaTransactions.deletedAt));
  console.log(`Total M-PESA transactions: ${totalCount[0]?.count ?? 0}`);
  
  // 2. Sample transactions with their location info
  const sampleTxns = await db
    .select({
      txnId: mpesaTransactions.txnId,
      txnDate: mpesaTransactions.txnDate,
      amount: mpesaTransactions.amount,
      locationId: mpesaTransactions.locationId,
      locationName: locations.name,
      businessId: locations.businessId,
    })
    .from(mpesaTransactions)
    .leftJoin(locations, eq(mpesaTransactions.locationId, locations.id))
    .where(isNull(mpesaTransactions.deletedAt))
    .limit(10);
  
  console.log("\nSample transactions with location/business info:");
  sampleTxns.forEach(txn => {
    console.log(`  ${txn.txnId} | Date: ${txn.txnDate} | Amount: ${txn.amount} | LocationID: ${txn.locationId} | Location: ${txn.locationName ?? 'NOT FOUND'} | BusinessID: ${txn.businessId ?? 'N/A'}`);
  });
  
  // 3. Check for orphaned transactions (locationId doesn't exist)
  const orphanedCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(mpesaTransactions)
    .leftJoin(locations, eq(mpesaTransactions.locationId, locations.id))
    .where(sql`${locations.id} IS NULL AND ${mpesaTransactions.deletedAt} IS NULL`);
  
  console.log(`\nOrphaned transactions (location not found): ${orphanedCount[0]?.count ?? 0}`);
  
  // 4. Group by business
  const byBusiness = await db
    .select({
      businessId: locations.businessId,
      count: sql<number>`COUNT(*)`,
    })
    .from(mpesaTransactions)
    .leftJoin(locations, eq(mpesaTransactions.locationId, locations.id))
    .where(isNull(mpesaTransactions.deletedAt))
    .groupBy(locations.businessId);
  
  console.log("\nTransactions by business:");
  byBusiness.forEach(b => {
    console.log(`  Business ID ${b.businessId ?? 'NULL'}: ${b.count} transactions`);
  });
  
  // 5. List all locations
  const allLocations = await db
    .select({
      id: locations.id,
      name: locations.name,
      businessId: locations.businessId,
      isActive: locations.isActive,
      deletedAt: locations.deletedAt,
    })
    .from(locations);
  
  console.log("\nAll locations:");
  allLocations.forEach(loc => {
    const status = loc.deletedAt ? 'DELETED' : (loc.isActive ? 'ACTIVE' : 'INACTIVE');
    console.log(`  ID: ${loc.id} | Name: ${loc.name} | BusinessID: ${loc.businessId} | Status: ${status}`);
  });
  
  process.exit(0);
}

diagnoseMpesaTransactions().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
