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

  it("prefers the first multi-location assignment as the legacy primary location", () => {
    const values = buildCreateUserValues(
      {
        username: "bob",
        name: "Bob",
        role: "employee",
        locationIds: [10, 20, 30],
      },
      "acct_456",
      88,
      "hashed-pass"
    );

    expect(values.locationId).toBe(10);
  });

  it("falls back to the legacy single location when locationIds is missing", () => {
    const values = buildCreateUserValues(
      {
        username: "carol",
        name: "Carol",
        role: "viewer",
        locationId: 42,
      },
      "acct_789",
      99,
      "hashed-pass"
    );

    expect(values.locationId).toBe(42);
  });
});
