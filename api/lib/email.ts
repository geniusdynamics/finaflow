// ABOUTME: Sends transactional emails through an SMTP transport configured by the database
// ABOUTME: (app_settings, via smtp-config) or, as a fallback, environment variables.
// ABOUTME: Keeps email delivery optional in development while using real SMTP in configured environments.
import nodemailer from "nodemailer";
import { getSmtpConfig, getSmtpPassword, type SmtpConfigInfo } from "./smtp-config";

export type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

let transporterPromise: Promise<nodemailer.Transporter> | null = null;

/**
 * Legacy synchronous check based purely on environment variables.
 * Prefer `isEmailConfiguredAsync` in code paths that can await — it also
 * accounts for database-backed SMTP configuration.
 */
export function isEmailConfigured(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_FROM
  );
}

export async function isEmailConfiguredAsync(): Promise<boolean> {
  const config = await getSmtpConfig();
  return config.isConfigured;
}

async function getEmailConfig(): Promise<{
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
} | null> {
  let cfg: SmtpConfigInfo;
  try {
    cfg = await getSmtpConfig();
  } catch (error) {
    console.warn("[email] failed to resolve SMTP config:", (error as Error).message);
    cfg = { host: "", port: "", user: "", from: "", hasPassword: false, isConfigured: false, source: "env" };
  }

  if (!cfg.isConfigured) {
    return null;
  }

  const port = parseInt(cfg.port, 10) || 587;
  const pass = cfg.hasPassword ? (await getSmtpPassword()) ?? "" : "";

  return {
    host: cfg.host,
    port,
    user: cfg.user,
    pass,
    from: cfg.from,
    secure: port === 465,
  };
}

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (!transporterPromise) {
    const config = await getEmailConfig();
    if (!config) {
      throw new Error("SMTP is not configured");
    }

    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        pool: true,
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: { user: config.user, pass: config.pass },
      }),
    );
  }

  return transporterPromise;
}

/**
 * Invalidates the cached transporter so the next send picks up fresh SMTP
 * configuration. Called by the admin SMTP save flow after persisting changes.
 */
export function resetEmailTransporter(): void {
  transporterPromise = null;
}

export async function sendEmail(payload: EmailPayload): Promise<{ delivered: boolean; skipped: boolean }> {
  const config = await getEmailConfig();
  if (!config) {
    console.warn("[email] SMTP not configured; skipping outbound email", { to: payload.to, subject: payload.subject });
    return { delivered: false, skipped: true };
  }

  const transporter = await getTransporter();
  await transporter.sendMail({
    from: config.from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });

  return { delivered: true, skipped: false };
}
