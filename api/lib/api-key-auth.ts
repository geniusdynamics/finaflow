import bcrypt from "bcryptjs";
import { eq, and, isNull, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { apiKeys } from "@db/schema";
import { env } from "./env";

const KEY_PREFIX = "fna_";
const KEY_BYTES = 32;

export function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(KEY_BYTES);
  crypto.getRandomValues(bytes);
  let result = KEY_PREFIX;
  for (let i = 0; i < KEY_BYTES; i++) {
    result += chars.charAt(bytes[i] % chars.length);
  }
  return result;
}

export function getKeyPrefix(rawKey: string): string {
  return rawKey.slice(0, Math.max(KEY_PREFIX.length + 4, 8));
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashApiKeySha256(rawKey: string): Promise<string> {
  return sha256Hex(rawKey);
}

export async function hashApiKey(rawKey: string, rounds: number): Promise<string> {
  return bcrypt.hash(rawKey, rounds);
}

export async function verifyApiKey(rawKey: string, keyHash: string): Promise<boolean> {
  return bcrypt.compare(rawKey, keyHash);
}

export type ResolvedApiKey = {
  id: number;
  businessId: number;
  scopes: string[];
};

function notExpiredCondition() {
  return and(
    isNull(apiKeys.deletedAt),
    eq(apiKeys.isActive, true),
    sql`${apiKeys.expiresAt} IS NULL OR ${apiKeys.expiresAt} > NOW()`
  );
}

export async function resolveApiKey(rawKey: string): Promise<ResolvedApiKey | null> {
  if (!rawKey.startsWith(KEY_PREFIX)) return null;

  const db = getDb();
  const prefix = getKeyPrefix(rawKey);

  // Primary lookup: bcrypt prefix-based lookup for current keys.
  const candidates = await db
    .select()
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.keyPrefix, prefix),
        notExpiredCondition()
      )
    );

  for (const candidate of candidates) {
    if (await verifyApiKey(rawKey, candidate.keyHash)) {
      await db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, candidate.id));

      return {
        id: candidate.id,
        businessId: candidate.businessId,
        scopes: Array.isArray(candidate.scopes) ? candidate.scopes : [],
      };
    }
  }

  // Fallback: legacy SHA-256 direct hash match.
  const shaHash = await hashApiKeySha256(rawKey);
  const shaRows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, shaHash), notExpiredCondition()))
    .limit(1);

  if (shaRows[0]) {
    const legacy = shaRows[0];
    // Upgrade the legacy key to bcrypt on first successful use.
    const bcryptHash = await hashApiKey(rawKey, env.bcryptRounds);
    await db
      .update(apiKeys)
      .set({ keyHash: bcryptHash, lastUsedAt: new Date() })
      .where(eq(apiKeys.id, legacy.id));

    return {
      id: legacy.id,
      businessId: legacy.businessId,
      scopes: Array.isArray(legacy.scopes) ? legacy.scopes : [],
    };
  }

  return null;
}
