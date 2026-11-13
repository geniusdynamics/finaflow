// ABOUTME: Verifies billing recovery eligibility independently of operational permissions.
// ABOUTME: Covers owner/admin recovery and absolute denial of disabled principals.
import { describe, expect, it } from "vitest";
import { billingAccessMode } from "../lib/account-access";

describe("billing access mode", () => {
  it("limits held account owners and admins to billing", () => {
    expect(billingAccessMode(true, "owner", true)).toBe("billing_only");
    expect(billingAccessMode(true, "admin", true)).toBe("billing_only");
    expect(billingAccessMode(true, "employee", true)).toBe("blocked");
  });
  it("never admits a disabled principal, including a billing owner", () => {
    expect(billingAccessMode(false, "owner", true)).toBe("blocked");
    expect(billingAccessMode(false, "admin", false)).toBe("blocked");
  });
  it("preserves ordinary access when there is no manual hold", () => {
    expect(billingAccessMode(true, "viewer", false)).toBe("full");
  });
});
