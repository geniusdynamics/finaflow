// ABOUTME: GET /api/v1/business/profile — get business profile for the authenticated business.
import { Hono } from "hono";
import type { ApiKeyVariables } from "../../lib/api-key-middleware";
import { resolveApiKeyMiddleware } from "../../lib/api-key-middleware";
import { successResponse, errorResponse } from "../../lib/api-response";
import { getBusinessProfile, logIntegration } from "../../lib/integration-service";

const business = new Hono<{ Variables: ApiKeyVariables }>();

business.get("/profile", resolveApiKeyMiddleware("business:read"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const data = await getBusinessProfile(apiKey.businessId);
    logIntegration({ businessId: apiKey.businessId, apiKey }, "getBusinessProfile", "success", { found: Boolean(data) });
    return successResponse(c, data);
  } catch (err) {
    return errorResponse(c, 500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Internal server error");
  }
});

export default business;
