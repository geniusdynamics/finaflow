import { z } from "zod";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { feedbackQuestionnaires, feedbackResponses } from "@db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const feedbackRouter = createRouter({
  questionnaires: authedQuery.query(async () => {
    const db = getDb();
    return db.select().from(feedbackQuestionnaires)
      .where(sql`"feedback_questionnaires"."deletedAt" IS NULL`)
      .orderBy(desc(feedbackQuestionnaires.createdAt));
  }),

  createQuestionnaire: authedQuery
    .input(z.object({
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      questions: z.array(z.object({
        id: z.string(),
        text: z.string().min(1),
        type: z.enum(["text", "rating", "choice", "yes_no"]),
        required: z.boolean().default(false),
        options: z.array(z.string()).optional(),
      })),
      businessId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(feedbackQuestionnaires).values({
        title: input.title,
        description: input.description,
        questions: JSON.stringify(input.questions),
        isActive: true,
        businessId: input.businessId,
      } as any).returning();
      return { id: result.id, success: true };
    }),

  updateQuestionnaire: authedQuery
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      questions: z.array(z.object({
        id: z.string(),
        text: z.string().min(1),
        type: z.enum(["text", "rating", "choice", "yes_no"]),
        required: z.boolean().default(false),
        options: z.array(z.string()).optional(),
      })).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...raw } = input;
      const updates: any = { ...raw };
      if (raw.questions) updates.questions = JSON.stringify(raw.questions);
      await db.update(feedbackQuestionnaires).set(updates).where(eq(feedbackQuestionnaires.id, id));
      return { success: true };
    }),

  deleteQuestionnaire: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(feedbackQuestionnaires).set({ deletedAt: new Date() } as any).where(eq(feedbackQuestionnaires.id, input.id));
      return { success: true };
    }),

  // Public — no auth required for submitting
  submitResponse: publicQuery
    .input(z.object({
      questionnaireId: z.number(),
      respondentName: z.string().optional(),
      respondentEmail: z.string().optional(),
      answers: z.record(z.string(), z.string()),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.insert(feedbackResponses).values({
        questionnaireId: input.questionnaireId,
        respondentName: input.respondentName,
        respondentEmail: input.respondentEmail,
        answers: JSON.stringify(input.answers),
      } as any).returning();
      return { success: true };
    }),

  responses: authedQuery
    .input(z.object({ questionnaireId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.questionnaireId) conditions.push(eq(feedbackResponses.questionnaireId, input.questionnaireId));
      const rows = await db.select().from(feedbackResponses)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(feedbackResponses.createdAt));
      return rows.map(r => ({ ...r, answers: typeof r.answers === "string" ? JSON.parse(r.answers) : r.answers }));
    }),
});


