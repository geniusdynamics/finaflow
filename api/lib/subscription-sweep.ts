// ABOUTME: Daily subscription sweep — due-soon/due-today/overdue/trial notifications (per-user fan-out),
// ABOUTME: auto-renew advance with pending payment rows, and overdue severity escalation. Idempotent by design.
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  appSettings,
  notifications,
  subscriptionPayments,
  subscriptions,
  userBusinesses,
  userLocations,
  users,
  type Subscription,
} from "@db/schema";
import { d } from "./decimal";
import { advanceDueDate, daysBetween, type CycleUnit } from "./subscription-math";
import { materializeSubscriptionBill } from "./subscription-posting";
import { applyReHighlight } from "./notification-lifecycle";
import { getRolePermissionsWithCache, loadRolePermissionsFromDb, PERMISSIONS } from "../middleware";
import type { DbClient } from "./account-subscriptions";

export const SUBSCRIPTION_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface SweepResult {
  dueSoonCreated: number;
  dueSoonReHighlighted: number;
  dueTodayReHighlighted: number;
  overdueCreated: number;
  overdueEscalated: number;
  pendingPaymentsCreated: number;
  autoAdvanced: number;
  trialEnding: number;
  billsMaterialized: number;
}

type Severity = "info" | "warning" | "critical";

interface EligibleUser {
  id: number;
  allLocationIds: number[];
}

function toDateString(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

/** Users of the business who hold subscriptions:view and can see the subscription's branch. */
async function loadEligibleUsers(db: DbClient, businessId: number): Promise<EligibleUser[]> {
  await loadRolePermissionsFromDb();
  const members = await db
    .select({ userId: userBusinesses.userId })
    .from(userBusinesses)
    .where(and(eq(userBusinesses.businessId, businessId), eq(userBusinesses.isActive, true)));
  const memberIds = members.map((m) => m.userId);
  if (memberIds.length === 0) return [];

  const enforceRows = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(and(eq(appSettings.businessId, businessId), eq(appSettings.key, "enforceLocationAssignment")))
    .limit(1);
  const enforce = enforceRows[0]?.value === "true" || enforceRows[0]?.value === "1";

  const userRows = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(and(inArray(users.id, memberIds), eq(users.isActive, true), isNull(users.deletedAt)));

  const out: EligibleUser[] = [];
  for (const user of userRows) {
    const perms = getRolePermissionsWithCache(user.role);
    if (!perms.includes(PERMISSIONS.SUBSCRIPTIONS_VIEW)) continue;
    const isPrivileged = user.role === "owner" || user.role === "admin";
    if (isPrivileged || !enforce) {
      out.push({ id: user.id, allLocationIds: [] });
      continue;
    }
    const assigned = await db
      .select({ locationId: userLocations.locationId })
      .from(userLocations)
      .where(and(eq(userLocations.userId, user.id), eq(userLocations.isActive, true)));
    out.push({ id: user.id, allLocationIds: assigned.map((a) => a.locationId) });
  }
  return out;
}

function userSeesSubscription(user: EligibleUser, subscription: Subscription): boolean {
  if (subscription.locationId == null) return true; // business-wide: visible across branches
  return user.allLocationIds.includes(subscription.locationId);
}

/**
 * Upsert one notification for one user, mirroring the bill overdue pattern
 * (api/notifications-router.ts): insert, re-highlight if cleared/archived, bump if faded.
 */
async function upsertNotification(
  db: DbClient,
  args: {
    userId: number;
    subscription: Subscription;
    type: string;
    severity: Severity;
    title: string;
    message: string;
    now: Date;
  },
): Promise<"created" | "rehighlighted"> {
  const { userId, subscription, type, severity, title, message, now } = args;
  const [existing] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.entityType, "subscription"),
        eq(notifications.entityId, subscription.id),
        eq(notifications.type, type),
      ),
    )
    .limit(1);

  if (!existing) {
    await db.insert(notifications).values({
      userId,
      type,
      title,
      message,
      severity,
      locationId: subscription.locationId,
      entityType: "subscription",
      entityId: subscription.id,
      priority: 0,
      highlightState: "highlighted",
      lastHighlightedAt: now,
      highlightCount: 1,
    } as typeof notifications.$inferInsert);
    return "created";
  }

  if (existing.clearedAt || existing.archivedAt) {
    await db
      .update(notifications)
      .set({
        highlightState: "highlighted",
        fadedAt: null,
        lastHighlightedAt: now,
        highlightCount: existing.highlightCount + 1,
        archivedAt: null,
        clearedAt: null,
        clearedReason: null,
        isRead: false,
        severity,
        title,
        message,
      })
      .where(eq(notifications.id, existing.id));
    return "rehighlighted";
  }

  const update = applyReHighlight(
    {
      id: existing.id,
      highlightState: existing.highlightState,
      fadedAt: existing.fadedAt ?? null,
      lastHighlightedAt: existing.lastHighlightedAt,
      highlightCount: existing.highlightCount,
      archivedAt: existing.archivedAt ?? null,
      clearedAt: existing.clearedAt ?? null,
      clearedReason: existing.clearedReason ?? null,
    },
    now,
  );
  await db
    .update(notifications)
    .set({
      highlightState: update.highlightState,
      fadedAt: update.fadedAt,
      lastHighlightedAt: update.lastHighlightedAt ?? now,
      highlightCount: update.highlightCount,
      severity,
      message,
    })
    .where(eq(notifications.id, existing.id));
  return "rehighlighted";
}

