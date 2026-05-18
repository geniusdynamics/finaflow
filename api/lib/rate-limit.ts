import { Context, Next } from "hono";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface EndpointRateLimit {
  windowMs: number;
  max: number;
}

const globalStore = new Map<string, RateLimitEntry>();
const endpointStores = new Map<string, Map<string, RateLimitEntry>>();

function getClientIp(c: Context): string {
  return c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
}

function checkRateLimit(store: Map<string, RateLimitEntry>, key: string, windowMs: number, max: number, c: Context): boolean {
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
    return false;
  }
  return true;
}

export function createRateLimiter(windowMs: number, max: number) {
  return async (c: Context, next: Next) => {
    const ip = getClientIp(c);
    if (!checkRateLimit(globalStore, ip, windowMs, max, c)) {
      console.warn(`[rate-limit] global limit exceeded for IP: ${ip}`);
      return c.json({ error: "Too many requests. Please try again later." }, 429);
    }
    await next();
  };
}

export function createEndpointRateLimiter(endpointKey: string, opts: EndpointRateLimit) {
  let store = endpointStores.get(endpointKey);
  if (!store) {
    store = new Map();
    endpointStores.set(endpointKey, store);
  }

  return async (c: Context, next: Next) => {
    const ip = getClientIp(c);
    if (!checkRateLimit(store!, ip, opts.windowMs, opts.max, c)) {
      console.warn(`[rate-limit] endpoint ${endpointKey} limit exceeded for IP: ${ip}`);
      return c.json({ error: "Too many requests. Please try again later." }, 429);
    }
    await next();
  };
}

export const loginLimiter = createRateLimiter(60 * 1000, 10);
export const apiLimiter = createRateLimiter(60 * 1000, 500);
export const lookupAccountLimiter = createEndpointRateLimiter("lookupAccount", { windowMs: 60 * 1000, max: 120 });

export function clearRateLimitStore(): void {
  globalStore.clear();
  endpointStores.clear();
}
