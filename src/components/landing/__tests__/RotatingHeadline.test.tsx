// ABOUTME: Verifies the RotatingHeadline renders the first variation by default and exposes the variation data for A/B testing.
// ABOUTME: Guards the hero headline contract used by the Finaflow marketing page.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RotatingHeadline, { headlineVariations } from "../RotatingHeadline";

describe("RotatingHeadline", () => {
  it("renders the first (pain-point) variation on initial mount", () => {
    const html = renderToStaticMarkup(<RotatingHeadline />);
    const first = headlineVariations[0];
    expect(html).toContain(first.headline);
  });

  it("applies the horizontal gradient treatment to the headline", () => {
    const html = renderToStaticMarkup(<RotatingHeadline />);
    expect(html).toContain("bg-gradient-to-r");
    expect(html).toContain("bg-clip-text");
  });

  it("renders the matching subtitle for the first variation", () => {
    const html = renderToStaticMarkup(<RotatingHeadline />);
    const first = headlineVariations[0];
    expect(html).toContain(first.subtitle);
  });

  it("exposes five simplified variations covering different angles", () => {
    expect(headlineVariations).toHaveLength(5);
    const ids = headlineVariations.map((v) => v.id);
    expect(ids).toContain("pain-point");
    expect(ids).toContain("aspirational");
    expect(ids).toContain("clarity");
    expect(ids).toContain("construction");
    expect(ids).toContain("budget");
  });

  it("every variation has a non-empty headline and subtitle", () => {
    for (const v of headlineVariations) {
      expect(v.headline).toBeTruthy();
      expect(v.subtitle).toBeTruthy();
    }
  });

  it("headlines are concise enough for the hero treatment", () => {
    for (const v of headlineVariations) {
      expect(v.headline.length).toBeLessThan(60);
    }
  });
});