/** Escalate an existing overdue notification to critical past the 3-day threshold. */
async function escalateOverdue(db: DbClient, notificationId: number, severity: Severity, message: string): Promise<void> {
  await db.update(notifications).set({ severity, message }).where(eq(notifications.id, notificationId));
}

/** Auto-renew: advance one cycle and record a pending (unconfirmed) payment for the cycle just left. */
async function autoAdvance(db: DbClient, subscription: Subscription): Promise<boolean> {
  const [existing] = await db
    .select({ id: subscriptionPayments.id })
    .from(subscriptionPayments)
    .where(
      and(
        eq(subscriptionPayments.subscriptionId, subscription.id),
        eq(subscriptionPayments.cycleDueDate, subscription.nextDueDate),
        isNull(subscriptionPayments.deletedAt),
      ),
    )
    .limit(1);
  if (!existing) {
    await db.insert(subscriptionPayments).values({
      subscriptionId: subscription.id,
      businessId: subscription.businessId,
      locationId: subscription.locationId ?? subscription.postingLocationId,
      cycleDueDate: subscription.nextDueDate,
      amount: subscription.amount,
      currency: subscription.currency,
      paidDate: null,
      accountId: subscription.defaultAccountId,
      confirmed: false,
      recordedBy: subscription.createdBy,
    } as typeof subscriptionPayments.$inferInsert);
  }
  const nextDueDate = advanceDueDate(subscription.nextDueDate, subscription.cycleUnit as CycleUnit, subscription.cycleCount);
  await db.update(subscriptions).set({ nextDueDate }).where(eq(subscriptions.id, subscription.id));
  return true;
}

/**
 * Run one subscription sweep across all businesses. Idempotent: repeated runs upsert
 * (never duplicate) notifications and skip already-advanced cycles.
 */
