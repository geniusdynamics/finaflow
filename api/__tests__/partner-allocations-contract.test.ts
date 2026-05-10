// ABOUTME: Validates shared partner allocation helper contracts used by routers and services.
// ABOUTME: Guards rights profiles, invite status transitions, and allocation code format.
import { describe, expect, it } from "vitest";
import {
  RIGHTS_PROFILES,
  assertRightsProfile,
  generateAllocationCode,
  assertInviteStatusCanTransition,
} from "../lib/partner-allocations";

describe("partner allocation contracts", () => {
  it("exports fixed rights profiles", () => {
    expect(RIGHTS_PROFILES).toEqual(["view_only", "create_view", "manage"]);
  });

  it("validates a supported rights profile", () => {
    expect(() => assertRightsProfile("view_only")).not.toThrow();
  });

  it("rejects unknown rights profile", () => {
    expect(() => assertRightsProfile("custom")).toThrow(/rights profile/i);
  });

  it("generates uppercase allocation code with prefix", () => {
    expect(generateAllocationCode()).toMatch(/^ALLOC[A-Z0-9]{8}$/);
  });

  it("allows active to consumed transition", () => {
    expect(() => assertInviteStatusCanTransition("active", "consumed")).not.toThrow();
  });
});
