import { TRPCError } from "@trpc/server";
import { errorResponse } from "./api-response";
import { createMiddleware } from "hono/factory";
import type { ResolvedApiKey } from "./api-key-auth";
import { resolveApiKey } from "./api-key-auth";
import { hasScope, type ApiScope } from "./api-scopes";

export type ApiKeyVariables = {
  apiKey: ResolvedApiKey;
  requestId?: string;
};

function hasRequiredScope(apiKey: ResolvedApiKey, scope?: ApiScope): boolean {
  if (!scope) return true;
  return hasScope(apiKey.scopes, scope);
}

/**
 * Hono middleware that resolves a Fina API key from the Authorization header
 * and stores the resolved key on the Hono context under "apiKey".
 * Pass `scope` to require a specific capability (admin always satisfies).
 * Supports legacy coarse scopes (read, write) via scope aliases in api-scopes.ts.
 */
export function resolveApiKeyMiddleware(scope?: ApiScope) {
  return createMiddleware<{ Variables: ApiKeyVariables }>(async (c, next) => {
    const authHeader = c.req.header("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Missing Authorization header" }, 401);
    }

    const rawKey = authHeader.slice(7).trim();
    if (!rawKey.startsWith("fna_")) {
      return c.json({ error: "Invalid API key format" }, 401);
    }

    let apiKey: ResolvedApiKey | null;
    try { apiKey = await resolveApiKey(rawKey); } catch (error) {
      if (error instanceof TRPCError && error.code === "FORBIDDEN") return errorResponse(c, 403, "ACCOUNT_BILLING_HOLD", "Account is on billing hold");
      throw error;
    }
    if (!apiKey) {
      return c.json({ error: "Invalid API key" }, 401);
    }

    if (!hasRequiredScope(apiKey, scope)) {
      return c.json({ error: `API key missing required scope: ${scope}` }, 403);
    }

    c.set("apiKey", apiKey);
    await next();
  });
}
