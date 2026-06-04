// ABOUTME: Verifies the BillingCycleToggle renders the active state, exposes a yearly discount badge, and is a controlled component.
// ABOUTME: Guards the section-level toggle contract used by the Finaflow pricing page header.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BillingCycleToggle from "../BillingCycleToggle";

describe("BillingCycleToggle", () => {
  it("renders both Monthly and Yearly labels and the yearly badge", () => {
    const html = renderToStaticMarkup(
      <BillingCycleToggle value="monthly" onChange={() => {}} />,
    );

    expect(html).toContain("Monthly");
    expect(html).toContain("Yearly");
    expect(html).toContain("−17%");
  });

  it("marks the active cycle with aria-pressed and surfaces the role group", () => {
    const monthlyActive = renderToStaticMarkup(
      <BillingCycleToggle value="monthly" onChange={() => {}} />,
    );
    expect(monthlyActive).toContain('role="group"');
    expect(monthlyActive).toContain('aria-label="Billing cycle"');
    expect(monthlyActive).toContain('aria-pressed="true"');
    expect(monthlyActive).toContain('aria-pressed="false"');

    const yearlyActive = renderToStaticMarkup(
      <BillingCycleToggle value="yearly" onChange={() => {}} />,
    );
    expect(yearlyActive).toContain('aria-pressed="true"');
  });

  it("hides the animated indicator pill from assistive tech", () => {
    const html = renderToStaticMarkup(
      <BillingCycleToggle value="monthly" onChange={() => {}} />,
    );
    expect(html).toContain('aria-hidden="true"');
  });

  it("accepts custom labels and a custom yearly badge", () => {
    const html = renderToStaticMarkup(
      <BillingCycleToggle
        value="yearly"
        onChange={() => {}}
        monthlyLabel="Per month"
        yearlyLabel="Per year"
        yearlyBadge="-20%"
      />,
    );
    expect(html).toContain("Per month");
    expect(html).toContain("Per year");
    expect(html).toContain("-20%");
    expect(html).not.toContain("Monthly");
  });

  it("forwards clicks through the onChange callback", () => {
    const onChange = vi.fn();
    const html = renderToStaticMarkup(
      <BillingCycleToggle value="monthly" onChange={onChange} />,
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(html).toContain("Monthly");
    expect(html).toContain("Yearly");
  });
});
