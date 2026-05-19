-- ABOUTME: Adds currency columns to all existing monetary tables for multi-currency support.
-- ABOUTME: Existing data defaults to 'KES' ensuring full backward compatibility.

-- Expenses
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'KES' NOT NULL;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "base_currency" varchar(3);
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "base_amount" numeric(15, 2);

-- Expense Items
ALTER TABLE "expense_items" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'KES' NOT NULL;

-- Bills
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'KES' NOT NULL;
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "base_currency" varchar(3);
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "base_amount" numeric(15, 2);

-- Bill Items
ALTER TABLE "bill_items" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'KES' NOT NULL;

-- Bill Payments
ALTER TABLE "bill_payments" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'KES' NOT NULL;

-- Daily Sales (core reporting table - needs baseCurrency/baseAmount)
ALTER TABLE "daily_sales" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'KES' NOT NULL;
ALTER TABLE "daily_sales" ADD COLUMN IF NOT EXISTS "base_currency" varchar(3);
ALTER TABLE "daily_sales" ADD COLUMN IF NOT EXISTS "base_amount" numeric(15, 2);

-- Daily Sale Payments
ALTER TABLE "daily_sale_payments" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'KES' NOT NULL;

-- Journal Lines (core reporting table - needs baseCurrency/baseAmount)
ALTER TABLE "journal_lines" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'KES' NOT NULL;
ALTER TABLE "journal_lines" ADD COLUMN IF NOT EXISTS "base_currency" varchar(3);
ALTER TABLE "journal_lines" ADD COLUMN IF NOT EXISTS "base_amount" numeric(15, 2);

-- Ledger Entries
ALTER TABLE "ledger_entries" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'KES' NOT NULL;

-- Payroll Entries
ALTER TABLE "payroll_entries" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'KES' NOT NULL;

-- Payroll Advances
ALTER TABLE "payroll_advances" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'KES' NOT NULL;

-- Suppliers
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'KES' NOT NULL;

-- Budgets
ALTER TABLE "budgets" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'KES' NOT NULL;

-- Purchase Orders
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'KES' NOT NULL;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "base_currency" varchar(3);
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "base_amount" numeric(15, 2);

-- Purchase Order Items
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'KES' NOT NULL;

-- Items (inventory)
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'KES' NOT NULL;

-- Fixed Asset Depreciation
ALTER TABLE "fixed_asset_depreciation" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'KES' NOT NULL;

-- Partner Commissions
ALTER TABLE "partner_commissions" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'KES' NOT NULL;
