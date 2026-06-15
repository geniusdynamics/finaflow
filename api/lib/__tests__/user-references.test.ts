// ABOUTME: Unit tests for employee username generation and user-reference messaging.
// ABOUTME: Proves the helper behavior before the implementation is restored.
import { describe, expect, it } from "vitest";
import { buildEmployeeUsername } from "../../employees-payroll-router";
import { formatLinkedRecordsMessage } from "../user-references";

describe("buildEmployeeUsername", () => {
  const biz = "General Retail Ltd";

  it("uses the first name when not taken", async () => {
    const result = await buildEmployeeUsername("Mary Otieno", biz, () => false);
    expect(result).toBe("mary");
  });

  it("falls back to biz-abbr_firstname when first name is taken", async () => {
    let callCount = 0;
    const result = await buildEmployeeUsername("Nitram", biz, () => {
      callCount++;
      return callCount <= 1; // first attempt (mary) taken, second (gen_nitram) available
    });
    expect(result).toBe("gen_nitram");
  });

  it("falls back to numbered variant when biz-abbr_firstname is also taken", async () => {
    let callCount = 0;
    const result = await buildEmployeeUsername("Koech", biz, () => {
      callCount++;
      return callCount <= 2; // koech taken, gen_koech taken, gen_koech_1 available
    });
    expect(result).toBe("gen_koech_1");
  });

  it("uses a numbered variant when no business name is available", async () => {
    let callCount = 0;
    const result = await buildEmployeeUsername("Alice", "", () => {
      callCount++;
      return callCount <= 1; // alice taken, alice_1 available
    });
    expect(result).toBe("alice_1");
  });

  it("handles special characters in the name gracefully", async () => {
    const result = await buildEmployeeUsername("JOHN!! DOE!!", "TestBiz", () => false);
    expect(result).toBe("john");
  });

  it("falls back to 'user' when the name is empty or all special chars", async () => {
    const result = await buildEmployeeUsername("!!!", "Biz", () => false);
    expect(result).toBe("user");
  });

  it("returns the first available candidate in sequence", async () => {
    let callCount = 0;
    const result = await buildEmployeeUsername("James", "AB", () => {
      callCount++;
      return callCount <= 3; // james, ab_james, ab_james_1 taken, ab_james_2 available
    });
    expect(result).toBe("ab_james_2");
  });
});

describe("formatLinkedRecordsMessage", () => {
  it("describes blocking and informational references separately", () => {
    const message = formatLinkedRecordsMessage({
      userId: 44,
      totalCount: 5,
      blockingCount: 4,
      blockingGroups: [
        { label: "Sales", resource: "daily_sales", count: 3, blocking: true },
        { label: "Expenses", resource: "expenses", count: 1, blocking: true },
      ],
      informationalGroups: [
        { label: "Refresh Tokens", resource: "refresh_tokens", count: 1, blocking: false },
      ],
      hasBlockingRecords: true,
      hasAnyRecords: true,
    });

    expect(message).toContain("cannot be deleted");
    expect(message).toContain("Sales (3)");
    expect(message).toContain("Expenses (1)");
    expect(message).toContain("Refresh Tokens (1)");
  });
});
