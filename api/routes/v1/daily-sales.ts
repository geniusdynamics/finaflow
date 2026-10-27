// ABOUTME: POST /api/v1/daily-sales — ingest daily sales batches.
import { Hono } from "hono";
import { z } from "zod";
import { Sentry } from "../../instrument";
import type { ApiKeyVariables } from "../../lib/api-key-middleware";
import { resolveApiKeyMiddleware } from "../../lib/api-key-middleware";
import { successResponse, paginatedResponse, errorResponse } from "../../lib/api-response";
import { ingestDailySales } from "../../lib/daily-sales-ingestion";
import { listDailySales } from "../../lib/integration-service";
import { dailySalesIngestSchema } from "../../schemas";

const dailySales = new Hono<{ Variables: ApiKeyVariables }>();

const listQuerySchema = z.object({
  locationId: z.coerce.number().int().positive().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  updatedSince: z.string().datetime().optional(),
  sourceBatchId: z.string().max(255).optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

dailySales.get("/", resolveApiKeyMiddleware("sales:read"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const parsed = listQuerySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", "));
    }
    const { offset, limit, ...filters } = parsed.data;
    const result = await listDailySales(apiKey.businessId, { ...filters, offset, limit });
    return paginatedResponse(c, result.items, {
      page: Math.floor(offset / limit) + 1,
      limit,
      total: result.total,
    });
  } catch (err) {
    Sentry.captureException(err);
    return errorResponse(c, 500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Internal server error");
  }
});

dailySales.post("/", resolveApiKeyMiddleware("sales:write"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const body = await c.req.json();
    const parsed = dailySalesIngestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "));
    }

    const result = await ingestDailySales({
      businessId: apiKey.businessId,
      ...parsed.data,
      saleDate: parsed.data.saleDate ?? new Date().toISOString().slice(0, 10),
    });

    if (!result.success) {
      return errorResponse(c, 400, "INGESTION_FAILED", result.error ?? "Ingestion failed");
    }

    const status = result.warnings.length > 0 ? 202 : 200;
    return successResponse(
      c,
      {
        dailySaleId: result.dailySaleId,
        netSales: result.netSales,
        warnings: result.warnings,
        created: result.created,
      },
      status as 200 | 202,
    );
  } catch (err) {
    console.error("[v1/daily-sales] error:", err);
    Sentry.captureException(err);
    return errorResponse(c, 500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Internal server error");
  }
});

export default dailySales;
