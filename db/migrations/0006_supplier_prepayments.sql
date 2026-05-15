-- ABOUTME: Creates the 1550 - Supplier Prepayments asset account for all businesses
-- ABOUTME: This account captures overpayments to suppliers that exceed the payable balance

-- Create the Supplier Prepayments account for each business that doesn't have it yet
INSERT INTO accounts (
  businessId, locationId, name, accountCode, description,
  accountType, accountSubType, type, openingBalance, currentBalance,
  isContra, isPaymentMethod, isActive, currency
)
SELECT
  b.id AS businessId,
  (SELECT id FROM locations WHERE "businessId" = b.id AND "deletedAt" IS NULL ORDER BY id LIMIT 1) AS locationId,
  'Supplier Prepayments' AS name,
  '1550' AS accountCode,
  'Overpayments to suppliers - amounts paid in excess of outstanding bills. This is an asset representing money owed back by suppliers.' AS description,
  'asset' AS accountType,
  'accounts_receivable' AS accountSubType,
  'bank_account' AS type,
  '0.00' AS openingBalance,
  '0.00' AS currentBalance,
  false AS isContra,
  false AS isPaymentMethod,
  true AS isActive,
  'KES' AS currency
FROM businesses b
WHERE b."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM accounts a
    WHERE a."accountCode" = '1550'
      AND a."businessId" = b.id
      AND a."deletedAt" IS NULL
  );

CREATE INDEX IF NOT EXISTS idx_accounts_supplier_prepayments
  ON accounts("accountCode")
  WHERE "accountCode" = '1550';
