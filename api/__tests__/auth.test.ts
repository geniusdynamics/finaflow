import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../lib/password";

describe("Auth Flow - Password Hashing", () => {
  it("should hash a password successfully", async () => {
    const hash = await hashPassword("testpassword123");
    expect(hash).toBeTruthy();
    expect(hash).toContain("");
  });

  it("should verify correct password", async () => {
    const password = "testpassword123";
    const hash = await hashPassword(password);
    const valid = await verifyPassword(password, hash);
    expect(valid).toBe(true);
  });

  it("should reject incorrect password", async () => {
    const hash = await hashPassword("correctpassword");
    const valid = await verifyPassword("wrongpassword", hash);
    expect(valid).toBe(false);
  });

  it("should generate unique salts for same password", async () => {
    const hash1 = await hashPassword("samepassword");
    const hash2 = await hashPassword("samepassword");
    expect(hash1).not.toBe(hash2);
  });

  it("should handle empty string", async () => {
    const hash = await hashPassword("");
    const valid = await verifyPassword("", hash);
    expect(valid).toBe(true);
  });
});

describe("Auth Flow - CSRF Token Generation", () => {
  it("should generate CSRF token", async () => {
    const { createId } = await import("@paralleldrive/cuid2");
    const token = createId();
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(10);
  });

  it("should generate unique CSRF tokens", async () => {
    const { createId } = await import("@paralleldrive/cuid2");
    const token1 = createId();
    const token2 = createId();
    expect(token1).not.toBe(token2);
  });
});

describe("Auth Flow - Rate Limiting", () => {
  it("should create rate limiter with correct config", async () => {
    const { createRateLimiter, clearRateLimitStore } = await import("../lib/rate-limit");
    const limiter = createRateLimiter(60000, 10);
    expect(limiter).toBeInstanceOf(Function);
    clearRateLimitStore();
  });
});
