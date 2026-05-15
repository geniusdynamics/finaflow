-- ABOUTME: Creates the 1300 - Accounts Receivable asset account for all businesses
-- ABOUTME: This account tracks money owed by customers for credit sales

INSERT INTO accounts ("businessId", "locationId", name, "accountCode", description,
  "accountType", "accountSubType", type, "openingBalance", "currentBalance",
  "isContra", "isPaymentMethod", "isActive", currency)
SELECT
  b.id AS "businessId",
  (SELECT id FROM locations WHERE "businessId" = b.id AND "deletedAt" IS NULL ORDER BY id LIMIT 1) AS "locationId",
  'Accounts Receivable' AS name,
  '1300' AS "accountCode",
  'Amounts owed by customers for credit sales - money expected to be received.' AS description,
  'asset' AS "accountType",
  'accounts_receivable' AS "accountSubType",
  'bank_account' AS type,
  '0.00' AS "openingBalance",
  '0.00' AS "currentBalance",
  false AS "isContra",
  false AS "isPaymentMethod",
  true AS "isActive",
  'KES' AS currency
FROM businesses b
WHERE b."deletedAt" IS NULL
  AND (SELECT id FROM locations WHERE "businessId" = b.id AND "deletedAt" IS NULL LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM accounts a
    WHERE a."accountCode" = '1300'
      AND a."businessId" = b.id
      AND a."deletedAt" IS NULL
  );

CREATE INDEX IF NOT EXISTS idx_accounts_ar
  ON accounts("accountCode")
  WHERE "accountCode" = '1300';
