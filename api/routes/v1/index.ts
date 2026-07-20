// ABOUTME: Mounts all v1 external REST API sub-routers and applies shared middleware.
// ABOUTME: Mounted at /api/v1/ in boot.ts.
import { Hono } from "hono";
import type { ApiKeyVariables } from "../../lib/api-key-middleware";
import { requestIdMiddleware } from "../../lib/request-id";
import { integrationLimiter } from "../../lib/rate-limit";

import verify from "./verify";
import accounts from "./accounts";
import suppliersRouter from "./suppliers";
import categories from "./categories";
import business from "./business";
import locations from "./locations";
import usersRouter from "./users";
import roles from "./roles";
import dailySales from "./daily-sales";
import webhooks from "./webhooks";

const v1 = new Hono<{ Variables: ApiKeyVariables }>();

// Shared middleware for all v1 routes
v1.use("*", requestIdMiddleware);
v1.use("*", integrationLimiter);

// Mount sub-routers
v1.route("/verify", verify);
v1.route("/accounts", accounts);
v1.route("/suppliers", suppliersRouter);
v1.route("/categories", categories);
v1.route("/business", business);
v1.route("/locations", locations);
v1.route("/users", usersRouter);
v1.route("/roles", roles);
v1.route("/daily-sales", dailySales);
v1.route("/webhooks", webhooks);

// 404 catch-all for unmatched v1 routes
v1.all("/*", (c) => {
  return c.json(
    {
      error: { code: "NOT_FOUND", message: `Route not found: ${c.req.method} ${c.req.path}` },
      meta: { requestId: c.get("requestId") },
    },
    404,
  );
});

export default v1;
