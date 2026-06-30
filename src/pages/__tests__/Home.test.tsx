// ABOUTME: Verifies the Home page header exposes a prominent, tabbed Sign In / Sign Up control and a "Already have an account? Sign In" CTA on the hero and partner sections.
// ABOUTME: Covers the "header sign-in placement", "tabbed auth switcher", and "prominent CTA" requirements from the auth workflow improvements.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";

vi.mock("react-helmet-async", () => ({
  Helmet: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, isLoading: false }),
}));

import Home from "../Home";

function renderHomeAt(path = "/") {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Home />
    </MemoryRouter>,
  );
}

describe("Home header auth controls", () => {
  it("renders the Sign In / Sign Up tab pair with a tablist role", () => {
    const html = renderHomeAt();
    expect(html).toContain('data-testid="header-auth-tabs"');
    expect(html).toContain('data-testid="header-tab-signin"');
    expect(html).toContain('data-testid="header-tab-signup"');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Sign in or sign up"');
  });

  it("links the Sign In tab to /login and the Sign Up tab to /login?type=standard", () => {
    const html = renderHomeAt();
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/login?type=standard"');
  });

  it("exposes a prominent Sign In button on mobile that does not require menu expansion", () => {
    const html = renderHomeAt();
    expect(html).toContain('data-testid="header-mobile-signin"');
    expect(html).toContain('href="/login"');
    expect(html).toMatch(/min-h-\[44px\]/);
  });

  it("exposes a dedicated \"Join as Partner\" link in the header", () => {
    const html = renderHomeAt();
    expect(html).toContain('data-testid="header-partner-cta"');
    expect(html).toContain('href="/login?type=partner"');
    expect(html).toContain("Join as Partner");
  });
});

describe("Home account reminder CTAs", () => {
  it("places a full-width \"Already have an account? Sign In\" CTA below the hero actions", () => {
    const html = renderHomeAt();
    expect(html).toContain('data-testid="hero-account-cta"');
    expect(html).toContain("Already have an account?");
    expect(html).toContain('href="/login"');
  });

  it("places a high-visibility \"Already have an account? Sign In\" CTA on the Partner Program section", () => {
    const html = renderHomeAt();
    expect(html).toContain('data-testid="partner-account-cta"');
    expect(html).toContain("Already have an account?");
  });

  it("uses 48px minimum touch targets on the account reminder CTAs", () => {
    const html = renderHomeAt();
    const occurrences = (html.match(/min-h-\[48px\]/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });
});

describe("Home header responsive layout", () => {
  it("uses responsive utility classes so the Sign In button stays visible at every breakpoint", () => {
    const html = renderHomeAt();
    expect(html).toContain("sm:flex");
    expect(html).toContain("lg:hidden");
  });
});
