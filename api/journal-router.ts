import { z } from "zod";
import { createRouter, accountManage, getCurrentBusinessLocationIds } from "./middleware";
import { getDb } from "./queries/connection";
import { journalEntries, journalLines, accounts, locations, userBusinesses } from "@db/schema";
import { and, asc, eq, isNull, isNotNull } from "drizzle-orm";
import { logAudit } from "./lib/audit";
import type { JournalLineInput } from "./lib/journal";
import {
  createJournalEntry,
  getJournalEntryWithLines,
  getJournalEntries,
  postJournalEntry,
  reverseJournalEntry,
  unpostJournalEntry,
} from "./lib/journal";

type Db = ReturnType<typeof getDb>;

async function fetchCoaRows(db: Db, businessId: number) {
  return db
    .select({
      id: accounts.id,
      name: accounts.name,
      accountCode: accounts.accountCode,
      accountType: accounts.accountType,
      accountSubType: accounts.accountSubType,
      description: accounts.description,
      isContra: accounts.isContra,
      isActive: accounts.isActive,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.businessId, businessId),
        isNull(accounts.deletedAt),
        eq(accounts.isActive, true),
        isNotNull(accounts.accountType),
      ),
    )
    .orderBy(asc(accounts.accountCode), asc(accounts.name));
}

