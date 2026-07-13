// ABOUTME: Covers frontend-facing regressions that break lazy routes, CSRF-protected mutations, and expense balance formatting.
// ABOUTME: Keeps the tests narrow by asserting module exports and pure helper behavior without rendering the full app.
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("Frontend regressions", () => {
  it("exposes a default export for the Businesses page lazy route", async () => {
    const module = await import("../../src/pages/Businesses");

    expect(typeof module.default).toBe("function");
  }, 120000);

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

  it("refetches payment-method-by-location assignments after a successful branch assignment", () => {
    const accountsPath = path.resolve(import.meta.dirname, "../../src/pages/Accounts.tsx");
    const source = fs.readFileSync(accountsPath, "utf8");

    expect(source).toContain("refetchLocMethods");
    expect(source).toContain("utils.paymentMethods.byLocation.invalidate({ locationId: +tagLocId })");
    expect(source).toContain("await refetchLocMethods();");
  });

  it("keeps the auth user profile fresh so assigned locations are current", () => {
    const authPath = path.resolve(import.meta.dirname, "../../src/hooks/useAuth.ts");
    const authSource = fs.readFileSync(authPath, "utf8");

    expect(authSource).toContain("staleTime: 0");
  });

  it("invalidates the current user profile after user locations are updated", () => {
    const usersPath = path.resolve(import.meta.dirname, "../../src/pages/Users.tsx");
    const source = fs.readFileSync(usersPath, "utf8");

    expect(source).toContain("utils.localAuth.me.invalidate()");
  });
});
