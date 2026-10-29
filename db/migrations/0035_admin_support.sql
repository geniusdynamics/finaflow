-- ABOUTME: Adds independent billing holds and manual renewal review storage.
-- ABOUTME: Preserves customer entitlements and enforces a single pending request per account.
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS "billingHoldAt" timestamp;
CREATE TABLE IF NOT EXISTS account_renewal_requests (
 id serial PRIMARY KEY,
 "accountRefId" bigint NOT NULL REFERENCES customer_accounts(id),
 "holdAt" timestamp NOT NULL,
 "requestedBy" bigint NOT NULL REFERENCES users(id),
 "paymentReference" varchar(255), note text,
 status varchar(20) NOT NULL DEFAULT 'pending',
 "reviewedBy" bigint REFERENCES users(id), "reviewReason" text,
 "createdAt" timestamp NOT NULL DEFAULT now(), "reviewedAt" timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_renewal_pending_account ON account_renewal_requests ("accountRefId") WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_renewal_account ON account_renewal_requests ("accountRefId");
CREATE INDEX IF NOT EXISTS idx_renewal_status ON account_renewal_requests (status);
