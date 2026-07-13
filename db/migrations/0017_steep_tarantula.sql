-- Migration: add core performance indexes to high-volume financial tables
-- Generated: 2026-07-11
-- Safety: all index builds use CREATE INDEX CONCURRENTLY IF NOT EXISTS to avoid long table locks.
-- Rollback (one per index):
--   DROP INDEX CONCURRENTLY IF EXISTS "idx_bills_location_deleted";

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_bills_location_deleted" ON "bills" USING btree ("locationId","deletedAt") WHERE "bills"."deletedAt" IS NULL;
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_bills_business_deleted" ON "bills" USING btree ("businessId","deletedAt") WHERE "bills"."deletedAt" IS NULL;
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_bills_status_due_date" ON "bills" USING btree ("status","dueDate");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_bills_supplier" ON "bills" USING btree ("supplierId");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_bills_journal_entry" ON "bills" USING btree ("journalEntryId");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_bills_debt" ON "bills" USING btree ("debtId");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_bills_entered_by" ON "bills" USING btree ("enteredBy");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_expenses_location_deleted" ON "expenses" USING btree ("locationId","deletedAt") WHERE "expenses"."deletedAt" IS NULL;
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_expenses_business_deleted" ON "expenses" USING btree ("businessId","deletedAt") WHERE "expenses"."deletedAt" IS NULL;
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_expenses_category_date" ON "expenses" USING btree ("categoryId","expenseDate");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_expenses_supplier" ON "expenses" USING btree ("supplierId");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_expenses_bill" ON "expenses" USING btree ("billId");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_expenses_journal_entry" ON "expenses" USING btree ("journalEntryId");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_expenses_fixed_asset" ON "expenses" USING btree ("fixedAssetItemId");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_expenses_entered_by" ON "expenses" USING btree ("enteredBy");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_daily_sales_location_date" ON "daily_sales" USING btree ("locationId","saleDate");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_daily_sales_deleted" ON "daily_sales" USING btree ("deletedAt") WHERE "daily_sales"."deletedAt" IS NULL;
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_daily_sales_source_batch" ON "daily_sales" USING btree ("source_batch_id");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_ledger_entries_account_date" ON "ledger_entries" USING btree ("accountId","entryDate","deletedAt") WHERE "ledger_entries"."deletedAt" IS NULL;
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_ledger_entries_transaction" ON "ledger_entries" USING btree ("transactionType","transactionId");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_bill_payments_bill" ON "bill_payments" USING btree ("billId");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_bill_payments_journal_entry" ON "bill_payments" USING btree ("journalEntryId");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_recurring_bills_location_next" ON "recurring_bill_templates" USING btree ("locationId","nextDueDate","isActive","deletedAt") WHERE "recurring_bill_templates"."deletedAt" IS NULL;
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_debts_business_deleted" ON "debts" USING btree ("businessId","deletedAt") WHERE "debts"."deletedAt" IS NULL;
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_debts_location_deleted" ON "debts" USING btree ("locationId","deletedAt") WHERE "debts"."deletedAt" IS NULL;
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_debts_status" ON "debts" USING btree ("status");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_mpesa_location_date" ON "mpesa_transactions" USING btree ("locationId","txnDate");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_mpesa_source_account" ON "mpesa_transactions" USING btree ("sourceAccountId");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_mpesa_destination_account" ON "mpesa_transactions" USING btree ("destinationAccountId");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_mpesa_linked_expense" ON "mpesa_transactions" USING btree ("linkedExpenseId");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_mpesa_linked_bill" ON "mpesa_transactions" USING btree ("linkedBillId");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_api_keys_business" ON "api_keys" USING btree ("businessId");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_api_keys_key_hash" ON "api_keys" USING btree ("keyHash");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_locations_business_deleted" ON "locations" USING btree ("businessId","deletedAt") WHERE "locations"."deletedAt" IS NULL;
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_businesses_account_deleted" ON "businesses" USING btree ("accountId","deletedAt") WHERE "businesses"."deletedAt" IS NULL;
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_users_account" ON "users" USING btree ("accountId");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_accounts_location_deleted" ON "accounts" USING btree ("locationId","deletedAt") WHERE "accounts"."deletedAt" IS NULL;
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_audit_log_table_record" ON "audit_log" USING btree ("tableName","recordId");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_audit_log_created_at" ON "audit_log" USING btree ("createdAt");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_exchange_rates_pair_valid" ON "exchange_rates" USING btree ("from_currency","to_currency","valid_from");
--> statement-breakpoint
-- Refresh query plans now that the indexes exist.
ANALYZE "bills";
--> statement-breakpoint
ANALYZE "expenses";
--> statement-breakpoint
ANALYZE "daily_sales";
--> statement-breakpoint
ANALYZE "ledger_entries";
--> statement-breakpoint
ANALYZE "bill_payments";
--> statement-breakpoint
ANALYZE "recurring_bill_templates";
--> statement-breakpoint
ANALYZE "debts";
--> statement-breakpoint
ANALYZE "mpesa_transactions";
--> statement-breakpoint
ANALYZE "api_keys";
--> statement-breakpoint
ANALYZE "locations";
--> statement-breakpoint
ANALYZE "businesses";
--> statement-breakpoint
ANALYZE "users";
--> statement-breakpoint
ANALYZE "accounts";
--> statement-breakpoint
ANALYZE "audit_log";
--> statement-breakpoint
ANALYZE "exchange_rates";
