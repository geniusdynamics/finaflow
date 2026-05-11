import { describe, expect, it } from "vitest";
import { toLocalDateKey } from "../lib/date-key";

describe("toLocalDateKey", () => {
  it("uses local calendar date for Date objects", () => {
    const date = new Date(2026, 4, 9, 0, 30, 0);
    expect(toLocalDateKey(date)).toBe("2026-05-09");
  });

  it("keeps date-string keys stable", () => {
    expect(toLocalDateKey("2026-05-09")).toBe("2026-05-09");
  });
});
