-- ABOUTME: Add target business identification to FinaFlow integration connections.
-- ABOUTME: Stores the paired business ID and name from the sibling Fina app.
ALTER TABLE "integration_connections" ADD COLUMN IF NOT EXISTS "targetBusinessId" bigint;
ALTER TABLE "integration_connections" ADD COLUMN IF NOT EXISTS "targetBusinessName" varchar(255);
