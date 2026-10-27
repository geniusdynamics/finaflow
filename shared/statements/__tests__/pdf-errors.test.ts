// ABOUTME: Tests for PDF byte detection used by both Node and browser extractors.
// ABOUTME: Bank exports sometimes prepend a UTF-8 BOM before the %PDF header.

import { describe, expect, it } from "vitest";
import { isPdfBytes } from "../extract/pdf-errors";

describe("PDF byte detection", () => {
  it("accepts a normal PDF header", () => {
    expect(isPdfBytes(new TextEncoder().encode("%PDF-1.4\n"))).toBe(true);
  });

  it("accepts a UTF-8 BOM before the PDF header", () => {
    expect(isPdfBytes(new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("%PDF-1.4\n")]))).toBe(true);
  });

  it("rejects non-PDF bytes", () => {
    expect(isPdfBytes(new TextEncoder().encode("PK\u0003\u0004"))).toBe(false);
  });
});
