// ABOUTME: Unit tests for the notification highlight lifecycle state machine.
// ABOUTME: Covers the full default → faded → re-highlighted cycle, archive
// ABOUTME: transitions, and the time/overdue triggers for re-highlighting.
import { describe, it, expect } from "vitest";
import {
  applyClickFade,
  applyClear,
  applyReHighlight,
  isActive,
  shouldReHighlight,
  FADE_REHIGHLIGHT_HOURS,
  type NotificationLifecycleRecord,
} from "../notification-lifecycle";

function makeRecord(overrides: Partial<NotificationLifecycleRecord> = {}): NotificationLifecycleRecord {
  return {
    id: 1,
    highlightState: "highlighted",
    fadedAt: null,
    lastHighlightedAt: new Date("2026-06-01T08:00:00Z"),
    highlightCount: 1,
    archivedAt: null,
    clearedAt: null,
    clearedReason: null,
    ...overrides,
  };
}

describe("notification-lifecycle: default state", () => {
  it("a fresh notification is in 'highlighted' state by default", () => {
    const record = makeRecord();
    expect(record.highlightState).toBe("highlighted");
    expect(record.highlightCount).toBe(1);
    expect(record.fadedAt).toBeNull();
    expect(record.archivedAt).toBeNull();
    expect(record.clearedAt).toBeNull();
  });
});

describe("notification-lifecycle: applyClickFade", () => {
  it("transitions highlighted → faded on click", () => {
    const before = makeRecord();
    const now = new Date("2026-06-01T09:00:00Z");
    const after = applyClickFade(before, now);
    expect(after.highlightState).toBe("faded");
    expect(after.fadedAt).toEqual(now);
    // Highlight count is preserved — not reset.
    expect(after.highlightCount).toBe(1);
    expect(after.archivedAt).toBeNull();
    expect(after.clearedAt).toBeNull();
  });

  it("is a no-op on an already-faded record", () => {
    const fadedAt = new Date("2026-06-01T09:00:00Z");
    const before = makeRecord({ highlightState: "faded", fadedAt });
    const after = applyClickFade(before, new Date("2026-06-02T00:00:00Z"));
    expect(after.highlightState).toBe("faded");
    expect(after.fadedAt).toEqual(fadedAt);
    expect(after.highlightCount).toBe(1);
  });

  it("is a no-op on an archived record (state is preserved)", () => {
    const archivedAt = new Date("2026-06-01T10:00:00Z");
    const before = makeRecord({ highlightState: "archived", archivedAt });
    const after = applyClickFade(before);
    expect(after.highlightState).toBe("archived");
    expect(after.archivedAt).toEqual(archivedAt);
  });
});

describe("notification-lifecycle: shouldReHighlight", () => {
  it("returns false for non-faded records", () => {
    const record = makeRecord({ highlightState: "highlighted" });
    expect(shouldReHighlight(record, { isOverdue: true })).toBe(false);
    expect(shouldReHighlight(record, { isOverdue: false })).toBe(false);
  });

  it("returns true when the bill is overdue, even if idle < 24h", () => {
    const now = new Date("2026-06-01T10:00:00Z");
    const fadedAt = new Date("2026-06-01T09:00:00Z"); // 1h ago
    const record = makeRecord({ highlightState: "faded", fadedAt });
    expect(shouldReHighlight(record, { isOverdue: true, now })).toBe(true);
  });

  it("returns true after 24h of inactivity in the faded state", () => {
    const fadedAt = new Date("2026-06-01T00:00:00Z");
    const now = new Date(fadedAt.getTime() + FADE_REHIGHLIGHT_HOURS * 60 * 60 * 1000);
    const record = makeRecord({ highlightState: "faded", fadedAt });
    expect(shouldReHighlight(record, { isOverdue: false, now })).toBe(true);
  });

  it("returns false before 24h of inactivity when not overdue", () => {
    const fadedAt = new Date("2026-06-01T00:00:00Z");
    const now = new Date(fadedAt.getTime() + (FADE_REHIGHLIGHT_HOURS - 1) * 60 * 60 * 1000);
    const record = makeRecord({ highlightState: "faded", fadedAt });
    expect(shouldReHighlight(record, { isOverdue: false, now })).toBe(false);
  });

  it("returns false for archived/cleared records", () => {
    const fadedAt = new Date("2026-05-01T00:00:00Z"); // a month ago
    const now = new Date("2026-06-03T00:00:00Z");
    const archivedRecord = makeRecord({
      highlightState: "faded",
      fadedAt,
      archivedAt: new Date("2026-05-02T00:00:00Z"),
    });
    expect(shouldReHighlight(archivedRecord, { isOverdue: true, now })).toBe(false);
    const clearedRecord = makeRecord({
      highlightState: "faded",
      fadedAt,
      clearedAt: new Date("2026-05-02T00:00:00Z"),
    });
    expect(shouldReHighlight(clearedRecord, { isOverdue: true, now })).toBe(false);
  });

  it("returns false if fadedAt is missing (defensive)", () => {
    const record = makeRecord({ highlightState: "faded", fadedAt: null });
    const now = new Date("2026-06-03T00:00:00Z");
    expect(shouldReHighlight(record, { isOverdue: false, now })).toBe(false);
  });
});

