// ABOUTME: GET/POST /api/v1/categories — list and upsert expense categories for integrators.
import { Hono } from "hono";
import type { ApiKeyVariables } from "../../lib/api-key-middleware";
import { resolveApiKeyMiddleware } from "../../lib/api-key-middleware";
import { successResponse, paginatedResponse, errorResponse } from "../../lib/api-response";
import { listCategories, upsertCategory, logIntegration } from "../../lib/integration-service";
import { paginationQuerySchema, upsertCategorySchema } from "../../schemas";

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

categories.post("/", resolveApiKeyMiddleware("categories:write"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const body = await c.req.json();
    const parsed = upsertCategorySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        c,
        400,
        "VALIDATION_ERROR",
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
      );
    }

    const result = await upsertCategory(apiKey.businessId, parsed.data);
    logIntegration(
      { businessId: apiKey.businessId, apiKey },
      "upsertCategory",
      "success",
      { categoryId: result.id, created: result.created },
    );
    return successResponse(c, result, result.created ? 201 : 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("not supported") || message.includes("must belong") ? 400 : 500;
    logIntegration(
      { businessId: c.get("apiKey")?.businessId, apiKey: c.get("apiKey") },
      "upsertCategory",
      "failed",
      { error: message },
    );
    return errorResponse(c, status as 400 | 500, status === 400 ? "VALIDATION_ERROR" : "INTERNAL_ERROR", message);
  }
});

export default categories;
