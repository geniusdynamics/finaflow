// ABOUTME: One-time migration script that copies existing M-PESA data into the new mobile wallet aggregation tables.
// ABOUTME: Seeds mobile_wallet_providers, copies mpesaTransactions, dailyMpesaLedger, reconciliation, and provider configs.

import { getDb } from "../api/queries/connection";
import {
  supportedCurrencies,
  mobileWalletProviders,
  mobileWalletTransactions,
  mobileWalletDailyLedger,
  mobileWalletReconciliation,
  providerConfigs,
  mpesaTransactions,
  dailyMpesaLedger,
  mpesaReconciliation,
  locations,
  accounts,
} from "../db/schema";
import { eq, isNull, and } from "drizzle-orm";

const DEFAULT_CURRENCIES = [
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", decimalPlaces: 2, isDefault: true },
  { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2, isDefault: false },
  { code: "UGX", name: "Ugandan Shilling", symbol: "USh", decimalPlaces: 0, isDefault: false },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh", decimalPlaces: 2, isDefault: false },
  { code: "EUR", name: "Euro", symbol: "EUR", decimalPlaces: 2, isDefault: false },
  { code: "GBP", name: "British Pound", symbol: "GBP", decimalPlaces: 2, isDefault: false },
];

export async function migrateMpesaToProviderFramework(): Promise<{
  currenciesSeeded: number;
  providersSeeded: number;
  transactionsMigrated: number;
  ledgerMigrated: number;
  reconciliationMigrated: number;
  configsMigrated: number;
}> {
  const db = getDb();
  const result = {
    currenciesSeeded: 0,
    providersSeeded: 0,
    transactionsMigrated: 0,
    ledgerMigrated: 0,
    reconciliationMigrated: 0,
    configsMigrated: 0,
  };

  console.log("[migrate-mpesa] Starting migration...");

  // ── Step 1: Seed supported currencies ──────────────────────────────────
  for (const currency of DEFAULT_CURRENCIES) {
    await db.insert(supportedCurrencies).values(currency).onConflictDoNothing({ target: supportedCurrencies.code });
    result.currenciesSeeded++;
  }
  console.log(`[migrate-mpesa] Seeded ${result.currenciesSeeded} currencies`);

  // ── Step 2: Seed mobile_wallet_providers ──────────────────────────────
  await db.insert(mobileWalletProviders).values({
    code: "mpesa",
    name: "M-PESA",
    displayName: "M-PESA",
    brandColor: "#C73E1D",
    supportedCurrencies: "KES",
    isActive: true,
    requiresProvisioning: false,
  }).onConflictDoNothing({ target: mobileWalletProviders.code });
  result.providersSeeded = 1;
  console.log(`[migrate-mpesa] Seeded M-PESA provider`);

  // ── Step 3: Migrate mpesa_transactions → mobile_wallet_transactions ──
  const oldTxns = await db.select().from(mpesaTransactions).where(isNull(mpesaTransactions.deletedAt));
  console.log(`[migrate-mpesa] Found ${oldTxns.length} M-PESA transactions to migrate`);

  for (const txn of oldTxns) {
    try {
      await db.insert(mobileWalletTransactions).values({
        locationId: txn.locationId,
        provider: "mpesa",
        providerTxnId: txn.txnId,
        txnDate: txn.txnDate,
        txnTime: txn.txnTime,
        txnType: txn.txnType,
        direction: parseFloat(txn.amount) >= 0 ? "in" : "out",
        partyName: txn.partyName,
        partyIdentifier: txn.partyName || undefined,
        amount: txn.amount,
        currency: "KES",
        txnFee: txn.txnFee,
        balance: txn.balance,
        description: txn.description,
        rawText: txn.rawText,
        status: "completed",
        isReconciled: false,
        isLinked: txn.isLinked,
        linkedExpenseId: txn.linkedExpenseId,
        linkedBillId: txn.linkedBillId,
        linkedSupplierId: txn.linkedSupplierId,
        sourceAccountId: txn.sourceAccountId,
        destinationAccountId: txn.destinationAccountId,
        importedBy: txn.importedBy,
        baseCurrency: "KES",
        baseAmount: txn.amount,
        createdAt: txn.createdAt,
        updatedAt: txn.updatedAt,
        deletedAt: txn.deletedAt,
      }).onConflictDoNothing({ target: [mobileWalletTransactions.provider, mobileWalletTransactions.providerTxnId] });
      result.transactionsMigrated++;
    } catch (err) {
      console.error(`[migrate-mpesa] Failed to migrate txn ${txn.txnId}:`, err);
    }
  }
  console.log(`[migrate-mpesa] Migrated ${result.transactionsMigrated} transactions`);

  // ── Step 4: Migrate daily_mpesa_ledger → mobile_wallet_daily_ledger ──
  const oldLedger = await db.select().from(dailyMpesaLedger).where(isNull(dailyMpesaLedger.deletedAt));
  console.log(`[migrate-mpesa] Found ${oldLedger.length} daily ledger entries to migrate`);

  for (const entry of oldLedger) {
    try {
      await db.insert(mobileWalletDailyLedger).values({
        locationId: entry.locationId,
        provider: "mpesa",
        accountId: entry.accountId,
        ledgerDate: entry.ledgerDate,
        openingBalance: entry.openingBalance,
        totalInflow: entry.totalTopups,
        totalOutflow: entry.totalExpenditures,
        totalFees: entry.totalFees,
        closingBalance: entry.closingBalance,
        transactionCount: entry.transactionCount,
        notes: entry.notes,
        baseCurrency: "KES",
        baseClosingBalance: entry.closingBalance,
        enteredBy: entry.enteredBy,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        deletedAt: entry.deletedAt,
      }).onConflictDoNothing({ target: [mobileWalletDailyLedger.locationId, mobileWalletDailyLedger.provider, mobileWalletDailyLedger.accountId, mobileWalletDailyLedger.ledgerDate] });
      result.ledgerMigrated++;
    } catch (err) {
      console.error(`[migrate-mpesa] Failed to migrate ledger entry ${entry.id}:`, err);
    }
  }
  console.log(`[migrate-mpesa] Migrated ${result.ledgerMigrated} ledger entries`);

  // ── Step 5: Migrate mpesa_reconciliation → mobile_wallet_reconciliation ──
  const oldRec = await db.select().from(mpesaReconciliation);
  console.log(`[migrate-mpesa] Found ${oldRec.length} reconciliation records to migrate`);

  for (const rec of oldRec) {
    try {
      await db.insert(mobileWalletReconciliation).values({
        provider: "mpesa",
        txnDate: rec.txnDate,
        orphanCount: rec.orphanCount,
        orphanTotal: rec.orphanTotal,
        matchedCount: rec.matchedCount,
        matchedTotal: rec.matchedTotal,
        status: rec.status,
        notes: rec.notes,
        createdAt: rec.createdAt,
        resolvedAt: rec.resolvedAt,
      }).onConflictDoNothing({ target: [mobileWalletReconciliation.provider, mobileWalletReconciliation.txnDate] });
      result.reconciliationMigrated++;
    } catch (err) {
      console.error(`[migrate-mpesa] Failed to migrate reconciliation ${rec.id}:`, err);
    }
  }
  console.log(`[migrate-mpesa] Migrated ${result.reconciliationMigrated} reconciliation records`);

  // ── Step 6: Migrate locations.defaultMpesaAccountId → provider_configs ──
  const locationRows = await db.select().from(locations).where(isNull(locations.deletedAt));
  console.log(`[migrate-mpesa] Found ${locationRows.length} locations to check for default M-PESA account`);

  for (const loc of locationRows) {
    if (!loc.defaultMpesaAccountId) continue;
    try {
      const existing = await db.select().from(providerConfigs).where(
        and(
          eq(providerConfigs.locationId, loc.id),
          eq(providerConfigs.provider, "mpesa"),
          isNull(providerConfigs.deletedAt)
        )
      );
      if (existing.length > 0) continue;

      const acct = await db.select().from(accounts).where(and(eq(accounts.id, loc.defaultMpesaAccountId), isNull(accounts.deletedAt))).limit(1);
      if (acct.length === 0) continue;

      await db.insert(providerConfigs).values({
        locationId: loc.id,
        provider: "mpesa",
        accountId: loc.defaultMpesaAccountId,
        isDefault: true,
        isActive: true,
      });
      result.configsMigrated++;
    } catch (err) {
      console.error(`[migrate-mpesa] Failed to migrate provider config for location ${loc.id}:`, err);
    }
  }
  console.log(`[migrate-mpesa] Migrated ${result.configsMigrated} provider configs`);

  console.log("[migrate-mpesa] Migration complete!");
  return result;
}

// Run directly: npx tsx scripts/migrate-mpesa-to-provider-framework.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateMpesaToProviderFramework()
    .then((r) => { console.log("Migration result:", r); process.exit(0); })
    .catch((err) => { console.error("Migration failed:", err); process.exit(1); });
}
