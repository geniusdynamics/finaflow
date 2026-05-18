// ABOUTME: Clears business-scoped transactional data while preserving setup records like locations and categories.
// ABOUTME: Resets journal, ledger, balances, and numbering. User-created payment accounts are soft-deleted; system accounts are preserved.
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
  expenses,
  fixedAssetDepreciation,
  journalEntries,
  journalLines,
  ledgerEntries,
  locations,
  mpesaTransactions,
  payrollAdvances,
  payrollEntries,
  payrollPeriods,
  purchaseOrderItems,
  purchaseOrders,
  recurringBillTemplates,
  suppliers,
} from "@db/schema";

type ResetResult = {
  success: true;
  results: Record<string, { count: number }>;
};

export async function resetBusinessTransactions(input: {
  db: any;
  businessId: number;
}): Promise<ResetResult> {
  return input.db.transaction(async (tx: any) => {
    const results: Record<string, { count: number }> = {};
    const now = new Date();

    const businessLocations = await tx
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.businessId, input.businessId), isNull(locations.deletedAt)));
    const locationIds = businessLocations.map((location: { id: number }) => location.id);

    const businessAccounts = await tx
      .select({ id: accounts.id, openingBalance: accounts.openingBalance, isSystemGenerated: accounts.isSystemGenerated, systemKey: accounts.systemKey })
      .from(accounts)
      .where(and(eq(accounts.businessId, input.businessId), isNull(accounts.deletedAt)));
    const accountIds = businessAccounts.map((account: { id: number }) => account.id);

    const businessJournalEntries = await tx
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .where(and(eq(journalEntries.businessId, input.businessId), isNull(journalEntries.deletedAt)));
    const journalEntryIds = businessJournalEntries.map((entry: { id: number }) => entry.id);

    if (locationIds.length > 0) {
      const saleRows = await tx
        .select({ id: dailySales.id })
        .from(dailySales)
        .where(and(inArray(dailySales.locationId, locationIds), isNull(dailySales.deletedAt)));
      const saleIds = saleRows.map((row: { id: number }) => row.id);
      const billRows = await tx
        .select({ id: bills.id })
        .from(bills)
        .where(and(inArray(bills.locationId, locationIds), isNull(bills.deletedAt)));
      const billIds = billRows.map((row: { id: number }) => row.id);
      const expenseRows = await tx
        .select({ id: expenses.id })
        .from(expenses)
        .where(and(inArray(expenses.locationId, locationIds), isNull(expenses.deletedAt)));
      const expenseIds = expenseRows.map((row: { id: number }) => row.id);
      const payrollPeriodRows = await tx
        .select({ id: payrollPeriods.id })
        .from(payrollPeriods)
        .where(and(inArray(payrollPeriods.locationId, locationIds), isNull(payrollPeriods.deletedAt)));
      const payrollPeriodIds = payrollPeriodRows.map((row: { id: number }) => row.id);
      const employeeRows = await tx
        .select({ id: employees.id })
        .from(employees)
        .where(and(inArray(employees.locationId, locationIds), isNull(employees.deletedAt)));
      const employeeIds = employeeRows.map((row: { id: number }) => row.id);

      if (saleIds.length > 0) {
        const deletedSalePayments = await tx
          .delete(dailySalePayments)
          .where(inArray(dailySalePayments.dailySaleId, saleIds))
          .returning({ id: dailySalePayments.id });
        results.daily_sale_payments = { count: deletedSalePayments.length };
      } else {
        results.daily_sale_payments = { count: 0 };
      }

      const purchaseOrdersToReset = await tx
        .select({ id: purchaseOrders.id })
        .from(purchaseOrders)
        .where(and(inArray(purchaseOrders.locationId, locationIds), isNull(purchaseOrders.deletedAt)));
      const purchaseOrderIds = purchaseOrdersToReset.map((row: { id: number }) => row.id);

      if (purchaseOrderIds.length > 0) {
        const updatedPurchaseOrderItems = await tx
          .update(purchaseOrderItems)
          .set({ deletedAt: now })
          .where(and(inArray(purchaseOrderItems.poId, purchaseOrderIds), isNull(purchaseOrderItems.deletedAt)))
          .returning({ id: purchaseOrderItems.id });
        results.purchase_order_items = { count: updatedPurchaseOrderItems.length };
      } else {
        results.purchase_order_items = { count: 0 };
      }

      if (billIds.length > 0) {
        const updatedBillItems = await tx
          .update(billItems)
          .set({ deletedAt: now })
          .where(and(inArray(billItems.billId, billIds), isNull(billItems.deletedAt)))
          .returning({ id: billItems.id });
        results.bill_items = { count: updatedBillItems.length };

        const updatedBillPayments = await tx
          .update(billPayments)
          .set({ deletedAt: now })
          .where(and(inArray(billPayments.billId, billIds), isNull(billPayments.deletedAt)))
          .returning({ id: billPayments.id });
        results.bill_payments = { count: updatedBillPayments.length };
      } else {
        results.bill_items = { count: 0 };
        results.bill_payments = { count: 0 };
      }

      const attachmentFilters: SQL<unknown>[] = [];
      if (billIds.length > 0) {
        const billAttachmentFilter = and(eq(attachments.recordType, "bill"), inArray(attachments.recordId, billIds));
        if (billAttachmentFilter) {
          attachmentFilters.push(billAttachmentFilter);
        }
      }
      if (expenseIds.length > 0) {
        const expenseAttachmentFilter = and(eq(attachments.recordType, "expense"), inArray(attachments.recordId, expenseIds));
        if (expenseAttachmentFilter) {
          attachmentFilters.push(expenseAttachmentFilter);
        }
      }
      if (saleIds.length > 0) {
        const saleAttachmentFilter = and(eq(attachments.recordType, "daily_sales"), inArray(attachments.recordId, saleIds));
        if (saleAttachmentFilter) {
          attachmentFilters.push(saleAttachmentFilter);
        }
      }

      if (attachmentFilters.length > 0) {
        const attachmentCondition =
          attachmentFilters.length === 1
            ? attachmentFilters[0]
            : or(...(attachmentFilters as [SQL<unknown>, SQL<unknown>, ...SQL<unknown>[]]));

        const updatedAttachments = await tx
          .update(attachments)
          .set({ deletedAt: now })
          .where(and(attachmentCondition, isNull(attachments.deletedAt)))
          .returning({ id: attachments.id });
        results.attachments = { count: updatedAttachments.length };
      } else {
        results.attachments = { count: 0 };
      }

      if (payrollPeriodIds.length > 0) {
        const updatedPayrollEntries = await tx
          .update(payrollEntries)
          .set({ deletedAt: now })
          .where(and(inArray(payrollEntries.periodId, payrollPeriodIds), isNull(payrollEntries.deletedAt)))
          .returning({ id: payrollEntries.id });
        results.payroll_entries = { count: updatedPayrollEntries.length };
      } else {
        results.payroll_entries = { count: 0 };
      }

      if (employeeIds.length > 0) {
        const updatedPayrollAdvances = await tx
          .update(payrollAdvances)
          .set({ deletedAt: now })
          .where(and(inArray(payrollAdvances.employeeId, employeeIds), isNull(payrollAdvances.deletedAt)))
          .returning({ id: payrollAdvances.id });
        results.payroll_advances = { count: updatedPayrollAdvances.length };
      } else {
        results.payroll_advances = { count: 0 };
      }

      const softDeleteLocationScoped = async (key: string, table: any, extraSet: Record<string, unknown> = {}) => {
        const updated = await tx
          .update(table)
          .set({ deletedAt: now, ...extraSet })
          .where(and(inArray(table.locationId, locationIds), isNull(table.deletedAt)))
          .returning({ id: table.id });
        results[key] = { count: updated.length };
      };

      await softDeleteLocationScoped("daily_sales", dailySales);
      await softDeleteLocationScoped("expenses", expenses);
      await softDeleteLocationScoped("bills", bills, { status: "cancelled", balanceDue: "0.00" });
      await softDeleteLocationScoped("mpesa_transactions", mpesaTransactions);
      await softDeleteLocationScoped("payroll_periods", payrollPeriods, { status: "cancelled" });
      await softDeleteLocationScoped("daily_mpesa_ledger", dailyMpesaLedger);
      await softDeleteLocationScoped("recurring_bill_templates", recurringBillTemplates, { isActive: false });
      await softDeleteLocationScoped("budgets", budgets);
      await softDeleteLocationScoped("purchase_orders", purchaseOrders, { status: "cancelled" });

      const resetLocations = await tx
        .update(locations)
        .set({ nextBillNumber: 1, nextExpenseNumber: 1 })
        .where(inArray(locations.id, locationIds))
        .returning({ id: locations.id });
      results.locations = { count: resetLocations.length };
    } else {
      results.daily_sale_payments = { count: 0 };
      results.purchase_order_items = { count: 0 };
      results.daily_sales = { count: 0 };
      results.expenses = { count: 0 };
      results.bills = { count: 0 };
      results.mpesa_transactions = { count: 0 };
      results.payroll_periods = { count: 0 };
      results.payroll_entries = { count: 0 };
      results.payroll_advances = { count: 0 };
      results.daily_mpesa_ledger = { count: 0 };
      results.attachments = { count: 0 };
      results.recurring_bill_templates = { count: 0 };
      results.budgets = { count: 0 };
      results.purchase_orders = { count: 0 };
      results.locations = { count: 0 };
      results.user_accounts = { count: 0 };
    }

    if (accountIds.length > 0) {
      const updatedLedgerEntries = await tx
        .update(ledgerEntries)
        .set({ deletedAt: now })
        .where(and(inArray(ledgerEntries.accountId, accountIds), isNull(ledgerEntries.deletedAt)))
        .returning({ id: ledgerEntries.id });
      results.ledger_entries = { count: updatedLedgerEntries.length };
    } else {
      results.ledger_entries = { count: 0 };
    }

    if (journalEntryIds.length > 0) {
      const updatedJournalLines = await tx
        .update(journalLines)
        .set({ deletedAt: now })
        .where(and(inArray(journalLines.journalEntryId, journalEntryIds), isNull(journalLines.deletedAt)))
        .returning({ id: journalLines.id });
      results.journal_lines = { count: updatedJournalLines.length };

      const depreciationTableResult = await tx.execute(
        sql`SELECT to_regclass('public.fixed_asset_depreciation') AS table_name`,
      );
      const depreciationTableName = depreciationTableResult.rows[0]?.table_name;

      if (depreciationTableName) {
        const resetDepreciationRows = await tx
          .update(fixedAssetDepreciation)
          .set({ journalEntryId: null, isPosted: false })
          .where(inArray(fixedAssetDepreciation.journalEntryId, journalEntryIds))
          .returning({ id: fixedAssetDepreciation.id });
        results.fixed_asset_depreciation = { count: resetDepreciationRows.length };
      } else {
        results.fixed_asset_depreciation = { count: 0 };
      }
    } else {
      results.journal_lines = { count: 0 };
      results.fixed_asset_depreciation = { count: 0 };
    }

    const updatedJournalEntries = await tx
      .update(journalEntries)
      .set({
        deletedAt: now,
        isPosted: false,
        postedAt: null,
        postedBy: null,
        isReversed: false,
        reversedBy: null,
        reversalOf: null,
      })
      .where(and(eq(journalEntries.businessId, input.businessId), isNull(journalEntries.deletedAt)))
      .returning({ id: journalEntries.id });
    results.journal_entries = { count: updatedJournalEntries.length };

    const systemAccounts = businessAccounts.filter((a: any) => a.isSystemGenerated === true || a.systemKey !== null);
    const userAccounts = businessAccounts.filter((a: any) => a.isSystemGenerated !== true && a.systemKey === null);

    let accountResetCount = 0;
    for (const account of systemAccounts) {
      await tx
        .update(accounts)
        .set({ currentBalance: account.openingBalance ?? "0.00" })
        .where(eq(accounts.id, account.id));
      accountResetCount++;
    }
    results.accounts = { count: accountResetCount };

    if (userAccounts.length > 0) {
      const userAccountIds = userAccounts.map((a: any) => a.id);
      const deletedUserAccounts = await tx
        .update(accounts)
        .set({ deletedAt: now, isActive: false, currentBalance: "0.00" })
        .where(and(inArray(accounts.id, userAccountIds), isNull(accounts.deletedAt)))
        .returning({ id: accounts.id });
      results.user_accounts = { count: deletedUserAccounts.length };
    } else {
      results.user_accounts = { count: 0 };
    }

    const updatedSuppliers = await tx
      .update(suppliers)
      .set({ currentBalance: "0.00", totalBilled: "0.00", totalPaid: "0.00" })
      .where(and(eq(suppliers.businessId, input.businessId), isNull(suppliers.deletedAt)))
      .returning({ id: suppliers.id });
    results.suppliers = { count: updatedSuppliers.length };

    return {
      success: true,
      results,
    };
  });
}
