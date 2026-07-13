-- Migration: add core foreign keys for data integrity
-- Generated: 2026-07-11
-- Safety: each FK is added with NOT VALID, then validated in a separate step to avoid long locks.
-- Rollback (example):
--   ALTER TABLE "bill_items" DROP CONSTRAINT IF EXISTS "bill_items_billId_bills_id_fk";

-- bill_items
ALTER TABLE "bill_items"
  ADD CONSTRAINT "bill_items_billId_bills_id_fk"
  FOREIGN KEY ("billId") REFERENCES "public"."bills"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "bill_items" VALIDATE CONSTRAINT "bill_items_billId_bills_id_fk";
--> statement-breakpoint
ALTER TABLE "bill_items"
  ADD CONSTRAINT "bill_items_categoryId_expense_categories_id_fk"
  FOREIGN KEY ("categoryId") REFERENCES "public"."expense_categories"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "bill_items" VALIDATE CONSTRAINT "bill_items_categoryId_expense_categories_id_fk";
--> statement-breakpoint

-- bill_payments
ALTER TABLE "bill_payments"
  ADD CONSTRAINT "bill_payments_billId_bills_id_fk"
  FOREIGN KEY ("billId") REFERENCES "public"."bills"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "bill_payments" VALIDATE CONSTRAINT "bill_payments_billId_bills_id_fk";
--> statement-breakpoint
ALTER TABLE "bill_payments"
  ADD CONSTRAINT "bill_payments_journalEntryId_journal_entries_id_fk"
  FOREIGN KEY ("journalEntryId") REFERENCES "public"."journal_entries"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "bill_payments" VALIDATE CONSTRAINT "bill_payments_journalEntryId_journal_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "bill_payments"
  ADD CONSTRAINT "bill_payments_enteredBy_users_id_fk"
  FOREIGN KEY ("enteredBy") REFERENCES "public"."users"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "bill_payments" VALIDATE CONSTRAINT "bill_payments_enteredBy_users_id_fk";
--> statement-breakpoint

-- bills
ALTER TABLE "bills"
  ADD CONSTRAINT "bills_supplierId_suppliers_id_fk"
  FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "bills" VALIDATE CONSTRAINT "bills_supplierId_suppliers_id_fk";
--> statement-breakpoint
ALTER TABLE "bills"
  ADD CONSTRAINT "bills_categoryId_expense_categories_id_fk"
  FOREIGN KEY ("categoryId") REFERENCES "public"."expense_categories"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "bills" VALIDATE CONSTRAINT "bills_categoryId_expense_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "bills"
  ADD CONSTRAINT "bills_journalEntryId_journal_entries_id_fk"
  FOREIGN KEY ("journalEntryId") REFERENCES "public"."journal_entries"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "bills" VALIDATE CONSTRAINT "bills_journalEntryId_journal_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "bills"
  ADD CONSTRAINT "bills_enteredBy_users_id_fk"
  FOREIGN KEY ("enteredBy") REFERENCES "public"."users"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "bills" VALIDATE CONSTRAINT "bills_enteredBy_users_id_fk";
--> statement-breakpoint

-- daily sales
ALTER TABLE "daily_sale_payments"
  ADD CONSTRAINT "daily_sale_payments_dailySaleId_daily_sales_id_fk"
  FOREIGN KEY ("dailySaleId") REFERENCES "public"."daily_sales"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "daily_sale_payments" VALIDATE CONSTRAINT "daily_sale_payments_dailySaleId_daily_sales_id_fk";
--> statement-breakpoint
ALTER TABLE "daily_sales"
  ADD CONSTRAINT "daily_sales_locationId_locations_id_fk"
  FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "daily_sales" VALIDATE CONSTRAINT "daily_sales_locationId_locations_id_fk";
--> statement-breakpoint

-- employees
ALTER TABLE "employees"
  ADD CONSTRAINT "employees_locationId_locations_id_fk"
  FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "employees" VALIDATE CONSTRAINT "employees_locationId_locations_id_fk";
--> statement-breakpoint
ALTER TABLE "employees"
  ADD CONSTRAINT "employees_userId_users_id_fk"
  FOREIGN KEY ("userId") REFERENCES "public"."users"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "employees" VALIDATE CONSTRAINT "employees_userId_users_id_fk";
--> statement-breakpoint

-- expenses
ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_categoryId_expense_categories_id_fk"
  FOREIGN KEY ("categoryId") REFERENCES "public"."expense_categories"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "expenses" VALIDATE CONSTRAINT "expenses_categoryId_expense_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_supplierId_suppliers_id_fk"
  FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "expenses" VALIDATE CONSTRAINT "expenses_supplierId_suppliers_id_fk";
--> statement-breakpoint
ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_billId_bills_id_fk"
  FOREIGN KEY ("billId") REFERENCES "public"."bills"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "expenses" VALIDATE CONSTRAINT "expenses_billId_bills_id_fk";
--> statement-breakpoint
ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_fixedAssetItemId_items_id_fk"
  FOREIGN KEY ("fixedAssetItemId") REFERENCES "public"."items"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "expenses" VALIDATE CONSTRAINT "expenses_fixedAssetItemId_items_id_fk";
--> statement-breakpoint
ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_journalEntryId_journal_entries_id_fk"
  FOREIGN KEY ("journalEntryId") REFERENCES "public"."journal_entries"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "expenses" VALIDATE CONSTRAINT "expenses_journalEntryId_journal_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_enteredBy_users_id_fk"
  FOREIGN KEY ("enteredBy") REFERENCES "public"."users"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "expenses" VALIDATE CONSTRAINT "expenses_enteredBy_users_id_fk";
--> statement-breakpoint

-- mpesa_transactions
ALTER TABLE "mpesa_transactions"
  ADD CONSTRAINT "mpesa_transactions_locationId_locations_id_fk"
  FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "mpesa_transactions" VALIDATE CONSTRAINT "mpesa_transactions_locationId_locations_id_fk";
--> statement-breakpoint

-- payroll
ALTER TABLE "payroll_advances"
  ADD CONSTRAINT "payroll_advances_employeeId_employees_id_fk"
  FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "payroll_advances" VALIDATE CONSTRAINT "payroll_advances_employeeId_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "payroll_advances"
  ADD CONSTRAINT "payroll_advances_payrollPeriodId_payroll_periods_id_fk"
  FOREIGN KEY ("payrollPeriodId") REFERENCES "public"."payroll_periods"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "payroll_advances" VALIDATE CONSTRAINT "payroll_advances_payrollPeriodId_payroll_periods_id_fk";
--> statement-breakpoint
ALTER TABLE "payroll_advances"
  ADD CONSTRAINT "payroll_advances_approvedBy_users_id_fk"
  FOREIGN KEY ("approvedBy") REFERENCES "public"."users"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "payroll_advances" VALIDATE CONSTRAINT "payroll_advances_approvedBy_users_id_fk";
--> statement-breakpoint
ALTER TABLE "payroll_entries"
  ADD CONSTRAINT "payroll_entries_periodId_payroll_periods_id_fk"
  FOREIGN KEY ("periodId") REFERENCES "public"."payroll_periods"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "payroll_entries" VALIDATE CONSTRAINT "payroll_entries_periodId_payroll_periods_id_fk";
--> statement-breakpoint
ALTER TABLE "payroll_entries"
  ADD CONSTRAINT "payroll_entries_employeeId_employees_id_fk"
  FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id")
  ON DELETE no action ON UPDATE no action
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "payroll_entries" VALIDATE CONSTRAINT "payroll_entries_employeeId_employees_id_fk";
