// ABOUTME: Daily subscription due/overdue digest email — one send per business per day (07:00 local sweep),
// ABOUTME: to owner/admin users with an email address. Logged via sendLoggedEmail (subscription_due_digest).
import { and, eq, inArray, isNull } from "drizzle-orm";
import { appSettings, businesses, subscriptions, users, userBusinesses, type Subscription } from "@db/schema";
import { d } from "./decimal";
import { daysBetween } from "./subscription-math";
import { sendLoggedEmail } from "./logged-email";
import type { DbClient } from "./account-subscriptions";

const DIGEST_WINDOW_DAYS = 7;
const LAST_DIGEST_SETTING_KEY = "subscriptions_last_digest_date";

function toDateString(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

interface DigestRow {
  name: string;
  amount: string;
  currency: string;
  nextDueDate: string;
  daysUntilDue: number;
  overdue: boolean;
}

function buildDigestRows(subs: Subscription[], today: string): DigestRow[] {
  return subs
    .filter((sub) => {
      if (sub.isOneTime || sub.status !== "active" || !sub.notifyEnabled) return false;
      const daysUntilDue = daysBetween(sub.nextDueDate, today);
      return daysUntilDue <= DIGEST_WINDOW_DAYS;
    })
    .map((sub) => {
      const daysUntilDue = daysBetween(sub.nextDueDate, today);
      return {
        name: sub.name,
        amount: d(sub.amount).toFixed(2),
        currency: sub.currency,
        nextDueDate: sub.nextDueDate,
        daysUntilDue,
        overdue: daysUntilDue < 0,
      };
    })
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

function buildEmailBody(businessName: string, rows: DigestRow[]): { text: string; html: string } {
  const overdue = rows.filter((r) => r.overdue);
  const dueSoon = rows.filter((r) => !r.overdue);
  const line = (r: DigestRow): string =>
    `${r.overdue ? "[OVERDUE] " : ""}${r.name} — ${r.currency} ${r.amount} due ${r.nextDueDate} (${
      r.overdue ? `${Math.abs(r.daysUntilDue)} days overdue` : r.daysUntilDue === 0 ? "today" : `in ${r.daysUntilDue} days`
    })`;

  const text = [
    `Subscription digest for ${businessName}`,
    "",
    ...(overdue.length > 0 ? ["Overdue:", ...overdue.map(line), ""] : []),
    ...(dueSoon.length > 0 ? [`Due in the next ${DIGEST_WINDOW_DAYS} days:`, ...dueSoon.map(line), ""] : []),
    "Manage subscriptions in Finaflow under Subscriptions.",
  ].join("\n");

  const htmlRows = rows
    .map(
      (r) =>
        `<tr><td style="padding:4px 8px;${r.overdue ? "color:#D32F2F;font-weight:600" : ""}">${r.overdue ? "[OVERDUE] " : ""}${r.name}</td>` +
        `<td style="padding:4px 8px;font-family:monospace">${r.currency} ${r.amount}</td>` +
        `<td style="padding:4px 8px">${r.nextDueDate}</td></tr>`,
    )
    .join("");
  const html = `<p>Subscription digest for <strong>${businessName}</strong></p><table>${htmlRows}</table><p>Manage subscriptions in Finaflow under Subscriptions.</p>`;

  return { text, html };
}

/**
 * Send one digest email per business per day listing subscriptions that are overdue
 * or due within the next 7 days. Idempotent via the appSettings
 * `subscriptions_last_digest_date` marker per business.
 *
 * Returns the number of emails sent (0 when nothing is due or the digest already ran today).
 */
export async function sendSubscriptionDigestEmails(db: DbClient, now: Date = new Date()): Promise<number> {
  const today = toDateString(now);

  const businessRows = await db
    .selectDistinct({ businessId: subscriptions.businessId })
    .from(subscriptions)
    .where(and(isNull(subscriptions.deletedAt), eq(subscriptions.status, "active")));

  let sent = 0;
  for (const { businessId } of businessRows) {
    const [lastDigest] = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(and(eq(appSettings.businessId, businessId), eq(appSettings.key, LAST_DIGEST_SETTING_KEY)))
      .limit(1);
    if (lastDigest?.value === today) continue;

    const subs = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.businessId, businessId), isNull(subscriptions.deletedAt), eq(subscriptions.status, "active")));
    const rows = buildDigestRows(subs, today);
    if (rows.length === 0) continue;

    const recipients = await db
      .select({ email: users.email })
      .from(users)
      .innerJoin(userBusinesses, eq(userBusinesses.userId, users.id))
      .where(
        and(
          eq(userBusinesses.businessId, businessId),
          eq(userBusinesses.isActive, true),
          eq(users.isActive, true),
          isNull(users.deletedAt),
          inArray(users.role, ["owner", "admin"]),
        ),
      );
    const emails = [...new Set(recipients.map((r) => r.email).filter((e): e is string => !!e))];
    if (emails.length === 0) continue;

    const [biz] = await db.select({ name: businesses.name }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
    const businessName = biz?.name ?? "your business";
    const { text, html } = buildEmailBody(businessName, rows);

    for (const to of emails) {
      await sendLoggedEmail("subscription_due_digest", {
        to,
        subject: `Subscription digest — ${rows.length} renewal${rows.length === 1 ? "" : "s"} need attention`,
        text,
        html,
      });
      sent += 1;
    }

    // appSettings has no unique (businessId, key) constraint — upsert manually like settings-router.
    const [existingSetting] = await db
      .select({ id: appSettings.id })
      .from(appSettings)
      .where(and(eq(appSettings.businessId, businessId), eq(appSettings.key, LAST_DIGEST_SETTING_KEY)))
      .limit(1);
    if (existingSetting) {
      await db.update(appSettings).set({ value: today }).where(eq(appSettings.id, existingSetting.id));
    } else {
      await db
        .insert(appSettings)
        .values({ businessId, key: LAST_DIGEST_SETTING_KEY, value: today } as typeof appSettings.$inferInsert);
    }
  }
  return sent;
}
