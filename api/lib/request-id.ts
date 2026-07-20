// ABOUTME: Hono middleware that generates a unique request ID per request.
// ABOUTME: The ID is stored on context as "requestId" and added to the X-Request-Id response header.
import { createMiddleware } from "hono/factory";
import { createId } from "@paralleldrive/cuid2";

export type RequestIdVariables = {
  requestId: string;
};

/**
 * Generates a `req_` prefixed unique ID and attaches it to the Hono context.
 * Also echoes it back in the X-Request-Id response header.
 */
export const requestIdMiddleware = createMiddleware<{ Variables: RequestIdVariables }>(
  async (c, next) => {
    const id = `req_${createId()}`;
    c.set("requestId", id);
    c.header("X-Request-Id", id);
    await next();
  }
);
