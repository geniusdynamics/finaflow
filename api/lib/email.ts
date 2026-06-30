// ABOUTME: Sends transactional emails through an SMTP transport configured by environment variables.
// ABOUTME: Keeps email delivery optional in development while using real SMTP in configured environments.
import nodemailer from "nodemailer";

export type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

let transporterPromise: Promise<nodemailer.Transporter> | null = null;

function getEmailConfig() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !port || !user || !pass || !from) {
    return null;
  }

  return {
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    from,
  };
}

export function isEmailConfigured(): boolean {
  return getEmailConfig() !== null;
}

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (!transporterPromise) {
    const config = getEmailConfig();
    if (!config) {
      throw new Error("SMTP is not configured");
    }

    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        pool: true,
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.auth,
      }),
    );
  }

  return transporterPromise;
}

export async function sendEmail(payload: EmailPayload): Promise<{ delivered: boolean; skipped: boolean }> {
  const config = getEmailConfig();
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
