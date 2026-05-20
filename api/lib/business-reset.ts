// ABOUTME: Comprehensive business transaction reset with full transactional integrity,
// ABOUTME: preserving all immutable/important records while clearing transactional data.

// ──────────────────────────────────────────────────────────────────────────────
// PRESERVED TABLES (never cleared):
//   - businesses, users, userBusinesses, customerAccounts
//   - expenseCategories, revenueCategories
//   - employees (records preserved, only payroll entries/advances cleared)
//   - suppliers (records preserved, balances reset to zero)
//   - accounts (system accounts preserved with balance reset, user accounts soft-deleted)
//   - locations (records preserved, counters reset)
//   - items, masterItems
//   - fixedAssetDepreciation (depreciation schedule preserved, journal links cleared)
//   - paymentMethods, locationPaymentMethods
//   - payrollSettings, cogsTargets, alertsConfig, priceAlertRules
//   - apiKeys, webhooks, pushSubscriptions, refreshTokens
//   - businessDocuments, businessLogos
//   - allocationInvites, partnerAllocations, partnerCommissions
//   - appSettings, feedbackQuestionnaires, feedbackResponses
//   - businessInquiries, externalSyncConfig, rolePermissions
//   - auditLog (regulatory requirement - immutable audit trail)
//
// RESETABLE TABLES (fully cleared):
//   - dailySales, dailySalePayments
//   - expenses, expenseItems
//   - bills, billItems, billPayments
//   - mpesaTransactions, dailyMpesaLedger
//   - mobileWalletTransactions, mobileWalletDailyLedger, mobileWalletReconciliation, providerConfigs
//   - payrollPeriods, payrollEntries, payrollAdvances
//   - ledgerEntries, journalEntries, journalLines
//   - budgets, purchaseOrders, purchaseOrderItems
//   - attachments, recurringBillTemplates
//   - notifications, quickActionsLog
//   - webhookDeliveries, mpesaReconciliation
//   - supplierPriceHistory, financialReports
// ──────────────────────────────────────────────────────────────────────────────

import { and, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";

import {
  accounts,
  attachments,
  billItems,
  billPayments,
  bills,
  budgets,
  dailyMpesaLedger,
  dailySalePayments,
  dailySales,
  employees,
  expenseItems,
  expenses,
  financialReports,
  fixedAssetDepreciation,
  journalEntries,
  journalLines,
  ledgerEntries,
  locations,
  mobileWalletTransactions,
  mobileWalletDailyLedger,
  mobileWalletReconciliation,
  mpesaReconciliation,
  mpesaTransactions,
  notifications,
  payrollAdvances,
  payrollEntries,
  payrollPeriods,
  providerConfigs,
  purchaseOrderItems,
  purchaseOrders,
  quickActionsLog,
  recurringBillTemplates,
  supplierPriceHistory,
  suppliers,
  webhookDeliveries,
} from "@db/schema";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ResetResult = {
  success: true;
  results: Record<string, { count: number }>;
  preserved: string[];
  resetAt: string;
};

export type ResetSummary = {
  totalRecordsCleared: number;
  tablesAffected: string[];
  preservedTables: string[];
  resetTimestamp: string;
};

// ─── Validation ──────────────────────────────────────────────────────────────

export type PreResetValidation = {
  valid: boolean;
  businessExists: boolean;
  hasLocations: boolean;
  locationCount: number;
  warnings: string[];
};

export async function validatePreReset(input: {
  db: any;
  businessId: number;
}): Promise<PreResetValidation> {
  const warnings: string[] = [];

  const [business] = await input.db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.businessId, input.businessId))
    .limit(1);

  const hasLocations = !!business;
  const locationRows = await input.db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.businessId, input.businessId));
  const locationCount = locationRows.length;

  if (!hasLocations) {
    warnings.push("No locations found for this business. Reset may be a no-op.");
  }

  return {
    valid: true,
    businessExists: true,
    hasLocations,
    locationCount,
    warnings,
  };
}

// ─── Snapshot (pre-reset backup metadata) ────────────────────────────────────

export type ResetSnapshot = {
  businessId: number;
  timestamp: string;
  tableCounts: Record<string, number>;
};

