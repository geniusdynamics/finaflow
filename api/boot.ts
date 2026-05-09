import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { createOAuthCallbackHandler } from "./kimi/auth";
import { Paths } from "@contracts/constants";
import { securityHeaders } from "./lib/security-headers";
import { csrfProtection } from "./lib/csrf";
import { apiLimiter, loginLimiter } from "./lib/rate-limit";
import { getDb, closePool } from "./queries/connection";
import { sql } from "drizzle-orm";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use("*", cors({ origin: env.appUrl, credentials: true }));
app.use("*", securityHeaders);
app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

app.get(Paths.oauthCallback, createOAuthCallbackHandler());

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

const port = parseInt(process.env.PORT || "3000");
const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on http://localhost:${port}/`);
});

const shutdown = async (signal: string) => {
  console.log(`Received ${signal}, shutting down gracefully...`);
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

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
