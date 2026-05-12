// ABOUTME: Hono server bootstrap that wires up CORS, security, rate limiting, CSRF, and tRPC request handling.
// ABOUTME: Also schedules background jobs (trial lifecycle) and handles graceful shutdown.
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
import { apiLimiter, loginLimiter } from "./lib/rate-limit";
import { getDb, closePool } from "./queries/connection";
import { sql } from "drizzle-orm";
import { processTrialLifecycle, TRIAL_JOB_INTERVAL_MS } from "./lib/subscriptions";
import { shouldStartStandaloneServer } from "./lib/server-runtime";

const app = new Hono<{ Bindings: HttpBindings }>();

function resolveCorsOrigin(origin: string | undefined): string | undefined {
  if (!origin) return env.appUrl;
  if (origin === env.appUrl) return origin;

  try {
    const url = new URL(origin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return origin;
    if (url.hostname === "finaflow.localhost" || url.hostname.endsWith(".finaflow.localhost")) return origin;
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

app.use("/api/trpc/localAuth.login*", loginLimiter);
app.use("/api/trpc/localAuth.register*", loginLimiter);
app.use("/*", csrfProtection);
app.use("/api/*", apiLimiter);

app.use("/api/trpc", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

const { serve } = await import("@hono/node-server");
const { serveStaticFiles } = await import("./lib/vite");
serveStaticFiles(app);

async function runTrialLifecycleJob() {
  try {
    const result = await processTrialLifecycle(getDb());
    if (result.remindersSent || result.downgraded || result.activated) {
      console.log("[subscriptions] trial lifecycle processed", result);
    }
  } catch (error) {
    console.error("[subscriptions] trial lifecycle job failed", error);
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

const port = parseInt(process.env.PORT || "3000");
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
