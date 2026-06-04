// ABOUTME: Verifies PricingCard renders plan data, swaps price by billing cycle, and exposes the CTA link.
// ABOUTME: Guards the desktop and tablet pricing card contract used by the Finaflow homepage.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; [k: string]: unknown }) => (
      <a href={to} {...props}>{children}</a>
    ),
  };
});

import PricingCard from "../PricingCard";
import type { PricingPlan } from "../ChangeablePricingSection";

const samplePlan: PricingPlan = {
  id: "growth",
  name: "Growth",
  description: "For multi-branch teams that need payroll and priority help.",
  priceMonthly: "KES 1,500",
  priceYearly: "KES 1,250",
  badge: "Popular",
  featuresLabel: "Everything in Starter, plus:",
  features: [
    { text: "3 businesses · 5 branches · 5 users" },
    { text: "Full payroll (PAYE, NHIF, NSSF)" },
    { text: "Priority support" },
    { text: "Custom dashboards" },
    { text: "Should be hidden" },
  ],
  cta: "Start Trial",
  highlight: true,
};

const basicPlan: PricingPlan = {
  id: "free",
  name: "Free",
  description: "For solo founders trying Finaflow for the first time.",
  priceMonthly: "KES 0",
  priceYearly: "KES 0",
  features: [{ text: "1 business · 1 branch · 1 user" }],
  cta: "Get Started",
};

const proPlan: PricingPlan = {
  id: "pro",
  name: "Pro",
  description: "For chains, franchises, and agencies scaling across regions.",
  priceMonthly: "KES 3,000",
  priceYearly: "KES 2,500",
  featuresLabel: "Everything in Growth, plus:",
  features: [
    { text: "10 businesses · unlimited branches & users" },
    { text: "API access & webhooks" },
    { text: "White-label option" },
    { text: "Dedicated success manager" },
  ],
  cta: "Contact Sales",
};

describe("PricingCard", () => {
  it("renders the plan name, description, badge, and CTA", () => {
    const html = renderToStaticMarkup(
      <PricingCard plan={samplePlan} billingCycle="monthly" index={0} />,
    );

    expect(html).toContain("Growth");
    expect(html).toContain("Popular");
    expect(html).toContain("Start Trial");
    expect(html).toContain("Everything in Starter, plus:");
  });

  it("shows the monthly price on monthly cycle", () => {
    const html = renderToStaticMarkup(
      <PricingCard plan={samplePlan} billingCycle="monthly" index={0} />,
    );
    expect(html).toContain("KES 1,500");
  });

  it("shows the yearly price on yearly cycle", () => {
    const html = renderToStaticMarkup(
      <PricingCard plan={samplePlan} billingCycle="yearly" index={0} />,
    );
    expect(html).toContain("KES 1,250");
  });

  it("renders at most the first four features when maxFeatures is the default", () => {
    const html = renderToStaticMarkup(
      <PricingCard plan={samplePlan} billingCycle="monthly" index={0} />,
    );
    expect(html).toContain("3 businesses");
    expect(html).toContain("Full payroll");
    expect(html).toContain("Priority support");
    expect(html).toContain("Custom dashboards");
    expect(html).not.toContain("Should be hidden");
  });

  it("links the CTA to the ctaHref prop", () => {
    const html = renderToStaticMarkup(
      <PricingCard
        plan={samplePlan}
        billingCycle="monthly"
        index={0}
        ctaHref="/signup?plan=growth"
      />,
    );
    expect(html).toContain('href="/signup?plan=growth"');
  });

  it("defaults the CTA href to /login?type=standard", () => {
    const html = renderToStaticMarkup(
      <PricingCard plan={samplePlan} billingCycle="monthly" index={0} />,
    );
    expect(html).toContain('href="/login?type=standard"');
  });

  it("renders the plan without a badge when none is provided", () => {
    const html = renderToStaticMarkup(
      <PricingCard plan={basicPlan} billingCycle="monthly" index={1} />,
    );
    expect(html).toContain("Free");
    expect(html).not.toContain("Popular");
  });

  it("respects a custom maxFeatures override", () => {
    const html = renderToStaticMarkup(
      <PricingCard
        plan={samplePlan}
        billingCycle="monthly"
        index={0}
        maxFeatures={2}
      />,
    );
    expect(html).toContain("3 businesses");
    expect(html).toContain("Full payroll");
    expect(html).not.toContain("Priority support");
  });

  it("renders the Pro plan monthly price at the last grid index (regression for clipped price)", () => {
    const html = renderToStaticMarkup(
      <PricingCard plan={proPlan} billingCycle="monthly" index={3} />,
    );
    expect(html).toContain("KES 3,000");
    expect(html).toContain("Contact Sales");
  });

  it("applies whitespace-nowrap to the Pro monthly price to prevent line-wrap (regression for Pro card)", () => {
    const html = renderToStaticMarkup(
      <PricingCard plan={proPlan} billingCycle="monthly" index={3} />,
    );
    expect(html).toMatch(/whitespace-nowrap[^>]*>\s*KES 3,000/);
  });

  it("renders the Pro plan yearly price at the last grid index", () => {
    const html = renderToStaticMarkup(
      <PricingCard plan={proPlan} billingCycle="yearly" index={3} />,
    );
    expect(html).toContain("KES 2,500");
  });
});
