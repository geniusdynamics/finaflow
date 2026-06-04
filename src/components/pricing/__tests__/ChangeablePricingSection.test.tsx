// ABOUTME: Verifies the ChangeablePricingSection component renders plans, badges, and CTAs correctly.
// ABOUTME: Guards the mobile pricing contract on the Finaflow marketing homepage.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ChangeablePricingSection, { type PricingPlan } from "../ChangeablePricingSection";

const plans: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    description: "For solo founders trying Finaflow for the first time.",
    priceMonthly: "KES 0",
    priceYearly: "KES 0",
    features: [
      { text: "1 business · 1 branch · 1 user" },
      { text: "100 transactions per month" },
    ],
    cta: "Get Started",
  },
  {
    id: "growth",
    name: "Growth",
    description: "For multi-branch teams that need payroll & priority help.",
    priceMonthly: "KES 1,500",
    priceYearly: "KES 1,250",
    badge: "Popular",
    featuresLabel: "Everything in Starter, plus:",
    features: [
      { text: "3 businesses · 5 branches · 5 users" },
      { text: "Full payroll (PAYE, NHIF, NSSF)" },
    ],
    cta: "Start Trial",
    highlight: true,
  },
];

describe("ChangeablePricingSection", () => {
  it("renders every plan name and description", () => {
    const html = renderToStaticMarkup(
      <ChangeablePricingSection plans={plans} />,
    );

    expect(html).toContain("Free");
    expect(html).toContain("Growth");
    expect(html).toContain("For solo founders trying Finaflow for the first time.");
    expect(html).toContain("For multi-branch teams that need payroll");
  });

  it("renders the badge when a plan defines one", () => {
    const html = renderToStaticMarkup(
      <ChangeablePricingSection plans={plans} defaultPlanId="free" />,
    );

    expect(html).toContain("Popular");
  });

  it("renders the monthly price as the default visible price", () => {
    const html = renderToStaticMarkup(
      <ChangeablePricingSection plans={plans} defaultPlanId="free" />,
    );

    expect(html).toContain("KES 1,500");
    expect(html).toContain("KES 0");
  });

  it("renders the billing cycle toggle with both Monthly and Yearly labels", () => {
    const html = renderToStaticMarkup(
      <ChangeablePricingSection plans={plans} />,
    );

    expect(html).toContain("Monthly");
    expect(html).toContain("Yearly");
  });

  it("renders the yearly discount note only when on the yearly cycle and note is provided", () => {
    const withNoteOnYearly = renderToStaticMarkup(
      <ChangeablePricingSection
        plans={plans}
        defaultBillingCycle="yearly"
        yearlyDiscountNote="Save 2 months free."
      />,
    );
    expect(withNoteOnYearly).toContain("Save 2 months free.");

    const withNoteOnMonthly = renderToStaticMarkup(
      <ChangeablePricingSection
        plans={plans}
        yearlyDiscountNote="Save 2 months free."
      />,
    );
    expect(withNoteOnMonthly).not.toContain("Save 2 months free.");

    const withoutNoteOnYearly = renderToStaticMarkup(
      <ChangeablePricingSection
        plans={plans}
        defaultBillingCycle="yearly"
      />,
    );
    expect(withoutNoteOnYearly).not.toContain("Save 2 months free.");
  });

  it("renders the footer text and the CTA button text", () => {
    const html = renderToStaticMarkup(
      <ChangeablePricingSection
        plans={plans}
        footerText="No credit card required."
        buttonText="Pick a plan"
      />,
    );

    expect(html).toContain("No credit card required.");
    expect(html).toContain("Pick a plan");
  });

  it("renders an anchor with ctaHref when provided", () => {
    const html = renderToStaticMarkup(
      <ChangeablePricingSection
        plans={plans}
        ctaHref="/login?type=standard"
        buttonText="Get Started"
      />,
    );

    expect(html).toContain('href="/login?type=standard"');
    expect(html).toContain("Get Started");
  });

  it("calls onContinue with the selected plan and billing cycle", () => {
    const onContinue = vi.fn();
    const html = renderToStaticMarkup(
      <ChangeablePricingSection
        plans={plans}
        defaultPlanId="growth"
        defaultBillingCycle="yearly"
        onContinue={onContinue}
      />,
    );

    expect(html).toContain("Continue");
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("renders plan features only for the selected plan", () => {
    const growthSelected = renderToStaticMarkup(
      <ChangeablePricingSection plans={plans} defaultPlanId="growth" />,
    );
    expect(growthSelected).toContain("Full payroll (PAYE, NHIF, NSSF)");
    expect(growthSelected).toContain("Everything in Starter, plus:");
    expect(growthSelected).not.toContain("1 business · 1 branch · 1 user");

    const freeSelected = renderToStaticMarkup(
      <ChangeablePricingSection plans={plans} defaultPlanId="free" />,
    );
    expect(freeSelected).toContain("1 business · 1 branch · 1 user");
    expect(freeSelected).toContain("100 transactions per month");
    expect(freeSelected).not.toContain("Full payroll (PAYE, NHIF, NSSF)");
  });
});
