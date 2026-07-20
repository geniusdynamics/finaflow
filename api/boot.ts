// ABOUTME: Hono server bootstrap that wires up CORS, security, rate limiting, CSRF, and tRPC request handling.
// ABOUTME: Also schedules background jobs (trial lifecycle) and handles graceful shutdown.
import "./instrument";
import { Sentry } from "./instrument";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { readFileSync } from "fs";
import { resolve } from "path";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { securityHeaders } from "./lib/security-headers";
import { csrfProtection } from "./lib/csrf";
import { apiLimiter, loginLimiter, lookupAccountLimiter, connectLimiter } from "./lib/rate-limit";
import { getDb, closePool } from "./queries/connection";
import { sql } from "drizzle-orm";
import { processTrialLifecycle, TRIAL_JOB_INTERVAL_MS } from "./lib/subscriptions";
import { shouldStartStandaloneServer } from "./lib/server-runtime";
import { walletRegistry } from "./lib/mobile-wallet/provider-registry";
import { mpesaProvider } from "./lib/mobile-wallet/providers/mpesa-provider";
import { airtelMoneyProvider } from "./lib/mobile-wallet/providers/airtel-money-provider";
import { SasapayProvider } from "./lib/mobile-wallet/providers/sasapay-provider";
import { startExchangeRateSync, validateEnvConfig } from "./lib/exchange-rate-sync";
import { seedSupportedCurrencies, seedDefaultExchangeRates } from "./lib/seed-currencies";
import { seedWalletProviders } from "./lib/seed-wallet-providers";
import { type ApiKeyVariables } from "./lib/api-key-middleware";
import { handleProviderWebhook } from "./lib/webhook-handlers";
import {
  partnerApproveSession,
  completeReverseConnection,
  getConnectSessionPublic,
  resolvePairingCodeOnInitiator,
} from "./lib/integrations/connect-service";
import v1 from "./routes/v1";
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

// ── API Documentation ─────────────────────────────────────────────
app.get("/openapi.yaml", (c) => {
  try {
    const specPath = resolve(process.cwd(), "docs/api-reference/openapi.yaml");
    const spec = readFileSync(specPath, "utf-8");
    return c.text(spec, 200, { "Content-Type": "text/yaml" });
  } catch {
    return c.text("OpenAPI spec not found", 404);
  }
});

// Documentation hub — human-facing landing page
const docsHeader = `<nav style="position:sticky;top:0;z-index:50;background:#fff;border-bottom:1px solid #E8E0D8;padding:0 24px">
  <div style="max-width:960px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;height:56px">
    <div style="display:flex;align-items:center;gap:24px">
      <a href="/" style="font-family:Georgia,serif;font-size:18px;font-weight:700;color:#2D2A26;text-decoration:none">FinaFlow</a>
      <div style="display:flex;gap:16px;font-size:14px">
        <a href="/docs" style="color:#8D8A87;text-decoration:none;transition:color .15s">Docs</a>
        <a href="/docs/api" style="color:#8D8A87;text-decoration:none;transition:color .15s">API</a>
      </div>
    </div>
    <div id="nav-auth">
      <a href="/dashboard" style="font-size:14px;color:#C73E1D;text-decoration:none;font-weight:500">Dashboard &rarr;</a>
    </div>
  </div>
</nav>`;

