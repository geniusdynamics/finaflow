-- ABOUTME: Adds debt origination, COA auto-classification, and bank-linking columns
-- ABOUTME: to the debts and bills tables. Idempotent — safe to re-run; uses
-- ABOUTME: ADD COLUMN IF NOT EXISTS and ADD VALUE IF NOT EXISTS guards throughout.
-- ABOUTME: Statements are kept on a single `;` boundary so the test runner's naive
-- ABOUTME: statement splitter does not break PL/pgSQL DO blocks.

-- ── 1. Create debts table (idempotent) ───────────────────────────────
CREATE TABLE IF NOT EXISTS "debts" (
  "id" serial PRIMARY KEY NOT NULL,
  "locationId" bigint,
  "businessId" bigint,
  "creditorName" varchar(255) NOT NULL,
  "description" text,
  "totalAmount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
  "paidAmount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
  "interestRate" numeric(5, 2) DEFAULT '0.00',
  "dueDate" timestamp,
  "loanDate" timestamp DEFAULT NOW() NOT NULL,
  "installmentAmount" numeric(15, 2),
  "destinationAccountId" bigint,
  "loanAccountId" bigint,
  "isDisbursed" boolean DEFAULT FALSE NOT NULL,
  "disbursementDate" timestamp,
  "disbursementFee" numeric(15, 2),
  "recurringBillTemplateId" bigint,
  "status" varchar(50) DEFAULT 'active' NOT NULL,
  "paymentSchedule" varchar(50) DEFAULT 'monthly',
  "notes" text,
  "createdBy" bigint,
  "createdAt" timestamp DEFAULT NOW() NOT NULL,
  "updatedAt" timestamp DEFAULT NOW() NOT NULL,
  "deletedAt" timestamp
);

-- ── 2. Add new columns to debts (in case the table already existed) ───
ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "loanDate" TIMESTAMP DEFAULT NOW() NOT NULL;
ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "installmentAmount" NUMERIC(15, 2);
ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "destinationAccountId" BIGINT;
ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "loanAccountId" BIGINT;
ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "isDisbursed" BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "disbursementDate" TIMESTAMP;
ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "disbursementFee" NUMERIC(15, 2);
ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "recurringBillTemplateId" BIGINT;

-- ── 3. Add debtId to bills ───────────────────────────────────────────
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "debtId" BIGINT REFERENCES "debts"("id") ON DELETE SET NULL;

-- ── 4. Indexes for the new foreign-key / lookup columns ───────────────
CREATE INDEX IF NOT EXISTS "idx_debts_loan_account" ON "debts" ("loanAccountId");
CREATE INDEX IF NOT EXISTS "idx_debts_destination_account" ON "debts" ("destinationAccountId");
CREATE INDEX IF NOT EXISTS "idx_debts_recurring_template" ON "debts" ("recurringBillTemplateId");
CREATE INDEX IF NOT EXISTS "idx_bills_debt" ON "bills" ("debtId");

-- ── 5. Extend the transactionType enum ───────────────────────────────
-- IF NOT EXISTS on ADD VALUE requires PostgreSQL 12+. The seed migration 0000
-- already requires PG 12+ features elsewhere, so this is safe.
ALTER TYPE "transactionType" ADD VALUE IF NOT EXISTS 'loan_origination';
ALTER TYPE "transactionType" ADD VALUE IF NOT EXISTS 'loan_disbursement';

-- ── 6. Extend the accountSubType enum ────────────────────────────────
ALTER TYPE "accountSubType" ADD VALUE IF NOT EXISTS 'bank_charges';
