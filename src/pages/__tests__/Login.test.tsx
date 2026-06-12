// ABOUTME: Verifies the Sign In / Sign Up tab pair is always visible on /login and that mobile-friendly touch targets are wired up correctly.
// ABOUTME: Covers the "tabbed auth intent switcher" and "48px CTA" requirements from the auth workflow improvements.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";

vi.mock("@/providers/trpc", () => ({
  trpc: {
    useUtils: () => ({ invalidate: vi.fn() }),
    localAuth: {
      checkAccountAvailability: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      lookupAccount: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      login: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      register: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  setCsrfFromResponse: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import Login from "../Login";

function renderLoginAt(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Login />
    </MemoryRouter>,
  );
}

describe("Login auth tab switcher", () => {
  it("renders the Sign In / Sign Up tab pair when landing directly on /login", () => {
    const html = renderLoginAt("/login");
    expect(html).toContain('data-testid="auth-tab-login"');
    expect(html).toContain('data-testid="auth-tab-signup"');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Authentication mode"');
  });

  it("still renders the tab pair when the URL preselects a signup intent", () => {
    const html = renderLoginAt("/login?type=standard");
    expect(html).toContain('data-testid="auth-tab-login"');
    expect(html).toContain('data-testid="auth-tab-signup"');
    expect(html).toContain('aria-selected="false"');
    expect(html).toContain('aria-selected="true"');
  });

  it("still renders the tab pair for the partner deep-link", () => {
    const html = renderLoginAt("/login?type=partner");
    expect(html).toContain('data-testid="auth-tab-login"');
    expect(html).toContain('data-testid="auth-tab-signup"');
    expect(html).toContain("Joining as Partner");
  });

  it("exposes a full-width 48px+ touch target on the primary Sign Up action", () => {
    const html = renderLoginAt("/login?type=standard");
    expect(html).toContain('data-testid="signup-submit"');
    expect(html).toContain("min-h-[52px]");
  });

  it("includes a prominent \"Already have an account? Sign In\" CTA on the signup form", () => {
    const html = renderLoginAt("/login?type=standard");
    expect(html).toContain('data-testid="account-cta-signin"');
    expect(html).toContain("Already have an account?");
    expect(html).toContain("Sign In");
  });

  it("includes a \"Create a new account\" CTA on the account lookup form", () => {
    const html = renderLoginAt("/login");
    expect(html).toContain('data-testid="account-cta-signup"');
    expect(html).toContain("New here?");
  });
});

describe("Login accessibility attributes", () => {
  it("uses native autoComplete hints so password managers can autofill", () => {
    const html = renderLoginAt("/login");
    expect(html).toMatch(/autocomplete="username"|autoComplete="username"/i);
    const signupHtml = renderLoginAt("/login?type=standard");
    expect(signupHtml).toMatch(/autocomplete="new-password"|autoComplete="new-password"/i);
  });

  it("exposes a password visibility toggle inside the credentials form", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    const source = fs.readFileSync(
      new URL("../Login.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain('aria-label={showPassword ? "Hide password" : "Show password"}');
    expect(source).toContain("setShowPassword");
  });

  it("keeps every interactive control at or above the 44px touch target on mobile", () => {
    const html = renderLoginAt("/login?type=standard");
    expect(html).toMatch(/min-h-\[44px\]/);
    expect(html).toMatch(/min-h-\[48px\]/);
  });
});
