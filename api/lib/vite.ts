import type { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";

export function serveStaticFiles(app: Hono) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");

  // Serve static files, but skip /docs and /openapi.yaml (handled by dedicated routes)
  app.use("*", async (c, next) => {
    const pathname = new URL(c.req.url).pathname;
    if (pathname.startsWith("/docs") || pathname === "/openapi.yaml") {
      return next();
    }
    return serveStatic({ root: "./dist/public" })(c, next);
  });

  app.notFound((c) => {
    const pathname = new URL(c.req.url).pathname;
    // Don't SPA-fallback for docs routes
    if (pathname.startsWith("/docs") || pathname === "/openapi.yaml") {
      return c.json({ error: "Not Found" }, 404);
    }
    const accept = c.req.header("accept") ?? "";
    if (!accept.includes("text/html")) {
      return c.json({ error: "Not Found" }, 404);
    }
    const indexPath = path.resolve(distPath, "index.html");
    const content = fs.readFileSync(indexPath, "utf-8");
    return c.html(content);
  });
}
