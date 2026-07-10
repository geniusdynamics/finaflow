// ABOUTME: Dispatches outgoing webhooks to subscriber URLs for a business/event.
// ABOUTME: Signs payloads with HMAC-SHA256, retries failed deliveries with exponential
// backoff, and persists every attempt to webhookDeliveries.
import crypto from "crypto";
import { eq, and, isNull } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { webhooks, webhookDeliveries, type Webhook } from "@db/schema";
import { decryptString, looksEncrypted } from "./crypto";

const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 10_000;

export function signWebhookPayload(payload: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload, "utf8");
  return `sha256=${hmac.digest("hex")}`;
}

export function decryptWebhookSecret(stored: string | null): string | null {
  if (!stored) return null;
  if (looksEncrypted(stored)) return decryptString(stored);
  return stored;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function webhookSubscribesToEvent(webhook: Webhook, event: string): boolean {
  const events = Array.isArray(webhook.events) ? webhook.events : [];
  return events.includes(event);
}

async function recordDelivery(
  webhookId: number,
  event: string,
  payload: Record<string, unknown>,
  statusCode: number | null,
  response: string,
  status: string
): Promise<void> {
  const db = getDb();
  try {
    await db.insert(webhookDeliveries).values({
      webhookId,
      event,
      payload,
      status,
      statusCode: statusCode ?? undefined,
      response,
    } as any);
  } catch (err) {
    console.error("[webhook-dispatcher] failed to record delivery:", err);
  }
}

async function deliverToWebhook(
  webhook: Webhook,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const db = getDb();
  const secret = decryptWebhookSecret(webhook.secret);
  const envelope = {
    event,
    timestamp: new Date().toISOString(),
    data: payload,
  };
  const body = JSON.stringify(envelope);
  const signature = secret ? signWebhookPayload(body, secret) : undefined;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(signature ? { "X-Fina-Signature": signature } : {}),
  };

  let finalStatus: "success" | "failed" = "failed";
  let lastError: string | null = null;
  let lastStatusCode: number | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      lastStatusCode = response.status;
      const responseText = await response.text().catch(() => "");
      const deliveryStatus = response.ok ? "success" : `failed`;
      await recordDelivery(
        webhook.id,
        event,
        payload,
        response.status,
        responseText,
        deliveryStatus
      );

      if (response.ok) {
        finalStatus = "success";
        lastError = null;
        break;
      }

      lastError = `HTTP ${response.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      lastStatusCode = null;
      await recordDelivery(webhook.id, event, payload, null, lastError, "error");
    }

    if (attempt < MAX_ATTEMPTS - 1) {
      await sleep(1000 * Math.pow(2, attempt));
    }
  }

  try {
    await db
      .update(webhooks)
      .set({
        lastTriggeredAt: new Date(),
        lastStatus: finalStatus === "success" ? "success" : lastError ?? "failed",
      })
      .where(eq(webhooks.id, webhook.id));
  } catch (err) {
    console.error("[webhook-dispatcher] failed to update webhook status:", err);
  }
}

/**
 * Dispatches an event to all active webhooks registered for the business that
 * subscribe to the event. Failed deliveries are retried up to 3 times with
 * exponential backoff. Every attempt is recorded in webhookDeliveries.
 */
export async function dispatchWebhook(
  businessId: number,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.businessId, businessId), eq(webhooks.isActive, true), isNull(webhooks.deletedAt)));

  const interested = rows.filter((webhook) => webhookSubscribesToEvent(webhook, event));
  if (interested.length === 0) return;

  await Promise.all(interested.map((webhook) => deliverToWebhook(webhook, event, payload)));
}
