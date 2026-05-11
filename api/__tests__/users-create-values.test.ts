import { describe, expect, it } from "vitest";
import { buildCreateUserValues } from "../users-router";

describe("buildCreateUserValues", () => {
  it("includes account and business linkage in inserted user values", () => {
    const values = buildCreateUserValues(
      {
        username: "alice",
        name: "Alice",
        role: "manager",
      },
      "acct_123",
      77,
      "hashed-secret"
    );

    expect(values.accountId).toBe("acct_123");
    expect(values.currentBusinessId).toBe(77);
    expect(values.passwordHash).toBe("hashed-secret");
  });
});
