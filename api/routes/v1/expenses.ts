// ABOUTME: GET /api/v1/expenses — list expenses with category and bill linkage for pull sync.
import { Hono } from "hono";
import type { ApiKeyVariables } from "../../lib/api-key-middleware";
import { resolveApiKeyMiddleware } from "../../lib/api-key-middleware";
import { paginatedResponse, errorResponse } from "../../lib/api-response";
import { listExpenses, logIntegration } from "../../lib/integration-service";
import { updatedSinceQuerySchema } from "../../schemas";

const expenses = new Hono<{ Variables: ApiKeyVariables }>();

expenses.get("/", resolveApiKeyMiddleware("expenses:read"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const parsed = updatedSinceQuerySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "));
    }

    const { offset, limit, updatedSince } = parsed.data;
    const all = await listExpenses(apiKey.businessId, { updatedSince });
    const total = all.length;
    const data = all.slice(offset, offset + limit);

    logIntegration({ businessId: apiKey.businessId, apiKey }, "listExpenses", "success", { count: data.length, total });
    return paginatedResponse(c, data, { page: Math.floor(offset / limit) + 1, limit, total });
  } catch (err) {
    logIntegration({ businessId: c.get("apiKey")?.businessId, apiKey: c.get("apiKey") }, "listExpenses", "failed", { error: String(err) });
    return errorResponse(c, 500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Internal server error");
  }
});

export default expenses;
