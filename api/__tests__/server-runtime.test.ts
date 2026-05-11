// ABOUTME: Verifies when the standalone Hono HTTP server should boot versus when Vite already hosts the app.
// ABOUTME: Prevents dev-mode double-binding where Vite owns the port and `api/boot.ts` tries to listen again.
import { describe, expect, it } from "vitest";

describe("Server runtime guard", () => {
  it("skips standalone server startup under the Vite dev server", async () => {
    const { shouldStartStandaloneServer } = await import("../lib/server-runtime");

    expect(shouldStartStandaloneServer({ DEV: true })).toBe(false);
  });

  it("starts the standalone server outside the Vite dev server", async () => {
    const { shouldStartStandaloneServer } = await import("../lib/server-runtime");

    expect(shouldStartStandaloneServer({ DEV: false })).toBe(true);
    expect(shouldStartStandaloneServer(undefined)).toBe(true);
  });
});
