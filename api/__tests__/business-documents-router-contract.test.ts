// ABOUTME: Verifies business document router contracts and download payload mapping.
// ABOUTME: Ensures input schemas and safe defaults remain stable for API consumers.
import { describe, expect, it } from "vitest";
import {
  downloadDocumentInputSchema,
  getDocumentsDetailedInputSchema,
  mapDownloadPayload,
} from "../businesses-router";

describe("business documents router contracts", () => {
  it("accepts valid getDocumentsDetailed input", () => {
    expect(getDocumentsDetailedInputSchema.parse({ businessId: 9 })).toEqual({ businessId: 9 });
  });

  it("rejects invalid download input", () => {
    expect(() => downloadDocumentInputSchema.parse({ documentId: 0 })).toThrow();
  });

  it("maps document row to download payload with safe defaults", () => {
    const payload = mapDownloadPayload({
      fileName: "my cert?.pdf",
      mimeType: null,
      fileData: "SGVsbG8=",
    });

    expect(payload.fileName).toBe("my-cert-.pdf");
    expect(payload.mimeType).toBe("application/octet-stream");
    expect(payload.fileData).toBe("SGVsbG8=");
  });
});
