// ABOUTME: Unit tests for lead normalization and commission-eligibility rules.
// ABOUTME: Keeps lead matching behavior stable across signup, settings referral updates, and dashboard views.
import { describe, expect, it } from "vitest";
import {
  evaluateLeadCommissionEligibility,
  normalizeLeadEmail,
  normalizeLeadPhone,
} from "../leads";

describe("lead helpers", () => {
  it("normalizes emails to trimmed lowercase values", () => {
    expect(normalizeLeadEmail("  Alice@Example.com ")).toBe("alice@example.com");
  });

  it("normalizes Kenyan phone formats to a consistent digit string", () => {
    expect(normalizeLeadPhone("+254 700 111 222")).toBe("254700111222");
    expect(normalizeLeadPhone("0700 111 222")).toBe("254700111222");
    expect(normalizeLeadPhone("700111222")).toBe("254700111222");
  });

  it("marks commission eligible when the lead creator matches the referral owner", () => {
    expect(
      evaluateLeadCommissionEligibility({
        creatorUserId: 10,
        creatorBusinessId: 15,
        creatorAccountRefId: 2,
        referredByUserId: 10,
        referredByBusinessId: 99,
      }),
    ).toEqual({ commissionEligible: true, commissionStatus: "eligible" });
  });

  it("marks commission as info only when there is no matching lead owner", () => {
    expect(
      evaluateLeadCommissionEligibility({
        creatorUserId: 10,
        creatorBusinessId: 15,
        creatorAccountRefId: 2,
        referredByUserId: 99,
        referredByBusinessId: 100,
      }),
    ).toEqual({ commissionEligible: false, commissionStatus: "info_only" });
  });
});
