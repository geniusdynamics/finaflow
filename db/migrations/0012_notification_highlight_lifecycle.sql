-- ABOUTME: Adds highlight lifecycle + clearance tracking to notifications table.
-- ABOUTME: Replaces duplicate-generation pattern with single-record state machine
-- ABOUTME: (highlighted → faded → re-highlighted) and supports automatic clearance
-- ABOUTME: on user action completion (e.g. bill payment) plus an archived log.
-- ABOUTME: Idempotent — safe to re-run; uses IF NOT EXISTS / DO blocks throughout.

-- ── 1. Create the highlight state enum ────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_highlight') THEN
    CREATE TYPE "notification_highlight" AS ENUM ('highlighted', 'faded', 'archived');
  END IF;
END $$;

-- ── 2. Create the cleared reason enum ─────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_cleared_reason') THEN
    CREATE TYPE "notification_cleared_reason" AS ENUM (
      'user_dismissed',
      'bill_paid',
      'action_completed',
      'manual_clear_all',
      'system_resolved'
    );
  END IF;
END $$;

-- ── 3. Add lifecycle + clearance columns to notifications ─────────────
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "highlightState" "notification_highlight" DEFAULT 'highlighted' NOT NULL;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "fadedAt" TIMESTAMP;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "lastHighlightedAt" TIMESTAMP DEFAULT NOW() NOT NULL;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "highlightCount" INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "clearedAt" TIMESTAMP;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "clearedReason" "notification_cleared_reason";

-- ── 4. Backfill: archive all pre-existing notification rows that have no
-- archive/clear timestamps yet. These are old rows from before the lifecycle
-- redesign and cannot be managed by the new UI. The system's
-- generateOverdueNotifications API will recreate overdue-bill notifications
-- fresh on its next scan, so it's safe to clear these out.
UPDATE "notifications"
SET
  "highlightState" = 'archived',
  "archivedAt" = NOW(),
  "clearedAt" = NOW(),
  "clearedReason" = 'system_resolved'
WHERE
  "archivedAt" IS NULL
  AND "clearedAt" IS NULL;

-- ── 5. Indexes for the new query patterns ─────────────────────────────
CREATE INDEX IF NOT EXISTS "idx_notifications_entity" ON "notifications" ("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "idx_notifications_user_highlight" ON "notifications" ("userId", "highlightState");
CREATE INDEX IF NOT EXISTS "idx_notifications_archived" ON "notifications" ("userId", "archivedAt");
