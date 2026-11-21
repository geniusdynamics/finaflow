// ABOUTME: Authenticates FinaBill instance controllers on the machine-to-machine instance API.
// ABOUTME: Keys use the fic_ prefix, are SHA-256 hashed at rest, and must match the controller header.
import { and, eq, isNull } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { getDb } from "../queries/connection";
import { instanceControllers } from "@db/schema";
import { errorResponse } from "./api-response";

export const INSTANCE_KEY_PREFIX = "fic_";
const KEY_LENGTH = 32;
const KEY_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Generates a new instance controller key (32 base64url characters after the prefix). */
export function generateInstanceKey(): string {
  const bytes = new Uint8Array(KEY_LENGTH);
  crypto.getRandomValues(bytes);
  let result = INSTANCE_KEY_PREFIX;
  for (let i = 0; i < KEY_LENGTH; i++) {
    result += KEY_ALPHABET.charAt(bytes[i] % KEY_ALPHABET.length);
  }
  return result;
}

/** Returns the stored lookup prefix for a raw instance key. */
export function instanceKeyPrefix(rawKey: string): string {
  return rawKey.slice(0, Math.max(INSTANCE_KEY_PREFIX.length + 4, 8));
}

/** Hashes a raw instance key for storage and lookup (SHA-256 hex). */
export async function hashInstanceKey(rawKey: string): Promise<string> {
  const data = new TextEncoder().encode(rawKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

export const INSTANCE_SCOPES = ["instance:read", "instance:manage"] as const;

export type InstanceScope = (typeof INSTANCE_SCOPES)[number];

export function isInstanceScope(value: string): value is InstanceScope {
  return (INSTANCE_SCOPES as readonly string[]).includes(value);
}

export type ResolvedInstanceController = {
  id: number;
  name: string;
  controllerId: string;
  scopes: InstanceScope[];
};

export type InstanceVariables = {
  instanceController: ResolvedInstanceController;
  requestId?: string;
};

function grantedScopes(value: unknown): InstanceScope[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (scope): scope is InstanceScope =>
      typeof scope === "string" && isInstanceScope(scope)
  );
}

/**
 * Resolves a FinaBill instance controller from `Authorization: Bearer fic_...`
 * plus the matching `X-Fina-Controller-Id` header. Pass a scope to require it.
 */
export function resolveInstanceKeyMiddleware(scope?: InstanceScope) {
  return createMiddleware<{ Variables: InstanceVariables }>(async (c, next) => {
    const authHeader = c.req.header("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(
        c,
        401,
        "UNAUTHORIZED",
        "Missing instance controller credentials"
      );
    }

    const rawKey = authHeader.slice(7).trim();
    if (!rawKey.startsWith(INSTANCE_KEY_PREFIX)) {
      return errorResponse(
        c,
        401,
        "UNAUTHORIZED",
        "Invalid instance controller key format"
      );
    }

    const controllerId = c.req.header("x-fina-controller-id")?.trim();
    if (!controllerId) {
      return errorResponse(
        c,
        401,
        "UNAUTHORIZED",
        "Missing X-Fina-Controller-Id header"
      );
    }

    const keyHash = await hashInstanceKey(rawKey);
    const db = getDb();
    const [controller] = await db
      .select()
      .from(instanceControllers)
      .where(
        and(
          eq(instanceControllers.keyHash, keyHash),
          eq(instanceControllers.isActive, true),
          isNull(instanceControllers.deletedAt)
        )
      )
      .limit(1);

    if (!controller) {
      return errorResponse(
        c,
        401,
        "UNAUTHORIZED",
        "Invalid or revoked instance controller key"
      );
    }

    if (controller.controllerId !== controllerId) {
      return errorResponse(
        c,
        401,
        "UNAUTHORIZED",
        "X-Fina-Controller-Id does not match the presented key"
      );
    }

    const scopes = grantedScopes(controller.scopes);
    if (scope && !scopes.includes(scope)) {
      return errorResponse(
        c,
        403,
        "FORBIDDEN",
        `Instance controller key missing required scope: ${scope}`
      );
    }

    await db
      .update(instanceControllers)
      .set({ lastUsedAt: new Date() })
      .where(eq(instanceControllers.id, controller.id));

    c.set("instanceController", {
      id: controller.id,
      name: controller.name,
      controllerId: controller.controllerId,
      scopes,
    });
    await next();
  });
}
