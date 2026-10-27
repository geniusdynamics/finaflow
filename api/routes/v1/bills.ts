// ABOUTME: GET /api/v1/bills and POST /api/v1/bills — list and upsert purchase bills.
import { Hono } from "hono";
import type { ApiKeyVariables } from "../../lib/api-key-middleware";
import { resolveApiKeyMiddleware } from "../../lib/api-key-middleware";
import { successResponse, paginatedResponse, errorResponse } from "../../lib/api-response";
import { listBills, getBill, upsertBill, logIntegration } from "../../lib/integration-service";
import { upsertBillSchema, updatedSinceQuerySchema } from "../../schemas";

const bills = new Hono<{ Variables: ApiKeyVariables }>();

bills.get("/", resolveApiKeyMiddleware("bills:read"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const parsed = updatedSinceQuerySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "));
    }

    const { offset, limit, updatedSince } = parsed.data;
    const all = await listBills(apiKey.businessId, { updatedSince });
    const total = all.length;
    const data = all.slice(offset, offset + limit);

    logIntegration({ businessId: apiKey.businessId, apiKey }, "listBills", "success", { count: data.length, total });
    return paginatedResponse(c, data, { page: Math.floor(offset / limit) + 1, limit, total });
  } catch (err) {
    logIntegration({ businessId: c.get("apiKey")?.businessId, apiKey: c.get("apiKey") }, "listBills", "failed", { error: String(err) });
    return errorResponse(c, 500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Internal server error");
  }
});

bills.get("/:id", resolveApiKeyMiddleware("bills:read"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return errorResponse(c, 400, "VALIDATION_ERROR", "Invalid bill id");
    }
    const bill = await getBill(apiKey.businessId, id);
    if (!bill) return errorResponse(c, 404, "NOT_FOUND", "Bill not found");
    logIntegration({ businessId: apiKey.businessId, apiKey }, "getBill", "success", { billId: id });
    return successResponse(c, bill);
  } catch (err) {
    logIntegration({ businessId: c.get("apiKey")?.businessId, apiKey: c.get("apiKey") }, "getBill", "failed", { error: String(err) });
    return errorResponse(c, 500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Internal server error");
  }
});

bills.post("/", resolveApiKeyMiddleware("bills:write"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const body = await c.req.json();
    const parsed = upsertBillSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "));
    }

    const result = await upsertBill(apiKey.businessId, parsed.data);
    logIntegration({ businessId: apiKey.businessId, apiKey }, "upsertBill", "success", { billId: result.id, created: result.created });
    return successResponse(c, result, result.created ? 201 : 200);
  } catch (err) {
    logIntegration({ businessId: c.get("apiKey")?.businessId, apiKey: c.get("apiKey") }, "upsertBill", "failed", { error: String(err) });
    return errorResponse(c, 500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Internal server error");
  }
});

export default bills;
