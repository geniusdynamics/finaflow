// ABOUTME: Pins the signup referral URL contract: which sibling path, which
// ABOUTME: source label, and that the connect session rides in the query.

import { describe, expect, it } from "vitest";
import { buildSignupReferralUrl } from "../lib/integrations/connect-referral";

const session = {
  sessionPublicId: "session-abc",
  state: "state-xyz",
  sourceAccount: "ACC-123",
  sourceName: "Alpha Lodge",
};

describe("buildSignupReferralUrl", () => {
  it("targets FinaFlow signup through its login tab", () => {
    const url = new URL(
      buildSignupReferralUrl({
        target: "finaflow",
        appUrl: "https://finaflow.example/",
        ...session,
      })
    );

    expect(url.origin).toBe("https://finaflow.example");
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("ref")).toBe("FINABILL");
    expect(url.searchParams.get("source")).toBe("finabill");
    expect(url.searchParams.get("connect")).toBe("session-abc");
    expect(url.searchParams.get("state")).toBe("state-xyz");
    expect(url.searchParams.get("source_account")).toBe("ACC-123");
    expect(url.searchParams.get("source_name")).toBe("Alpha Lodge");
  });

  it("targets FinaBill's dedicated signup page", () => {
    const url = new URL(
      buildSignupReferralUrl({
        target: "finabill",
        appUrl: "https://finabill.example",
        ...session,
      })
    );

    expect(url.pathname).toBe("/signup");
    expect(url.searchParams.get("ref")).toBe("FINAFLOW");
    expect(url.searchParams.get("source")).toBe("finaflow");
  });

  it("omits optional source details but keeps the session", () => {
    const url = new URL(
      buildSignupReferralUrl({
        target: "finaflow",
        appUrl: "https://finaflow.example",
        sessionPublicId: "session-abc",
        state: "state-xyz",
        sourceAccount: "  ",
        sourceName: null,
      })
    );

    expect(url.searchParams.get("source_account")).toBeNull();
    expect(url.searchParams.get("source_name")).toBeNull();
    expect(url.searchParams.get("connect")).toBe("session-abc");
  });

  it("refuses an empty app URL", () => {
    expect(() =>
      buildSignupReferralUrl({
        target: "finaflow",
        appUrl: "  ",
        ...session,
      })
    ).toThrow("not configured");
  });
});
