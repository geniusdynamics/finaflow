import { Context, Next } from "hono";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

function getClientIp(c: Context): string {
  return c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
}

export function createRateLimiter(windowMs: number, max: number) {
  return async (c: Context, next: Next) => {
    const key = getClientIp(c);
    const now = Date.now();
    let entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    c.res.headers.set("X-RateLimit-Limit", String(max));
    c.res.headers.set("X-RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    c.res.headers.set("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.res.headers.set("Retry-After", String(retryAfter));
      return c.json({ error: "Too many requests. Please try again later." }, 429);
    }

    await next();
  };
}

export const loginLimiter = createRateLimiter(60 * 1000, 10);
export const apiLimiter = createRateLimiter(60 * 1000, 100);

export function clearRateLimitStore(): void {
  store.clear();
}
