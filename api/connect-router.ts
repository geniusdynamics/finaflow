// ABOUTME: tRPC router for first-party Fina Connect (session create, approve, exchange, pair).
// ABOUTME: UI uses these endpoints; machine-to-machine complete/partner-approve use REST in boot.ts.
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, integrationsManage, publicQuery } from "./middleware";
import {
  createConnectSession,
  getConnectSessionStatus,
  getConnectSessionPublic,
  exchangeConnectSession,
  approveAsPartner,
  resolvePairingCodeOnInitiator,
  listBusinessConnectionStates,
} from "./lib/integrations/connect-service";
import { DEFAULT_CONNECT_SCOPES } from "./lib/api-scopes";
import { env } from "./lib/env";

function requireBusinessId(ctx: {
  user?: { currentBusiness?: { id: number } | null; currentBusinessId?: number | null };
}): number {
  const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
  if (!businessId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "No current business selected" });
  }
  return businessId;
}

export const connectRouter = createRouter({
  siblingUrls: integrationsManage.query(async () => {
    return {
      partnerSystem: "finabill" as const,
      partnerAppUrl: env.finabillAppUrl,
      partnerApiUrl: env.finabillApiUrl,
      defaultScopes: [...DEFAULT_CONNECT_SCOPES],
    };
  }),

  createSession: integrationsManage
    .input(
      z
        .object({
          scopes: z.array(z.string()).optional(),
          mode: z.enum(["redirect", "pairing"]).optional(),
        })
        .optional()
    )
    .mutation(async ({ input, ctx }) => {
      const businessId = requireBusinessId(ctx);
      return createConnectSession({
        businessId,
        userId: ctx.user!.id,
        scopes: input?.scopes,
      });
    }),

  sessionStatus: integrationsManage
    .input(z.object({ sessionPublicId: z.string().min(8) }))
    .query(async ({ input, ctx }) => {
      const businessId = requireBusinessId(ctx);
      const status = await getConnectSessionStatus(input.sessionPublicId, businessId);
      if (!status) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connect session not found" });
      }
      return status;
    }),

  exchange: integrationsManage
    .input(
      z.object({
        sessionPublicId: z.string().min(8),
        authorizationCode: z.string().min(8),
        codeVerifier: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const businessId = requireBusinessId(ctx);
      try {
        return await exchangeConnectSession({
          sessionPublicId: input.sessionPublicId,
          authorizationCode: input.authorizationCode,
          codeVerifier: input.codeVerifier,
          businessId,
          userId: ctx.user!.id,
        });
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "Exchange failed",
        });
      }
    }),

  approveAsPartner: integrationsManage
    .input(
      z.object({
        initiatorApiUrl: z.string().url(),
        sessionPublicId: z.string().min(8),
        state: z.string().min(8),
        scopes: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const businessId = requireBusinessId(ctx);
      try {
        return await approveAsPartner({
          initiatorApiUrl: input.initiatorApiUrl,
          sessionPublicId: input.sessionPublicId,
          state: input.state,
          businessId,
          userId: ctx.user!.id,
          scopes: input.scopes,
        });
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "Approve failed",
        });
      }
    }),

  resolvePairingCode: publicQuery
    .input(z.object({ pairingCode: z.string().min(8) }))
    .query(async ({ input }) => {
      const session = await resolvePairingCodeOnInitiator(input.pairingCode.trim().toUpperCase());
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired pairing code" });
      }
      return session;
    }),

  lookupSession: publicQuery
    .input(z.object({ sessionPublicId: z.string().min(8) }))
    .query(async ({ input }) => {
      const session = await getConnectSessionPublic(input.sessionPublicId);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connect session not found" });
      }
      return session;
    }),

  listBusinessConnectionStates: integrationsManage
    .input(z.object({ targetSystem: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      return listBusinessConnectionStates({ userId: ctx.user!.id, targetSystem: input.targetSystem });
    }),
});
