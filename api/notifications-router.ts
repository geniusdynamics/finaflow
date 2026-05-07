import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { notifications, bills } from "@db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const notificationsRouter = createRouter({
  // List notifications for current user
  list: authedQuery
    .input(z.object({ limit: z.number().default(20), unreadOnly: z.boolean().default(false) }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const userId = (ctx as any).user?.id;
      const cond = [eq(notifications.userId, userId)];
      if (input?.unreadOnly) cond.push(eq(notifications.isRead, false));
      return db.select().from(notifications).where(and(...cond)).orderBy(desc(notifications.createdAt)).limit(input?.limit ?? 20);
    }),

  // Mark as read
  markRead: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, input.id));
      return { success: true };
    }),

  markAllRead: authedQuery
    .mutation(async ({ ctx }) => {
      const db = getDb();
      const userId = (ctx as any).user?.id;
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
      return { success: true };
    }),

  // Delete notification
  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(notifications).where(eq(notifications.id, input.id));
      return { success: true };
    }),

  // Get unread count
  unreadCount: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = (ctx as any).user?.id;
    const [result] = await db.select({ count: sql<number>`COUNT(*)` }).from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return result?.count ?? 0;
  }),

  // Auto-generate overdue bill notifications
  generateOverdueNotifications: authedQuery
    .mutation(async ({ ctx }) => {
      const db = getDb();
      const userId = (ctx as any).user?.id;
      const today = new Date().toISOString().split("T")[0];

      // Find overdue bills without existing notifications
      const overdueBills = await db.select().from(bills).where(
        and(sql`${bills.dueDate} < ${today}`, sql`${bills.balanceDue} > 0`, sql`${bills.deletedAt} IS NULL`)
      ).orderBy(desc(bills.dueDate)).limit(50);

      let created = 0;
      for (const bill of overdueBills) {
        // Check if notification already exists for this bill
        const existing = await db.select().from(notifications).where(
          and(eq(notifications.entityType, "bill"), eq(notifications.entityId, bill.id), eq(notifications.type, "overdue_bill"))
        ).limit(1);

        if (existing.length === 0) {
          await db.insert(notifications).values({
            userId,
            type: "overdue_bill",
            title: `Overdue Bill: ${bill.billNumber ?? `BILL-${bill.id}`}`,
            message: `${bill.description} — Balance: KES ${bill.balanceDue} (Due: ${bill.dueDate})`,
            severity: "critical",
            locationId: bill.locationId,
            entityType: "bill",
            entityId: bill.id,
          } as any);
          created++;
        }
      }
      return { created };
    }),
});
