// ABOUTME: One-time migration script to populate Chart of Accounts with existing data
// Run this once after schema migration: npx tsx db/migrate-existing-data.ts

import { getDb } from "../api/queries/connection";
import { accounts, expenses, expenseCategories, bills, journalEntries, journalLines } from "./schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { d } from "../api/lib/decimal";

async function migrateExistingData(businessId: number, locationIds: number[]) {
  const db = getDb();
  const locationId = locationIds[0];
  
  console.log(`Migrating data for business ${businessId}, locations: ${locationIds.join(",")}`);

  // 1. Update existing accounts with accounting types
  console.log("--- Step 1: Updating existing accounts ---");
  
  const existingAccounts = await db
    .select()
    .from(accounts)
    .where(and(
      sql`${accounts.businessId} = ${businessId} OR ${accounts.businessId} IS NULL`,
      sql`${accounts.accountType} IS NULL`
    ));

  for (const acc of existingAccounts) {
    const typeMap: Record<string, { type: string; subType: string; code: string }> = {
      cash: { type: "asset", subType: "cash", code: "1000" },
      mpesa: { type: "asset", subType: "cash", code: "1200" },
      bank_account: { type: "asset", subType: "bank", code: "1100" },
    };

    const config = typeMap[acc.type] || { type: "asset", subType: "other_asset", code: "1900" };
    
    await db.update(accounts).set({
      businessId: businessId,
      accountCode: acc.accountCode || config.code,
      accountType: config.type as any,
      accountSubType: config.subType as any,
      isActive: true,
    }).where(eq(accounts.id, acc.id));
    
    console.log(`  Updated account: ${acc.name} -> ${config.type}/${config.subType}`);
  }

  // 2. Create expense categories mapping
  console.log("--- Step 2: Mapping expense categories ---");
  
  const cats = await db
    .select()
    .from(expenseCategories)
    .where(isNull(expenseCategories.accountingClass));

  for (const cat of cats) {
    const nameLower = cat.name.toLowerCase();
    let accountingClass: string = "operating_expense";
    if (["food supplies", "beverages", "food cost", "beverage cost"].some(s => nameLower.includes(s))) {
      accountingClass = "cogs";
    } else if (["rent"].some(s => nameLower.includes(s))) {
      accountingClass = "operating_expense";
    } else if (["admin", "office", "legal", "license"].some(s => nameLower.includes(s))) {
      accountingClass = "admin_expense";
    } else if (["marketing", "advert", "promo"].some(s => nameLower.includes(s))) {
      accountingClass = "marketing";
    }

    await db.update(expenseCategories).set({
      businessId: businessId,
      locationId: locationId,
      accountingClass: accountingClass as any,
    }).where(eq(expenseCategories.id, cat.id));
    
    console.log(`  Mapped category: ${cat.name} -> ${accountingClass}`);
  }

  // 3. Create opening balance journal entries for accounts with balances
  console.log("--- Step 3: Creating opening balance journal entries ---");
  
  const balancedAccounts = await db
    .select()
    .from(accounts)
    .where(and(
      sql`${accounts.businessId} = ${businessId}`,
      sql`${accounts.currentBalance} IS NOT NULL`,
      sql`${accounts.currentBalance} != '0.00'`,
      isNull(accounts.deletedAt)
    ));

  if (balancedAccounts.length > 0) {
    const openingDate = "2020-01-01";

    // Check if opening balance entry already exists (idempotent)
    const existingOB = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.entryNumber, "OB-0001"))
      .limit(1);

    let entryId: number;
    if (existingOB.length > 0) {
      entryId = existingOB[0].id;
      // Delete old opening balance lines first
      await db.delete(journalLines).where(eq(journalLines.journalEntryId, entryId));
      console.log(`  Reusing existing OB-0001 (id=${entryId}), cleared old lines`);
    } else {
      const openingBalanceEntry = await db.insert(journalEntries).values({
        businessId,
        entryNumber: "OB-0001",
        entryDate: openingDate,
        description: "Opening Balance - Existing Accounts",
        sourceType: "opening_balance",
        isPosted: true,
        createdBy: 1,
        postedBy: 1,
        postedAt: new Date(),
      }).returning();
      entryId = openingBalanceEntry[0].id;
    }

    let lineNum = 1;
    for (const acc of balancedAccounts) {
      const balance = d(acc.currentBalance || "0");
      if (balance.isZero()) continue;

      const isDebitNormal = acc.accountType === "asset" || acc.accountType === "expense";

      await db.insert(journalLines).values({
        journalEntryId: entryId,
        accountId: acc.id,
        debit: isDebitNormal ? balance.toFixed(2) : "0.00",
        credit: isDebitNormal ? "0.00" : balance.toFixed(2),
        description: `Opening balance: ${acc.name}`,
        lineNumber: lineNum++,
      } as any);

      console.log(`  Created opening line: ${acc.name} = ${balance.toFixed(2)}`);
    }

    console.log(`  Journal entry #OB-0001 has ${lineNum - 1} lines`);
  }

  // 4. Convert existing ledger entries to journal entries
  console.log("--- Step 4: Converting existing ledger entries ---");
  
  const existingLedgerEntries = await db.execute(
    sql`SELECT * FROM "ledger_entries" WHERE "journalEntryId" IS NULL`
  );

  const ledgerGrouped: Record<string, any[]> = {};
  for (const le of existingLedgerEntries.rows) {
    const key = `${le.transactionType}-${le.transactionId}-${le.entryDate}`;
    if (!ledgerGrouped[key]) ledgerGrouped[key] = [];
    ledgerGrouped[key].push(le);
  }

  let convertedCount = 0;
  for (const [key, ledgers] of Object.entries(ledgerGrouped)) {
    if (ledgers.length < 2) continue;

    const first = ledgers[0];
    const entryNumber = `MIG-${String(convertedCount + 1).padStart(4, "0")}`;
    const dateStr = typeof first.entryDate === 'string' ? first.entryDate : new Date(first.entryDate).toISOString().split("T")[0];
    
    const je = await db.insert(journalEntries).values({
      businessId,
      entryNumber,
      entryDate: dateStr,
      description: `Migrated: ${first.description || `${first.transactionType} #${first.transactionId}`}`,
      sourceType: first.transactionType,
      sourceId: first.transactionId,
      isPosted: true,
      createdBy: first.createdBy || 1,
      postedBy: first.createdBy || 1,
      postedAt: new Date(),
    }).returning();

    for (let i = 0; i < ledgers.length; i++) {
      const le = ledgers[i];
      await db.insert(journalLines).values({
        journalEntryId: je[0].id,
        accountId: le.accountId,
        debit: le.entryType === "debit" ? le.amount : "0.00",
        credit: le.entryType === "credit" ? le.amount : "0.00",
        description: le.description || "",
        lineNumber: i + 1,
      } as any);
    }

    convertedCount++;
  }

  console.log(`  Converted ${convertedCount} transaction groups to journal entries`);
  console.log("--- Migration Complete ---");
}

async function main() {
  const businessId = process.argv[2] ? parseInt(process.argv[2]) : 1;
  const locationIdsStr = process.argv[3] || "";
  const locationIds = locationIdsStr ? locationIdsStr.split(",").map(Number) : [1];

  await migrateExistingData(businessId, locationIds);
  process.exit(0);
}

main().catch(console.error);

export { migrateExistingData };
