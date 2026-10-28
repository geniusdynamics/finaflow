// ABOUTME: External v1 statement API: parse, analyze, import, history, detail and export.
// ABOUTME: API-key auth with statements:read/write scopes; files are parsed in memory and never stored.

import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { Sentry } from "../../instrument";
import type { ApiKeyVariables } from "../../lib/api-key-middleware";
import { resolveApiKeyMiddleware } from "../../lib/api-key-middleware";
import { successResponse, errorResponse } from "../../lib/api-response";
import { statementParseLimiter } from "../../lib/rate-limit";
import { logAudit } from "../../lib/audit";
import { getDb } from "../../queries/connection";
import { locations } from "@db/schema";
import {
  MAX_FILES_PER_BATCH,
  MAX_FILE_BYTES,
  buildStatementPreview,
  getStatementImport,
  importStatements,
  listStatementImports,
} from "../../lib/statements/service";
import { exportStatementImport } from "../../lib/statements/export-service";
import { analyzePublicStatements } from "../../lib/statements/public-analysis";
import { analyzeStatementImport } from "../../lib/statements/stored-analysis";
import { linkWalletTransactionToBill, tagWalletTransactions } from "../../lib/statements/tagging";
import { setWalletCategory } from "../../lib/statements/categories";
import { linkStatementAccount } from "../../lib/integration-service";
import { buildAnalysisSheets } from "@shared/statements/analysis-sheets";
import { StatementError } from "@shared/statements/errors";

const statements = new Hono<{ Variables: ApiKeyVariables }>();

const parseSchema = z.object({
  fileName: z.string().min(1).max(255).optional(),
  contentBase64: z.string().min(1).max(14_000_000),
  password: z.string().max(100).optional(),
  provider: z.string().max(20).optional(),
  locationId: z.number().optional(),
});

const importSchema = z.object({  locationId: z.number(),
  batchLabel: z.string().max(100).optional(),
  files: z
    .array(
      z.object({
        fileName: z.string().min(1).max(255),
        contentBase64: z.string().min(1).max(14_000_000),
        password: z.string().max(100).optional(),
        provider: z.string().max(20).optional(),
        overrides: z.record(z.string(), z.number().nullable()).optional(),
        exclude: z.array(z.string().max(120)).max(50_000).optional(),
      }),
    )
    .min(1)
    .max(MAX_FILES_PER_BATCH),
});

interface FilePayload {
  fileName: string;
  bytes: Uint8Array;
  password?: string;
  provider?: string;
  locationId?: number;
}

const analysisFileSchema = z.object({
  fileName: z.string().min(1).max(255).optional(),
  contentBase64: z.string().min(1).max(14_000_000),
  password: z.string().max(100).optional(),
});

const analysisRequestSchema = z.object({
  files: z.array(analysisFileSchema).min(1).max(MAX_FILES_PER_BATCH),
  includeTransactions: z.boolean().optional(),
});

interface AnalysisPayload {
  files: Array<{ fileName: string; bytes: Uint8Array; password?: string }>;
  includeTransactions: boolean;
}

function isUploadedFile(value: unknown): value is File {
  return Boolean(
    value
    && typeof value === "object"
    && "arrayBuffer" in value
    && "name" in value
    && "size" in value,
  );
}

async function readAnalysisPayload(c: Context): Promise<AnalysisPayload | null> {
  const contentType = c.req.header("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const body = (await c.req.parseBody()) as Record<string, unknown>;
    const raw = body.files ?? body.file;
    const entries = Array.isArray(raw) ? raw : [raw];
    const password = typeof body.password === "string" ? body.password : undefined;
    const files: AnalysisPayload["files"] = [];
    for (const entry of entries) {
      if (!isUploadedFile(entry)) continue;
      files.push({
        fileName: entry.name || "statement.pdf",
        bytes: new Uint8Array(await entry.arrayBuffer()),
        password,
      });
    }
    if (files.length === 0) return null;
    return { files, includeTransactions: body.includeTransactions === "true" };
  }

  const json = await c.req.json();
  const parsed = analysisRequestSchema.safeParse(json);
  if (!parsed.success) return null;
  return {
    files: parsed.data.files.map((file) => ({
      fileName: file.fileName ?? "statement.pdf",
      bytes: fromBase64(file.contentBase64),
      password: file.password,
    })),
    includeTransactions: parsed.data.includeTransactions === true,
  };
}

