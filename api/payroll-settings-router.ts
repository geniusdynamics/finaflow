import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { payrollSettings } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { computePaye, computeNssf, PERSONAL_RELIEF } from "./lib/tax";
import { d } from "./lib/decimal";

export const payrollSettingsRouter = createRouter({
  get: authedQuery
    .input(z.object({ locationId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(payrollSettings).where(eq(payrollSettings.locationId, input.locationId)).limit(1);
      return rows[0] ?? null;
    }),

  update: authedQuery
    .input(z.object({
      locationId: z.number(),
      nhifRate: z.string().optional(),
      nssfTier1Limit: z.string().optional(),
      nssfTier1Employee: z.string().optional(),
      nssfTier1Employer: z.string().optional(),
      nssfTier2Limit: z.string().optional(),
      nssfTier2Employee: z.string().optional(),
      nssfTier2Employer: z.string().optional(),
      personalRelief: z.string().optional(),
      insuranceRelief: z.string().optional(),
      payeBands: z.any().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { locationId, ...updates } = input;
      const existing = await db.select().from(payrollSettings).where(eq(payrollSettings.locationId, locationId)).limit(1);
      if (existing.length > 0) {
        await db.update(payrollSettings).set(updates).where(eq(payrollSettings.id, existing[0].id));
      } else {
        await db.insert(payrollSettings).values({ locationId, ...updates } as any).returning();
      }
      return { success: true };
    }),

  compute: authedQuery
    .input(z.object({
      grossPay: z.number(),
      locationId: z.number(),
      insurancePremium: z.number().optional().default(0),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const { grossPay, locationId, insurancePremium } = input;

      const settings = await db.select().from(payrollSettings).where(eq(payrollSettings.locationId, locationId)).limit(1);
      const set = settings[0] ?? null;

      const nhif = d(grossPay).mul(parseFloat(set?.nhifRate || "2.75")).div(100).toNumber();
      const nssfResult = computeNssf(grossPay);
      const personalRelief = parseFloat(set?.personalRelief || "2400");
      const rawPaye = computePaye(grossPay);
      const insuranceReliefAmount = insurancePremium * (parseFloat(set?.insuranceRelief || "0") / 100);
      const paye = Math.max(0, rawPaye - personalRelief + PERSONAL_RELIEF - insuranceReliefAmount);

      const totalDeductions = nhif + nssfResult.employee + paye;
      const netPay = grossPay - totalDeductions;

      return {
        nhif,
        nssfEmployee: nssfResult.employee,
        nssfEmployer: nssfResult.employer,
        paye,
        taxableIncome: grossPay,
        totalDeductions,
        netPay: Math.max(0, netPay),
      };
    }),
});
