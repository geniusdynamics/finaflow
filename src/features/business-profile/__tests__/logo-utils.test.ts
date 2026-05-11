// ABOUTME: Verifies business logo client utilities for type/size validation and optimization API shape.
// ABOUTME: Guards upload rules so unsupported files are blocked before API submission.
import { describe, expect, it } from "vitest";
import {
  isAllowedLogoType,
  validateLogoFileSizeBytes,
  optimizeLogoFile,
} from "../logo-utils";

describe("logo utils", () => {
  it("accepts png type", () => {
    expect(isAllowedLogoType("image/png")).toBe(true);
  });

  it("rejects unsupported type", () => {
    expect(isAllowedLogoType("image/webp")).toBe(false);
  });

  it("validates 5MB max", () => {
    expect(validateLogoFileSizeBytes(5 * 1024 * 1024)).toBe(true);
    expect(validateLogoFileSizeBytes(5 * 1024 * 1024 + 1)).toBe(false);
  });

  it("exports optimizeLogoFile function", () => {
    expect(typeof optimizeLogoFile).toBe("function");
  });
});
