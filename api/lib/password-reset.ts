// ABOUTME: Shared password-reset helpers used by the public forgot-password flow
// ABOUTME: and the super-admin initiated reset flow. Creates a single-use token,
// ABOUTME: builds the reset URL and dispatches the email through the logged emailer.
import { createHash, randomBytes } from "node:crypto";
import { getDb } from "../queries/connection";
import { passwordResetTokens } from "@db/schema";
import { env } from "./env";
import { isEmailConfiguredAsync } from "./email";
import { sendLoggedEmail } from "./logged-email";
import { passwordResetHtml, passwordResetText } from "./email-templates";

export type ResetUser = {
  id: number;
  name?: string | null;
  username?: string | null;
  email?: string | null;
};

export const PASSWORD_RESET_EXPIRY_MINUTES = 60;

/**
 * Creates a single-use password reset token for the given user and returns the
 * plain-text token (for the URL) plus the fully built reset URL.
 */
export async function createPasswordResetForUser(
  db: ReturnType<typeof getDb>,
  user: ResetUser,
): Promise<{ plainToken: string; resetUrl: string; expiresAt: Date }> {
  const plainToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(plainToken).digest("hex");
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000);

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  } as typeof passwordResetTokens.$inferInsert);

  const resetUrl = `${env.appUrl}/reset-password?token=${plainToken}`;
  return { plainToken, resetUrl, expiresAt };
}

/**
 * Creates a reset token for a user and emails them the reset link.
 * Returns the reset URL even when delivery fails so support staff can share the
 * link manually. Never throws — delivery problems are surfaced in the result.
 */
export async function sendPasswordResetEmail(
  user: ResetUser,
): Promise<{
  success: boolean;
  delivered: boolean;
  skipped: boolean;
  error: string | null;
  resetUrl: string | null;
  expiresInMinutes: number;
}> {
  if (!user.email) {
    return {
      success: false,
      delivered: false,
      skipped: true,
      error: "User has no email address on file",
      resetUrl: null,
      expiresInMinutes: PASSWORD_RESET_EXPIRY_MINUTES,
    };
  }

  const db = getDb();
  const { resetUrl } = await createPasswordResetForUser(db, user);
  const recipientName = user.name || user.username || "there";

  if (!(await isEmailConfiguredAsync())) {
    return {
      success: true,
      delivered: false,
      skipped: true,
      error: "SMTP is not configured — reset link created but email was not sent",
      resetUrl,
      expiresInMinutes: PASSWORD_RESET_EXPIRY_MINUTES,
    };
  }

  try {
    const result = await sendLoggedEmail("password_reset", {
      to: user.email,
      subject: "Reset your Finaflow password",
      text: passwordResetText(recipientName, resetUrl),
      html: passwordResetHtml(recipientName, resetUrl),
    });
    return {
      success: true,
      delivered: result.delivered,
      skipped: result.skipped,
      error: result.delivered || result.skipped ? null : (result.error ?? "Email delivery failed"),
      resetUrl,
      expiresInMinutes: PASSWORD_RESET_EXPIRY_MINUTES,
    };
  } catch (error) {
    return {
      success: true,
      delivered: false,
      skipped: false,
      error: (error as Error).message,
      resetUrl,
      expiresInMinutes: PASSWORD_RESET_EXPIRY_MINUTES,
    };
  }
}