export async function runSubscriptionSweep(db: DbClient, now: Date = new Date()): Promise<SweepResult> {
  const today = toDateString(now);
  const inThreeDays = addDays(today, 3);
  const result: SweepResult = {
    dueSoonCreated: 0,
    dueSoonReHighlighted: 0,
    dueTodayReHighlighted: 0,
    overdueCreated: 0,
    overdueEscalated: 0,
    pendingPaymentsCreated: 0,
    autoAdvanced: 0,
    trialEnding: 0,
    billsMaterialized: 0,
  };

  const businessRows = await db
    .selectDistinct({ businessId: subscriptions.businessId })
    .from(subscriptions)
    .where(and(isNull(subscriptions.deletedAt), inArray(subscriptions.status, ["active", "paused"])));

  for (const { businessId } of businessRows) {
    const subs = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.businessId, businessId), isNull(subscriptions.deletedAt)));
    const eligibleUsers = await loadEligibleUsers(db, businessId);
    const notifyDaysRaw = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(and(eq(appSettings.businessId, businessId), eq(appSettings.key, "subscriptions_default_notify_days")))
      .limit(1);
    const defaultNotifyDays = Number(notifyDaysRaw[0]?.value ?? "7") || 7;

    for (const sub of subs) {
      const audience = eligibleUsers.filter((u) => userSeesSubscription(u, sub));
      // Spec §6.1: the subscription's creator is always notified while still an active member.
      if (sub.createdBy && !audience.some((u) => u.id === sub.createdBy)) {
        const [creator] = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.id, sub.createdBy), eq(users.isActive, true), isNull(users.deletedAt)))
          .limit(1);
        if (creator) audience.push({ id: creator.id, allLocationIds: [] });
      }

      if (sub.status === "active" && !sub.isOneTime) {
        await handleScheduleEvents(db, sub, audience, today, defaultNotifyDays, now, result);
      }
      if (sub.status === "active" && sub.postingMode === "bill") {
        // Bill mode accrues an AP obligation on the due date; the cycle's schedule advance
        // happens here, so the auto-renew step is skipped for these subscriptions.
        await handleBillMaterialization(db, sub, audience, today, now, result);
      } else if (sub.status === "active") {
        await handleAutoRenew(db, sub, audience, today, now, result);
      }
      if (sub.status === "active" && sub.trialEndsAt && sub.trialEndsAt >= today && sub.trialEndsAt <= inThreeDays) {
        for (const user of audience) {
          const outcome = await upsertNotification(db, {
            userId: user.id,
            subscription: sub,
            type: "subscription_trial_ending",
            severity: "info",
            title: `${sub.name} trial ends in ${daysBetween(sub.trialEndsAt, today)} days`,
            message: `Trial for ${sub.name} ends on ${sub.trialEndsAt}.`,
            now,
          });
          if (outcome === "created") result.trialEnding += 1;
        }
      }
    }
  }
  return result;
}

async function handleScheduleEvents(
  db: DbClient,
  sub: Subscription,
  audience: EligibleUser[],
  today: string,
  defaultNotifyDays: number,
  now: Date,
  result: SweepResult,
): Promise<void> {
  const daysUntilDue = daysBetween(sub.nextDueDate, today);
  const notifyDays = sub.notifyDaysBefore ?? defaultNotifyDays;

  if (daysUntilDue > 0 && daysUntilDue <= notifyDays && sub.notifyEnabled) {
    for (const user of audience) {
      const outcome = await upsertNotification(db, {
        userId: user.id,
        subscription: sub,
        type: "subscription_due_soon",
        severity: "info",
        title: `${sub.name} renews in ${daysUntilDue} days (${sub.currency} ${d(sub.amount).toFixed(2)})`,
        message: `${sub.name} is due on ${sub.nextDueDate}.`,
        now,
      });
      if (outcome === "created") result.dueSoonCreated += 1;
      else result.dueSoonReHighlighted += 1;
    }
    return;
  }

  if (daysUntilDue === 0 && sub.notifyEnabled) {
    for (const user of audience) {
      const outcome = await upsertNotification(db, {
        userId: user.id,
        subscription: sub,
        type: "subscription_due",
        severity: "warning",
        title: `${sub.name} is due today`,
        message: `${sub.name} (${sub.currency} ${d(sub.amount).toFixed(2)}) is due today.`,
        now,
      });
      if (outcome === "created") result.dueSoonCreated += 1;
      else result.dueTodayReHighlighted += 1;
    }
    return;
  }

  if (daysUntilDue < 0) {
    const overdueDays = Math.abs(daysUntilDue);
    const severity: Severity = overdueDays >= 3 ? "critical" : "warning";
    for (const user of audience) {
      const outcome = await upsertNotification(db, {
        userId: user.id,
        subscription: sub,
        type: "subscription_overdue",
        severity,
        title: `${sub.name} renewal overdue by ${overdueDays} days`,
        message: `${sub.name} (${sub.currency} ${d(sub.amount).toFixed(2)}) was due on ${sub.nextDueDate}.`,
        now,
      });
      if (outcome === "created") result.overdueCreated += 1;
      else if (severity === "critical") {
        await escalateOverdueForUser(db, user.id, sub, severity, overdueDays);
        result.overdueEscalated += 1;
      }
    }
  }
}

