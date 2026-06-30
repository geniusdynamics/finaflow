// ABOUTME: tRPC router for the notifications panel — list, click-fade, clear, archive.
// ABOUTME: Replaces the previous duplicate-generation pattern with a single-record
// ABOUTME: state machine (highlighted → faded → re-highlighted) and automatic
// ABOUTME: clearance on action completion (bill payment, manual clear-all, etc.).
import { z } from "zod";
import { createRouter, authedQuery, getCurrentBusinessLocationIds, getRolePermissionsWithCache, PERMISSIONS } from "./middleware";
import { getDb } from "./queries/connection";
import { notifications, bills } from "@db/schema";
import { eq, and, desc, sql, isNull, inArray } from "drizzle-orm";
import {
  applyClear,
  applyClickFade,
  applyReHighlight,
  shouldReHighlight,
  type ClearedReason,
  type NotificationLifecycleRecord,
} from "./lib/notification-lifecycle";

function canViewBills(role: string): boolean {
  return getRolePermissionsWithCache(role).includes(PERMISSIONS.BILLS_VIEW);
}

// Re-helper: convert a DB row into the lifecycle record interface
function toLifecycleRecord(row: typeof notifications.$inferSelect): NotificationLifecycleRecord {
  return {
    id: row.id,
    highlightState: row.highlightState,
    fadedAt: row.fadedAt ?? null,
    lastHighlightedAt: row.lastHighlightedAt,
    highlightCount: row.highlightCount,
    archivedAt: row.archivedAt ?? null,
    clearedAt: row.clearedAt ?? null,
    clearedReason: row.clearedReason ?? null,
  };
}

