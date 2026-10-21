-- ABOUTME: Adds the DOWNLOAD audit action used by statement exports and logo downloads.
-- ABOUTME: Idempotent; PostgreSQL allows ADD VALUE in a transaction as long as it is not used in the same one.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'action' AND e.enumlabel = 'DOWNLOAD'
  ) THEN
    ALTER TYPE "action" ADD VALUE 'DOWNLOAD';
  END IF;
END $$;
