// ABOUTME: Verifies the Mobile Money Agents marketing page renders and, critically, that the
// ABOUTME: features Finaflow does NOT ship (handover, shortage/surplus, close day, e-float) are only
// ABOUTME: ever mentioned inside the explicitly-labelled roadmap section — never as claims.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";

vi.mock("react-helmet-async", () => ({
  Helmet: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

import MobileMoneyAgents from "../MobileMoneyAgents";

function renderPage() {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={["/solutions/mobile-money-agents"]}>
      <MobileMoneyAgents />
    </MemoryRouter>,
  );
}

/** Terms that describe features which do not exist in the product yet. */
const NOT_YET_SHIPPED = ["handover", "shortage", "surplus", "e-float", "close day", "salesbook"];

describe("MobileMoneyAgents hero and CTA", () => {
  it("renders the hero with a primary CTA to signup and a sign-in path", () => {
    const html = renderPage();
    expect(html).toContain('data-testid="agent-hero"');
    expect(html).toContain('data-testid="agent-hero-cta"');
    expect(html).toContain('href="/login?type=standard"');
    expect(html).toContain('data-testid="agent-account-cta"');
    expect(html).toContain("Already have an account?");
  });

  it("states plainly that Finaflow does not process mobile money transactions", () => {
    const html = renderPage();
    expect(html).toContain("does not");
    expect(html).toMatch(/process mobile money transactions/i);
  });

  it("uses 48px minimum touch targets on the account reminder CTA", () => {
    const html = renderPage();
    expect(html).toMatch(/min-h-\[48px\]/);
  });
});

describe("MobileMoneyAgents honest-claims guard", () => {
  it("exposes a roadmap section labelled as not yet available", () => {
    const html = renderPage();
    expect(html).toContain('data-testid="agent-roadmap"');
    expect(html).toMatch(/Not available yet/i);
  });

  it("never mentions a not-yet-shipped feature before the roadmap section", () => {
    const html = renderPage();
    const lower = html.toLowerCase();
    const roadmapStart = lower.indexOf('data-testid="agent-roadmap"');
    expect(roadmapStart).toBeGreaterThan(-1);

    for (const term of NOT_YET_SHIPPED) {
      let index = lower.indexOf(term);
      while (index !== -1) {
        expect(
          index,
          `"${term}" appears before the roadmap section — it must not be sold as available`,
        ).toBeGreaterThan(roadmapStart);
        index = lower.indexOf(term, index + 1);
      }
    }
  });

  it("answers the end-of-day question with an explicit not-yet rather than a claim", () => {
    const html = renderPage();
    expect(html).toMatch(/Does it do end-of-day closing and shortage checks\?/);
    expect(html).toMatch(/Not yet, and we are not going to pretend otherwise/);
  });

  it("does not advertise a CSV or statement upload for wallet transactions", () => {
    const html = renderPage();
    expect(html).not.toMatch(/upload (a )?csv/i);
    // The only mention of statement upload is the explicit denial in the FAQ.
    expect(html).toMatch(/there is no CSV or statement upload for wallet transactions/i);
  });
});

describe("MobileMoneyAgents shipped capability content", () => {
  it("lists the capabilities that do exist", () => {
    const html = renderPage();
    for (const capability of [
      "Cash position across outlets",
      "M-PESA &amp; Airtel Money import",
      "E-money movement",
      "Daily wallet ledger",
      "Deposits, drawings &amp; transfers",
      "Outlet expenses with photos",
      "Per-outlet accounts",
      "Bill alerts per branch",
      "Reports &amp; exports",
    ]) {
      expect(html).toContain(capability);
    }
  });

  it("anchors every in-page navigation target it links to", () => {
    const html = renderPage();
    for (const anchor of ["#capabilities", "#daily-loop", "#outlets", "#roadmap", "#faq"]) {
      expect(html).toContain(`href="${anchor}"`);
      expect(html).toContain(`id="${anchor.slice(1)}"`);
    }
  });
});
