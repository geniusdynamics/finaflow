// ABOUTME: Unit tests for Fina Connect pairing helpers (code hashing, session shapes).
// ABOUTME: Focuses on pure protocol behavior without requiring a live database.
import { describe, expect, it } from "vitest";
import crypto from "crypto";

function hashCode(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function generatePairingCodeFromBytes(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i]! % alphabet.length];
  return `FINA-${out.slice(0, 4)}-${out.slice(4)}`;
}

describe("fina connect protocol helpers", () => {
  it("hashes pairing codes deterministically", () => {
    const code = "FINA-ABCD-EFGH";
    expect(hashCode(code)).toBe(hashCode(code));
    expect(hashCode(code)).not.toBe(hashCode("FINA-ABCD-EFGI"));
  });

  it("formats pairing codes as FINA-XXXX-XXXX", () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const code = generatePairingCodeFromBytes(bytes);
    expect(code).toMatch(/^FINA-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it("uses sha256 hex digests of length 64", () => {
    expect(hashCode("verifier")).toHaveLength(64);
  });
});