async function escalateOverdueForUser(
  db: DbClient,
  userId: number,
  sub: Subscription,
  severity: Severity,
  overdueDays: number,
): Promise<void> {
  const [row] = await db
    .select({ id: notifications.id, severity: notifications.severity })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.entityType, "subscription"),
        eq(notifications.entityId, sub.id),
        eq(notifications.type, "subscription_overdue"),
      ),
    )
    .limit(1);
  if (row && row.severity !== severity) {
    await escalateOverdue(db, row.id, severity, `${sub.name} renewal overdue by ${overdueDays} days`);
  }
}

/**
 * Bill-mode accrual: on/after each due date create the pending bill (with expense/AP ledger
 * entries), a pending payment row to settle, and a "mark paid" notification. Bounded
 * catch-up of up to 12 cycles per run; idempotent via the subscription bill external key.
 */
async function handleBillMaterialization(
  db: DbClient,
  sub: Subscription,
  audience: EligibleUser[],
  today: string,
  now: Date,
  result: SweepResult,
): Promise<void> {
  if (sub.nextDueDate > today) return;
  let due = sub.nextDueDate;
  let cycles = 0;
  while (due <= today && cycles < 12) {
    try {
      const materialized = await materializeSubscriptionBill(db, {
        subscription: { ...sub, nextDueDate: due },
        cycleDueDate: due,
        userId: sub.createdBy,
      });
      if (materialized.created) result.billsMaterialized += 1;

      const [existingPayment] = await db
        .select({ id: subscriptionPayments.id })
        .from(subscriptionPayments)
        .where(
          and(
            eq(subscriptionPayments.subscriptionId, sub.id),
            eq(subscriptionPayments.cycleDueDate, due),
            isNull(subscriptionPayments.deletedAt),
          ),
        )
        .limit(1);
      if (!existingPayment) {
        await db.insert(subscriptionPayments).values({
          subscriptionId: sub.id,
          businessId: sub.businessId,
          locationId: sub.locationId ?? sub.postingLocationId,
          cycleDueDate: due,
          amount: sub.amount,
          currency: sub.currency,
          paidDate: null,
          accountId: sub.defaultAccountId,
          confirmed: false,
          recordedBy: sub.createdBy,
          billId: materialized.billId,
        } as typeof subscriptionPayments.$inferInsert);
        result.pendingPaymentsCreated += 1;
        for (const user of audience) {
          await upsertNotification(db, {
            userId: user.id,
            subscription: sub,
            type: "subscription_pending_payment",
            severity: "warning",
            title: `Bill created for ${sub.name}`,
            message: `Bill ${materialized.billNumber} (${sub.currency} ${d(sub.amount).toFixed(2)}) was created for the ${due} cycle. Mark it paid to settle it.`,
            now,
          });
        }
      }
      due = advanceDueDate(due, sub.cycleUnit as CycleUnit, sub.cycleCount);
      cycles += 1;
    } catch (error) {
      console.error("[subscriptions] bill materialization failed", sub.id, due, error);
      break;
    }
  }
  if (cycles > 0) {
    await db.update(subscriptions).set({ nextDueDate: due }).where(eq(subscriptions.id, sub.id));
  }
}

async function handleAutoRenew(
  db: DbClient,
  sub: Subscription,
  audience: EligibleUser[],
  today: string,
  now: Date,
  result: SweepResult,
): Promise<void> {
  if (!sub.autoRenew || sub.nextDueDate > today) return;
  const before = await db
    .select({ id: subscriptionPayments.id })
    .from(subscriptionPayments)
    .where(and(eq(subscriptionPayments.subscriptionId, sub.id), eq(subscriptionPayments.cycleDueDate, sub.nextDueDate), isNull(subscriptionPayments.deletedAt)))
    .limit(1);
  await autoAdvance(db, sub);
  result.autoAdvanced += 1;
  if (before.length === 0) {
    result.pendingPaymentsCreated += 1;
    for (const user of audience) {
      await upsertNotification(db, {
        userId: user.id,
        subscription: sub,
        type: "subscription_pending_payment",
        severity: "warning",
        title: `Confirm ${sub.name} payment (auto-renewed)`,
        message: `${sub.name} auto-renewed for ${sub.currency} ${d(sub.amount).toFixed(2)}. Confirm the payment to post it to accounting.`,
        now,
      });
    }
  }
}
