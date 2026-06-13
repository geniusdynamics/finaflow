// ABOUTME: End-to-end style regression tests for the business-owner user-management flow.
// ABOUTME: Covers employee auto-provisioning and blocked deletion messaging at the app-contract level.
import { describe, expect, it } from "vitest";
import { buildEmployeeUsername } from "../../api/employees-payroll-router";
import { formatLinkedRecordsMessage } from "../../api/lib/user-references";

describe("Business owner user management flow", () => {
  it("builds an employee username from first name", async () => {
    const result = await buildEmployeeUsername("Mary Otieno", "General Retail Ltd", () => false);
    expect(result).toBe("mary");
  });

  it("uses biz-abbr_fallback when first name is taken", async () => {
    let calls = 0;
    const result = await buildEmployeeUsername("Nitram Test", "Gen", () => {
      calls++;
      return calls <= 1;
    });
    expect(result).toBe("gen_nitram");
  });

  it("formats the blocked-deletion message with a disable fallback hint", () => {
    const message = formatLinkedRecordsMessage({
      userId: 99,
      totalCount: 4,
      blockingCount: 3,
      blockingGroups: [
        { label: "Sales", resource: "daily_sales", count: 2, blocking: true },
        { label: "Expenses", resource: "expenses", count: 1, blocking: true },
      ],
      informationalGroups: [
        { label: "Refresh Tokens", resource: "refresh_tokens", count: 1, blocking: false },
      ],
      hasBlockingRecords: true,
      hasAnyRecords: true,
    });

    expect(message).toContain("disable");
    expect(message).toContain("Sales (2)");
    expect(message).toContain("Expenses (1)");
  });
});
