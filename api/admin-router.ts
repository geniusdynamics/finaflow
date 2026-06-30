// ABOUTME: Platform-wide admin analytics and configuration endpoints.
// ABOUTME: Accessible only to users whose accountId matches SUPER_ADMIN_ACCOUNT.
import { z } from "zod";
import { createRouter, adminProcedure } from "./middleware";
import { getDb } from "./queries/connection";
import { users, customerAccounts, userSessions, notifications, emailLogs, ownerBroadcasts, businesses } from "@db/schema";
import { eq, and, or, sql, isNull, desc, gte, lte, type SQL } from "drizzle-orm";
import { isEmailConfigured } from "./lib/email";
import { sendLoggedEmail } from "./lib/logged-email";
import { ownerBroadcastHtml, ownerBroadcastText } from "./lib/email-templates";
import { updateEnvVar } from "./lib/update-env";
import { env } from "./lib/env";

const dateRangeInput = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

function parseDateRange(input: z.infer<typeof dateRangeInput>): { from?: Date; to?: Date } {
  return {
    from: input.from ? new Date(input.from) : undefined,
    to: input.to ? new Date(input.to) : undefined,
  };
}

type DateRange = { from?: Date; to?: Date };

function withDateRange(conds: SQL<unknown>[], dateCol: typeof userSessions.loginAt, range: DateRange): SQL<unknown>[] {
  if (range.from) conds.push(gte(dateCol, range.from));
  if (range.to) conds.push(lte(dateCol, range.to));
  return conds;
}

