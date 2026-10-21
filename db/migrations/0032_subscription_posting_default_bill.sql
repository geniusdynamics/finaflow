-- ABOUTME: Default new subscriptions to bill posting — the AP obligation accrues on the due date
-- ABOUTME: and is settled when the payment is marked paid. Existing rows keep their posting mode.
ALTER TABLE "subscriptions" ALTER COLUMN "postingMode" SET DEFAULT 'bill';
