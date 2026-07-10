import { createMiddleware } from "hono/factory";
import type { ResolvedApiKey } from "./api-key-auth";
import { resolveApiKey } from "./api-key-auth";

export type ApiKeyVariables = {
  apiKey: ResolvedApiKey;
};

function hasRequiredScope(apiKey: ResolvedApiKey, scope?: string): boolean {
  if (!scope) return true;
  return apiKey.scopes.includes(scope) || apiKey.scopes.includes("admin");
}

/**
 * Hono middleware that resolves a Fina API key from the Authorization header
 * and stores the resolved key on the Hono context under "apiKey".
 * Pass `scope` to require a specific capability (admin always satisfies).
 */
export function resolveApiKeyMiddleware(scope?: string) {
  return createMiddleware<{ Variables: ApiKeyVariables }>(async (c, next) => {
    const authHeader = c.req.header("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Missing Authorization header" }, 401);
    }

    const rawKey = authHeader.slice(7).trim();
    if (!rawKey.startsWith("fna_")) {
      return c.json({ error: "Invalid API key format" }, 401);
    }

    const apiKey = await resolveApiKey(rawKey);
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
