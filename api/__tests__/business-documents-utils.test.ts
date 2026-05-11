// ABOUTME: Verifies pure business document utility behavior with deterministic unit tests.
// ABOUTME: Covers base64 byte sizing, filename sanitization, and MIME fallback defaults.
import { describe, expect, it } from "vitest";
import {
  base64SizeBytes,
  sanitizeDownloadFileName,
  resolveMimeType,
} from "../lib/business-documents";

describe("business document utils", () => {
  it("calculates byte size from base64 payload", () => {
    expect(base64SizeBytes("SGVsbG8=")).toBe(5);
  });

  it("sanitizes unsafe filename characters", () => {
    expect(sanitizeDownloadFileName("../../tax:cert?.pdf")).toBe("tax-cert-.pdf");
  });

  it("falls back mime type when none provided", () => {
    expect(resolveMimeType(undefined)).toBe("application/octet-stream");
  });
});
