// ABOUTME: Privacy-safe email logging wrapper around sendEmail.
// ABOUTME: Records the email type and delivery status without storing recipient PII.
import { sendEmail, type EmailPayload } from "./email";
import { getDb } from "../queries/connection";
import { emailLogs, type emailLogTypeEnum } from "@db/schema";
import { eq } from "drizzle-orm";

export type EmailLogType = typeof emailLogTypeEnum.enumValues[number];

export async function sendLoggedEmail(
  type: EmailLogType,
  payload: EmailPayload,
): Promise<{ delivered: boolean; skipped: boolean; logId: number }> {
  const db = getDb();
  const [log] = await db.insert(emailLogs).values({ type, status: "pending" }).returning({ id: emailLogs.id });

  try {
    const result = await sendEmail(payload);
    const status = result.delivered ? "sent" : (result.skipped ? "skipped" : "failed");
    await db.update(emailLogs).set({ status, sentAt: new Date() }).where(eq(emailLogs.id, log.id));
    return { ...result, logId: log.id };
  } catch (error) {
    await db.update(emailLogs).set({
      status: "failed",
      errorMessage: (error as Error).message,
      sentAt: new Date(),
    }).where(eq(emailLogs.id, log.id));
    return { delivered: false, skipped: false, logId: log.id };
  }
}
