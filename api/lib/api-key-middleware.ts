import { createMiddleware } from "hono/factory";
import type { ResolvedApiKey } from "./api-key-auth";
import { resolveApiKey } from "./api-key-auth";

export type ApiKeyVariables = {
  apiKey: ResolvedApiKey;
};

/**
 * Hono middleware that resolves a Fina API key from the Authorization header
 * and stores the resolved key on the Hono context under "apiKey".
 */
export const resolveApiKeyMiddleware = createMiddleware<{ Variables: ApiKeyVariables }>(
  async (c, next) => {
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

    c.set("apiKey", apiKey);
    await next();
  }
);
