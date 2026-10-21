// ABOUTME: Verifies the SegmentedToggle renders every option and marks the active one with aria-pressed.
// ABOUTME: Uses the repo's node-env renderToStaticMarkup test style with no DOM testing library.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SegmentedToggle, type SegmentedToggleOption } from "../ui/segmented-toggle";

const options: SegmentedToggleOption<"cards" | "table" | "split">[] = [
  { value: "cards", label: "Cards" },
  { value: "table", label: "Table" },
  { value: "split", label: "Split" },
];

describe("SegmentedToggle", () => {
  it("renders all options as buttons inside a labeled group", () => {
    const html = renderToStaticMarkup(
      <SegmentedToggle options={options} value="cards" onChange={() => {}} ariaLabel="View mode" />,
    );
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="View mode"');
    expect(html).toContain('data-testid="segmented-option-cards"');
    expect(html).toContain('data-testid="segmented-option-table"');
    expect(html).toContain('data-testid="segmented-option-split"');
    expect(html).toContain("Cards");
    expect(html).toContain("Table");
    expect(html).toContain("Split");
  });

  it("marks only the active option with aria-pressed=true", () => {
    const html = renderToStaticMarkup(
      <SegmentedToggle options={options} value="table" onChange={() => {}} ariaLabel="View mode" />,
    );
    const tableIdx = html.indexOf('data-testid="segmented-option-table"');
    const activeSlice = html.slice(Math.max(0, tableIdx - 200), tableIdx + 400);
    expect(activeSlice).toContain('aria-pressed="true"');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toContain('aria-pressed="false"');
  });

  it("uses real buttons so it is keyboard accessible", () => {
    const html = renderToStaticMarkup(
      <SegmentedToggle options={options} value="cards" onChange={() => {}} />,
    );
    expect(html).toContain('<button type="button"');
    expect(html).toContain('min-h-[44px]');
  });

  it("calls onChange with the option value when clicked", () => {
    const onChange = vi.fn();
    const html = renderToStaticMarkup(
      <SegmentedToggle options={options} value="cards" onChange={onChange} />,
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(html).toContain('aria-pressed="false"');
  });
});
