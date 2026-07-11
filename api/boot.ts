// ABOUTME: Hono server bootstrap that wires up CORS, security, rate limiting, CSRF, and tRPC request handling.
// ABOUTME: Also schedules background jobs (trial lifecycle) and handles graceful shutdown.
import "./instrument";
import { Sentry } from "./instrument";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { securityHeaders } from "./lib/security-headers";
import { csrfProtection } from "./lib/csrf";
import { apiLimiter, loginLimiter, lookupAccountLimiter } from "./lib/rate-limit";
import { getDb, closePool } from "./queries/connection";
import { sql, eq, and, isNull } from "drizzle-orm";
import { processTrialLifecycle, TRIAL_JOB_INTERVAL_MS } from "./lib/subscriptions";
import { shouldStartStandaloneServer } from "./lib/server-runtime";
import { walletRegistry } from "./lib/mobile-wallet/provider-registry";
import { mpesaProvider } from "./lib/mobile-wallet/providers/mpesa-provider";
import { airtelMoneyProvider } from "./lib/mobile-wallet/providers/airtel-money-provider";
import { SasapayProvider } from "./lib/mobile-wallet/providers/sasapay-provider";
import { startExchangeRateSync, validateEnvConfig } from "./lib/exchange-rate-sync";
import { seedSupportedCurrencies, seedDefaultExchangeRates } from "./lib/seed-currencies";
import { seedWalletProviders } from "./lib/seed-wallet-providers";
import { resolveApiKeyMiddleware, type ApiKeyVariables } from "./lib/api-key-middleware";
import { ingestDailySales } from "./lib/daily-sales-ingestion";
import {
  signWebhookPayload,
  decryptWebhookSecret,
} from "./lib/webhook-dispatcher";
import { handleProviderWebhook, type FinabillWebhookPayload } from "./lib/webhook-handlers";
import { integrationConnections } from "@db/schema";
import crypto from "crypto";
import {
  partnerApproveSession,
  completeReverseConnection,
  getConnectSessionPublic,
  resolvePairingCodeOnInitiator,
} from "./lib/integrations/connect-service";
// import { ensureDatabaseReady } from "./lib/db-startup";

// await ensureDatabaseReady(env.databaseUrl);

const app = new Hono<{ Bindings: HttpBindings; Variables: ApiKeyVariables }>();