function fromBase64(value: string): Uint8Array {
  const base64 = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
  return new Uint8Array(Buffer.from(base64, "base64"));
}

async function readFilePayload(c: Context): Promise<FilePayload | null> {
  const contentType = c.req.header("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const body = (await c.req.parseBody()) as Record<string, unknown>;
    const file = body.file;
    if (!file || typeof file !== "object" || !("arrayBuffer" in file)) return null;
    const uploaded = file as File;
    const bytes = new Uint8Array(await uploaded.arrayBuffer());
    return {
      fileName: uploaded.name || "statement.pdf",
      bytes,
      password: typeof body.password === "string" ? body.password : undefined,
      provider: typeof body.provider === "string" ? body.provider : undefined,
      locationId: typeof body.locationId === "string" ? Number(body.locationId) : undefined,
    };
  }

  const json = await c.req.json();
  const parsed = parseSchema.safeParse(json);
  if (!parsed.success) return null;
  return {
    fileName: parsed.data.fileName ?? "statement.pdf",
    bytes: fromBase64(parsed.data.contentBase64),
    password: parsed.data.password,
    provider: parsed.data.provider,
    locationId: parsed.data.locationId,
  };
}

async function resolveLocationId(businessId: number, requested?: number): Promise<number | null> {
  const db = getDb();
  if (requested) {
    const [location] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.id, requested),
          eq(locations.businessId, businessId),
          eq(locations.isActive, true),
          isNull(locations.deletedAt),
        ),
      )
      .limit(1);
    return location?.id ?? null;
  }
  const [location] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(
        eq(locations.businessId, businessId),
        eq(locations.isActive, true),
        isNull(locations.deletedAt),
      ),
    )
    .limit(1);
  return location?.id ?? null;
}

function statementFailure(c: Context, error: unknown) {
  if (error instanceof StatementError) {
    return errorResponse(c, 400, error.code, error.message);
  }
  console.error("[v1/statements] error:", error);
  Sentry.captureException(error);
  return errorResponse(c, 500, "INTERNAL_ERROR", error instanceof Error ? error.message : "Statement processing failed.");
}

statements.post("/parse", statementParseLimiter, resolveApiKeyMiddleware("statements:write"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const payload = await readFilePayload(c);
    if (!payload) return errorResponse(c, 400, "VALIDATION_ERROR", "Send multipart file= or JSON contentBase64.");
    if (payload.bytes.length > MAX_FILE_BYTES) {
      return errorResponse(c, 400, "FILE_TOO_LARGE", "Statements larger than 10 MB are not supported.");
    }

    const locationId = await resolveLocationId(apiKey.businessId, payload.locationId);
    if (!locationId) return errorResponse(c, 400, "NO_LOCATION", "No active location is available for this business.");

    const preview = await buildStatementPreview({
      businessId: apiKey.businessId,
      locationId,
      file: {
        fileName: payload.fileName,
        bytes: payload.bytes,
        password: payload.password,
        provider: payload.provider,
      },
    });
    return successResponse(c, preview);
  } catch (error) {
    return statementFailure(c, error);
  }
});

statements.post("/analyze", statementParseLimiter, resolveApiKeyMiddleware("statements:write"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const payload = await readFilePayload(c);
    if (!payload) return errorResponse(c, 400, "VALIDATION_ERROR", "Send multipart file= or JSON contentBase64.");
    const locationId = await resolveLocationId(apiKey.businessId, payload.locationId);
    if (!locationId) return errorResponse(c, 400, "NO_LOCATION", "No active location is available for this business.");

    const preview = await buildStatementPreview({
      businessId: apiKey.businessId,
      locationId,
      file: {
        fileName: payload.fileName,
        bytes: payload.bytes,
        password: payload.password,
        provider: payload.provider,
      },
    });
    return successResponse(c, {
      provider: preview.provider,
      kind: preview.kind,
      period: preview.analysis.period,
      totals: preview.totals,
      statementSummary: preview.statementSummary,
      warnings: preview.warnings,
      analysis: preview.analysis,
    });
  } catch (error) {
    return statementFailure(c, error);
  }
});

