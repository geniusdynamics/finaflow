// ABOUTME: Verifies financial report scope resolution uses the authenticated business context.
// ABOUTME: Prevents reports from silently falling back to tenant 1 when no local storage value exists.
import { describe, expect, it } from "vitest";

import { resolveFinancialReportBusinessId } from "../report-scope";

describe("resolveFinancialReportBusinessId", () => {
  it("prefers the current business object id", () => {
    expect(
      resolveFinancialReportBusinessId({
        currentBusinessId: 7,
        currentBusiness: { id: 9 },
      } as any),
    ).toBe(9);
  });

  it("falls back to currentBusinessId when the business object is absent", () => {
    expect(
      resolveFinancialReportBusinessId({
        currentBusinessId: 7,
        currentBusiness: null,
      } as any),
    ).toBe(7);
  });

  it("returns null instead of silently forcing business 1", () => {
    expect(resolveFinancialReportBusinessId(null)).toBeNull();
    expect(resolveFinancialReportBusinessId({} as any)).toBeNull();
  });
});