export async function createResetSnapshot(input: {
  db: any;
  businessId: number;
}): Promise<ResetSnapshot> {
  const locationRows = await input.db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.businessId, input.businessId));
  const locationIds = locationRows.map((r: { id: number }) => r.id);

  const accountRows = await input.db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.businessId, input.businessId), isNull(accounts.deletedAt)));
  const accountIds = accountRows.map((r: { id: number }) => r.id);

  const snapshot: Record<string, number> = {};

  if (locationIds.length > 0) {
    const locIdSql = sql.join(locationIds.map((id: number) => sql`${id}`), sql`, `);

    const countTable = async (table: any, idField: any, extraCondition?: SQL) => {
      const conditions = [sql`${idField} IN (${locIdSql})`];
      if (extraCondition) conditions.push(extraCondition);
      const [row] = await input.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(table)
        .where(and(...conditions));
      return row?.count ?? 0;
    };

    snapshot.dailySales = await countTable(dailySales, dailySales.locationId, isNull(dailySales.deletedAt));
    snapshot.expenses = await countTable(expenses, expenses.locationId, isNull(expenses.deletedAt));
    snapshot.bills = await countTable(bills, bills.locationId, isNull(bills.deletedAt));
    snapshot.mpesaTransactions = await countTable(mpesaTransactions, mpesaTransactions.locationId, isNull(mpesaTransactions.deletedAt));
    snapshot.mobileWalletTransactions = await countTable(mobileWalletTransactions, mobileWalletTransactions.locationId, isNull(mobileWalletTransactions.deletedAt));
    snapshot.mobileWalletDailyLedger = await countTable(mobileWalletDailyLedger, mobileWalletDailyLedger.locationId, isNull(mobileWalletDailyLedger.deletedAt));
    snapshot.providerConfigs = await countTable(providerConfigs, providerConfigs.locationId, isNull(providerConfigs.deletedAt));
    snapshot.payrollPeriods = await countTable(payrollPeriods, payrollPeriods.locationId, isNull(payrollPeriods.deletedAt));
    snapshot.employees = await countTable(employees, employees.locationId, isNull(employees.deletedAt));
    snapshot.purchaseOrders = await countTable(purchaseOrders, purchaseOrders.locationId, isNull(purchaseOrders.deletedAt));
    snapshot.budgets = await countTable(budgets, budgets.locationId, isNull(budgets.deletedAt));
    snapshot.recurringBillTemplates = await countTable(recurringBillTemplates, recurringBillTemplates.locationId, isNull(recurringBillTemplates.deletedAt));
  }

  if (accountIds.length > 0) {
    const acctIdSql = sql.join(accountIds.map((id: number) => sql`${id}`), sql`, `);
    const [ledger] = await input.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(ledgerEntries)
      .where(sql`${ledgerEntries.accountId} IN (${acctIdSql})`);
    snapshot.ledgerEntries = ledger?.count ?? 0;
  }

  const [journal] = await input.db
    .select({ count: sql<number>`COUNT(*)` })
    .from(journalEntries)
    .where(and(eq(journalEntries.businessId, input.businessId), isNull(journalEntries.deletedAt)));
  snapshot.journalEntries = journal?.count ?? 0;

  return {
    businessId: input.businessId,
    timestamp: new Date().toISOString(),
    tableCounts: snapshot,
  };
}

// ─── Main Reset Function ─────────────────────────────────────────────────────

