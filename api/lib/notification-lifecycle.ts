// ABOUTME: Pure helper functions for the notification highlight lifecycle state machine.
// ABOUTME: Encapsulates single-record state transitions (highlighted → faded → re-highlighted)
// ABOUTME: and the rules governing automatic re-highlighting and clearance.
// ABOUTME: No DB access — designed to be unit-tested without infrastructure.

export type HighlightState = "highlighted" | "faded" | "archived";
export type ClearedReason =
  | "user_dismissed"
  | "bill_paid"
  | "action_completed"
  | "manual_clear_all"
  | "system_resolved";

/** A snapshot of a notification's lifecycle-relevant fields, no DB required. */
export interface NotificationLifecycleRecord {
  id: number;
  highlightState: HighlightState;
  fadedAt: Date | null;
  lastHighlightedAt: Date;
  highlightCount: number;
  archivedAt: Date | null;
  clearedAt: Date | null;
  clearedReason: ClearedReason | null;
}

/** Number of hours of inactivity in the faded state that triggers re-highlighting. */
export const FADE_REHIGHLIGHT_HOURS = 24;

/** Result returned by the lifecycle helpers. */
export interface LifecycleUpdate {
  highlightState: HighlightState;
  fadedAt: Date | null;
  lastHighlightedAt: Date;
  highlightCount: number;
  archivedAt: Date | null;
  clearedAt: Date | null;
  clearedReason: ClearedReason | null;
}

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Compute the next state when the user clicks/views a notification.
 * The default action on click is to fade (not clear) so that we still track
 * that the user is aware of the item without removing it from view.
 */
export function applyClickFade(
  record: NotificationLifecycleRecord,
  now: Date = new Date(),
): LifecycleUpdate {
  if (record.highlightState === "archived" || record.archivedAt) {
    return identityUpdate(record);
  }
  if (record.highlightState === "faded") {
    return identityUpdate(record);
  }
  return {
    highlightState: "faded",
    fadedAt: now,
    lastHighlightedAt: record.lastHighlightedAt,
    highlightCount: record.highlightCount,
    archivedAt: null,
    clearedAt: null,
    clearedReason: null,
  };
}

/**
 * Decide whether a faded notification should be automatically re-highlighted
 * because either (a) the underlying bill is overdue or (b) it has been
 * idle in the faded state for more than FADE_REHIGHLIGHT_HOURS.
 */
export function shouldReHighlight(
  record: NotificationLifecycleRecord,
  opts: { isOverdue: boolean; now?: Date } = { isOverdue: false },
): boolean {
  if (record.highlightState !== "faded") return false;
  if (record.archivedAt || record.clearedAt) return false;
  if (opts.isOverdue) return true;
  const fadedAt = record.fadedAt;
  if (!fadedAt) return false;
  const now = opts.now ?? new Date();
  const elapsedMs = now.getTime() - fadedAt.getTime();
  return elapsedMs >= FADE_REHIGHLIGHT_HOURS * MS_PER_HOUR;
}

/**
 * Compute the next state when a faded notification qualifies for re-highlight.
 * Increments the highlightCount so we can detect runaway loops.
 */
export function applyReHighlight(
  record: NotificationLifecycleRecord,
  now: Date = new Date(),
): LifecycleUpdate {
  if (record.highlightState !== "faded") {
    return identityUpdate(record);
  }
  return {
    highlightState: "highlighted",
    fadedAt: null,
    lastHighlightedAt: now,
    highlightCount: record.highlightCount + 1,
    archivedAt: null,
    clearedAt: null,
    clearedReason: null,
  };
}

/**
 * Mark the notification as cleared (removed from the active panel) and
 * archive it for historical reference. Idempotent: a second call to
 * clear an already-cleared notification is a no-op.
 */
export function applyClear(
  record: NotificationLifecycleRecord,
  reason: ClearedReason,
  now: Date = new Date(),
): LifecycleUpdate {
  if (record.clearedAt && record.archivedAt) {
    return identityUpdate(record);
  }
  return {
    highlightState: "archived",
    fadedAt: record.fadedAt,
    lastHighlightedAt: record.lastHighlightedAt,
    highlightCount: record.highlightCount,
    archivedAt: now,
    clearedAt: now,
    clearedReason: reason,
  };
}

/**
 * Decision helper for the background "auto re-highlight" sweep.
 * Returns true if the caller should call applyReHighlight for this record.
 */
export function shouldAutoReHighlightSweep(
  record: NotificationLifecycleRecord,
  opts: { isOverdue: boolean; now?: Date } = { isOverdue: false },
): boolean {
  return shouldReHighlight(record, opts);
}

function identityUpdate(record: NotificationLifecycleRecord): LifecycleUpdate {
  return {
    highlightState: record.highlightState,
    fadedAt: record.fadedAt,
    lastHighlightedAt: record.lastHighlightedAt,
    highlightCount: record.highlightCount,
    archivedAt: record.archivedAt,
    clearedAt: record.clearedAt,
    clearedReason: record.clearedReason,
  };
}

/**
 * Pick which notifications are visible in the active panel.
 * Cleared/archived rows are excluded by default.
 */
export function isActive(record: NotificationLifecycleRecord): boolean {
  return !record.archivedAt && !record.clearedAt;
}
