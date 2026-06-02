-- ABOUTME: Sync existing business rows' maxUsers from their customer account
-- ABOUTME: where the business currently has "free" plan limits but the account has higher limits.
-- ABOUTME: This ensures consistent limit enforcement after the business bootstrap refactoring.

UPDATE businesses b
SET
  "maxUsers" = ca."maxUsers",
  "plan" = ca."plan"
FROM customer_accounts ca
WHERE b."accountId" = ca."accountId"
  AND ca."isActive" = true
  AND (
    b."maxUsers" IS NULL
    OR b."maxUsers" < ca."maxUsers"
    OR b."plan" = 'free'
  );

-- Also sync businesses that reference accounts via accountRefId (legacy relationship)
UPDATE businesses b
SET
  "maxUsers" = ca."maxUsers",
  "plan" = ca."plan"
FROM customer_accounts ca
WHERE b."accountRefId" = ca."id"
  AND b."accountId" IS NULL
  AND ca."isActive" = true
  AND (
    b."maxUsers" IS NULL
    OR b."maxUsers" < ca."maxUsers"
    OR b."plan" = 'free'
  );
