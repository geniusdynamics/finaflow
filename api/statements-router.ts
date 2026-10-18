// ABOUTME: tRPC procedures for statement parsing, import, history, detail and undo.
// ABOUTME: Mounted under wallet.statements; reuses wallet permissions and location authorisation.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, requireAuthorizedLocation, walletImport, walletQuery } from "./middleware";
import { logAudit } from "./lib/audit";
import {
  MAX_FILES_PER_BATCH,
  MAX_FILE_BYTES,
  buildStatementPreview,
  getStatementImport,
  importStatements,
  listStatementImports,
  undoStatementImport,
} from "./lib/statements/service";
import { exportStatementImport } from "./lib/statements/export-service";
import { deleteCategoryRule, listCategoryRules, setWalletCategory } from "./lib/statements/categories";
import { StatementError } from "@shared/statements/errors";

const fileSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileBase64: z.string().min(1).max(14_000_000),
  password: z.string().max(100).optional(),
  provider: z.string().max(20).optional(),
  overrides: z.record(z.string(), z.number().nullable()).optional(),
  exclude: z.array(z.string().max(120)).max(50_000).optional(),
});

interface SessionUser {
  id?: number;
  currentBusiness?: { id?: number } | null;
  currentBusinessId?: number | null;
}

function sessionUser(ctx: { user?: unknown }): SessionUser | null {
  return (ctx.user ?? null) as SessionUser | null;
}

function businessIdOf(ctx: { user?: unknown }): number {
  const user = sessionUser(ctx);
  const businessId = user?.currentBusiness?.id ?? user?.currentBusinessId;
  if (!businessId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No active business context available." });
  }
  return businessId;
}

function userIdOf(ctx: { user?: unknown }): number | null {
  return sessionUser(ctx)?.id ?? null;
}

function decodeFile(value: string): Uint8Array {
  const base64 = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) {
    throw new StatementError("INVALID_FILE", "The selected file is empty.");
  }
  if (bytes.length > MAX_FILE_BYTES) {
    throw new StatementError("FILE_TOO_LARGE", "Statements larger than 10 MB are not supported.");
  }
  return new Uint8Array(bytes);
}

function rethrow(error: unknown): never {
  if (error instanceof StatementError) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `[${error.code}] ${error.message}`,
    });
  }
  if (error instanceof TRPCError) throw error;
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: error instanceof Error ? error.message : "Statement processing failed.",
  });
}

