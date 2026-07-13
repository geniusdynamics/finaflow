import { z } from "zod";
import {
  createRouter,
  publicQuery,
  authedQuery,
  apiKeysManage,
  webhooksManage,
  integrationsManage,
  requireAuthOrApiKey,
} from "./middleware";
import { getDb } from "./queries/connection";
import { apiKeys, webhooks, webhookDeliveries, integrationConnections } from "@db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { encryptString, decryptString, looksEncrypted } from "./lib/crypto";
import { generateApiKey, getKeyPrefix, hashApiKey } from "./lib/api-key-auth";
import { env } from "./lib/env";
import { getAdapter, listAdapters } from "./lib/integrations";

function encryptSecret(secret: string | undefined | null): string | null {
  if (!secret) return null;
  return encryptString(secret);
}

function decryptSecret(stored: string | null): string | null {
  if (!stored) return null;
  if (looksEncrypted(stored)) return decryptString(stored);
  // Legacy plaintext fallback
  return stored;
}

function requireBusinessId(ctx: { user?: { currentBusiness?: { id: number } | null; currentBusinessId?: number | null } }): number {
  const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
  if (!businessId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "No active business selected" });
  }
  return businessId;
}

async function getConnectionByTarget(
  db: ReturnType<typeof getDb>,
  businessId: number,
  targetSystem: string
) {
  const [connection] = await db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.businessId, businessId),
        eq(integrationConnections.targetSystem, targetSystem),
        isNull(integrationConnections.deletedAt)
      )
    )
    .limit(1);
  return connection;
}

function getConnectionToken(connection: typeof integrationConnections.$inferSelect | undefined): string | null {
  if (!connection?.authData) return null;
  const authData = connection.authData as Record<string, unknown>;
  const apiKey = authData.apiKey;
  if (typeof apiKey !== "string" || !apiKey) return null;
  if (looksEncrypted(apiKey)) return decryptString(apiKey);
  return apiKey;
}

