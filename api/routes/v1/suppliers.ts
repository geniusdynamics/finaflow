// ABOUTME: GET /api/v1/suppliers and POST /api/v1/suppliers — list and upsert suppliers.
import { Hono } from "hono";
import type { ApiKeyVariables } from "../../lib/api-key-middleware";
import { resolveApiKeyMiddleware } from "../../lib/api-key-middleware";
import { successResponse, paginatedResponse, errorResponse } from "../../lib/api-response";
import { listSuppliers, upsertSupplier, logIntegration } from "../../lib/integration-service";
import { upsertSupplierSchema, paginationQuerySchema } from "../../schemas";

const suppliers = new Hono<{ Variables: ApiKeyVariables }>();

suppliers.get("/", resolveApiKeyMiddleware("suppliers:read"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const parsed = paginationQuerySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", parsed.error.issues.map((i) => i.message).join(", "));
    }

    const { offset, limit } = parsed.data;
    const all = await listSuppliers(apiKey.businessId);
    const total = all.length;
    const data = all.slice(offset, offset + limit);

    logIntegration({ businessId: apiKey.businessId, apiKey }, "listSuppliers", "success", { count: data.length, total });
    return paginatedResponse(c, data, { page: Math.floor(offset / limit) + 1, limit, total });
  } catch (err) {
    return errorResponse(c, 500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Internal server error");
  }
});

suppliers.post("/", resolveApiKeyMiddleware("suppliers:write"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const body = await c.req.json();
    const parsed = upsertSupplierSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "));
    }

    const result = await upsertSupplier(apiKey.businessId, parsed.data);
    logIntegration({ businessId: apiKey.businessId, apiKey }, "upsertSupplier", "success", { supplierId: result.id, created: result.created });
    return successResponse(c, result, result.created ? 201 : 200);
  } catch (err) {
    logIntegration({ businessId: c.get("apiKey")?.businessId, apiKey: c.get("apiKey") }, "upsertSupplier", "failed", { error: String(err) });
    return errorResponse(c, 500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Internal server error");
  }
});

export default suppliers;
