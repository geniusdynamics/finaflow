// ABOUTME: Verifies business profile formatting behavior for file size and print labels.
// ABOUTME: Protects UI output contracts used by BusinessDetails profile rendering.
import { describe, expect, it } from "vitest";
import { buildPrintGeneratedLabel, formatFileSize } from "../formatters";

describe("business profile formatters", () => {
  it("formats bytes to KB with one decimal", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats large values to MB", () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("builds print generated label with account id", () => {
    const label = buildPrintGeneratedLabel("ACCT123", new Date("2026-05-09T10:00:00.000Z"));
    expect(label).toContain("ACCT123");
  });
});