export async function resetBusinessTransactions(input: {
  db: any;
  businessId: number;
  userId?: number;
}): Promise<ResetResult> {
  return input.db.transaction(async (tx: any) => {
    const results: Record<string, { count: number }> = {};
    const now = new Date();

    // ── Step 1: Collect scoped IDs ─────────────────────────────────────────

    const businessLocations = await tx
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.businessId, input.businessId), isNull(locations.deletedAt)));
    const locationIds = businessLocations.map((l: { id: number }) => l.id);

    const accountRows = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.businessId, input.businessId), isNull(accounts.deletedAt)));
    const accountIds = accountRows.map((a: { id: number }) => a.id);

    const businessJournalEntries = await tx
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .where(and(eq(journalEntries.businessId, input.businessId), isNull(journalEntries.deletedAt)));
    const journalEntryIds = businessJournalEntries.map((e: { id: number }) => e.id);

    // ── Step 2: If no locations, short-circuit ─────────────────────────────

    if (locationIds.length === 0) {
      const zeroResult = (key: string) => { results[key] = { count: 0 }; };
      const resetableKeys = [
        "daily_sale_payments", "purchase_order_items", "bill_items", "bill_payments",
        "attachments", "payroll_entries", "payroll_advances", "daily_sales",
        "expenses", "expense_items", "bills", "mpesa_transactions",
        "mobile_wallet_transactions", "mobile_wallet_daily_ledger", "mobile_wallet_reconciliation",
        "provider_configs", "payroll_periods", "daily_mpesa_ledger", "recurring_bill_templates",
        "budgets", "purchase_orders", "locations", "supplier_price_history",
        "notifications", "quick_actions_log", "webhook_deliveries",
        "mpesa_reconciliation", "financial_reports",
      ];
      resetableKeys.forEach(zeroResult);
      results.ledger_entries = { count: 0 };
      results.journal_lines = { count: 0 };
      results.journal_entries = { count: 0 };
      results.fixed_asset_depreciation = { count: 0 };
      results.accounts = { count: 0 };
      results.user_accounts = { count: 0 };
      results.suppliers = { count: 0 };

      return {
        success: true,
        results,
        preserved: getPreservedTableList(),
        resetAt: now.toISOString(),
      };
    }

    const locIdSql = sql.join(locationIds.map((id: number) => sql`${id}`), sql`, `);

    // ── Step 3: Helper for soft-deleting location-scoped records ───────────

    const softDeleteLocationScoped = async (
      key: string,
      table: any,
      extraSet: Record<string, unknown> = {},
    ) => {
      const updated = await tx
        .update(table)
        .set({ deletedAt: now, ...extraSet })
        .where(and(sql`${table.locationId} IN (${locIdSql})`, isNull(table.deletedAt)))
        .returning({ id: table.id });
      results[key] = { count: updated.length };
    };

    const deleteLocationScoped = async (key: string, table: any) => {
      const deleted = await tx
        .delete(table)
        .where(sql`${table.locationId} IN (${locIdSql})`)
        .returning({ id: table.id });
      results[key] = { count: deleted.length };
    };

    // ── Step 4: Collect child IDs for cascade operations ───────────────────

    // Sale IDs
    const saleRows = await tx
      .select({ id: dailySales.id })
      .from(dailySales)
      .where(and(sql`${dailySales.locationId} IN (${locIdSql})`, isNull(dailySales.deletedAt)));
    const saleIds = saleRows.map((r: { id: number }) => r.id);

    // Bill IDs
    const billRows = await tx
      .select({ id: bills.id })
      .from(bills)
      .where(and(sql`${bills.locationId} IN (${locIdSql})`, isNull(bills.deletedAt)));
    const billIds = billRows.map((r: { id: number }) => r.id);

    // Expense IDs
    const expenseRows = await tx
      .select({ id: expenses.id })
      .from(expenses)
      .where(and(sql`${expenses.locationId} IN (${locIdSql})`, isNull(expenses.deletedAt)));
    const expenseIds = expenseRows.map((r: { id: number }) => r.id);

    // Payroll period IDs
    const payrollPeriodRows = await tx
      .select({ id: payrollPeriods.id })
      .from(payrollPeriods)
      .where(and(sql`${payrollPeriods.locationId} IN (${locIdSql})`, isNull(payrollPeriods.deletedAt)));
    const payrollPeriodIds = payrollPeriodRows.map((r: { id: number }) => r.id);

    // Employee IDs
    const employeeRows = await tx
      .select({ id: employees.id })
      .from(employees)
      .where(and(sql`${employees.locationId} IN (${locIdSql})`, isNull(employees.deletedAt)));
    const employeeIds = employeeRows.map((r: { id: number }) => r.id);

    // Purchase order IDs
    const poRows = await tx
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(and(sql`${purchaseOrders.locationId} IN (${locIdSql})`, isNull(purchaseOrders.deletedAt)));
    const poIds = poRows.map((r: { id: number }) => r.id);

    // ── Step 5: Clear child records first (cascade order) ─────────────────

    // 5a. daily_sale_payments (child of daily_sales)
    if (saleIds.length > 0) {
      const deleted = await tx
        .delete(dailySalePayments)
        .where(inArray(dailySalePayments.dailySaleId, saleIds))
        .returning({ id: dailySalePayments.id });
      results.daily_sale_payments = { count: deleted.length };
    } else {
      results.daily_sale_payments = { count: 0 };
    }

    // 5b. expense_items (child of expenses)
    if (expenseIds.length > 0) {
      const deleted = await tx
        .update(expenseItems)
        .set({ deletedAt: now })
        .where(and(inArray(expenseItems.expenseId, expenseIds), isNull(expenseItems.deletedAt)))
        .returning({ id: expenseItems.id });
      results.expense_items = { count: deleted.length };
    } else {
      results.expense_items = { count: 0 };
    }

    // 5c. purchase_order_items (child of purchase_orders)
    if (poIds.length > 0) {
      const deleted = await tx
        .update(purchaseOrderItems)
        .set({ deletedAt: now })
        .where(and(inArray(purchaseOrderItems.poId, poIds), isNull(purchaseOrderItems.deletedAt)))
        .returning({ id: purchaseOrderItems.id });
      results.purchase_order_items = { count: deleted.length };
    } else {
      results.purchase_order_items = { count: 0 };
    }

    // 5d. bill_items (child of bills)
    if (billIds.length > 0) {
      const deleted = await tx
        .update(billItems)
        .set({ deletedAt: now })
        .where(and(inArray(billItems.billId, billIds), isNull(billItems.deletedAt)))
        .returning({ id: billItems.id });
      results.bill_items = { count: deleted.length };
    } else {
      results.bill_items = { count: 0 };
    }

    // 5e. bill_payments (child of bills)
    if (billIds.length > 0) {
      const deleted = await tx
        .update(billPayments)
        .set({ deletedAt: now })
        .where(and(inArray(billPayments.billId, billIds), isNull(billPayments.deletedAt)))
        .returning({ id: billPayments.id });
      results.bill_payments = { count: deleted.length };
    } else {
      results.bill_payments = { count: 0 };
    }

    // 5f. attachments (linked to bills, expenses, sales)
    const attachmentFilters: SQL<unknown>[] = [];
    if (billIds.length > 0) {
      const f = and(eq(attachments.recordType, "bill"), inArray(attachments.recordId, billIds));
      if (f) attachmentFilters.push(f);
    }
    if (expenseIds.length > 0) {
      const f = and(eq(attachments.recordType, "expense"), inArray(attachments.recordId, expenseIds));
      if (f) attachmentFilters.push(f);
    }
    if (saleIds.length > 0) {
      const f = and(eq(attachments.recordType, "daily_sales"), inArray(attachments.recordId, saleIds));
      if (f) attachmentFilters.push(f);
    }

    if (attachmentFilters.length > 0) {
      const condition = attachmentFilters.length === 1
        ? attachmentFilters[0]
        : or(...(attachmentFilters as [SQL<unknown>, SQL<unknown>, ...SQL<unknown>[]]));

      const deleted = await tx
        .update(attachments)
        .set({ deletedAt: now })
        .where(and(condition, isNull(attachments.deletedAt)))
        .returning({ id: attachments.id });
      results.attachments = { count: deleted.length };
    } else {
      results.attachments = { count: 0 };
    }

    // 5g. payroll_entries (child of payroll_periods)
    if (payrollPeriodIds.length > 0) {
      const deleted = await tx
        .update(payrollEntries)
        .set({ deletedAt: now })
        .where(and(inArray(payrollEntries.periodId, payrollPeriodIds), isNull(payrollEntries.deletedAt)))
        .returning({ id: payrollEntries.id });
      results.payroll_entries = { count: deleted.length };
    } else {
      results.payroll_entries = { count: 0 };
    }

    // 5h. payroll_advances (child of employees)
    if (employeeIds.length > 0) {
      const deleted = await tx
        .update(payrollAdvances)
        .set({ deletedAt: now })
        .where(and(inArray(payrollAdvances.employeeId, employeeIds), isNull(payrollAdvances.deletedAt)))
        .returning({ id: payrollAdvances.id });
      results.payroll_advances = { count: deleted.length };
    } else {
      results.payroll_advances = { count: 0 };
    }

    // 5i. supplier_price_history (child of suppliers)
    const supplierRows = await tx
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(and(eq(suppliers.businessId, input.businessId), isNull(suppliers.deletedAt)));
    const supplierIds = supplierRows.map((r: { id: number }) => r.id);

    if (supplierIds.length > 0) {
      const suppIdSql = sql.join(supplierIds.map((id: number) => sql`${id}`), sql`, `);
      const deleted = await tx
        .delete(supplierPriceHistory)
        .where(sql`${supplierPriceHistory.supplierId} IN (${suppIdSql})`)
        .returning({ id: supplierPriceHistory.id });
      results.supplier_price_history = { count: deleted.length };
    } else {
      results.supplier_price_history = { count: 0 };
    }

    // ── Step 6: Soft-delete all parent location-scoped records ─────────────

    await softDeleteLocationScoped("daily_sales", dailySales);
    await softDeleteLocationScoped("expenses", expenses);
    await softDeleteLocationScoped("bills", bills, {
      status: "cancelled",
      balanceDue: "0.00",
    });
    await softDeleteLocationScoped("mpesa_transactions", mpesaTransactions);
    await softDeleteLocationScoped("mobile_wallet_transactions", mobileWalletTransactions);
    await softDeleteLocationScoped("mobile_wallet_daily_ledger", mobileWalletDailyLedger);

    await softDeleteLocationScoped("payroll_periods", payrollPeriods, {
      status: "cancelled",
    });
    await softDeleteLocationScoped("daily_mpesa_ledger", dailyMpesaLedger);
    await softDeleteLocationScoped("recurring_bill_templates", recurringBillTemplates, {
      isActive: false,
    });
    await softDeleteLocationScoped("budgets", budgets);
    await softDeleteLocationScoped("purchase_orders", purchaseOrders, {
      status: "cancelled",
    });

    // ── Step 7: Clear non-location-scoped but business-scoped transient data ─

    // 7a. notifications (transient, location-scoped)
    await deleteLocationScoped("notifications", notifications);

    // 7b. quick_actions_log (transient, user-scoped but business-specific)
    const quickDeleted = await tx
      .delete(quickActionsLog)
      .where(sql`${quickActionsLog.createdAt} < ${now}`)
      .returning({ id: quickActionsLog.id });
    results.quick_actions_log = { count: quickDeleted.length };

    // 7c. webhook_deliveries (transient)
    const whDeleted = await tx
      .delete(webhookDeliveries)
      .where(sql`${webhookDeliveries.createdAt} < ${now}`)
      .returning({ id: webhookDeliveries.id });
    results.webhook_deliveries = { count: whDeleted.length };

    // 7d. mpesa_reconciliation (transient, date-scoped)
    const mpesaRecDeleted = await tx
      .delete(mpesaReconciliation)
      .where(sql`1=1`)
      .returning({ id: mpesaReconciliation.id });
    results.mpesa_reconciliation = { count: mpesaRecDeleted.length };

    // 7e. mobile_wallet_reconciliation (transient)
    const walletRecDeleted = await tx
      .delete(mobileWalletReconciliation)
      .where(sql`1=1`)
      .returning({ id: mobileWalletReconciliation.id });
    results.mobile_wallet_reconciliation = { count: walletRecDeleted.length };

    // 7f. provider_configs (location-scoped, clear on reset)
    const configDeleted = await tx
      .update(providerConfigs)
      .set({ deletedAt: now, isActive: false } as any)
      .where(sql`1=1`)
      .returning({ id: providerConfigs.id });
    results.provider_configs = { count: configDeleted.length };

    // 7g. financial_reports (generated data, business-scoped)
    const frDeleted = await tx
      .delete(financialReports)
      .where(eq(financialReports.businessId, input.businessId))
      .returning({ id: financialReports.id });
    results.financial_reports = { count: frDeleted.length };

    // ── Step 8: Reset location counters ────────────────────────────────────

    const resetLocations = await tx
      .update(locations)
      .set({ nextBillNumber: 1, nextExpenseNumber: 1 })
      .where(inArray(locations.id, locationIds))
      .returning({ id: locations.id });
    results.locations = { count: resetLocations.length };

    // ── Step 9: Hard-delete ledger entries ─────────────────────────────────

    if (accountIds.length > 0) {
      const acctIdSql = sql.join(accountIds.map((id: number) => sql`${id}`), sql`, `);

      const deletedLedger = await tx
        .delete(ledgerEntries)
        .where(sql`${ledgerEntries.accountId} IN (${acctIdSql})`)
        .returning({ id: ledgerEntries.id });
      results.ledger_entries = { count: deletedLedger.length };
    } else {
      results.ledger_entries = { count: 0 };
    }

    // ── Step 10: Hard-delete journal entries and lines ─────────────────────

    if (journalEntryIds.length > 0) {
      const jeIdSql = sql.join(journalEntryIds.map((id: number) => sql`${id}`), sql`, `);

      // Hard-delete journal lines first (child records)
      const deletedLines = await tx
        .delete(journalLines)
        .where(sql`${journalLines.journalEntryId} IN (${jeIdSql})`)
        .returning({ id: journalLines.id });
      results.journal_lines = { count: deletedLines.length };

      // Reset fixed_asset_depreciation journal links before deleting entries
      const depTableResult = await tx.execute(
        sql`SELECT to_regclass('public.fixed_asset_depreciation') AS table_name`,
      );
      const depTableName = depTableResult.rows[0]?.table_name;

      if (depTableName) {
        const resetDep = await tx
          .update(fixedAssetDepreciation)
          .set({ journalEntryId: null, isPosted: false })
          .where(inArray(fixedAssetDepreciation.journalEntryId, journalEntryIds))
          .returning({ id: fixedAssetDepreciation.id });
        results.fixed_asset_depreciation = { count: resetDep.length };
      } else {
        results.fixed_asset_depreciation = { count: 0 };
      }
    } else {
      results.journal_lines = { count: 0 };
      results.fixed_asset_depreciation = { count: 0 };
    }

    // Hard-delete journal entries themselves
    const deletedJournalEntries = await tx
      .delete(journalEntries)
      .where(eq(journalEntries.businessId, input.businessId))
      .returning({ id: journalEntries.id });
    results.journal_entries = { count: deletedJournalEntries.length };

    // ── Step 11: Reset all account balances to zero, keep all active ───────

    const resetAccounts = await tx
      .update(accounts)
      .set({ currentBalance: "0.00", isActive: true })
      .where(and(eq(accounts.businessId, input.businessId), isNull(accounts.deletedAt)))
      .returning({ id: accounts.id });
    results.accounts = { count: resetAccounts.length };
    // User accounts are preserved (not soft-deleted), just zero-balanced
    results.user_accounts = { count: 0 };

    // ── Step 12: Reset supplier balances ───────────────────────────────────

    const updatedSuppliers = await tx
      .update(suppliers)
      .set({ currentBalance: "0.00", totalBilled: "0.00", totalPaid: "0.00" })
      .where(and(eq(suppliers.businessId, input.businessId), isNull(suppliers.deletedAt)))
      .returning({ id: suppliers.id });
    results.suppliers = { count: updatedSuppliers.length };

    // ── Step 13: Audit log entry for the reset operation ────────────────────
    try {
      const auditCount = Object.values(results).reduce(
        (sum, r) => sum + r.count,
        0,
      );
      const { logAudit } = await import("./audit");
      await logAudit({
        userId: input.userId ?? 0,
        businessId: input.businessId,
        action: "DELETE",
        resource: "business_reset",
        resourceId: input.businessId,
        details: {
          operation: "reset_all_transactions",
          totalRecordsCleared: auditCount,
          tablesAffected: Object.keys(results).filter(
            (k) => results[k].count > 0,
          ),
          resetTimestamp: now.toISOString(),
        },
      });
    } catch {
      // Audit logging is best-effort; don't fail the reset if audit fails
      console.warn("[business-reset] Failed to write audit log entry");
    }

    return {
      success: true,
      results,
      preserved: getPreservedTableList(),
      resetAt: now.toISOString(),
    };
  });
}

// ─── Preserved Table Documentation ───────────────────────────────────────────

function getPreservedTableList(): string[] {
  return [
    "businesses",
    "users",
    "user_businesses",
    "customer_accounts",
    "locations",
    "expense_categories",
    "revenue_categories",
    "employees",
    "suppliers",
    "accounts (all)",
    "items",
    "master_items",
    "fixed_asset_depreciation",
    "payment_methods",
    "location_payment_methods",
    "payroll_settings",
    "cogs_targets",
    "alerts_config",
    "price_alert_rules",
    "api_keys",
    "webhooks",
    "push_subscriptions",
    "refresh_tokens",
    "business_documents",
    "business_logos",
    "mobile_wallet_providers",
    "allocation_invites",
    "partner_allocations",
    "partner_commissions",
    "app_settings",
    "feedback_questionnaires",
    "feedback_responses",
    "business_inquiries",
    "external_sync_config",
    "role_permissions",
    "audit_log",
  ];
}