export const journalRouter = createRouter({
  list: accountManage
    .input(
      z.object({
        businessId: z.number(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
        sourceType: z.string().optional(),
        sourceId: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        isPosted: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {

      const result = await getJournalEntries({
        businessId: input.businessId,
        page: input.page,
        pageSize: input.pageSize,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        isPosted: input.isPosted,
      });

      return result;
    }),

  getById: accountManage
    .input(
      z.object({
        id: z.number(),
        businessId: z.number(),
      })
    )
    .query(async ({ input }) => {

      return getJournalEntryWithLines(input.id);
    }),

  create: accountManage
    .input(
      z.object({
        businessId: z.number(),
        entryDate: z.string(),
        description: z.string().min(1).max(500),
        reference: z.string().max(100).optional(),
        sourceType: z.string().optional(),
        sourceId: z.number().optional(),
        lines: z
          .array(
            z.object({
              accountId: z.number(),
              debit: z.string().default("0.00"),
              credit: z.string().default("0.00"),
              description: z.string().optional(),
            })
          )
          .min(2),
        postImmediately: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      

      const lines: JournalLineInput[] = input.lines.map((line) => ({
        accountId: line.accountId,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
      }));

      const entry = await createJournalEntry({
        businessId: input.businessId,
        entryDate: input.entryDate,
        description: input.description,
        reference: input.reference,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        lines,
        createdBy: ctx.user.id,
        postImmediately: input.postImmediately,
      });

      // ABOUTME: Audit trail for manual journal entries — tracks user, CoA IDs, and account IDs
      await logAudit({
        userId: ctx.user.id,
        businessId: input.businessId,
        action: "CREATE",
        resource: "journal_entries",
        resourceId: entry.id,
        details: {
          description: input.description,
          lineCount: lines.length,
          accountIds: lines.map((l) => l.accountId),
          postImmediately: input.postImmediately,
          sourceType: input.sourceType || "manual",
        },
      });

      return entry;
    }),

  update: accountManage
    .input(
      z.object({
        id: z.number(),
        businessId: z.number(),
        entryDate: z.string().optional(),
        description: z.string().min(1).max(500).optional(),
        reference: z.string().max(100).optional(),
        lines: z
          .array(
            z.object({
              accountId: z.number(),
              debit: z.string().default("0.00"),
              credit: z.string().default("0.00"),
              description: z.string().optional(),
            })
          )
          .min(2)
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      

      const entry = await db.query.journalEntries.findFirst({
        where: (je, { eq, and, isNull }) =>
          and(eq(je.id, input.id), isNull(je.deletedAt)),
      });

      if (!entry) throw new Error("Journal entry not found");
      if (entry.isPosted) throw new Error("Cannot edit a posted journal entry");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: any = {};
      if (input.entryDate) updates.entryDate = input.entryDate;
      if (input.description) updates.description = input.description;
      if (input.reference !== undefined) updates.reference = input.reference;

      await db
        .update(journalEntries)
        .set(updates)
        .where(eq(journalEntries.id, input.id));

      if (input.lines) {
        await db
          .delete(journalLines)
          .where(eq(journalLines.journalEntryId, input.id));

        for (let i = 0; i < input.lines.length; i++) {
          const line = input.lines[i];
          await db.insert(journalLines).values({
            journalEntryId: input.id,
            accountId: line.accountId,
            debit: line.debit || "0.00",
            credit: line.credit || "0.00",
            description: line.description,
            lineNumber: i + 1,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);
        }
      }

      return { success: true };
    }),

  post: accountManage
    .input(
      z.object({
        id: z.number(),
        businessId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      
      await postJournalEntry(input.id, ctx.user.id);
      return { success: true };
    }),

  unpost: accountManage
    .input(
      z.object({
        id: z.number(),
        businessId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      
      await unpostJournalEntry(input.id, ctx.user.id);
      return { success: true };
    }),

  reverse: accountManage
    .input(
      z.object({
        id: z.number(),
        businessId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      
      const reversal = await reverseJournalEntry(input.id, ctx.user.id);
      return reversal;
    }),

  getBySource: accountManage
    .input(
      z.object({
        businessId: z.number(),
        sourceType: z.string(),
        sourceId: z.number(),
      })
    )
    .query(async ({ input }) => {

      const entries = await getJournalEntries({
        businessId: input.businessId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      });

      return entries;
    }),

  /**
   * Returns all active Chart-of-Accounts entries for the current user's business.
   * Excludes operational accounts (cash/wallet/bank), which are managed by the
   * transfer module. Used by the manual journal entry form's account selector.
   *
   * Resolves the target business by, in order:
   *   1. The `businessId` argument if supplied
   *   2. `ctx.user.currentBusinessId`
   *   3. The first business the user is a member of (userBusinesses)
   *   4. The first business a non-deleted location belongs to
   * If the resolved business has no CoA entries yet, falls back to the first
   * business the user is authorized for that does have entries — so an admin
   * whose default business was just created can still see the existing CoA.
   */
  listForJournalEntries: accountManage
    .input(z.object({ businessId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user?.id;

      // Build the ordered list of candidate business ids for this user.
      const candidates: number[] = [];
      if (input?.businessId) candidates.push(input.businessId);
      if (ctx.user?.currentBusinessId) candidates.push(ctx.user.currentBusinessId);
      if (userId) {
        const ubRows = await db
          .select({ businessId: userBusinesses.businessId })
          .from(userBusinesses)
          .where(eq(userBusinesses.userId, userId));
        for (const r of ubRows) if (typeof r.businessId === "number") candidates.push(r.businessId);
      }
      const locIds = await getCurrentBusinessLocationIds(ctx);
      if (locIds.length > 0) {
        const locRows = await db
          .select({ businessId: locations.businessId })
          .from(locations)
          .where(eq(locations.id, locIds[0]));
        for (const r of locRows) if (typeof r.businessId === "number") candidates.push(r.businessId);
      }

      // Dedupe candidate ids preserving order
      const seen = new Set<number>();
      const orderedCandidates: number[] = [];
      for (const id of candidates) {
        if (typeof id === "number" && !seen.has(id)) {
          seen.add(id);
          orderedCandidates.push(id);
        }
      }
      if (orderedCandidates.length === 0) return { accounts: [], businessId: null };

      // First, try the explicit input / current business
      let businessId = orderedCandidates[0];
      let rows = await fetchCoaRows(db, businessId);

      // If the primary business has no CoA, try each remaining candidate
      // until we find one with entries — this keeps the picker useful for
      // admins whose default business is new and empty.
      if (rows.length === 0 && orderedCandidates.length > 1) {
        for (let i = 1; i < orderedCandidates.length; i++) {
          const altRows = await fetchCoaRows(db, orderedCandidates[i]);
          if (altRows.length > 0) {
            businessId = orderedCandidates[i];
            rows = altRows;
            break;
          }
        }
      }

      return { accounts: rows, businessId };
    }),
});

