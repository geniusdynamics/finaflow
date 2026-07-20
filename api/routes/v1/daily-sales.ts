// ABOUTME: POST /api/v1/daily-sales — ingest daily sales batches.
import { Hono } from "hono";
import { Sentry } from "../../instrument";
import type { ApiKeyVariables } from "../../lib/api-key-middleware";
import { resolveApiKeyMiddleware } from "../../lib/api-key-middleware";
import { successResponse, errorResponse } from "../../lib/api-response";
import { ingestDailySales } from "../../lib/daily-sales-ingestion";
import { dailySalesIngestSchema } from "../../schemas";

const dailySales = new Hono<{ Variables: ApiKeyVariables }>();

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