function resolveCorsOrigin(origin: string | undefined): string | undefined {
  if (!origin) return env.appUrl;
  if (origin === env.appUrl) return origin;
  if (env.finabillAppUrl && origin === env.finabillAppUrl.replace(/\/$/, "")) return origin;

  try {
    const url = new URL(origin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return origin;
    if (url.hostname === "finaflow.localhost" || url.hostname.endsWith(".finaflow.localhost"))
      return origin;
    if (url.hostname.endsWith(".localhost")) return origin;
    return undefined;
  } catch {
    return undefined;
  }
}

app.use("*", cors({ origin: resolveCorsOrigin, credentials: true }));
app.use("*", securityHeaders);
app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

app.get("/health", async (c) => {
  try {
    await getDb().execute(sql`SELECT 1`);
    return c.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (e) {
    return c.json({ status: "unhealthy", error: String(e) }, 503);
  }
});

app.get("/debug-sentry", () => {
  throw new Error("Sentry backend test error!");
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function trpcRateLimiter(c: any, next: any) {
  if (c.req.method === "POST" && c.req.path.startsWith("/api/trpc")) {
    try {
      const body = await c.req.raw
        .clone()
        .json()
        .catch(() => null);
      if (body && typeof body === "object") {
        const paths = new Set<string>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const walk = (obj: any) => {
          if (!obj || typeof obj !== "object") return;
          if (obj.path && typeof obj.path === "string") paths.add(obj.path);
          for (const v of Object.values(obj)) {
            if (v && typeof v === "object") walk(v);
          }
        };
        walk(body);
        if (paths.has("localAuth.login") || paths.has("localAuth.register")) {
          return loginLimiter(c, next);
        }
        if (paths.has("localAuth.lookupAccount")) {
          return lookupAccountLimiter(c, next);
        }
      }
    } catch {
      // body parse failed, fall through to general limiter
    }
  }
  return next();
}

app.use("/*", csrfProtection);
app.use("/api/trpc/*", trpcRateLimiter, apiLimiter);

// Fina Connect machine-to-machine endpoints (CSRF-exempt via csrf.ts)
app.post("/api/connect/partner-approve", async (c) => {
  try {
    const body = await c.req.json();
    const result = await partnerApproveSession({
      sessionPublicId: String(body.sessionPublicId ?? ""),
      state: String(body.state ?? ""),
      partnerBusinessId: Number(body.partnerBusinessId),
      partnerApiUrl: String(body.partnerApiUrl ?? ""),
      partnerAppUrl: String(body.partnerAppUrl ?? ""),
      partnerApiKey: String(body.partnerApiKey ?? ""),
      webhookSecret: String(body.webhookSecret ?? ""),
      scopes: Array.isArray(body.scopes) ? body.scopes : undefined,
      approvedByUserId: body.approvedByUserId ? Number(body.approvedByUserId) : undefined,
    });
    return c.json(result);
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Partner approve failed" },
      400
    );
  }
});

app.post("/api/connect/complete", async (c) => {
  try {
    const body = await c.req.json();
    const partnerBusinessId = Number(body.partnerBusinessId);
    if (!Number.isFinite(partnerBusinessId) || partnerBusinessId <= 0) {
      return c.json({ error: "partnerBusinessId required" }, 400);
    }
    const result = await completeReverseConnection({
      partnerBusinessId,
      initiatorSystem: String(body.initiatorSystem ?? "finabill"),
      initiatorApiUrl: String(body.initiatorApiUrl ?? ""),
      initiatorApiKey: String(body.initiatorApiKey ?? ""),
      webhookSecret: String(body.webhookSecret ?? ""),
      scopes: Array.isArray(body.scopes) ? body.scopes : undefined,
    });
    return c.json(result);
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Complete failed" },
      400
    );
  }
});

app.get("/api/connect/sessions/:sessionPublicId", async (c) => {
  const session = await getConnectSessionPublic(c.req.param("sessionPublicId"));
  if (!session) return c.json({ error: "Not found" }, 404);
  return c.json(session);
});

app.post("/api/connect/resolve-pairing", async (c) => {
  try {
    const body = await c.req.json();
    const pairingCode = String(body.pairingCode ?? "").trim().toUpperCase();
    if (!pairingCode) return c.json({ error: "pairingCode required" }, 400);
    const session = await resolvePairingCodeOnInitiator(pairingCode);
    if (!session) return c.json({ error: "Invalid or expired pairing code" }, 404);
    return c.json(session);
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Resolve failed" },
      400
    );
  }
});

app.post("/api/integration/daily-sales", resolveApiKeyMiddleware("sales:write"), async (c) => {
  try {
    const apiKey = c.get("apiKey");

    const body = await c.req.json();
    if (body.locationId == null || Number.isNaN(Number(body.locationId))) {
      return c.json({ error: "locationId is required" }, 400);
    }
    if (!body.sourceBatchId || typeof body.sourceBatchId !== "string") {
      return c.json({ error: "sourceBatchId is required" }, 400);
    }
    const result = await ingestDailySales({
      businessId: apiKey.businessId,
      locationId: Number(body.locationId),
      saleDate: body.saleDate,
      sourceSystem: body.sourceSystem ?? "finabill",
      sourceBatchId: body.sourceBatchId,
      payments: body.payments ?? [],
      discountAmount: body.discountAmount,
      voidAmount: body.voidAmount,
      unpaidAmount: body.unpaidAmount,
      ticketCount: body.ticketCount,
      orderCount: body.orderCount,
      notes: body.notes,
    });

    if (!result.success) {
      return c.json({ error: result.error, warnings: result.warnings }, 400);
    }

    const status = result.warnings.length > 0 ? 202 : 200;
    return c.json(
      {
        success: true,
        dailySaleId: result.dailySaleId,
        netSales: result.netSales,
        warnings: result.warnings,
        created: result.created,
      },
      status
    );
  } catch (err) {
    console.error("[daily-sales-ingestion] error:", err);
    Sentry.captureException(err);
    return c.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      500
    );
  }
});

