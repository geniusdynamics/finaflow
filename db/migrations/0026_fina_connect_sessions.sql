-- Fina Connect sessions (first-party FinaFlow <-> FinaBill pairing)
CREATE TABLE IF NOT EXISTS "integration_connect_sessions" (
  "id" serial PRIMARY KEY NOT NULL,
  "sessionPublicId" varchar(64) NOT NULL,
  "initiatorSystem" varchar(50) NOT NULL,
  "partnerSystem" varchar(50) NOT NULL,
  "initiatorBusinessId" bigint,
  "partnerBusinessId" bigint,
  "codeHash" varchar(255) NOT NULL,
  "codePrefix" varchar(20) NOT NULL,
  "state" varchar(128) NOT NULL,
  "codeChallenge" varchar(128),
  "redirectUri" varchar(500),
  "scopes" json,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "initiatorApiUrl" varchar(500),
  "initiatorAppUrl" varchar(500),
  "partnerApiUrl" varchar(500),
  "partnerAppUrl" varchar(500),
  "exchangePayload" json,
  "createdByUserId" bigint,
  "approvedByUserId" bigint,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_connect_sessions_public_id" ON "integration_connect_sessions" ("sessionPublicId");
CREATE INDEX IF NOT EXISTS "idx_connect_sessions_code_prefix" ON "integration_connect_sessions" ("codePrefix");
CREATE INDEX IF NOT EXISTS "idx_connect_sessions_state" ON "integration_connect_sessions" ("state");
CREATE INDEX IF NOT EXISTS "idx_connect_sessions_status" ON "integration_connect_sessions" ("status", "expiresAt");