export const adminRouter = createRouter({
  // Verify the caller is the configured super admin.
  verify: adminProcedure.query(() => ({ isSuperAdmin: true })),

  getLoginStats: adminProcedure
    .input(dateRangeInput)
    .query(async ({ input }) => {
      const db = getDb();
      const range = parseDateRange(input);

      const totalLogins = await db.select({ count: sql<number>`COUNT(*)` }).from(userSessions)
        .where(and(...withDateRange([eq(userSessions.action, "login")], userSessions.loginAt, range)));
      const uniqueUsers = await db.select({ count: sql<number>`COUNT(DISTINCT ${userSessions.userId})` }).from(userSessions)
        .where(and(...withDateRange([eq(userSessions.action, "login")], userSessions.loginAt, range)));
      const totalLogouts = await db.select({ count: sql<number>`COUNT(*)` }).from(userSessions)
        .where(and(...withDateRange([eq(userSessions.action, "logout")], userSessions.loginAt, range)));

      const daily = await db.select({
        date: sql<string>`DATE(${userSessions.loginAt})`,
        count: sql<number>`COUNT(*)`,
        uniqueUsers: sql<number>`COUNT(DISTINCT ${userSessions.userId})`,
      }).from(userSessions)
        .where(and(...withDateRange([eq(userSessions.action, "login")], userSessions.loginAt, range)))
        .groupBy(sql`DATE(${userSessions.loginAt})`)
        .orderBy(sql`DATE(${userSessions.loginAt})`);

      return {
        totalLogins: totalLogins[0]?.count ?? 0,
        uniqueUsers: uniqueUsers[0]?.count ?? 0,
        totalLogouts: totalLogouts[0]?.count ?? 0,
        daily,
      };
    }),

  getActiveAccounts: adminProcedure
    .input(dateRangeInput)
    .query(async ({ input }) => {
      const db = getDb();
      const range = parseDateRange(input);

      const accountActivity = await db.select({
        accountId: userSessions.accountId,
        uniqueUsers: sql<number>`COUNT(DISTINCT ${userSessions.userId})`,
        totalLogins: sql<number>`COUNT(*)`,
        lastLogin: sql<Date | null>`MAX(${userSessions.loginAt})`,
      }).from(userSessions)
        .where(and(...withDateRange([
          eq(userSessions.action, "login"),
          sql`${userSessions.accountId} IS NOT NULL`,
        ], userSessions.loginAt, range)))
        .groupBy(userSessions.accountId)
        .orderBy(desc(sql`MAX(${userSessions.loginAt})`));

      const accountIds = accountActivity.map((row) => row.accountId).filter(Boolean) as string[];
      const accountsData = accountIds.length > 0
        ? await db.select().from(customerAccounts).where(sql`${customerAccounts.accountId} IN (${sql.join(accountIds.map(id => sql`${id}`), sql`, `)})`)
        : [];
      const accountMap = new Map(accountsData.map((a) => [a.accountId, a]));

      return accountActivity.map((row) => {
        const account = row.accountId ? accountMap.get(row.accountId) : null;
        return {
          accountId: row.accountId,
          accountName: account?.name ?? null,
          plan: account?.plan ?? null,
          subscriptionStatus: account?.subscriptionStatus ?? null,
          uniqueUsers: row.uniqueUsers,
          totalLogins: row.totalLogins,
          lastLogin: row.lastLogin,
        };
      });
    }),

  getNewUsers: adminProcedure
    .input(dateRangeInput)
    .query(async ({ input }) => {
      const db = getDb();
      const range = parseDateRange(input);
      const userFilters: SQL<unknown>[] = [isNull(users.deletedAt)];
      if (range.from) userFilters.push(gte(users.createdAt, range.from));
      if (range.to) userFilters.push(lte(users.createdAt, range.to));

      const newUsers = await db.select().from(users)
        .where(and(...userFilters))
        .orderBy(desc(users.createdAt));

      const userIds = newUsers.map((u) => u.id);
      const loginStats = userIds.length > 0
        ? await db.select({
            userId: userSessions.userId,
            loginCount: sql<number>`COUNT(*)`,
            lastLogin: sql<Date | null>`MAX(${userSessions.loginAt})`,
            avgDuration: sql<number | null>`AVG(${userSessions.sessionDuration})`,
          }).from(userSessions)
            .where(and(eq(userSessions.action, "login"), sql`${userSessions.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`))
            .groupBy(userSessions.userId)
        : [];
      const loginMap = new Map(loginStats.map((row) => [row.userId, row]));

      return newUsers.map((user) => {
        const stats = loginMap.get(user.id);
        return {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          accountId: user.accountId,
          createdAt: user.createdAt,
          loginCount: stats?.loginCount ?? 0,
          lastLogin: stats?.lastLogin ?? null,
          avgSessionDuration: stats?.avgDuration ?? null,
        };
      });
    }),

  getSessionDuration: adminProcedure
    .input(dateRangeInput)
    .query(async ({ input }) => {
      const db = getDb();
      const range = parseDateRange(input);

      const overall = await db.select({
        avgDuration: sql<number | null>`AVG(${userSessions.sessionDuration})`,
        maxDuration: sql<number | null>`MAX(${userSessions.sessionDuration})`,
        totalSessions: sql<number>`COUNT(*)`,
      }).from(userSessions)
        .where(and(...withDateRange([
          eq(userSessions.action, "logout"),
          sql`${userSessions.sessionDuration} IS NOT NULL`,
        ], userSessions.loginAt, range)));

      const byAccount = await db.select({
        accountId: userSessions.accountId,
        avgDuration: sql<number | null>`AVG(${userSessions.sessionDuration})`,
        sessions: sql<number>`COUNT(*)`,
      }).from(userSessions)
        .where(and(...withDateRange([
          eq(userSessions.action, "logout"),
          sql`${userSessions.sessionDuration} IS NOT NULL`,
          sql`${userSessions.accountId} IS NOT NULL`,
        ], userSessions.loginAt, range)))
        .groupBy(userSessions.accountId)
        .orderBy(desc(sql`AVG(${userSessions.sessionDuration})`));

      return {
        overall: overall[0],
        byAccount,
      };
    }),

  getPlanStats: adminProcedure
    .input(dateRangeInput)
    .query(async ({ input }) => {
      const db = getDb();
      const range = parseDateRange(input);
      const filters: SQL<unknown>[] = [isNull(customerAccounts.deletedAt)];
      if (range.from) filters.push(gte(customerAccounts.createdAt, range.from));
      if (range.to) filters.push(lte(customerAccounts.createdAt, range.to));

      const plans = await db.select({
        plan: customerAccounts.plan,
        count: sql<number>`COUNT(*)`,
      }).from(customerAccounts)
        .where(and(...filters))
        .groupBy(customerAccounts.plan);

      const statuses = await db.select({
        status: customerAccounts.subscriptionStatus,
        count: sql<number>`COUNT(*)`,
      }).from(customerAccounts)
        .where(and(...filters))
        .groupBy(customerAccounts.subscriptionStatus);

      const features = await db.select({
        features: customerAccounts.features,
      }).from(customerAccounts)
        .where(and(...filters));

      let extendedTrials = 0;
      for (const row of features) {
        const feats = row.features as Record<string, unknown> | null;
        if (feats && feats.trialExtended === true) extendedTrials++;
      }

      return {
        byPlan: plans,
        byStatus: statuses,
        extendedTrials,
        totalAccounts: plans.reduce((sum, row) => sum + row.count, 0),
      };
    }),

  getAccountList: adminProcedure
    .input(z.object({ search: z.string().optional(), limit: z.number().default(50), offset: z.number().default(0) }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const search = input?.search?.trim();
      const cond: (SQL<unknown> | undefined)[] = [isNull(customerAccounts.deletedAt)];
      if (search) {
        cond.push(or(
          sql`LOWER(${customerAccounts.accountId}) LIKE ${`%${search.toLowerCase()}%`}`,
          sql`LOWER(${customerAccounts.name}) LIKE ${`%${search.toLowerCase()}%`}`,
        ));
      }

      const list = await db.select().from(customerAccounts)
        .where(and(...cond.filter(Boolean) as SQL<unknown>[]))
        .orderBy(desc(customerAccounts.createdAt))
        .limit(input?.limit ?? 50)
        .offset(input?.offset ?? 0);

      const accountIds = list.map((a) => a.accountId);

      const userCounts = accountIds.length > 0
        ? await db.select({
            accountId: users.accountId,
            count: sql<number>`COUNT(*)`,
          }).from(users)
            .where(and(sql`${users.accountId} IN (${sql.join(accountIds.map(id => sql`${id}`), sql`, `)})`, isNull(users.deletedAt)))
            .groupBy(users.accountId)
        : [];
      const userCountMap = new Map(userCounts.map((row) => [row.accountId, row.count]));

      const businessCounts = accountIds.length > 0
        ? await db.select({
            accountId: businesses.accountId,
            count: sql<number>`COUNT(*)`,
          }).from(businesses)
            .where(sql`${businesses.accountId} IN (${sql.join(accountIds.map(id => sql`${id}`), sql`, `)})`)
            .groupBy(businesses.accountId)
        : [];
      const businessCountMap = new Map(businessCounts.map((row) => [row.accountId, row.count]));

      return list.map((account) => ({
        ...account,
        userCount: userCountMap.get(account.accountId) ?? 0,
        businessCount: businessCountMap.get(account.accountId) ?? 0,
      }));
    }),

  getSmtpConfig: adminProcedure.query(() => ({
    host: env.smtpHost,
    port: env.smtpPort,
    user: env.smtpUser,
    from: env.smtpFrom,
    hasPassword: !!process.env.SMTP_PASS,
    isConfigured: isEmailConfigured(),
  })),

  updateSmtpConfig: adminProcedure
    .input(z.object({
      host: z.string().min(1).optional(),
      port: z.string().min(1).optional(),
      user: z.string().min(1).optional(),
      pass: z.string().min(1).optional(),
      from: z.string().email().optional(),
    }))
    .mutation(async ({ input }) => {
      if (input.host !== undefined) updateEnvVar("SMTP_HOST", input.host);
      if (input.port !== undefined) updateEnvVar("SMTP_PORT", input.port);
      if (input.user !== undefined) updateEnvVar("SMTP_USER", input.user);
      if (input.pass !== undefined) updateEnvVar("SMTP_PASS", input.pass);
      if (input.from !== undefined) updateEnvVar("SMTP_FROM", input.from);
      return { success: true };
    }),

  sendTestEmail: adminProcedure
    .input(z.object({ to: z.string().email() }))
    .mutation(async ({ input }) => {
      const result = await sendLoggedEmail("smtp_test", {
        to: input.to,
        subject: "Finaflow SMTP Test",
        text: "This is a test email from your Finaflow admin dashboard.",
        html: "<p>This is a test email from your Finaflow admin dashboard.</p>",
      });
      return result;
    }),

  getEmailStats: adminProcedure
    .input(dateRangeInput)
    .query(async ({ input }) => {
      const db = getDb();
      const range = parseDateRange(input);
      const conds: SQL<unknown>[] = [];
      if (range.from) conds.push(gte(emailLogs.createdAt, range.from));
      if (range.to) conds.push(lte(emailLogs.createdAt, range.to));
      const where = conds.length > 0 ? and(...conds) : undefined;

      const total = await db.select({ count: sql<number>`COUNT(*)` }).from(emailLogs).where(where);
      const totalSent = await db.select({ count: sql<number>`COUNT(*)` }).from(emailLogs)
        .where(where ? and(where, eq(emailLogs.status, "sent")) : eq(emailLogs.status, "sent"));
      const totalFailed = await db.select({ count: sql<number>`COUNT(*)` }).from(emailLogs)
        .where(where ? and(where, eq(emailLogs.status, "failed")) : eq(emailLogs.status, "failed"));

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - today.getDay());

      const sentToday = await db.select({ count: sql<number>`COUNT(*)` }).from(emailLogs)
        .where(and(eq(emailLogs.status, "sent"), gte(emailLogs.sentAt, today), ...(where ? [where] : [])));
      const sentThisWeek = await db.select({ count: sql<number>`COUNT(*)` }).from(emailLogs)
        .where(and(eq(emailLogs.status, "sent"), gte(emailLogs.sentAt, thisWeekStart), ...(where ? [where] : [])));

      const byType = await db.select({
        type: emailLogs.type,
        count: sql<number>`COUNT(*)`,
      }).from(emailLogs)
        .where(where)
        .groupBy(emailLogs.type);

      const byStatus = await db.select({
        status: emailLogs.status,
        count: sql<number>`COUNT(*)`,
      }).from(emailLogs)
        .where(where)
        .groupBy(emailLogs.status);

      return {
        total: total[0]?.count ?? 0,
        totalSent: totalSent[0]?.count ?? 0,
        totalFailed: totalFailed[0]?.count ?? 0,
        sentToday: sentToday[0]?.count ?? 0,
        sentThisWeek: sentThisWeek[0]?.count ?? 0,
        byType,
        byStatus,
      };
    }),

  getEmailLogs: adminProcedure
    .input(z.object({
      limit: z.number().default(50),
      offset: z.number().default(0),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const logs = await db.select({
        id: emailLogs.id,
        type: emailLogs.type,
        status: emailLogs.status,
        createdAt: emailLogs.createdAt,
        sentAt: emailLogs.sentAt,
      }).from(emailLogs)
        .orderBy(desc(emailLogs.createdAt))
        .limit(input?.limit ?? 50)
        .offset(input?.offset ?? 0);
      return logs;
    }),

  sendOwnerBroadcast: adminProcedure
    .input(z.object({
      title: z.string().min(1).max(255),
      message: z.string().min(1),
      channels: z.array(z.enum(["email", "notification", "banner"])).min(1),
      linkUrl: z.string().url().optional(),
      linkLabel: z.string().min(1).max(255).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const user = (ctx as { user: { id: number } }).user;

      const owners = await db.select({
        id: users.id,
        email: users.email,
        name: users.name,
        username: users.username,
      }).from(users)
        .where(and(eq(users.role, "owner"), eq(users.isActive, true), isNull(users.deletedAt), sql`${users.email} IS NOT NULL`));

      const channels = input.channels;
      const sendEmailFlag = channels.includes("email");
      const sendNotification = channels.includes("notification");
      const sendBanner = channels.includes("banner");

      let emailsQueued = 0;
      let notificationsCreated = 0;

      for (const owner of owners) {
        if (sendEmailFlag && owner.email) {
          await sendLoggedEmail("owner_broadcast", {
            to: owner.email,
            subject: input.title,
            text: ownerBroadcastText(input.title, input.message),
            html: ownerBroadcastHtml(input.title, input.message),
          });
          emailsQueued++;
        }

        if (sendNotification || sendBanner) {
          await db.insert(notifications).values({
            userId: owner.id,
            type: "owner_broadcast",
            title: input.title,
            message: input.message,
            severity: "info",
            priority: 100,
            entityType: sendBanner ? "banner" : "broadcast",
            linkUrl: input.linkUrl,
            linkLabel: input.linkLabel,
            highlightState: "highlighted",
            lastHighlightedAt: new Date(),
            highlightCount: 1,
          } as typeof notifications.$inferInsert);
          notificationsCreated++;
        }
      }

      const [broadcast] = await db.insert(ownerBroadcasts).values({
        title: input.title,
        message: input.message,
        channels,
        sentBy: user.id,
        recipientCount: owners.length,
      } as typeof ownerBroadcasts.$inferInsert).returning({ id: ownerBroadcasts.id });

      return {
        success: true,
        broadcastId: broadcast?.id ?? null,
        recipientCount: owners.length,
        emailsQueued,
        notificationsCreated,
      };
    }),

  getOwnerBroadcasts: adminProcedure
    .input(z.object({
      limit: z.number().default(20),
      offset: z.number().default(0),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(ownerBroadcasts)
        .orderBy(desc(ownerBroadcasts.createdAt))
        .limit(input?.limit ?? 20)
        .offset(input?.offset ?? 0);
    }),

  getNotificationAnalytics: adminProcedure
    .query(async () => {
      const db = getDb();
      const broadcasts = await db.select().from(ownerBroadcasts)
        .orderBy(desc(ownerBroadcasts.createdAt));

      const broadcastIds = broadcasts.map((b) => b.id);
      const stats = broadcastIds.length > 0
        ? await db.select({
            broadcastId: notifications.entityId,
            reads: sql<number>`COUNT(CASE WHEN ${notifications.readAt} IS NOT NULL THEN 1 END)`,
            clicks: sql<number>`COALESCE(SUM(${notifications.linkClicks}), 0)`,
            dismissals: sql<number>`COUNT(CASE WHEN ${notifications.dismissedAt} IS NOT NULL THEN 1 END)`,
            recipients: sql<number>`COUNT(*)`,
          }).from(notifications)
            .where(and(
              eq(notifications.type, "owner_broadcast"),
              sql`${notifications.entityId} IN (${sql.join(broadcastIds.map(id => sql`${id}`), sql`, `)})`,
            ))
            .groupBy(notifications.entityId)
        : [];
      const statsMap = new Map(stats.map((s) => [s.broadcastId, s]));

      const enriched = broadcasts.map((b) => {
        const s = statsMap.get(b.id);
        const recipients = s?.recipients ?? 0;
        const reads = s?.reads ?? 0;
        const clicks = s?.clicks ?? 0;
        return {
          ...b,
          recipients,
          reads,
          clicks,
          dismissals: s?.dismissals ?? 0,
          readRate: recipients > 0 ? Math.round((reads / recipients) * 100) : 0,
          clickRate: reads > 0 ? Math.round((clicks / reads) * 100) : 0,
        };
      });

      return {
        totalBroadcasts: broadcasts.length,
        totalRecipients: enriched.reduce((sum, b) => sum + b.recipients, 0),
        totalReads: enriched.reduce((sum, b) => sum + b.reads, 0),
        totalClicks: enriched.reduce((sum, b) => sum + b.clicks, 0),
        totalDismissals: enriched.reduce((sum, b) => sum + b.dismissals, 0),
        broadcasts: enriched,
      };
    }),

  notifySuperAdmin: adminProcedure
    .input(z.object({
      type: z.enum(["new_signup"]),
      title: z.string(),
      message: z.string(),
    }))
    .mutation(async ({ input }) => {
      if (!env.superAdminAccount) return { created: 0 };
      const db = getDb();
      const superAdminUsers = await db.select({ id: users.id }).from(users)
        .where(and(eq(users.accountId, env.superAdminAccount), isNull(users.deletedAt)));
      for (const sa of superAdminUsers) {
        await db.insert(notifications).values({
          userId: sa.id,
          type: input.type,
          title: input.title,
          message: input.message,
          severity: "info",
        } as typeof notifications.$inferInsert);
      }
      return { created: superAdminUsers.length };
    }),
});
