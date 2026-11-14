-- One-time report and recovery links for administrator-set passwords.
ALTER TYPE email_log_type ADD VALUE IF NOT EXISTS 'password_changed';
ALTER TABLE users ADD COLUMN IF NOT EXISTS "passwordChangedAt" timestamp;
CREATE TABLE IF NOT EXISTS password_change_events (
  id serial PRIMARY KEY,
  "userId" bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "actorId" bigint REFERENCES users(id) ON DELETE SET NULL,
  "accountId" varchar(100),
  "tokenHash" varchar(64) NOT NULL UNIQUE,
  "expiresAt" timestamp NOT NULL,
  "reportedAt" timestamp,
  "resolvedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_change_events_user ON password_change_events ("userId");
CREATE INDEX IF NOT EXISTS idx_password_change_events_account ON password_change_events ("accountId");
CREATE INDEX IF NOT EXISTS idx_password_change_events_reported ON password_change_events ("reportedAt");
