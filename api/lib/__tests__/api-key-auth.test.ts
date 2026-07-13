import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "../../queries/connection";
import { apiKeys } from "@db/schema";
import {
  generateApiKey,
  getKeyPrefix,
  hashApiKey,
  hashApiKeySha256,
  verifyApiKey,
  resolveApiKey,
} from "../api-key-auth";

describe("api-key-auth", () => {
  it("generates keys with the fna_ prefix and correct length", () => {
    const key = generateApiKey();
    expect(key.startsWith("fna_")).toBe(true);
    expect(key.length).toBe(36); // "fna_" + 32 random chars
  });

  it("generates unique keys", () => {
    const keys = new Set(Array.from({ length: 50 }, generateApiKey));
    expect(keys.size).toBe(50);
  });

  it("extracts a consistent prefix", () => {
    const key = generateApiKey();
    expect(getKeyPrefix(key)).toBe(key.slice(0, 8));
  });

  it("hashes and verifies keys with bcrypt", async () => {
    const key = generateApiKey();
    const hash = await hashApiKey(key, 4);
    expect(await verifyApiKey(key, hash)).toBe(true);
    expect(await verifyApiKey("fna_wrongkey", hash)).toBe(false);
  });

  it("resolveApiKey returns the correct businessId and scopes for bcrypt keys", async () => {
    const db = getDb();
    const rawKey = generateApiKey();
    const prefix = getKeyPrefix(rawKey);
    const keyHash = await hashApiKey(rawKey, 4);
    const [row] = await db
      .insert(apiKeys)
      .values({
        businessId: 12345,
        name: "Bcrypt Key Test",
        keyHash,
        keyPrefix: prefix,
        scopes: ["read", "write"],
      } as any)
      .returning();

    const resolved = await resolveApiKey(rawKey);
    expect(resolved).not.toBeNull();
    expect(resolved!.id).toBe(row.id);
    expect(resolved!.businessId).toBe(12345);
    expect(resolved!.scopes).toEqual(["read", "write"]);

    // lastUsedAt should be updated.
    const after = await db.select().from(apiKeys).where(eq(apiKeys.id, row.id)).limit(1);
    expect(after[0].lastUsedAt).not.toBeNull();
  });

  it("resolveApiKey falls back to legacy SHA-256 keys and upgrades them to bcrypt", async () => {
    const db = getDb();
    const rawKey = generateApiKey();
    const prefix = getKeyPrefix(rawKey);
    const shaHash = await hashApiKeySha256(rawKey);
    const [row] = await db
      .insert(apiKeys)
      .values({
        businessId: 12346,
        name: "Legacy SHA-256 Key Test",
        keyHash: shaHash,
        keyPrefix: prefix,
        scopes: ["read"],
      } as any)
      .returning();

    const resolved = await resolveApiKey(rawKey);
    expect(resolved).not.toBeNull();
    expect(resolved!.id).toBe(row.id);
    expect(resolved!.businessId).toBe(12346);
    expect(resolved!.scopes).toEqual(["read"]);

    // The DB row should now be stored as a bcrypt hash.
    const after = await db.select().from(apiKeys).where(eq(apiKeys.id, row.id)).limit(1);
    expect(after[0].keyHash).not.toBe(shaHash);
    expect(await verifyApiKey(rawKey, after[0].keyHash)).toBe(true);

    // A second resolve should still work via the new bcrypt hash.
    const resolved2 = await resolveApiKey(rawKey);
    expect(resolved2).not.toBeNull();
    expect(resolved2!.businessId).toBe(12346);
  });

  it("resolveApiKey rejects inactive keys", async () => {
    const db = getDb();
    const rawKey = generateApiKey();
    const prefix = getKeyPrefix(rawKey);
    const keyHash = await hashApiKey(rawKey, 4);
    await db
      .insert(apiKeys)
      .values({
        businessId: 12347,
        name: "Inactive Key Test",
        keyHash,
        keyPrefix: prefix,
        scopes: ["read"],
        isActive: false,
      } as any);

    const resolved = await resolveApiKey(rawKey);
    expect(resolved).toBeNull();
  });
});
