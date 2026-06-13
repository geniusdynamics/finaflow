-- ABOUTME: Creates the user_locations junction table for multi-location assignment support.
-- ABOUTME: Allows users to be assigned to multiple locations with primary designation.

-- Create the user_locations junction table
CREATE TABLE IF NOT EXISTS "user_locations" (
  "id" SERIAL PRIMARY KEY,
  "userId" BIGINT NOT NULL,
  "locationId" BIGINT NOT NULL,
  "isPrimary" BOOLEAN DEFAULT FALSE NOT NULL,
  "isActive" BOOLEAN DEFAULT TRUE NOT NULL,
  "assignedAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "assignedBy" BIGINT
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS "idx_user_locations_userId" ON "user_locations" ("userId");
CREATE INDEX IF NOT EXISTS "idx_user_locations_locationId" ON "user_locations" ("locationId");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_locations_unique" ON "user_locations" ("userId", "locationId");

-- Migrate existing single location assignments to the new junction table
-- This preserves backward compatibility while enabling multi-location support
INSERT INTO "user_locations" ("userId", "locationId", "isPrimary", "isActive", "assignedAt")
SELECT 
  u."id" as "userId",
  u."locationId" as "locationId",
  TRUE as "isPrimary",
  TRUE as "isActive",
  NOW() as "assignedAt"
FROM "users" u
WHERE u."locationId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "user_locations" ul 
    WHERE ul."userId" = u."id" AND ul."locationId" = u."locationId"
  );

-- Add comment for documentation
COMMENT ON TABLE "user_locations" IS 'Junction table linking users to their assigned locations. Supports multi-location assignments with primary designation.';
COMMENT ON COLUMN "user_locations"."isPrimary" IS 'Indicates if this is the user''s primary/default location';
COMMENT ON COLUMN "user_locations"."isActive" IS 'Soft delete flag - false means the assignment is inactive but preserved for audit';
