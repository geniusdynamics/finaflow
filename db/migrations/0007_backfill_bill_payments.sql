-- ABOUTME: Backfill billPayments records for existing expenses that reference a billId
-- ABOUTME: but don't yet have a corresponding billPayments entry. This ensures the
-- ABOUTME: payment audit trail is complete after the bill payment consolidation refactoring.

INSERT INTO bill_payments ("billId", "paymentMethod", "amount", "paymentDate", "notes", "accountId", "enteredBy", "createdAt", "updatedAt")
SELECT
  e."billId",
  COALESCE(e."paymentMethod"::text, 'cash')::"paymentMethod2",
  e."amount",
  e."expenseDate",
  CONCAT('Backfilled: ', e."description"),
  e."accountId",
  COALESCE(e."enteredBy", 1),
  NOW(),
  NOW()
FROM expenses e
WHERE e."billId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM bill_payments bp WHERE bp."billId" = e."billId"
  );