export const notificationsRouter = createRouter({
  // List active (non-archived) notifications for current user
  list: authedQuery
    .input(
      z
        .object({
          limit: z.number().default(20),
          unreadOnly: z.boolean().default(false),
          includeArchived: z.boolean().default(false),
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user = (ctx as any).user;
      const userId = user?.id;
      const cond = [eq(notifications.userId, userId)];
      if (!input?.includeArchived) {
        cond.push(isNull(notifications.archivedAt));
        cond.push(isNull(notifications.clearedAt));
      }
      if (input?.unreadOnly) cond.push(eq(notifications.isRead, false));
      if (!canViewBills(user?.role ?? "viewer")) {
        cond.push(sql`${notifications.entityType} IS DISTINCT FROM 'bill'`);
      }
      return db
        .select()
        .from(notifications)
        .where(and(...cond))
        .orderBy(desc(notifications.createdAt))
        .limit(input?.limit ?? 20);
    }),

  // List archived (cleared) notifications for the historical log
  listArchived: authedQuery
    .input(z.object({ limit: z.number().default(50) }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (ctx as any).user?.id;
      return db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            sql`${notifications.archivedAt} IS NOT NULL`,
          ),
        )
        .orderBy(desc(notifications.archivedAt))
        .limit(input?.limit ?? 50);
    }),

  // Mark as read
  markRead: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, input.id));
      return { success: true };
    }),

  markAllRead: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (ctx as any).user?.id;
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.userId, userId),
          isNull(notifications.clearedAt),
        ),
      );
    return { success: true };
  }),

  /**
   * Click-fade: the user viewed the notification details.
   * Transitions highlighted → faded. Idempotent.
   */
  clickFade: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (ctx as any).user?.id;
      const [row] = await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.id, input.id), eq(notifications.userId, userId)))
        .limit(1);
      if (!row) return { success: false, reason: "not_found" as const };
      const update = applyClickFade(toLifecycleRecord(row));
      await db
        .update(notifications)
        .set({
          highlightState: update.highlightState,
          fadedAt: update.fadedAt,
          isRead: true,
        })
        .where(eq(notifications.id, input.id));
      return { success: true, highlightState: update.highlightState };
    }),

  /**
   * Dismiss: the user explicitly dismissed the notification from the panel.
   * Removes it from the active list and archives it.
   */
  dismiss: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (ctx as any).user?.id;
      const [row] = await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.id, input.id), eq(notifications.userId, userId)))
        .limit(1);
      if (!row) return { success: false, reason: "not_found" as const };
      const now = new Date();
      const update = applyClear(toLifecycleRecord(row), "user_dismissed", now);
      await db
        .update(notifications)
        .set({
          highlightState: update.highlightState,
          archivedAt: update.archivedAt,
          clearedAt: update.clearedAt,
          clearedReason: update.clearedReason,
        })
        .where(eq(notifications.id, input.id));
      return { success: true };
    }),

  /**
   * Clear All: archive every active notification for the current user.
   * Used by the "Clear All Notifications" UI button.
   */
  clearAll: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (ctx as any).user?.id;
    const now = new Date();
    const result = await db
      .update(notifications)
      .set({
        highlightState: "archived",
        archivedAt: now,
        clearedAt: now,
        clearedReason: "manual_clear_all",
      })
      .where(
        and(
          eq(notifications.userId, userId),
          isNull(notifications.clearedAt),
        ),
      )
      .returning({ id: notifications.id });
    return { success: true, cleared: result.length };
  }),

  /**
   * clearForEntity: automatic clearance hook used by other routers
   * (e.g. bills.recordPayment) when the underlying action is completed.
   * Archives any active notifications for the entity.
   */
  clearForEntity: authedQuery
    .input(
      z.object({
        entityType: z.string(),
        entityId: z.number(),
        reason: z.enum([
          "user_dismissed",
          "bill_paid",
          "action_completed",
          "manual_clear_all",
          "system_resolved",
        ]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (ctx as any).user?.id;
      const now = new Date();
      const reason: ClearedReason = input.reason;
      const active = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.entityType, input.entityType),
            eq(notifications.entityId, input.entityId),
            isNull(notifications.clearedAt),
          ),
        );
      let cleared = 0;
      for (const row of active) {
        const update = applyClear(toLifecycleRecord(row), reason, now);
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
      return { success: true, cleared };
    }),

  /**
   * autoReHighlight: background sweep — re-highlight any faded notifications
   * that have been idle for 24h+ or whose underlying entity is overdue.
   * Returns the number of rows that transitioned back to highlighted.
   */
  autoReHighlight: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = (ctx as any).user;
    const userId = user?.id;
    const userCanViewBills = canViewBills(user?.role ?? "viewer");
    const now = new Date();
    const fadedRows = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.highlightState, "faded"),
          isNull(notifications.clearedAt),
          isNull(notifications.archivedAt),
          userCanViewBills ? undefined : sql`${notifications.entityType} IS DISTINCT FROM 'bill'`,
        ),
      );

    // Pre-fetch overdue bill ids for bill-typed notifications
    const billIds = userCanViewBills
      ? fadedRows
          .filter((r) => r.entityType === "bill" && r.entityId != null)
          .map((r) => Number(r.entityId))
      : [];
    const today = new Date().toISOString().split("T")[0];
    const overdueBillIds = new Set<number>();
    if (billIds.length > 0) {
      const locIds = await getCurrentBusinessLocationIds(ctx);
      const overdueBills = await db
        .select({ id: bills.id })
        .from(bills)
        .where(
          and(
            inArray(bills.id, billIds),
            sql`${bills.dueDate} < ${today}`,
            sql`${bills.balanceDue} > 0`,
            isNull(bills.deletedAt),
            locIds.length > 0
              ? sql`${bills.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`
              : sql`1=0`,
          ),
        );
      for (const b of overdueBills) overdueBillIds.add(b.id);
    }

    let reHighlighted = 0;
    for (const row of fadedRows) {
      const isOverdue =
        row.entityType === "bill" && row.entityId != null
          ? overdueBillIds.has(Number(row.entityId))
          : false;
      const lifecycle = toLifecycleRecord(row);
      if (!shouldReHighlight(lifecycle, { isOverdue, now })) continue;
      const update = applyReHighlight(lifecycle, now);
      await db
        .update(notifications)
        .set({
          highlightState: update.highlightState,
          fadedAt: update.fadedAt,
          lastHighlightedAt: update.lastHighlightedAt,
          highlightCount: update.highlightCount,
        })
        .where(eq(notifications.id, row.id));
      reHighlighted++;
    }
    return { success: true, reHighlighted };
  }),

  // Delete notification (hard delete — used by tests/admin only)
  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(notifications).where(eq(notifications.id, input.id));
      return { success: true };
    }),

  // Get unread count (excludes cleared/archived rows)
  unreadCount: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = (ctx as any).user;
    const userId = user?.id;
    const cond = [
      eq(notifications.userId, userId),
      eq(notifications.isRead, false),
      isNull(notifications.clearedAt),
    ];
    if (!canViewBills(user?.role ?? "viewer")) {
      cond.push(sql`${notifications.entityType} IS DISTINCT FROM 'bill'`);
    }
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(notifications)
      .where(and(...cond));
    return result?.count ?? 0;
  }),

  // Get active highlighted count for the bell badge
  highlightedCount: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = (ctx as any).user;
    const userId = user?.id;
    const cond = [
      eq(notifications.userId, userId),
      eq(notifications.highlightState, "highlighted"),
      isNull(notifications.clearedAt),
    ];
    if (!canViewBills(user?.role ?? "viewer")) {
      cond.push(sql`${notifications.entityType} IS DISTINCT FROM 'bill'`);
    }
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(notifications)
      .where(and(...cond));
    return result?.count ?? 0;
  }),

  /**
   * generateOverdueNotifications: idempotent upsert of overdue-bill notifications.
   * Replaces the prior duplicate-generation pattern: a single record per
   * (userId, entityType='bill', entityId) is kept, and a faded one is
   * re-highlighted back to "highlighted" instead of creating a new row.
   */
  generateOverdueNotifications: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = (ctx as any).user;
    const userId = user?.id;
    if (!canViewBills(user?.role ?? "viewer")) {
      return { created: 0, reHighlighted: 0 };
    }
    const today = new Date().toISOString().split("T")[0];

    const locIds = await getCurrentBusinessLocationIds(ctx);
    if (locIds.length === 0) return { created: 0, reHighlighted: 0 };

    const overdueBills = await db
      .select()
      .from(bills)
      .where(
        and(
          sql`${bills.dueDate} < ${today}`,
          sql`${bills.balanceDue} > 0`,
          isNull(bills.deletedAt),
          sql`${bills.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`,
        ),
      )
      .orderBy(desc(bills.dueDate))
      .limit(50);

    let created = 0;
    let reHighlighted = 0;
    const now = new Date();
    for (const bill of overdueBills) {
      const [existing] = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.entityType, "bill"),
            eq(notifications.entityId, bill.id),
            eq(notifications.type, "overdue_bill"),
          ),
        )
        .limit(1);

      if (!existing) {
        // No record yet — create the single source-of-truth row in highlighted state.
        await db.insert(notifications).values({
          userId,
          type: "overdue_bill",
          title: `Overdue Bill: ${bill.billNumber ?? `BILL-${bill.id}`}`,
          message: `${bill.description} — Balance: KES ${bill.balanceDue} (Due: ${bill.dueDate})`,
          severity: "critical",
          locationId: bill.locationId,
          entityType: "bill",
          entityId: bill.id,
          highlightState: "highlighted",
          lastHighlightedAt: now,
          highlightCount: 1,
        } as typeof notifications.$inferInsert);
        created++;
        continue;
      }

      if (existing.clearedAt || existing.archivedAt) {
        // The bill was already paid (or the user dismissed/cleared it) but
        // is now overdue again. Re-open the same record by re-highlighting
        // and clearing the archive/cleared flags.
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
            message: `${bill.description} — Balance: KES ${bill.balanceDue} (Due: ${bill.dueDate})`,
          })
          .where(eq(notifications.id, existing.id));
        reHighlighted++;
        continue;
      }

      if (existing.highlightState === "faded") {
        // Faded but still active — flip back to highlighted (single record).
        const lifecycle = toLifecycleRecord(existing);
        const update = applyReHighlight(lifecycle, now);
        await db
          .update(notifications)
          .set({
            highlightState: update.highlightState,
            fadedAt: update.fadedAt,
            lastHighlightedAt: update.lastHighlightedAt,
            highlightCount: update.highlightCount,
            isRead: false,
          })
          .where(eq(notifications.id, existing.id));
        reHighlighted++;
      }
      // If already 'highlighted', nothing to do — single record, no duplicate.
    }
    return { created, reHighlighted };
  }),
});
