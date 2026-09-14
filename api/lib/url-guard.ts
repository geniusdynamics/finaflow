// ABOUTME: Outbound-URL validation for user-supplied endpoints (SSRF guard).
// ABOUTME: Ported from finabill's api/lib/url-guard.ts so finaflow does not
// ABOUTME: POST fresh credentials to arbitrary URLs in the approveAsPartner flow.
// ABOUTME: Localhost is allowed in dev (three-app local pairing) and blocked in prod.

import dns from "node:dns/promises";
import net from "node:net";

export class UnsafeUrlError extends Error {
  constructor(url: string, reason: string) {
    super(`URL "${url}" is not allowed: ${reason}`);
    this.name = "UnsafeUrlError";
  }
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (
    parts.length !== 4 ||
    parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)
  ) {
    return true; // malformed → treat as unsafe
  }
  const [a, b] = parts;
  if (a === 10 || a === 127) return true; // private + loopback
  if (a === 0) return true; // "this" network
  if (a === 169 && b === 254) return true; // link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIpv4(ip);
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fe80:") || // link-local
      lower.startsWith("fc") ||
      lower.startsWith("fd") || // unique local
      lower.startsWith("::ffff:127.") ||
      lower.startsWith("::ffff:10.") ||
      lower.startsWith("::ffff:192.168.")
    );
  }
  return true; // not an IP at all → unresolved, treat as unsafe
}

/**
 * Validate a user-supplied URL before the server makes an outbound request.
 * - Rejects non-http(s) schemes (no file:, data:, etc.)
 * - Unless `allowHttp` is set, rejects plain http (prod credentials must not
 *   travel in cleartext)
 * - Resolves DNS and rejects loopback/link-local/private/CGNAT targets
 *   (SSRF to cloud metadata, internal services, etc.)
 * - In dev, `localhost` is allowed (local three-app pairing); always blocked
 *   in production.
 * Returns the parsed URL on success; throws UnsafeUrlError otherwise.
 */
export async function assertSafeOutboundUrl(
  rawUrl: string,
  opts: { allowHttp?: boolean } = {},
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError(rawUrl, "not a valid URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UnsafeUrlError(rawUrl, `scheme "${url.protocol}" is not allowed`);
  }
  if (url.protocol === "http:" && !opts.allowHttp) {
    throw new UnsafeUrlError(rawUrl, "plain http is not allowed — use https");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError(rawUrl, "embedded credentials are not allowed");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  const isDev = process.env.NODE_ENV !== "production";

  // Localhost is fine for local development (finaflow <-> finabill <-> glomish),
  // but never in production.
  if (
    host === "localhost" ||
    host.endsWith(".localhost")
  ) {
    if (!isDev) {
      throw new UnsafeUrlError(rawUrl, "loopback hostname is not allowed in production");
    }
    return url;
  }

  // Literal IP hosts: check directly. Hostnames: resolve every address —
  // ANY private resolution is rejected (DNS-rebinding to internals).
  if (net.isIP(host)) {
    if (isPrivateIp(host)) {
      throw new UnsafeUrlError(rawUrl, "target is a private/loopback address");
    }
    return url;
  }

  if (host.endsWith(".local") || host.endsWith(".internal")) {
    throw new UnsafeUrlError(rawUrl, "internal hostname is not allowed");
  }

  try {
    const records = await dns.lookup(host, { all: true });
    if (records.length === 0) {
      throw new UnsafeUrlError(rawUrl, "host does not resolve");
    }
    for (const record of records) {
      if (isPrivateIp(record.address)) {
        throw new UnsafeUrlError(
          rawUrl,
          `host resolves to private address ${record.address}`,
        );
      }
    }
  } catch (err) {
    if (err instanceof UnsafeUrlError) throw err;
    throw new UnsafeUrlError(rawUrl, "host does not resolve");
  }

  return url;
}
