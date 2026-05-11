-- Migration: Add userType field to users table
-- Description: Adds user_type enum and userType column to support partner vs standard user types

-- Create user_type enum
DO $$ BEGIN
  CREATE TYPE user_type AS ENUM ('standard', 'partner');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add userType column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS "userType" user_type NOT NULL DEFAULT 'standard';

-- Create index on userType for faster queries
CREATE INDEX IF NOT EXISTS idx_users_userType ON users("userType");
