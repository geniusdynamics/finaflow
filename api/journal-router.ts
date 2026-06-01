import { z } from "zod";
import { createRouter, accountManage } from "./middleware";
import { getDb } from "./queries/connection";
import { journalEntries, journalLines } from "@db/schema";
import { eq } from "drizzle-orm";
import type { JournalLineInput } from "./lib/journal";
import {
  createJournalEntry,
  getJournalEntryWithLines,
  getJournalEntries,
  postJournalEntry,
  reverseJournalEntry,
  unpostJournalEntry,
} from "./lib/journal";

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
    .mutation(async ({ input, _ctx }) => {
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
});

