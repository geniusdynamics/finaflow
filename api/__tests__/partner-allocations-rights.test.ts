// ABOUTME: Verifies allocation rights profile clamps applied by middleware permission checks.
// ABOUTME: Ensures allocated context enforces view/create/manage ceilings consistently.
import { describe, expect, it } from "vitest";
import { clampPermissionsForAllocation } from "../middleware";

describe("allocation rights clamp", () => {
  it("view_only keeps only read and view permissions", () => {
    const next = clampPermissionsForAllocation(
      ["sales:view", "sales:create", "sales:manage", "ledger.read", "settings:config"],
      "view_only",
    );

    expect(next).toContain("sales:view");
    expect(next).toContain("ledger.read");
    expect(next).not.toContain("sales:create");
    expect(next).not.toContain("sales:manage");
    expect(next).not.toContain("settings:config");
  });

  it("create_view keeps view and create-style permissions", () => {
    const next = clampPermissionsForAllocation(
      ["sales:view", "sales:create", "bills:add", "users:manage", "transactions:reset"],
      "create_view",
    );

    expect(next).toContain("sales:view");
    expect(next).toContain("sales:create");
    expect(next).toContain("bills:add");
    expect(next).not.toContain("users:manage");
    expect(next).not.toContain("transactions:reset");
  });

  it("manage keeps the full permission list", () => {
    const base = ["sales:view", "sales:create", "users:manage"];
    expect(clampPermissionsForAllocation(base, "manage")).toEqual(base);
  });
});
