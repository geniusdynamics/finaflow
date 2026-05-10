// ABOUTME: Verifies business-logo router input contracts for upload, fetch, and delete procedures.
// ABOUTME: Ensures schema exports remain stable for API consumers and client callers.
import { describe, expect, it } from "vitest";
import {
  uploadLogoInputSchema,
  getActiveLogoInputSchema,
  deleteLogoInputSchema,
} from "../businesses-router";

describe("business logo router contracts", () => {
  it("validates upload payload", () => {
    expect(uploadLogoInputSchema.parse({
      businessId: 1,
      fileName: "logo.png",
      mimeType: "image/png",
      fileData: "iVBORw0KGgoAAAANSUhEUgAA",
      width: 512,
      height: 128,
      sizeBytes: 104857,
    })).toBeTruthy();
  });

  it("validates getActiveLogo payload", () => {
    expect(getActiveLogoInputSchema.parse({ businessId: 2 })).toEqual({ businessId: 2 });
  });

  it("rejects invalid delete payload", () => {
    expect(() => deleteLogoInputSchema.parse({ businessId: 0 })).toThrow();
  });
});
