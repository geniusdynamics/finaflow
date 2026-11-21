-- ABOUTME: Adds machine-to-machine instance controllers for sibling FinaBill deployments.
-- ABOUTME: Stores SHA-256 key hashes, controller identity, scopes, and revocation state.
CREATE TABLE IF NOT EXISTS instance_controllers (
  id serial PRIMARY KEY,
  name varchar(120) NOT NULL,
  "controllerId" varchar(100) NOT NULL,
  "keyHash" varchar(64) NOT NULL,
  "keyPrefix" varchar(20) NOT NULL,
  scopes json NOT NULL DEFAULT '["instance:read","instance:manage"]'::json,
  "isActive" boolean NOT NULL DEFAULT true,
  "lastUsedAt" timestamp,
  "createdByUserId" bigint REFERENCES users(id),
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "deletedAt" timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_instance_controllers_key_hash ON instance_controllers ("keyHash");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_instance_controllers_controller ON instance_controllers ("controllerId") WHERE "deletedAt" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_instance_controllers_active ON instance_controllers ("isActive", "deletedAt");
