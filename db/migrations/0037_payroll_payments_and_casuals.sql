-- Casual / daily pay basis, partial-payment tracking, and per-payment reversal.
-- Adds the settlement state payroll needs to pay staff in parts and to undo one payment.
DO $$ BEGIN
  CREATE TYPE "public"."payroll_payment_status" AS ENUM('unpaid', 'partial', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS "daysWorked" numeric(8,2);
ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS "housingLevyDeducted" numeric(15,2) NOT NULL DEFAULT 0.00;
ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS "paidAmount" numeric(15,2) NOT NULL DEFAULT 0.00;
ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS "paymentStatus" "public"."payroll_payment_status" NOT NULL DEFAULT 'unpaid';

CREATE TABLE IF NOT EXISTS payroll_payments (
  id serial PRIMARY KEY,
  "periodId" bigint NOT NULL REFERENCES payroll_periods(id),
  "entryId" bigint NOT NULL REFERENCES payroll_entries(id),
  "employeeId" bigint NOT NULL REFERENCES employees(id),
  amount numeric(15,2) NOT NULL,
  "accountId" bigint NOT NULL,
  "paymentMethod" "public"."paymentMethod" NOT NULL DEFAULT 'mpesa',
  reference varchar(100),
  "paidAt" timestamp NOT NULL DEFAULT now(),
  "reversedAt" timestamp,
  "reversalReason" text,
  "reversedBy" bigint,
  "createdBy" bigint,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_payments_period ON payroll_payments ("periodId");
CREATE INDEX IF NOT EXISTS idx_payroll_payments_entry ON payroll_payments ("entryId");

-- Existing settled entries predate per-entry tracking; treat them as fully paid.
UPDATE payroll_entries
SET "paidAmount" = "netPay", "paymentStatus" = 'paid'
WHERE "deletedAt" IS NULL AND "paidAt" IS NOT NULL AND "paidAmount" = 0.00;