app.use("/api/trpc/*", async (c) => {
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;
  console.log(`→ ${method} ${path}`);
  try {
    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: c.req.raw,
      router: appRouter,
      createContext,
    });
    console.log(`← ${method} ${path} ${response.status}`);
    return response;
  } catch (err) {
    console.error(`✗ ${method} ${path}`, err);
    Sentry.withScope((scope) => {
      scope.setExtra("method", method);
      scope.setExtra("path", path);
      scope.setExtra("status", 500);
      Sentry.captureException(err);
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

app.post("/api/webhooks/finabill", async (c) => {
  try {
    const rawBody = await c.req.text();
    let payload: FinabillWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const businessId =
      typeof payload.businessId === "number" ? payload.businessId : null;
    if (!businessId) {
      return c.json({ error: "Missing businessId" }, 400);
    }

    const db = getDb();
    const [connection] = await db
      .select()
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.businessId, businessId),
          eq(integrationConnections.targetSystem, "finabill"),
          eq(integrationConnections.isActive, true),
          isNull(integrationConnections.deletedAt)
        )
      )
      .limit(1);

    if (!connection?.webhookSecret) {
      return c.json({ error: "Webhook secret not configured" }, 401);
    }

    const secret = decryptWebhookSecret(connection.webhookSecret);
    if (!secret) {
      return c.json({ error: "Invalid webhook secret" }, 401);
    }

    const expectedSignature = signWebhookPayload(rawBody, secret);
    const providedSignature = c.req.header("X-Fina-Signature") ?? "";
    if (!constantTimeCompare(providedSignature, expectedSignature)) {
      return c.json({ error: "Invalid signature" }, 401);
    }

    const result = await handleProviderWebhook("finabill", payload as Record<string, unknown>);
    return c.json(result.body, result.status as 200 | 400 | 500);
  } catch (err) {
    console.error("[webhooks/finabill] error:", err);
    Sentry.captureException(err);
    return c.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      500
    );
  }
});

app.post("/api/webhooks/:provider", async (c) => {
  const provider = c.req.param("provider");
  if (provider === "finabill") {
    return c.json({ error: "Use /api/webhooks/finabill" }, 404);
  }
  const result = await handleProviderWebhook(provider, {});
  return c.json(result.body, result.status as 200 | 501);
});

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

const { serve } = await import("@hono/node-server");
const { serveStaticFiles } = await import("./lib/vite");
serveStaticFiles(app as never);

async function runTrialLifecycleJob() {
  try {
    const result = await processTrialLifecycle(getDb());
    if (result.remindersSent || result.downgraded || result.activated) {
      console.log("[subscriptions] trial lifecycle processed", result);
    }
  } catch (error) {
    console.error("[subscriptions] trial lifecycle job failed", error);
    Sentry.captureException(error);
  }
}

const runStandaloneServer = shouldStartStandaloneServer({
  DEV: process.env.NODE_ENV === "development",
});

let trialLifecycleTimer: NodeJS.Timeout | null = null;
if (runStandaloneServer) {
  trialLifecycleTimer = setInterval(() => {
    void runTrialLifecycleJob();
  }, TRIAL_JOB_INTERVAL_MS);
  trialLifecycleTimer.unref();
  void runTrialLifecycleJob();
}

// ── Startup initialization ──────────────────────────────────────────

walletRegistry.register(mpesaProvider);
walletRegistry.register(airtelMoneyProvider);

const sasapayProvider = new SasapayProvider({
  apiKey: process.env.SASAPAY_API_KEY ?? "",
  apiSecret: process.env.SASAPAY_API_SECRET ?? "",
  merchantCode: process.env.SASAPAY_MERCHANT_CODE ?? "",
  callbackUrl: process.env.SASAPAY_CALLBACK_URL ?? "",
});
walletRegistry.register(sasapayProvider);

if (process.env.SASAPAY_API_KEY && process.env.SASAPAY_API_SECRET) {
  console.log("[boot] Sasapay provider registered with API credentials");
} else {
  console.log("[boot] Sasapay provider registered (API credentials not configured — set SASAPAY_API_KEY and SASAPAY_API_SECRET to enable live transactions)");
}

console.log("[boot] Registered wallet providers:", walletRegistry.getAll().map((p) => p.code).join(", "));

validateEnvConfig();

if (process.env.EXCHANGE_RATE_PROVIDER && process.env.EXCHANGE_RATE_PROVIDER !== "manual") {
  const syncTimer = startExchangeRateSync();
  syncTimer.unref();
}

seedSupportedCurrencies().catch((err) => {
  console.error("[boot] Failed to seed supported currencies:", err);
  Sentry.captureException(err);
});
seedWalletProviders().catch((err) => {
  console.error("[boot] Failed to seed wallet providers:", err);
  Sentry.captureException(err);
});
seedDefaultExchangeRates().catch((err) => {
  console.error("[boot] Failed to seed exchange rates:", err);
  Sentry.captureException(err);
});

const port = parseInt(process.env.PORT || "3200");
const server = runStandaloneServer
  ? serve({ fetch: app.fetch, port }, () => {
      console.log(`Server running on http://localhost:${port}/`);
    })
  : null;

const shutdown = async (signal: string) => {
  console.log(`Received ${signal}, shutting down gracefully...`);

  if (trialLifecycleTimer) {
    clearInterval(trialLifecycleTimer);
  }

  if (!server) {
    await closePool();
    process.exit(0);
  }

  server.close(async () => {
    await closePool();
    console.log("Server shut down");
    process.exit(0);
  });
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