app.get("/docs", (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FinaFlow Documentation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #FAF9F7; color: #2D2A26; line-height: 1.6; }
    .container { max-width: 720px; margin: 0 auto; padding: 48px 24px; }
    h1 { font-family: Georgia, serif; font-size: 28px; margin-bottom: 8px; }
    .subtitle { color: #8D8A87; font-size: 15px; margin-bottom: 40px; }
    .cards { display: flex; flex-direction: column; gap: 16px; }
    .card { background: #fff; border: 1px solid #E8E0D8; border-radius: 12px; padding: 24px; transition: box-shadow 0.15s; }
    .card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
    .card h2 { font-family: Georgia, serif; font-size: 18px; margin-bottom: 6px; }
    .card h2 a { color: #2D2A26; text-decoration: none; }
    .card h2 a:hover { color: #C73E1D; }
    .card p { color: #8D8A87; font-size: 14px; margin-bottom: 12px; }
    .card .link { display: inline-flex; align-items: center; gap: 4px; color: #C73E1D; font-size: 13px; font-weight: 500; text-decoration: none; }
    .card .link:hover { text-decoration: underline; }
    .badge { display: inline-block; background: #C73E1D; color: #fff; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 99px; margin-left: 8px; vertical-align: middle; }
    footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #E8E0D8; color: #8D8A87; font-size: 13px; }
  </style>
</head>
<body>
  ${docsHeader}
  <div class="container">
    <h1>FinaFlow Documentation</h1>
    <p class="subtitle">Guides and references for using FinaFlow and its integrations.</p>
    <div class="cards">
      <div class="card">
        <h2><a href="/docs/api">API Reference</a> <span class="badge">Interactive</span></h2>
        <p>Complete REST API documentation with live request builder. Covers all v1 endpoints, authentication, scopes, webhooks, and error codes.</p>
        <a href="/docs/api" class="link">Open API Reference &rarr;</a>
      </div>
      <div class="card">
        <h2><a href="/docs/authentication">Authentication</a></h2>
        <p>How API keys work, the scope model, cookie vs Bearer auth, rate limits, and error response format.</p>
        <a href="/docs/authentication" class="link">Read guide &rarr;</a>
      </div>
      <div class="card">
        <h2><a href="/docs/webhooks">Webhooks</a></h2>
        <p>Incoming and outgoing webhook contract: event catalog, HMAC signature verification, retry policy, and payload schemas.</p>
        <a href="/docs/webhooks" class="link">Read guide &rarr;</a>
      </div>
    </div>
    <footer>
      <p>FinaFlow &mdash; Financial management for multi-location businesses.</p>
    </footer>
  </div>
</body>
</html>`);
});

// Serve markdown docs as styled HTML pages
function renderDocPage(title: string, filename: string): string {
  try {
    const md = readFileSync(resolve(process.cwd(), `docs/${filename}`), "utf-8");
    // Simple markdown → HTML: handle headings, bold, code, tables, lists, paragraphs
    const html = md
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/^\| (.+)$/gm, (match) => {
        const cells = match.split('|').filter(c => c.trim());
        return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
      })
      .replace(/^(- .+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
      .replace(/(<tr>.*<\/tr>\n?)+/g, (match) => `<table>${match}</table>`)
      .replace(/^(?!<[hutlol])(.+)$/gm, '<p>$1</p>')
      .replace(/<p><\/p>/g, '')
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

    return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} — FinaFlow</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#FAF9F7;color:#2D2A26;line-height:1.7}
.container{max-width:720px;margin:0 auto;padding:48px 24px}
.breadcrumb{font-size:13px;color:#8D8A87;margin-bottom:24px}
.breadcrumb a{color:#C73E1D;text-decoration:none}
.breadcrumb a:hover{text-decoration:underline}
h1{font-family:Georgia,serif;font-size:28px;margin-bottom:24px}
h2{font-family:Georgia,serif;font-size:20px;margin-top:32px;margin-bottom:12px;color:#2D2A26}
h3{font-size:16px;margin-top:24px;margin-bottom:8px}
p{margin-bottom:12px;font-size:14px}
code{background:#F0ECE6;padding:2px 6px;border-radius:4px;font-size:13px;font-family:'SF Mono',Consolas,monospace}
pre{background:#2D2A26;color:#FAF9F7;padding:16px;border-radius:8px;overflow-x:auto;margin-bottom:16px}
pre code{background:none;color:inherit;padding:0}
table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:14px}
td{padding:8px 12px;border-bottom:1px solid #E8E0D8;text-align:left}
tr:first-child td{font-weight:600;border-bottom:2px solid #E8E0D8}
ul{margin:0 0 16px 20px;font-size:14px}
li{margin-bottom:4px}
a{color:#C73E1D}
strong{font-weight:600}
footer{margin-top:48px;padding-top:24px;border-top:1px solid #E8E0D8;color:#8D8A87;font-size:13px}
</style></head><body>
${docsHeader}
<div class="container">
<div class="breadcrumb"><a href="/docs">&larr; Documentation</a></div>
${html}
<footer><a href="/docs">&larr; Back to Documentation</a></footer>
</div></body></html>`;
  } catch {
    return `<!DOCTYPE html><html><body><h1>${title}</h1><p>Documentation file not found.</p></body></html>`;
  }
}

app.get("/docs/authentication", (c) => {
  return c.html(renderDocPage("Authentication", "authentication.md"));
});

app.get("/docs/webhooks", (c) => {
  return c.html(renderDocPage("Webhooks", "webhooks.md"));
});

// Scalar docs need CDN scripts — relax CSP for this route only
app.use("/docs/api", async (c, next) => {
  await next();
  c.res.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: blob: https://cdn.jsdelivr.net; font-src 'self' data: https://cdn.jsdelivr.net; connect-src 'self' https: https://cdn.jsdelivr.net;",
  );
});

const scalarConfig = JSON.stringify({
  spec: { url: "/openapi.yaml" },
  theme: "kepler",
  layout: "modern",
  pageTitle: "FinaFlow API Reference",
});

app.get("/docs/api", (c) => {
  return c.html(`<!doctype html>
<html>
  <head>
    <title>FinaFlow API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin: 0; padding: 0; }
    </style>
  </head>
  <body>
    <nav style="background:#fff;border-bottom:1px solid #E8E0D8;padding:0 24px;height:48px;display:flex;align-items:center">
      <div style="max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;width:100%">
        <div style="display:flex;align-items:center;gap:24px">
          <a href="/" style="font-family:Georgia,serif;font-size:16px;font-weight:700;color:#2D2A26;text-decoration:none">FinaFlow</a>
          <div style="display:flex;gap:14px;font-size:13px">
            <a href="/docs" style="color:#8D8A87;text-decoration:none">Docs</a>
            <a href="/docs/api" style="color:#C73E1D;text-decoration:none;font-weight:500">API</a>
          </div>
        </div>
        <div>
          <a href="/dashboard" style="font-size:13px;color:#C73E1D;text-decoration:none;font-weight:500">Dashboard &rarr;</a>
        </div>
      </div>
    </nav>
    <script id="api-reference" data-configuration='${scalarConfig.replace(/'/g, "&#39;")}' src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`);
});

if (process.env.NODE_ENV !== "production") {
  app.get("/debug-sentry", () => {
    throw new Error("Sentry backend test error!");
  });
}

async function trpcRateLimiter(c: any, next: any) {
  if (c.req.method === "POST" && c.req.path.startsWith("/api/trpc")) {
    try {
      const body = await c.req.raw
        .clone()
        .json()
        .catch(() => null);
      if (body && typeof body === "object") {
        const paths = new Set<string>();
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
app.post("/api/connect/partner-approve", connectLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const result = await partnerApproveSession({
      sessionPublicId: String(body.sessionPublicId ?? ""),
      state: String(body.state ?? ""),
      partnerBusinessId: Number(body.partnerBusinessId),
      partnerBusinessName: body.partnerBusinessName ? String(body.partnerBusinessName) : undefined,
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

app.post("/api/connect/complete", connectLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const businessId = Number(body.partnerBusinessId);
    if (!Number.isFinite(businessId) || businessId <= 0) {
      return c.json({ error: "partnerBusinessId required" }, 400);
    }
    const targetBusinessId = body.initiatorBusinessId ? Number(body.initiatorBusinessId) : null;
    const result = await completeReverseConnection({
      businessId,
      targetSystem: String(body.initiatorSystem ?? "finabill"),
      targetUrl: String(body.initiatorApiUrl ?? ""),
      apiKey: String(body.initiatorApiKey ?? ""),
      webhookSecret: String(body.webhookSecret ?? ""),
      scopes: Array.isArray(body.scopes) ? body.scopes : undefined,
      targetBusinessId: targetBusinessId && Number.isFinite(targetBusinessId) ? targetBusinessId : null,
      targetBusinessName: body.initiatorBusinessName ? String(body.initiatorBusinessName) : null,
    });
    return c.json(result);
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Complete failed" },
      400
    );
  }
});

app.get("/api/connect/sessions/:sessionPublicId", connectLimiter, async (c) => {
  const session = await getConnectSessionPublic(c.req.param("sessionPublicId"));
  if (!session) return c.json({ error: "Not found" }, 404);
  return c.json(session);
});

app.post("/api/connect/resolve-pairing", connectLimiter, async (c) => {
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

// ── External REST API v1 ──────────────────────────────────────────
app.route("/api/v1", v1);

// Backward-compat: redirect old daily-sales path to v1
app.post("/api/integration/daily-sales", (c) => {
  c.header("Deprecation", "true");
  c.header("X-API-Deprecation-Notice", "Use POST /api/v1/daily-sales instead");
  return c.redirect("/api/v1/daily-sales", 307);
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

// Backward-compat: redirect old FinaBill webhook to v1
app.post("/api/webhooks/finabill", (c) => {
  c.header("Deprecation", "true");
  c.header("X-API-Deprecation-Notice", "Use POST /api/v1/webhooks/finabill instead");
  return c.redirect("/api/v1/webhooks/finabill", 307);
});

app.post("/api/webhooks/:provider", async (c) => {
  const provider = c.req.param("provider");
  if (provider === "finabill") {
    return c.json({ error: "Use /api/v1/webhooks/finabill" }, 404);
  }
  const body = await c.req.json().catch(() => ({}));
  const result = await handleProviderWebhook(provider, body);
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