export const integrationsRouter = createRouter({
  // Public / machine-to-machine health check
  verify: publicQuery
    .use(requireAuthOrApiKey)
    .query(async ({ ctx }) => {
      return {
        ok: true,
        businessId: ctx.user?.currentBusiness?.id ?? ctx.apiKey?.businessId ?? null,
        authMethod: ctx.apiKey ? "api_key" : ctx.user ? "user" : "none",
      };
    }),

  // Adapters / external systems
  listAdapters: integrationsManage.query(async () => {
    return listAdapters().map((adapter) => ({
      targetSystem: adapter.targetSystem,
      name: adapter.name,
      description: adapter.description,
      authMode: adapter.authMode,
      credentialFields: adapter.credentialFields,
      scopes: adapter.scopes,
      features: adapter.features,
    }));
  }),

  status: integrationsManage
    .input(z.object({ targetSystem: z.string().min(1).max(50) }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = requireBusinessId(ctx);
      const connection = await getConnectionByTarget(db, businessId, input.targetSystem);
      const configured = Boolean(connection && (connection.webhookSecret || connection.authData));
      const connected = Boolean(configured && connection?.isActive);
      return {
        configured,
        connected,
        isActive: connection?.isActive ?? false,
        targetSystem: input.targetSystem,
        lastSyncAt: connection?.updatedAt ?? null,
      };
    }),

  getConnection: integrationsManage
    .input(z.object({ targetSystem: z.string().min(1).max(50) }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = requireBusinessId(ctx);
      const connection = await getConnectionByTarget(db, businessId, input.targetSystem);
      if (!connection) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Integration connection not found" });
      }
      return {
        id: connection.id,
        targetSystem: connection.targetSystem,
        authMode: connection.authMode,
        targetUrl: (connection.authData as Record<string, unknown> | null)?.url as string | undefined,
        scopes: connection.authData && typeof connection.authData === "object" && Array.isArray((connection.authData as Record<string, unknown>).scopes)
          ? (connection.authData as Record<string, unknown>).scopes as string[]
          : [],
        isActive: connection.isActive,
        webhookSecret: null, // never return the secret
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt,
      };
    }),

  saveConnection: integrationsManage
    .input(
      z.object({
        targetSystem: z.string().min(1).max(50),
        targetUrl: z.string().url().max(500).optional(),
        apiKey: z.string().max(255).optional(),
        webhookSecret: z.string().max(500).optional(),
        scopes: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = requireBusinessId(ctx);
      const { targetSystem } = input;

      return db.transaction(async (tx) => {
        const existing = await getConnectionByTarget(tx as unknown as ReturnType<typeof getDb>, businessId, targetSystem);

        const authData: Record<string, unknown> = {
          url: input.targetUrl ?? null,
          scopes: input.scopes ?? [],
        };
        if (input.apiKey !== undefined) {
          authData.apiKey = input.apiKey ? encryptString(input.apiKey) : null;
        }

        const values = {
          authMode: "api_key" as const,
          authData,
          webhookSecret: input.webhookSecret ? encryptString(input.webhookSecret) : undefined,
          isActive: true,
          updatedAt: new Date(),
        };

        let connection;
        if (existing) {
          const updateValues: typeof values & { authData?: Record<string, unknown>; webhookSecret?: string | null } = { ...values };
          if (input.apiKey === undefined) {
            const existingAuthData = existing.authData as Record<string, unknown> | null;
            updateValues.authData = { ...authData, apiKey: existingAuthData?.apiKey ?? null };
          }
          if (input.webhookSecret === undefined) {
            delete updateValues.webhookSecret;
          }
          [connection] = await tx
            .update(integrationConnections)
            .set(updateValues)
            .where(eq(integrationConnections.id, existing.id))
            .returning();
        } else {
          [connection] = await tx
            .insert(integrationConnections)
            .values({
              businessId,
              targetSystem,
              ...values,
              webhookSecret: values.webhookSecret ?? null,
              createdAt: new Date(),
            })
            .returning();
        }

        return {
          id: connection.id,
          targetSystem: connection.targetSystem,
          isActive: connection.isActive,
          updatedAt: connection.updatedAt,
        };
      });
    }),

  testConnection: integrationsManage
    .input(z.object({ targetSystem: z.string().min(1).max(50) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = requireBusinessId(ctx);
      const connection = await getConnectionByTarget(db, businessId, input.targetSystem);
      if (!connection) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Integration connection not found" });
      }

      const adapter = getAdapter(input.targetSystem);
      if (!adapter) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `No adapter registered for ${input.targetSystem}` });
      }

      const apiKey = getConnectionToken(connection);
      const testResult = await adapter.testConnection({
        id: connection.id,
        businessId: connection.businessId,
        targetSystem: connection.targetSystem,
        isActive: connection.isActive,
        credentials: {
          url: (connection.authData as Record<string, unknown> | null)?.url as string | null ?? null,
          apiKey,
          authMode: connection.authMode ?? "api_key",
          authData: (connection.authData as Record<string, unknown> | null) ?? {},
          webhookSecret: connection.webhookSecret ? decryptSecret(connection.webhookSecret) : null,
        },
        scopes: (connection.authData as Record<string, unknown> | null)?.scopes as string[] ?? [],
      });

      if (!testResult.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: testResult.error || "Connection test failed" });
      }
      return { success: true, targetSystem: input.targetSystem, message: "Connection test succeeded" };
    }),

  toggleConnection: integrationsManage
    .input(z.object({ targetSystem: z.string().min(1).max(50) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = requireBusinessId(ctx);

      return db.transaction(async (tx) => {
        const connection = await getConnectionByTarget(tx as unknown as ReturnType<typeof getDb>, businessId, input.targetSystem);
        if (!connection) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Integration connection not found" });
        }

        const isActive = !connection.isActive;
        const [updated] = await tx
          .update(integrationConnections)
          .set({ isActive, updatedAt: new Date() })
          .where(eq(integrationConnections.id, connection.id))
          .returning();

        return { success: true, targetSystem: input.targetSystem, isActive: updated.isActive };
      });
    }),

  // API Keys
  listKeys: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
    if (!businessId) return [];
    return db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        isActive: apiKeys.isActive,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.businessId, businessId), isNull(apiKeys.deletedAt)))
      .orderBy(desc(apiKeys.createdAt));
  }),

  createKey: apiKeysManage
    .input(z.object({
      name: z.string().min(1),
      scopes: z.array(z.string()).optional(),
      expiresAt: z.string().datetime().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
      if (!businessId) throw new Error("No active business");
      const rawKey = generateApiKey();
      const prefix = getKeyPrefix(rawKey);
      const keyHash = await hashApiKey(rawKey, env.bcryptRounds);
      const [result] = await db.insert(apiKeys).values({
        businessId,
        name: input.name,
        keyHash,
        keyPrefix: prefix,
        scopes: input.scopes ?? ["read"],
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).returning();
      return { id: result.id, key: rawKey, prefix };
    }),

  revokeKey: apiKeysManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
      if (!businessId) throw new Error("No active business");
      await db
        .update(apiKeys)
        .set({ isActive: false })
        .where(and(eq(apiKeys.id, input.id), eq(apiKeys.businessId, businessId)));
      return { success: true };
    }),

  deleteKey: apiKeysManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
      if (!businessId) throw new Error("No active business");
      await db
        .update(apiKeys)
        .set({ deletedAt: new Date() })
        .where(and(eq(apiKeys.id, input.id), eq(apiKeys.businessId, businessId)));
      return { success: true };
    }),

  // Webhooks
  listWebhooks: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
    if (!businessId) return [];
    return db
      .select({
        id: webhooks.id,
        name: webhooks.name,
        url: webhooks.url,
        events: webhooks.events,
        isActive: webhooks.isActive,
        lastTriggeredAt: webhooks.lastTriggeredAt,
        lastStatus: webhooks.lastStatus,
        createdAt: webhooks.createdAt,
      })
      .from(webhooks)
      .where(and(eq(webhooks.businessId, businessId), isNull(webhooks.deletedAt)))
      .orderBy(desc(webhooks.createdAt));
  }),

  createWebhook: webhooksManage
    .input(z.object({
      name: z.string().min(1),
      url: z.string().url(),
      events: z.array(z.enum(["bill.overdue", "bill.paid", "sale.recorded", "expense.created", "payroll.processed", "low.balance"])),
      secret: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
      if (!businessId) throw new Error("No active business");
      const [result] = await db.insert(webhooks).values({
        businessId,
        name: input.name,
        url: input.url,
        events: input.events,
        secret: encryptSecret(input.secret),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).returning();
      return { id: result.id };
    }),

  updateWebhook: webhooksManage
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      url: z.string().url().optional(),
      events: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
      secret: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
      if (!businessId) throw new Error("No active business");
      const { id, ...updates } = input;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const setValues: any = { ...updates };
      if (input.secret !== undefined) {
        setValues.secret = encryptSecret(input.secret);
      }
      await db
        .update(webhooks)
        .set(setValues)
        .where(and(eq(webhooks.id, id), eq(webhooks.businessId, businessId)));
      return { success: true };
    }),

  deleteWebhook: webhooksManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
      if (!businessId) throw new Error("No active business");
      await db
        .update(webhooks)
        .set({ deletedAt: new Date() })
        .where(and(eq(webhooks.id, input.id), eq(webhooks.businessId, businessId)));
      return { success: true };
    }),

  // Webhook delivery log
  listDeliveries: webhooksManage
    .input(z.object({ webhookId: z.number(), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, input.webhookId))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(input.limit);
    }),
});
