// ABOUTME: Legacy tRPC router for FinaBill integration (API-key authenticated).
// ABOUTME: Thin wrapper over integration-service.ts — kept for backward compat with tRPC clients.
// ABOUTME: New consumers should use the REST API at /api/v1/ instead.
import { z } from "zod";
import {
  createRouter,
  apiKeyProcedure,
  requireApiKey,
} from "./middleware";
import * as integrationService from "./lib/integration-service";

function getBusinessId(ctx: { businessId?: number | null }): number | null {
  return ctx.businessId ?? null;
}

export const integrationFinabillRouter = createRouter({
  verify: apiKeyProcedure
    .meta({ description: "Verify that an API key is valid and return its business identity." })
    .query(async ({ ctx }) => {
    const businessId = getBusinessId(ctx);
    integrationService.logIntegration(ctx, "finabill.verify", "success");
    return {
      ok: true,
      businessId,
      authMethod: ctx.apiKey ? "api_key" : "none",
    };
  }),

  listAccounts: apiKeyProcedure
    .meta({ description: "List all accounts for the authenticated business. Optionally filter by accountType." })
    .use(requireApiKey("accounts:read"))
    .input(z.object({ accountType: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        integrationService.logIntegration(ctx, "finabill.listAccounts", "failed", { error: "No active business" });
        return { data: [] };
      }
      const data = await integrationService.listAccounts(businessId, input?.accountType);
      integrationService.logIntegration(ctx, "finabill.listAccounts", "success", { count: data.length });
      return { data };
    }),

  listPaymentAccounts: apiKeyProcedure
    .meta({ description: "List operational money/payment accounts (cash, mpesa, wallet, bank) with live balances." })
    .use(requireApiKey("accounts:read"))
    .query(async ({ ctx }) => {
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        integrationService.logIntegration(ctx, "finabill.listPaymentAccounts", "failed", { error: "No active business" });
        return { data: [] };
      }
      const data = await integrationService.listPaymentAccounts(businessId);
      integrationService.logIntegration(ctx, "finabill.listPaymentAccounts", "success", { count: data.length });
      return { data };
    }),

  listAccountTransactions: apiKeyProcedure
    .meta({ description: "List ledger entries for one money account, oldest first, cursor-paginated by entry id." })
    .use(requireApiKey("accounts:read"))
    .input(
      z.object({
        accountId: z.number().int().positive(),
        sinceEntryId: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        integrationService.logIntegration(ctx, "finabill.listAccountTransactions", "failed", { error: "No active business" });
        return { data: [] };
      }
      const data = await integrationService.listAccountTransactions(businessId, input.accountId, {
        sinceEntryId: input.sinceEntryId,
        limit: input.limit,
      });
      integrationService.logIntegration(ctx, "finabill.listAccountTransactions", "success", { accountId: input.accountId, count: data.length });
      return { data };
    }),

  upsertAccount: apiKeyProcedure
    .meta({ description: "Create or update a Chart of Accounts entry pushed from FinaBill. Match by externalId, then accountType+code, then accountType+name." })
    .use(requireApiKey("accounts:write"))
    .input(
      z.object({
        externalId: z.string().min(1),
        name: z.string().min(1).max(100),
        accountCode: z.string().max(20).optional().nullable(),
        accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
        accountSubType: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        integrationService.logIntegration(ctx, "finabill.upsertAccount", "failed", { error: "No active business" });
        throw new Error("No active business");
      }
      const result = await integrationService.upsertAccount(businessId, input as Parameters<typeof integrationService.upsertAccount>[1]);
      integrationService.logIntegration(ctx, "finabill.upsertAccount", "success", { accountId: result.id, created: result.created });
      return result;
    }),

  listBills: apiKeyProcedure
    .meta({ description: "List bills with line items and external linkage for pull sync." })
    .use(requireApiKey("bills:read"))
    .input(z.object({ updatedSince: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        integrationService.logIntegration(ctx, "finabill.listBills", "failed", { error: "No active business" });
        return { data: [] };
      }
      const data = await integrationService.listBills(businessId, { updatedSince: input?.updatedSince });
      integrationService.logIntegration(ctx, "finabill.listBills", "success", { count: data.length });
      return { data };
    }),

  upsertBill: apiKeyProcedure
    .meta({ description: "Create or update a purchase bill pushed from FinaBill (matched by externalId). Resolves/creates the supplier." })
    .use(requireApiKey("bills:write"))
    .input(
      z.object({
        externalId: z.string().min(1),
        billNumber: z.string().max(100).optional().nullable(),
        description: z.string().min(1),
        amount: z.string(),
        amountPaid: z.string().optional().nullable(),
        issueDate: z.string(),
        dueDate: z.string(),
        status: z.enum(["draft", "received", "partial", "paid", "void"]),
        locationId: z.number().int().positive().optional().nullable(),
        supplier: z
          .object({
            externalId: z.string().optional().nullable(),
            name: z.string().min(1),
            email: z.string().email().optional().nullable(),
            phone: z.string().optional().nullable(),
            taxId: z.string().optional().nullable(),
          })
          .optional()
          .nullable(),
        items: z
          .array(
            z.object({
              itemName: z.string().min(1).max(255),
              quantity: z.string().optional().nullable(),
              unitPrice: z.string(),
              totalPrice: z.string(),
              notes: z.string().optional().nullable(),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        integrationService.logIntegration(ctx, "finabill.upsertBill", "failed", { error: "No active business" });
        throw new Error("No active business");
      }
      const result = await integrationService.upsertBill(businessId, input);
      integrationService.logIntegration(ctx, "finabill.upsertBill", "success", { billId: result.id, created: result.created });
      return result;
    }),

  listExpenses: apiKeyProcedure
    .meta({ description: "List expenses (with category and bill linkage) for pull sync." })
    .use(requireApiKey("expenses:read"))
    .input(z.object({ updatedSince: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        integrationService.logIntegration(ctx, "finabill.listExpenses", "failed", { error: "No active business" });
        return { data: [] };
      }
      const data = await integrationService.listExpenses(businessId, { updatedSince: input?.updatedSince });
      integrationService.logIntegration(ctx, "finabill.listExpenses", "success", { count: data.length });
      return { data };
    }),

  listSuppliers: apiKeyProcedure
    .meta({ description: "List all suppliers for the authenticated business." })
    .use(requireApiKey("suppliers:read"))
    .query(async ({ ctx }) => {
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        integrationService.logIntegration(ctx, "finabill.listSuppliers", "failed", { error: "No active business" });
        return { data: [] };
      }
      const data = await integrationService.listSuppliers(businessId);
      integrationService.logIntegration(ctx, "finabill.listSuppliers", "success", { count: data.length });
      return { data };
    }),

  listCategories: apiKeyProcedure
    .meta({ description: "List all expense categories for the authenticated business." })
    .use(requireApiKey("categories:read"))
    .query(async ({ ctx }) => {
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        integrationService.logIntegration(ctx, "finabill.listCategories", "failed", { error: "No active business" });
        return { data: [] };
      }
      const data = await integrationService.listCategories(businessId);
      integrationService.logIntegration(ctx, "finabill.listCategories", "success", { count: data.length });
      return { data };
    }),

  upsertCategory: apiKeyProcedure
    .meta({
      description:
        "Create or update an expense category. Match by externalId (FinaBill category id) or name. Income categories are not supported yet.",
    })
    .use(requireApiKey("categories:write"))
    .input(
      z.object({
        externalId: z.string().optional(),
        name: z.string().min(1).max(100),
        categoryType: z.enum(["expense", "income"]).optional().default("expense"),
        defaultAccountId: z.number().int().positive().optional().nullable(),
        description: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        integrationService.logIntegration(ctx, "finabill.upsertCategory", "failed", { error: "No active business" });
        throw new Error("No active business");
      }
      const result = await integrationService.upsertCategory(businessId, input);
      integrationService.logIntegration(ctx, "finabill.upsertCategory", "success", {
        categoryId: result.id,
        created: result.created,
      });
      return result;
    }),

  upsertSupplier: apiKeyProcedure
    .meta({ description: "Create or update a supplier. Match by externalId if provided, otherwise create new." })
    .use(requireApiKey("suppliers:write"))
    .input(
      z.object({
        externalId: z.string().optional(),
        name: z.string().min(1),
        email: z.string().email().optional().nullable(),
        phone: z.string().optional().nullable(),
        taxId: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        integrationService.logIntegration(ctx, "finabill.upsertSupplier", "failed", { error: "No active business" });
        throw new Error("No active business");
      }
      const result = await integrationService.upsertSupplier(businessId, input);
      integrationService.logIntegration(ctx, "finabill.upsertSupplier", "success", { supplierId: result.id, created: result.created });
      return result;
    }),

  getBusinessProfile: apiKeyProcedure
    .meta({ description: "Get the business profile (name, email, phone, address, country, tax ID)." })
    .use(requireApiKey("business:read"))
    .query(async ({ ctx }) => {
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        integrationService.logIntegration(ctx, "finabill.getBusinessProfile", "failed", { error: "No active business" });
        return { data: null };
      }
      const data = await integrationService.getBusinessProfile(businessId);
      integrationService.logIntegration(ctx, "finabill.getBusinessProfile", "success", { found: Boolean(data) });
      return { data };
    }),

  listLocations: apiKeyProcedure
    .meta({ description: "List all locations/branches for the authenticated business." })
    .use(requireApiKey("locations:read"))
    .query(async ({ ctx }) => {
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        integrationService.logIntegration(ctx, "finabill.listLocations", "failed", { error: "No active business" });
        return { data: [] };
      }
      const data = await integrationService.listLocations(businessId);
      integrationService.logIntegration(ctx, "finabill.listLocations", "success", { count: data.length });
      return { data };
    }),

  listUsers: apiKeyProcedure
    .meta({ description: "List all users assigned to the authenticated business, with role and location assignments." })
    .use(requireApiKey("users:read"))
    .query(async ({ ctx }) => {
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        integrationService.logIntegration(ctx, "finabill.listUsers", "failed", { error: "No active business" });
        return { data: [] };
      }
      const data = await integrationService.listUsers(businessId);
      integrationService.logIntegration(ctx, "finabill.listUsers", "success", { count: data.length });
      return { data };
    }),

  listRoleTemplates: apiKeyProcedure
    .meta({ description: "List all active role templates with their permission sets." })
    .use(requireApiKey("users:read"))
    .query(async ({ ctx }) => {
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        integrationService.logIntegration(ctx, "finabill.listRoleTemplates", "failed", { error: "No active business" });
        return { data: [] };
      }
      const data = await integrationService.listRoleTemplates();
      integrationService.logIntegration(ctx, "finabill.listRoleTemplates", "success", { count: data.length });
      return { data };
    }),

  upsertUser: apiKeyProcedure
    .meta({ description: "Create or update a user and assign to the business. Match by externalId if provided." })
    .use(requireApiKey("users:write"))
    .input(
      z.object({
        externalId: z.string().optional(),
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional().nullable(),
        role: z.string().min(1),
        isActive: z.boolean().optional().default(true),
        locationIds: z.array(z.number()).optional().default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const businessId = getBusinessId(ctx);
      if (!businessId) {
        integrationService.logIntegration(ctx, "finabill.upsertUser", "failed", { error: "No active business" });
        throw new Error("No active business");
      }
      const result = await integrationService.upsertUser(businessId, input);
      integrationService.logIntegration(ctx, "finabill.upsertUser", "success", { userId: result.id, created: result.created });
      return result;
    }),
});