statements.post("/analyze/full", statementParseLimiter, resolveApiKeyMiddleware("statements:read"), async (c) => {
  try {
    const payload = await readAnalysisPayload(c);
    if (!payload) {
      return errorResponse(c, 400, "VALIDATION_ERROR", "Send multipart files= (one or more PDF/CSV) or JSON files[].");
    }
    const totalBytes = payload.files.reduce((sum, file) => sum + file.bytes.length, 0);
    if (totalBytes > 40 * 1024 * 1024) {
      return errorResponse(c, 400, "FILE_TOO_LARGE", "The combined upload is larger than 40 MB.");
    }
    const result = await analyzePublicStatements(payload.files, {
      includeTransactions: payload.includeTransactions,
    });
    return successResponse(c, result);
  } catch (error) {
    return statementFailure(c, error);
  }
});

statements.post("/import", statementParseLimiter, resolveApiKeyMiddleware("statements:write"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const body = await c.req.json();
    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", "));
    }
    const locationId = await resolveLocationId(apiKey.businessId, parsed.data.locationId);
    if (!locationId) return errorResponse(c, 400, "NO_LOCATION", "No active location is available for this business.");

    const result = await importStatements({
      businessId: apiKey.businessId,
      locationId,
      userId: null,
      batchLabel: parsed.data.batchLabel,
      files: parsed.data.files.map((file) => ({
        fileName: file.fileName,
        bytes: fromBase64(file.contentBase64),
        password: file.password,
        provider: file.provider,
        overrides: file.overrides,
        exclude: file.exclude,
      })),
    });

    for (const file of result.files) {
      if (file.status !== "imported" || !file.importId) continue;
      await logAudit({
        businessId: apiKey.businessId,
        action: "CREATE",
        resource: "statement_imports",
        resourceId: file.importId,
        details: {
          source: "api",
          fileName: file.fileName,
          rowCount: file.rowCount,
          imported: file.imported,
          skipped: file.skipped,
          batchRef: result.batchRef,
        },
      });
    }

    const failed = result.files.filter((file) => file.status === "failed");
    return successResponse(c, result, failed.length > 0 ? 202 : 200);
  } catch (error) {
    return statementFailure(c, error);
  }
});

statements.get("/imports", resolveApiKeyMiddleware("statements:read"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 25), 1), 100);
    const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);
    const locationId = c.req.query("locationId") ? Number(c.req.query("locationId")) : undefined;
    const provider = c.req.query("provider");
    const batchRef = c.req.query("batchRef");

    const result = await listStatementImports({
      businessId: apiKey.businessId,
      locationId,
      provider,
      batchRef,
      limit,
      offset,
    });
    return successResponse(c, result);
  } catch (error) {
    return statementFailure(c, error);
  }
});

statements.get("/imports/:id", resolveApiKeyMiddleware("statements:read"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return errorResponse(c, 400, "VALIDATION_ERROR", "Invalid import id.");

    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 500), 1), 1000);
    const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);
    const result = await getStatementImport({ businessId: apiKey.businessId, importId: id, limit, offset });
    if (!result) return errorResponse(c, 404, "NOT_FOUND", "Statement import not found.");
    return successResponse(c, result);
  } catch (error) {
    return statementFailure(c, error);
  }
});

statements.get("/imports/:id/analysis", resolveApiKeyMiddleware("statements:read"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return errorResponse(c, 400, "VALIDATION_ERROR", "Invalid import id.");

    const consolidated = await analyzeStatementImport({ businessId: apiKey.businessId, importId: id });
    if (!consolidated) return errorResponse(c, 404, "NOT_FOUND", "Statement import not found.");

    return successResponse(c, {
      generatedAt: new Date().toISOString(),
      analysis: consolidated.analysis,
      files: consolidated.files,
      fileCount: consolidated.fileCount,
      totalRowCount: consolidated.totalRowCount,
      duplicateRows: consolidated.duplicateRows,
      banks: consolidated.banks,
      periodStart: consolidated.periodStart,
      periodEnd: consolidated.periodEnd,
      sheets: buildAnalysisSheets(consolidated),
    });
  } catch (error) {
    return statementFailure(c, error);
  }
});

statements.post("/imports/:id/link-account", resolveApiKeyMiddleware("statements:write"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return errorResponse(c, 400, "VALIDATION_ERROR", "Invalid import id.");
    const body = await c.req.json();
    const parsed = z.object({ accountId: z.number().int().positive() }).safeParse(body);
    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", "accountId is required.");
    }
    const result = await linkStatementAccount(apiKey.businessId, id, parsed.data.accountId);
    return successResponse(c, result);
  } catch (error) {
    return statementFailure(c, error);
  }
});

