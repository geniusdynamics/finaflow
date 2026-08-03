// ABOUTME: Database-backed SMTP configuration storage with environment-variable fallback.
// ABOUTME: Fixes EACCES crashes on read-only .env files (Docker) by persisting SMTP settings
// ABOUTME: in the app_settings table while keeping .env as a best-effort sync target.
import { getDb } from "../queries/connection";
import { appSettings } from "@db/schema";
import { eq, and, sql } from "drizzle-orm";
import { updateEnvVarSafe } from "./update-env";

const SMTP_CONFIG_KEY = "smtp_config";

export type SmtpConfigInput = {
  host?: string;
  port?: string;
  user?: string;
  pass?: string;
  from?: string;
};

export type SmtpConfigInfo = {
  host: string;
  port: string;
  user: string;
  from: string;
  hasPassword: boolean;
  isConfigured: boolean;
  source: "env" | "database";
};

type StoredSmtpConfig = {
  host: string;
  port: string;
  user: string;
  from: string;
  pass: string;
};

function isStoredConfigValid(value: unknown): value is StoredSmtpConfig {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.host === "string" && typeof v.port === "string";
}

/**
 * Reads SMTP configuration from process.env (legacy source).
 */
export function loadSmtpFromEnv(): SmtpConfigInfo {
  const host = process.env.SMTP_HOST || "";
  const port = process.env.SMTP_PORT || "";
  const user = process.env.SMTP_USER || "";
  const from = process.env.SMTP_FROM || "";
  const hasPassword = !!process.env.SMTP_PASS;
  const isConfigured = !!(host && port && user && hasPassword && from);
  return { host, port, user, from, hasPassword, isConfigured, source: "env" };
}

async function readStoredConfig(): Promise<StoredSmtpConfig | null> {
  const db = getDb();
  const rows = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(and(eq(appSettings.key, SMTP_CONFIG_KEY), sql`${appSettings.businessId} IS NULL`))
    .limit(1);
  const raw = rows[0]?.value;
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredConfigValid(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Returns the effective SMTP configuration: database first, then environment.
 * Never throws — falls back to env on any database error.
 */
export async function getSmtpConfig(): Promise<SmtpConfigInfo> {
  try {
    const stored = await readStoredConfig();
    if (stored) {
      return {
        host: stored.host,
        port: stored.port,
        user: stored.user,
        from: stored.from,
        hasPassword: !!stored.pass,
        isConfigured: !!(stored.host && stored.port && stored.user && stored.pass && stored.from),
        source: "database",
      };
    }
  } catch (error) {
    console.warn("[smtp-config] failed to read database config, falling back to env:", (error as Error).message);
  }
  return loadSmtpFromEnv();
}

/**
 * Returns just the SMTP password (used to build nodemailer auth). Falls back to env.
 */
export async function getSmtpPassword(): Promise<string | null> {
  try {
    const stored = await readStoredConfig();
    if (stored) return stored.pass || null;
  } catch {
    // fall through to env
  }
  return process.env.SMTP_PASS || null;
}

async function upsertStoredConfig(config: StoredSmtpConfig): Promise<void> {
  const db = getDb();
  const json = JSON.stringify(config);
  const conditions = [eq(appSettings.key, SMTP_CONFIG_KEY), sql`${appSettings.businessId} IS NULL`];
  const existing = await db.select({ id: appSettings.id }).from(appSettings).where(and(...conditions)).limit(1);
  if (existing.length > 0) {
    await db.update(appSettings).set({ value: json }).where(eq(appSettings.id, existing[0].id));
  } else {
    await db.insert(appSettings).values({
      key: SMTP_CONFIG_KEY,
      value: json,
      businessId: null,
    } as typeof appSettings.$inferInsert);
  }
}

/**
 * Persists SMTP configuration. The database is the authoritative store; the
 * `.env` file is only synced on a best-effort basis. Write failures (e.g.
 * EACCES in Docker) are collected as warnings and never thrown.
 */
export async function saveSmtpConfig(input: SmtpConfigInput): Promise<{
  success: true;
  source: "env" | "database";
  warnings: string[];
}> {
  const warnings: string[] = [];
  const previous = await getSmtpConfig();
  const previousPass = previous.hasPassword ? (await getSmtpPassword()) ?? "" : "";

  const next: StoredSmtpConfig = {
    host: input.host !== undefined && input.host !== "" ? input.host : previous.host,
    port: input.port !== undefined && input.port !== "" ? input.port : previous.port,
    user: input.user !== undefined && input.user !== "" ? input.user : previous.user,
    from: input.from !== undefined && input.from !== "" ? input.from : previous.from,
    pass: input.pass !== undefined && input.pass !== "" ? input.pass : previousPass,
  };

  // Persist to the database (authoritative).
  try {
    await upsertStoredConfig(next);
    applyToProcessEnv(next);
    // Invalidate the cached nodemailer transporter so the new config takes effect.
    try {
      const { resetEmailTransporter } = await import("./email");
      resetEmailTransporter();
    } catch (e) {
      console.warn("[smtp-config] failed to reset email transporter:", (e as Error).message);
    }
  } catch (error) {
    // Database unavailable — fall back to .env + process.env so the running
    // process still picks up the new settings for the session.
    console.warn("[smtp-config] database write failed, falling back to env-only:", (error as Error).message);
    applyToProcessEnv(next);
    for (const [key, value] of Object.entries({
      SMTP_HOST: next.host,
      SMTP_PORT: next.port,
      SMTP_USER: next.user,
      SMTP_PASS: next.pass,
      SMTP_FROM: next.from,
    })) {
      const result = updateEnvVarSafe(key, value);
      if (!result.ok && result.warning) warnings.push(result.warning);
    }
    return { success: true, source: "env", warnings };
  }

  // Best-effort .env sync — failures are warnings, never errors.
  for (const [key, value] of Object.entries({
    SMTP_HOST: next.host,
    SMTP_PORT: next.port,
    SMTP_USER: next.user,
    SMTP_PASS: next.pass,
    SMTP_FROM: next.from,
  })) {
    const result = updateEnvVarSafe(key, value);
    if (!result.ok && result.warning) warnings.push(result.warning);
  }

  return { success: true, source: "database", warnings };
}

function applyToProcessEnv(config: StoredSmtpConfig): void {
  process.env.SMTP_HOST = config.host;
  process.env.SMTP_PORT = config.port;
  process.env.SMTP_USER = config.user;
  process.env.SMTP_PASS = config.pass;
  process.env.SMTP_FROM = config.from;
}

/**
 * Reserved for future caching layers — config is currently read fresh per call.
 */
export function invalidateSmtpConfigCache(): void {
  // no-op
}

export async function isEmailConfiguredAsync(): Promise<boolean> {
  return (await getSmtpConfig()).isConfigured;
}
