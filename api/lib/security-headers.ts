import { Context, Next } from "hono";

export const securityHeaders = async (c: Context, next: Next) => {
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );
  c.res.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https:;"
  );
  c.res.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin"
  );
  c.res.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()"
  );
  await next();
};