statements.patch("/transactions/:id/category", resolveApiKeyMiddleware("statements:write"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return errorResponse(c, 400, "VALIDATION_ERROR", "Invalid transaction id.");
    }
    const parsed = z
      .object({
        categoryId: z.number().int().positive().nullable(),
        rememberMerchant: z.boolean().optional(),
      })
      .safeParse(await c.req.json());
    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", parsed.error.issues.map((issue) => issue.message).join(", "));
    }
    const result = await setWalletCategory({
      businessId: apiKey.businessId,
      walletTxnId: id,
      categoryId: parsed.data.categoryId,
      rememberMerchant: parsed.data.rememberMerchant,
    });
    if (!result) return errorResponse(c, 404, "NOT_FOUND", "Statement transaction not found.");
    return successResponse(c, { id, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("does not belong")) return errorResponse(c, 400, "VALIDATION_ERROR", message);
    return statementFailure(c, error);
  }
});

statements.post("/transactions/tag", resolveApiKeyMiddleware("statements:write"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const parsed = z
      .object({
        transactionIds: z.array(z.number().int().positive()).min(1).max(500),
        categoryId: z.number().int().positive().nullable(),
        rememberMerchant: z.boolean().optional(),
      })
      .safeParse(await c.req.json());
    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", parsed.error.issues.map((issue) => issue.message).join(", "));
    }
    const result = await tagWalletTransactions({
      businessId: apiKey.businessId,
      transactionIds: parsed.data.transactionIds,
      categoryId: parsed.data.categoryId,
      rememberMerchant: parsed.data.rememberMerchant,
    });
    return successResponse(c, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("does not belong")) return errorResponse(c, 400, "VALIDATION_ERROR", message);
    return statementFailure(c, error);
  }
});

statements.post("/transactions/:id/link-bill", resolveApiKeyMiddleware("statements:write"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return errorResponse(c, 400, "VALIDATION_ERROR", "Invalid transaction id.");
    }
    const parsed = z
      .object({
        billId: z.number().int().positive(),
        postPayment: z.boolean().optional(),
        categoryId: z.number().int().positive().optional(),
      })
      .safeParse(await c.req.json());
    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", parsed.error.issues.map((issue) => issue.message).join(", "));
    }
    const result = await linkWalletTransactionToBill({
      businessId: apiKey.businessId,
      transactionId: id,
      billId: parsed.data.billId,
      postPayment: parsed.data.postPayment,
      categoryId: parsed.data.categoryId,
    });
    if (!result) return errorResponse(c, 404, "NOT_FOUND", "Statement transaction not found.");
    return successResponse(c, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Bill not found") return errorResponse(c, 404, "NOT_FOUND", message);
    if (/categor|account|outgoing|no active user/i.test(message)) {
      return errorResponse(c, 400, "VALIDATION_ERROR", message);
    }
    return statementFailure(c, error);
  }
});

statements.get("/imports/:id/export", resolveApiKeyMiddleware("statements:read"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return errorResponse(c, 400, "VALIDATION_ERROR", "Invalid import id.");

    const format = (c.req.query("format") ?? "csv").toLowerCase();
    if (format !== "csv" && format !== "xlsx" && format !== "json") {
      return errorResponse(c, 400, "VALIDATION_ERROR", "format must be csv, xlsx or json.");
    }

    const file = await exportStatementImport({
      businessId: apiKey.businessId,
      importId: id,
      format,
      options: {
        excludeCharges: c.req.query("excludeCharges") === "true",
        sortOrder: c.req.query("sortOrder") === "desc" ? "desc" : "asc",
        dateFormat:
          c.req.query("dateFormat") === "dd-mmm-yyyy"
            ? "dd-mmm-yyyy"
            : c.req.query("dateFormat") === "dd/mm/yyyy"
              ? "dd/mm/yyyy"
              : "iso",
        maskPii: c.req.query("maskPii") === "true",
      },
    });
    if (!file) return errorResponse(c, 404, "NOT_FOUND", "Statement import not found.");

    await logAudit({
      businessId: apiKey.businessId,
      action: "DOWNLOAD",
      resource: "statement_imports",
      resourceId: id,
      details: { source: "api", format, fileName: file.fileName },
    });

    const bytes = new Uint8Array(Buffer.from(file.base64, "base64"));
    return c.body(bytes, 200, {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename="${file.fileName.replace(/"/g, "")}"`,
    });
  } catch (error) {
    return statementFailure(c, error);
  }
});

export default statements;
