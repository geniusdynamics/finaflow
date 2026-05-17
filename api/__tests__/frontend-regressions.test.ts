// ABOUTME: Covers frontend-facing regressions that break lazy routes, CSRF-protected mutations, and expense balance formatting.
// ABOUTME: Keeps the tests narrow by asserting module exports and pure helper behavior without rendering the full app.
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("Frontend regressions", () => {
  it("exposes a default export for the Businesses page lazy route", async () => {
    const module = await import("../../src/pages/Businesses");

    expect(typeof module.default).toBe("function");
  }, 30000);

  it("recovers the CSRF token from cookies after a page reload", async () => {
    const module = await import("../../src/providers/trpc");

    expect(typeof module.getCsrfTokenFromCookies).toBe("function");
    expect(module.getCsrfTokenFromCookies("foo=bar; csrf_token=test-token; theme=dark")).toBe("test-token");
  });

  it("formats per-location balances even when the API returns strings", async () => {
    const module = await import("../../src/pages/Expenses");

    expect(typeof module.formatLocationBalance).toBe("function");
    expect(module.formatLocationBalance("1234.50")).toBe("KES 1,234.50");
  });

  it("does not wrap protected routes in the placeholder AuthLayout shell", () => {
    const appPath = path.resolve(import.meta.dirname, "../../src/App.tsx");
    const source = fs.readFileSync(appPath, "utf8");

    expect(source).not.toContain("<AuthLayout>{children}</AuthLayout>");
  });
});
