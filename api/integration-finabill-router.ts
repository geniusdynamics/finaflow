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
