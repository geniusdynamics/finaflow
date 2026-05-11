// ABOUTME: Validates backend business-logo MIME and file-size guardrails.
// ABOUTME: Ensures shared helper constants and errors stay aligned with API expectations.
import { describe, expect, it } from "vitest";
import {
  MAX_LOGO_BYTES,
  ALLOWED_LOGO_MIME_TYPES,
  assertAllowedLogoMimeType,
  assertLogoMaxSize,
} from "../lib/logo-validation";

describe("logo validation helpers", () => {
  it("accepts allowed mime types", () => {
    expect(() => assertAllowedLogoMimeType("image/png")).not.toThrow();
  });

  it("rejects unsupported mime types", () => {
    expect(() => assertAllowedLogoMimeType("image/webp")).toThrow(/Unsupported logo format/i);
  });

  it("rejects payload bigger than max size", () => {
    expect(() => assertLogoMaxSize(MAX_LOGO_BYTES + 1)).toThrow(/5MB/i);
  });

  it("exports expected allowed mime set", () => {
    expect(ALLOWED_LOGO_MIME_TYPES).toContain("image/svg+xml");
  });
});
