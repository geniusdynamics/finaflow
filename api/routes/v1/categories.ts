// ABOUTME: GET /api/v1/categories — list expense categories for the authenticated business.
import { Hono } from "hono";
import type { ApiKeyVariables } from "../../lib/api-key-middleware";
import { resolveApiKeyMiddleware } from "../../lib/api-key-middleware";
import { paginatedResponse, errorResponse } from "../../lib/api-response";
import { listCategories, logIntegration } from "../../lib/integration-service";
import { paginationQuerySchema } from "../../schemas";

const categories = new Hono<{ Variables: ApiKeyVariables }>();

categories.get("/", resolveApiKeyMiddleware("categories:read"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const parsed = paginationQuerySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", parsed.error.issues.map((i) => i.message).join(", "));
    }

    const { offset, limit } = parsed.data;
    const all = await listCategories(apiKey.businessId);
    const total = all.length;
    const data = all.slice(offset, offset + limit);

    logIntegration({ businessId: apiKey.businessId, apiKey }, "listCategories", "success", { count: data.length, total });
    return paginatedResponse(c, data, { page: Math.floor(offset / limit) + 1, limit, total });
  } catch (err) {
    return errorResponse(c, 500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Internal server error");
  }
});

export default categories;