export const statementsRouter = createRouter({
  parse: walletImport
    .input(
      z.object({
        locationId: z.number(),
        fileName: z.string().min(1).max(255),
        fileBase64: z.string().min(1).max(14_000_000),
        password: z.string().max(100).optional(),
        provider: z.string().max(20).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const businessId = businessIdOf(ctx);
        await requireAuthorizedLocation(ctx, input.locationId);
        const preview = await buildStatementPreview({
          businessId,
          locationId: input.locationId,
          file: {
            fileName: input.fileName,
            bytes: decodeFile(input.fileBase64),
            password: input.password,
            provider: input.provider,
          },
        });
        return { ok: true as const, preview };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof StatementError) {
          return { ok: false as const, code: error.code, message: error.message };
        }
        rethrow(error);
      }
    }),

  import: walletImport
    .input(
      z.object({
        locationId: z.number(),
        files: z.array(fileSchema).min(1).max(MAX_FILES_PER_BATCH),
        batchLabel: z.string().max(100).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const businessId = businessIdOf(ctx);
        await requireAuthorizedLocation(ctx, input.locationId);

        const result = await importStatements({
          businessId,
          locationId: input.locationId,
          userId: userIdOf(ctx),
          batchLabel: input.batchLabel,
          files: input.files.map((file) => ({
            fileName: file.fileName,
            bytes: decodeFile(file.fileBase64),
            password: file.password,
            provider: file.provider,
            overrides: file.overrides,
            exclude: file.exclude,
          })),
        });

        for (const file of result.files) {
          if (file.status !== "imported" || !file.importId) continue;
          await logAudit({
            userId: userIdOf(ctx),
            businessId,
            action: "CREATE",
            resource: "statement_imports",
            resourceId: file.importId,
            details: {
              fileName: file.fileName,
              rowCount: file.rowCount,
              imported: file.imported,
              skipped: file.skipped,
              duplicates: file.duplicates,
              batchRef: result.batchRef,
            },
          });
        }

        return result;
      } catch (error) {
        rethrow(error);
      }
    }),

  imports: walletQuery
    .input(
      z.object({
        locationId: z.number().optional(),
        provider: z.string().max(20).optional(),
        batchRef: z.string().max(36).optional(),
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        const businessId = businessIdOf(ctx);
        if (input.locationId) await requireAuthorizedLocation(ctx, input.locationId);
        return await listStatementImports({ businessId, ...input });
      } catch (error) {
        rethrow(error);
      }
    }),

  get: walletQuery
    .input(
      z.object({
        importId: z.number(),
        limit: z.number().min(1).max(1000).optional(),
        offset: z.number().min(0).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        const businessId = businessIdOf(ctx);
        const result = await getStatementImport({
          businessId,
          importId: input.importId,
          limit: input.limit,
          offset: input.offset,
        });
        if (!result) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Statement import not found." });
        }
        await requireAuthorizedLocation(ctx, result.import.locationId);
        return result;
      } catch (error) {
        rethrow(error);
      }
    }),

  undo: walletImport
    .input(z.object({ importId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const businessId = businessIdOf(ctx);
        const existing = await getStatementImport({ businessId, importId: input.importId, limit: 1 });
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Statement import not found." });
        }
        await requireAuthorizedLocation(ctx, existing.import.locationId);

        const result = await undoStatementImport({ businessId, importId: input.importId });
        if (!result) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Statement import not found." });
        }

        if (result.ok) {
          await logAudit({
            userId: userIdOf(ctx),
            businessId,
            action: "DELETE",
            resource: "statement_imports",
            resourceId: input.importId,
            details: { deletedRows: result.deleted, action: "undo_statement_import" },
          });
        }

        return result;
      } catch (error) {
        rethrow(error);
      }
    }),

  export: walletQuery
    .input(
      z.object({
        importId: z.number(),
        format: z.enum(["csv", "xlsx", "json"]),
        excludeCharges: z.boolean().optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
        dateFormat: z.enum(["iso", "dd-mmm-yyyy", "dd/mm/yyyy"]).optional(),
        maskPii: z.boolean().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        const businessId = businessIdOf(ctx);
        const existing = await getStatementImport({ businessId, importId: input.importId, limit: 1 });
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Statement import not found." });
        }
        await requireAuthorizedLocation(ctx, existing.import.locationId);

        const file = await exportStatementImport({
          businessId,
          importId: input.importId,
          format: input.format,
          options: {
            excludeCharges: input.excludeCharges,
            sortOrder: input.sortOrder,
            dateFormat: input.dateFormat,
            maskPii: input.maskPii,
          },
        });
        if (!file) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Statement import not found." });
        }

        await logAudit({
          userId: userIdOf(ctx),
          businessId,
          action: "DOWNLOAD",
          resource: "statement_imports",
          resourceId: input.importId,
          details: { format: input.format, fileName: file.fileName },
        });

        return file;
      } catch (error) {
        rethrow(error);
      }
    }),

  setCategory: walletImport
    .input(
      z.object({
        walletTxnId: z.number(),
        categoryId: z.number().nullable(),
        rememberMerchant: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const businessId = businessIdOf(ctx);
        const result = await setWalletCategory({
          businessId,
          walletTxnId: input.walletTxnId,
          categoryId: input.categoryId,
          rememberMerchant: input.rememberMerchant,
          userId: userIdOf(ctx),
        });
        if (!result) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Wallet transaction not found." });
        }
        return { success: true, ...result };
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("That category")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }
        rethrow(error);
      }
    }),

  categoryRules: createRouter({
    list: walletQuery.query(async ({ ctx }) => {
      try {
        return await listCategoryRules({ businessId: businessIdOf(ctx) });
      } catch (error) {
        rethrow(error);
      }
    }),

    delete: walletImport
      .input(z.object({ ruleId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const deleted = await deleteCategoryRule({
            businessId: businessIdOf(ctx),
            ruleId: input.ruleId,
          });
          if (!deleted) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Category rule not found." });
          }
          return { success: true };
        } catch (error) {
          rethrow(error);
        }
      }),
  }),
});

