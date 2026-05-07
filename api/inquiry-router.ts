import { z } from "zod";
import { createRouter, publicQuery, inquiryView } from "./middleware";
import { getDb } from "./queries/connection";
import { businessInquiries } from "@db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const inquiryRouter = createRouter({
  // Public — for landing page registration form
  create: publicQuery
    .input(z.object({
      businessName: z.string().min(1).max(255),
      contactName: z.string().min(1).max(255),
      email: z.string().email(),
      phone: z.string().optional(),
      position: z.string().optional(),
      suggestedPrice: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(businessInquiries).values({
        ...input,
        status: "new",
      } as any);
      return { id: Number(result.insertId), success: true };
    }),

  list: inquiryView.query(async () => {
    const db = getDb();
    return db.select().from(businessInquiries).orderBy(desc(businessInquiries.createdAt));
  }),

  updateStatus: inquiryView
    .input(z.object({ id: z.number(), status: z.enum(["new", "contacted", "converted", "declined"]) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(businessInquiries).set({ status: input.status }).where(eq(businessInquiries.id, input.id));
      return { success: true };
    }),
});
