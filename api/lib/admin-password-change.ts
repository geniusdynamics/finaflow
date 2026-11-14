// ABOUTME: Records administrator-set passwords and delivers one-time recovery notices.
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { auditLog, customerAccounts, notifications, passwordChangeEvents, passwordResetTokens, refreshTokens, userBusinesses, businesses, users } from "@db/schema";
import { getDb } from "../queries/connection";
import { env } from "./env";
import { hashPassword, verifyPassword } from "./password";
import { isEmailConfiguredAsync } from "./email";
import { sendLoggedEmail } from "./logged-email";
import { escapeHtml } from "./email-templates";

export const adminPasswordSchema = { min: 8, max: 100 };
const invalidLink = () => new TRPCError({ code: "BAD_REQUEST", message: "This report link is invalid or expired. Request a new password reset from sign in." });
const digest = (token: string) => createHash("sha256").update(token).digest("hex");

export async function setAdminPassword(userId: number, actorId: number, newPassword: string, reason: string) {
  const db = getDb();
  const hash = await hashPassword(newPassword);
  if (!await verifyPassword(newPassword, hash)) throw new Error("Password verification failed; no changes were saved");
  const token = randomBytes(32).toString("hex");
  const url = `${env.appUrl}/report-password-change?token=${token}`;
  const result = await db.transaction(async tx => {
    const [user] = await tx.select().from(users).where(and(eq(users.id, userId), isNull(users.deletedAt))).for("update");
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    if (userId === actorId) throw new TRPCError({ code: "BAD_REQUEST", message: "Use your own password settings to change your password" });
    if (user.accountId === env.superAdminAccount) throw new TRPCError({ code: "FORBIDDEN", message: "The platform account is protected" });
    await tx.update(users).set({ passwordHash: hash, passwordChangedAt: new Date() }).where(eq(users.id, userId));
    await tx.update(refreshTokens).set({ isRevoked: true }).where(eq(refreshTokens.userId, userId));
    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
    await tx.update(passwordChangeEvents).set({ resolvedAt: new Date() }).where(and(eq(passwordChangeEvents.userId, userId), isNull(passwordChangeEvents.resolvedAt)));
    const [event] = await tx.insert(passwordChangeEvents).values({
      userId, actorId, accountId: user.accountId, tokenHash: digest(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }).returning({ id: passwordChangeEvents.id });
    await tx.insert(notifications).values({
      userId, type: "password_changed", title: "Your password was changed by an administrator",
      message: "If you did not request this change, report it and choose a new password.",
      severity: "critical", priority: 200, entityType: "password_change", entityId: event.id,
      linkUrl: url, linkLabel: "Report this change",
    });
    await tx.insert(auditLog).values({ tableName: "admin_support", recordId: userId, action: "UPDATE", changedBy: actorId,
      newValues: { accountId: user.accountId, operation: "set_password", reason, eventId: event.id, outcome: "success" } });
    const memberships = await tx.select({ id: userBusinesses.id }).from(userBusinesses).innerJoin(businesses, eq(userBusinesses.businessId, businesses.id))
      .where(and(eq(userBusinesses.userId, userId), eq(userBusinesses.isActive, true), isNull(businesses.deletedAt)));
    const [account] = await tx.select({ billingHoldAt: customerAccounts.billingHoldAt }).from(customerAccounts).where(and(eq(customerAccounts.accountId, user.accountId || ""), isNull(customerAccounts.deletedAt)));
    return { user, canSignIn: user.isActive && memberships.length > 0 && (!account?.billingHoldAt || user.role === "owner" || user.role === "admin") };
  });

  let emailStatus = "No email address on file";
  let emailConfigured = false;
  if (result.user.email) {
    try { emailConfigured = await isEmailConfiguredAsync(); } catch { emailStatus = "Email configuration unavailable"; }
  }
  if (result.user.email && emailConfigured) {
    const name = result.user.name || result.user.username;
    const text = `Hi ${name},\n\nAn administrator changed your Finaflow password. If you did not request this, report it and choose a new password within 7 days: ${url}\n\nIf you requested the change, no action is needed.`;
    try {
      const sent = await sendLoggedEmail("password_changed", {
        to: result.user.email, subject: "Your Finaflow password was changed",
        text, html: `<p>Hi ${escapeHtml(name)},</p><p>An administrator changed your Finaflow password.</p><p>If you did not request this, <a href="${escapeHtml(url)}">report it and choose a new password</a> within 7 days.</p><p>If you requested the change, no action is needed.</p>`,
      });
      emailStatus = sent.delivered ? "sent" : sent.error || "Email not delivered";
    } catch {
      emailStatus = "Email delivery failed";
    }
  } else if (result.user.email && emailStatus === "No email address on file") emailStatus = "SMTP is not configured";
  return { success: true, emailStatus, canSignIn: result.canSignIn, username: result.user.username, accountId: result.user.accountId };
}

export async function reportAdminPasswordChange(token: string) {
  const db = getDb();
  return db.transaction(async tx => {
    const [event] = await tx.select().from(passwordChangeEvents).where(eq(passwordChangeEvents.tokenHash, digest(token))).for("update");
    if (!event || event.resolvedAt || event.expiresAt <= new Date()) throw invalidLink();
    if (!event.reportedAt) {
      await tx.update(passwordChangeEvents).set({ reportedAt: new Date() }).where(eq(passwordChangeEvents.id, event.id));
      await tx.insert(auditLog).values({ tableName: "admin_support", recordId: event.userId, action: "UPDATE", changedBy: event.userId,
        newValues: { accountId: event.accountId, operation: "password_change_reported", eventId: event.id, outcome: "pending_recovery" } });
    }
    return { reported: true };
  });
}

export async function recoverReportedPassword(token: string, password: string) {
  const db = getDb();
  const hash = await hashPassword(password);
  if (!await verifyPassword(password, hash)) throw new Error("Password verification failed");
  return db.transaction(async tx => {
    const [event] = await tx.select().from(passwordChangeEvents).where(eq(passwordChangeEvents.tokenHash, digest(token))).for("update");
    if (!event || !event.reportedAt || event.resolvedAt || event.expiresAt <= new Date()) throw invalidLink();
    const [user] = await tx.select({ id: users.id, username: users.username, accountId: users.accountId }).from(users).where(and(eq(users.id, event.userId), isNull(users.deletedAt)));
    if (!user) throw invalidLink();
    await tx.update(users).set({ passwordHash: hash, passwordChangedAt: new Date() }).where(eq(users.id, user.id));
    await tx.update(refreshTokens).set({ isRevoked: true }).where(eq(refreshTokens.userId, user.id));
    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));
    await tx.update(passwordChangeEvents).set({ resolvedAt: new Date() }).where(eq(passwordChangeEvents.id, event.id));
    await tx.update(notifications).set({ message: "You reported this change and set a new password.", linkUrl: null, linkLabel: null, severity: "info" })
      .where(and(eq(notifications.entityType, "password_change"), eq(notifications.entityId, event.id), eq(notifications.userId, user.id)));
    await tx.insert(auditLog).values({ tableName: "admin_support", recordId: user.id, action: "UPDATE", changedBy: user.id,
      newValues: { accountId: event.accountId, operation: "password_change_recovered", eventId: event.id, outcome: "success" } });
    return { success: true, username: user.username, accountId: user.accountId };
  });
}
