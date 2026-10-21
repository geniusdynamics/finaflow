// ABOUTME: Tests for mapping canonical statement category keys to a business's own category names.
// ABOUTME: Guards the "best effort, never forced" rule: unknown keys return null.

import { describe, expect, it } from "vitest";
import { resolveCategory } from "../categorize/taxonomy";

describe("statement category taxonomy", () => {
  it("matches aliases case-insensitively", () => {
    expect(resolveCategory("utilities", [{ id: 1, name: "Utilities" }])).toEqual({ id: 1, name: "Utilities" });
    expect(resolveCategory("utilities", [{ id: 1, name: "  UTILITIES  " }])).toEqual({ id: 1, name: "  UTILITIES  " });
    expect(resolveCategory("fees", [{ id: 2, name: "Bank Charges & Fees" }])?.id).toBe(2);
    expect(resolveCategory("airtime", [{ id: 3, name: "Airtime/Data" }])?.id).toBe(3);
    expect(resolveCategory("food", [{ id: 4, name: "Food Supplies" }])?.id).toBe(4);
  });

  it("returns null when nothing matches", () => {
    expect(resolveCategory("utilities", [{ id: 1, name: "Office Supplies" }])).toBeNull();
    expect(resolveCategory(null, [{ id: 1, name: "Utilities" }])).toBeNull();
    expect(resolveCategory("unknown_key", [{ id: 1, name: "Utilities" }])).toBeNull();
    expect(resolveCategory("utilities", [])).toBeNull();
  });

  it("never falls back to Miscellaneous", () => {
    expect(resolveCategory("fuel", [{ id: 1, name: "Miscellaneous" }])).toBeNull();
  });
});
