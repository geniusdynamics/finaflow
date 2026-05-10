// ABOUTME: Validates shared partner allocation helper contracts used by routers and services.
// ABOUTME: Guards rights profiles, invite status transitions, and allocation code format.
import { describe, expect, it } from "vitest";
import {
  RIGHTS_PROFILES,
  assertRightsProfile,
  generateAllocationCode,
  assertInviteStatusCanTransition,
} from "../lib/partner-allocations";
import {
  generateAllocationInviteInputSchema,
  claimAllocationInviteInputSchema,
  revokeAllocationInputSchema,
} from "../partner-router";

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

describe("partner allocation api contracts", () => {
  it("accepts owner invite generation payload", () => {
    expect(generateAllocationInviteInputSchema.parse({ businessId: 1, rightsProfile: "view_only" })).toBeTruthy();
  });

  it("accepts partner claim payload", () => {
    expect(claimAllocationInviteInputSchema.parse({ code: "ALLOCAB12CD34" })).toBeTruthy();
  });

  it("rejects invalid revoke payload", () => {
    expect(() => revokeAllocationInputSchema.parse({ allocationId: 0 })).toThrow();
  });
});
