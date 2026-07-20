// ABOUTME: POST /api/v1/webhooks/finabill — incoming webhook handler with HMAC signature verification.
import { Hono } from "hono";
import { Sentry } from "../../instrument";
import { eq, and, isNull } from "drizzle-orm";
import { getDb } from "../../queries/connection";
import { integrationConnections } from "@db/schema";
import type { ApiKeyVariables } from "../../lib/api-key-middleware";
import { successResponse, errorResponse } from "../../lib/api-response";
import { signWebhookPayload, decryptWebhookSecret } from "../../lib/webhook-dispatcher";
import { handleProviderWebhook } from "../../lib/webhook-handlers";
import { handleWalletWebhook } from "../../lib/mobile-wallet/webhook-handler";
import { constantTimeCompare } from "../../lib/crypto";
import { finabillWebhookPayloadSchema } from "../../schemas";

const webhooks = new Hono<{ Variables: ApiKeyVariables }>();

webhooks.post("/finabill", async (c) => {
  try {
    const rawBody = await c.req.text();
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return errorResponse(c, 400, "INVALID_JSON", "Invalid JSON body");
    }

    const parsed = finabillWebhookPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "));
    }

    const { businessId } = parsed.data;

    const db = getDb();
    const [connection] = await db
      .select()
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.businessId, businessId),
          eq(integrationConnections.targetSystem, "finabill"),
          eq(integrationConnections.isActive, true),
          isNull(integrationConnections.deletedAt),
        ),
      )
      .limit(1);

    if (!connection?.webhookSecret) {
      return errorResponse(c, 401, "WEBHOOK_NOT_CONFIGURED", "Webhook secret not configured");
    }

    const secret = decryptWebhookSecret(connection.webhookSecret);
    if (!secret) {
      return errorResponse(c, 401, "INVALID_WEBHOOK_SECRET", "Invalid webhook secret");
    }

    const expectedSignature = signWebhookPayload(rawBody, secret);
    const providedSignature = c.req.header("X-Fina-Signature") ?? "";
    if (!constantTimeCompare(providedSignature, expectedSignature)) {
      return errorResponse(c, 401, "INVALID_SIGNATURE", "Invalid signature");
    }

    const result = await handleProviderWebhook("finabill", parsed.data as Record<string, unknown>);
    return successResponse(c, result.body);
  } catch (err) {
    console.error("[v1/webhooks/finabill] error:", err);
    Sentry.captureException(err);
    return errorResponse(c, 500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Internal server error");
  }
});

/**
 * POST /api/v1/wallet-webhooks/:provider
 * Incoming webhook for mobile wallet providers (mpesa, airtel_money, sasapay).
 * Routes the raw request to the registered provider's processWebhook handler.
 */
webhooks.post("/wallet-webhooks/:provider", async (c) => {
  try {
    const provider = c.req.param("provider");
    const rawBody = await c.req.text();
    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const result = await handleWalletWebhook({
      provider,
      rawBody,
      headers,
      signature: c.req.header("X-Signature") ?? c.req.header("X-Mpesa-Signature") ?? undefined,
    });

    return c.json(JSON.parse(result.body), result.status as 200 | 400 | 404 | 405 | 500);
  } catch (err) {
    console.error("[v1/wallet-webhooks] error:", err);
    Sentry.captureException(err);
    return errorResponse(c, 500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Internal server error");
  }
});

export default webhooks;
