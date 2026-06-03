// ABOUTME: Side-effecting helper that archives any active notifications linked to a bill
// ABOUTME: when the bill is paid. Called from the bills-router recordPayment mutation so
// ABOUTME: users see the notification disappear the moment they submit a payment.
// ABOUTME: Idempotent — if no matching notifications exist, this is a no-op.
import { eq, and, isNull } from "drizzle-orm";
import type { DbClient } from "./account-subscriptions";
import { notifications } from "@db/schema";
import { applyClear } from "./notification-lifecycle";

/**
 * Archive any active notifications tied to the given bill (entityType='bill',
 * entityId=id). Reason is recorded as 'bill_paid' for the historical log.
 *
 * Returns the number of rows that were archived.
 */
export async function clearNotificationsForBill(
  db: DbClient,
  args: { userId: number; billId: number; now?: Date },
): Promise<number> {
  const now = args.now ?? new Date();
  const active = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, args.userId),
        eq(notifications.entityType, "bill"),
        eq(notifications.entityId, args.billId),
        isNull(notifications.clearedAt),
      ),
    );
  let cleared = 0;
  for (const row of active) {
    const update = applyClear(
      {
        id: row.id,
        highlightState: row.highlightState,
        fadedAt: row.fadedAt ?? null,
        lastHighlightedAt: row.lastHighlightedAt,
        highlightCount: row.highlightCount,
        archivedAt: row.archivedAt ?? null,
        clearedAt: row.clearedAt ?? null,
        clearedReason: row.clearedReason ?? null,
      },
      "bill_paid",
      now,
    );
    await db
      .update(notifications)
      .set({
        highlightState: update.highlightState,
        archivedAt: update.archivedAt,
        clearedAt: update.clearedAt,
        clearedReason: update.clearedReason,
      })
      .where(eq(notifications.id, row.id));
    cleared++;
  }
  return cleared;
}
