import type { Context, Next } from "hono";
import { createId } from "@paralleldrive/cuid2";

export function generateCsrfToken(): string {
  return createId();
}

export const csrfProtection = async (c: Context, next: Next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    return next();
  }

  const path = c.req.path;

  // Machine-to-machine routes authenticate via API key / webhook signature, not browser CSRF cookies.
  if (
    path.startsWith("/api/trpc") ||
    path.startsWith("/api/webhooks") ||
    path.startsWith("/api/integration/") ||
    path.startsWith("/api/connect")
  ) {
    return next();
  }

  const cookieHeader = c.req.header("cookie") || "";
  const csrfCookie = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("csrf_token="))
    ?.split("=")[1];
  const csrfHeader = c.req.header("x-csrf-token");

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return c.json({ error: "CSRF token mismatch" }, 403);
  }

  return next();
};
