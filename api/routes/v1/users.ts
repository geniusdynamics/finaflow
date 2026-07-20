// ABOUTME: GET /api/v1/users and POST /api/v1/users — list and upsert users.
import { Hono } from "hono";
import type { ApiKeyVariables } from "../../lib/api-key-middleware";
import { resolveApiKeyMiddleware } from "../../lib/api-key-middleware";
import { successResponse, paginatedResponse, errorResponse } from "../../lib/api-response";
import { listUsers, upsertUser, logIntegration } from "../../lib/integration-service";
import { upsertUserSchema, paginationQuerySchema } from "../../schemas";

const usersRouter = new Hono<{ Variables: ApiKeyVariables }>();

usersRouter.get("/", resolveApiKeyMiddleware("users:read"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const parsed = paginationQuerySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", parsed.error.issues.map((i) => i.message).join(", "));
    }

    const { offset, limit } = parsed.data;
    const all = await listUsers(apiKey.businessId);
    const total = all.length;
    const data = all.slice(offset, offset + limit);

    logIntegration({ businessId: apiKey.businessId, apiKey }, "listUsers", "success", { count: data.length, total });
    return paginatedResponse(c, data, { page: Math.floor(offset / limit) + 1, limit, total });
  } catch (err) {
    return errorResponse(c, 500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Internal server error");
  }
});

usersRouter.post("/", resolveApiKeyMiddleware("users:write"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const body = await c.req.json();
    const parsed = upsertUserSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "));
    }

    const result = await upsertUser(apiKey.businessId, parsed.data);
    logIntegration({ businessId: apiKey.businessId, apiKey }, "upsertUser", "success", { userId: result.id, created: result.created });
    return successResponse(c, result, result.created ? 201 : 200);
  } catch (err) {
    logIntegration({ businessId: c.get("apiKey")?.businessId, apiKey: c.get("apiKey") }, "upsertUser", "failed", { error: String(err) });
    const message = err instanceof Error ? err.message : "Internal server error";
    if (message.includes("not allowed via integration")) {
      return errorResponse(c, 400, "INVALID_ROLE", message);
    }
    return errorResponse(c, 500, "INTERNAL_ERROR", message);
  }
});

export default usersRouter;
