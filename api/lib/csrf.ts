import { Context, Next } from "hono";
import { createId } from "@paralleldrive/cuid2";
import { serialize } from "cookie";

export function generateCsrfToken(): string {
  return createId();
}

export function setCsrfCookie(c: Context, token: string): void {
  c.res.headers.append(
    "Set-Cookie",
    serialize("csrf_token", token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    })
  );
}

const CSRF_EXEMPT_PATHS = [
  "/health",
  "/api/trpc/localAuth.seedDefaults",
  "/api/trpc/localAuth.login",
  "/api/trpc/localAuth.register",
  "/api/trpc/localAuth.lookupAccount",
];

export const csrfProtection = async (c: Context, next: Next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    return next();
  }
  const path = c.req.path;
  if (CSRF_EXEMPT_PATHS.some((p) => path.startsWith(p))) {
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
