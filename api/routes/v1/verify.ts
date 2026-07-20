// ABOUTME: Verifies that an API key is valid and returns its identity.
import { Hono } from "hono";
import type { ApiKeyVariables } from "../../lib/api-key-middleware";
import { resolveApiKeyMiddleware } from "../../lib/api-key-middleware";
import { successResponse } from "../../lib/api-response";

const verify = new Hono<{ Variables: ApiKeyVariables }>();

verify.get("/", resolveApiKeyMiddleware(), async (c) => {
  const apiKey = c.get("apiKey");
  return successResponse(c, {
    ok: true,
    businessId: apiKey.businessId,
    authMethod: "api_key",
  });
});

export default verify;