describe("notification-lifecycle: applyReHighlight", () => {
  it("transitions faded → highlighted, increments highlightCount, clears fadedAt", () => {
    const fadedAt = new Date("2026-06-01T08:00:00Z");
    const lastHighlighted = new Date("2026-06-01T07:00:00Z");
    const before = makeRecord({
      highlightState: "faded",
      fadedAt,
      lastHighlightedAt: lastHighlighted,
      highlightCount: 1,
    });
    const now = new Date("2026-06-02T10:00:00Z");
    const after = applyReHighlight(before, now);
    expect(after.highlightState).toBe("highlighted");
    expect(after.fadedAt).toBeNull();
    expect(after.lastHighlightedAt).toEqual(now);
    expect(after.highlightCount).toBe(2);
  });

  it("is a no-op on a non-faded record", () => {
    const before = makeRecord({ highlightState: "highlighted", highlightCount: 5 });
    const after = applyReHighlight(before, new Date());
    expect(after.highlightState).toBe("highlighted");
    expect(after.highlightCount).toBe(5);
  });

  it("survives multiple re-highlight cycles without producing duplicates", () => {
    let record = makeRecord();
    expect(record.highlightState).toBe("highlighted");
    // Cycle 1
    record = { ...record, ...applyClickFade(record) };
    expect(record.highlightState).toBe("faded");
    record = { ...record, ...applyReHighlight(record) };
    expect(record.highlightState).toBe("highlighted");
    expect(record.highlightCount).toBe(2);
    // Cycle 2
    record = { ...record, ...applyClickFade(record) };
    record = { ...record, ...applyReHighlight(record) };
    expect(record.highlightState).toBe("highlighted");
    expect(record.highlightCount).toBe(3);
  });
});

describe("notification-lifecycle: applyClear", () => {
  it("archives a highlighted record with reason 'user_dismissed'", () => {
    const before = makeRecord();
    const now = new Date("2026-06-03T10:00:00Z");
    const after = applyClear(before, "user_dismissed", now);
    expect(after.highlightState).toBe("archived");
    expect(after.archivedAt).toEqual(now);
    expect(after.clearedAt).toEqual(now);
    expect(after.clearedReason).toBe("user_dismissed");
  });

  it("archives a faded record", () => {
    const fadedAt = new Date("2026-06-01T08:00:00Z");
    const before = makeRecord({ highlightState: "faded", fadedAt });
    const now = new Date("2026-06-03T10:00:00Z");
    const after = applyClear(before, "bill_paid", now);
    expect(after.highlightState).toBe("archived");
    expect(after.fadedAt).toEqual(fadedAt); // preserved
    expect(after.clearedReason).toBe("bill_paid");
  });

  it("is idempotent (second call returns identity)", () => {
    const now = new Date("2026-06-03T10:00:00Z");
    const record = makeRecord();
    const cleared = { ...record, ...applyClear(record, "action_completed", now) };
    const twice = applyClear(cleared, "action_completed", new Date("2026-06-04T10:00:00Z"));
    expect(twice.highlightState).toBe("archived");
    expect(twice.clearedAt).toEqual(now);
    expect(twice.clearedReason).toBe("action_completed");
  });
});

describe("notification-lifecycle: isActive", () => {
  it("returns true for fresh highlighted records", () => {
    expect(isActive(makeRecord())).toBe(true);
  });

  it("returns true for faded records that are not archived", () => {
    expect(isActive(makeRecord({ highlightState: "faded", fadedAt: new Date() }))).toBe(true);
  });

  it("returns false once archived or cleared", () => {
    expect(
      isActive(makeRecord({ archivedAt: new Date(), clearedAt: new Date() })),
    ).toBe(false);
    expect(isActive(makeRecord({ clearedAt: new Date() }))).toBe(false);
  });
});

describe("notification-lifecycle: full lifecycle integration", () => {
  it("default highlighted → faded on click → re-highlighted after 24h → cleared", () => {
    const created = new Date("2026-06-01T00:00:00Z");
    let record = makeRecord({ lastHighlightedAt: created });

    // 1. Default is highlighted
    expect(record.highlightState).toBe("highlighted");

    // 2. User clicks at T+1h → fades
    const clickTime = new Date("2026-06-01T01:00:00Z");
    record = { ...record, ...applyClickFade(record, clickTime) };
    expect(record.highlightState).toBe("faded");
    expect(record.fadedAt).toEqual(clickTime);

    // 3a. 1 hour later, not overdue → still faded
    const oneHourLater = new Date("2026-06-01T02:00:00Z");
    expect(shouldReHighlight(record, { isOverdue: false, now: oneHourLater })).toBe(false);

    // 3b. 24h+1 later, not overdue → should re-highlight
    const oneDayLater = new Date("2026-06-02T02:00:00Z");
    expect(shouldReHighlight(record, { isOverdue: false, now: oneDayLater })).toBe(true);

    // 4. Apply re-highlight
    record = { ...record, ...applyReHighlight(record, oneDayLater) };
    expect(record.highlightState).toBe("highlighted");
    expect(record.highlightCount).toBe(2);
    expect(record.fadedAt).toBeNull();

    // 5. User pays the bill → clearance archives the single record
    const paymentTime = new Date("2026-06-03T10:00:00Z");
    record = { ...record, ...applyClear(record, "bill_paid", paymentTime) };
    expect(record.highlightState).toBe("archived");
    expect(record.clearedReason).toBe("bill_paid");
    expect(isActive(record)).toBe(false);
  });

  it("no duplicates are created when re-highlight is triggered repeatedly", () => {
    // The state machine keeps a single record — verifying that the helper
    // never produces a new recordId.
    let record = makeRecord({ id: 42 });
    for (let i = 0; i < 5; i++) {
      record = { ...record, ...applyClickFade(record) };
      record = { ...record, ...applyReHighlight(record) };
    }
    expect(record.id).toBe(42);
    expect(record.highlightCount).toBe(1 + 5); // initial + 5 cycles
  });
});
