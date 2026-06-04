// ABOUTME: Verifies the AnimatedCounter renders the prefix, value (locale-formatted), and suffix.
// ABOUTME: Guards the trust-stats and hero-dashboard counter contract used by the Finaflow marketing page.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AnimatedCounter from "../AnimatedCounter";

describe("AnimatedCounter", () => {
  it("renders 0 by default when waiting to enter the viewport", () => {
    const html = renderToStaticMarkup(<AnimatedCounter value={500} />);
    expect(html).toContain("0");
  });

  it("renders the final value when startOnView is false", () => {
    const html = renderToStaticMarkup(
      <AnimatedCounter value={500} suffix="+" startOnView={false} />,
    );
    expect(html).toContain("500");
    expect(html).toContain("+");
  });

  it("renders the prefix before the value", () => {
    const html = renderToStaticMarkup(
      <AnimatedCounter value={2} prefix="KES " suffix="B+" startOnView={false} />,
    );
    expect(html).toContain("KES");
    expect(html).toContain("2");
    expect(html).toContain("B+");
  });

  it("respects the decimals prop for fractional values", () => {
    const html = renderToStaticMarkup(
      <AnimatedCounter value={99.9} decimals={1} suffix="%" startOnView={false} />,
    );
    expect(html).toContain("99.9");
    expect(html).toContain("%");
  });

  it("applies a className to the rendered span", () => {
    const html = renderToStaticMarkup(
      <AnimatedCounter value={100} className="text-3xl font-bold" />,
    );
    expect(html).toContain("text-3xl");
    expect(html).toContain("font-bold");
  });
});
