import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { payrollSettings } from "@db/schema";
import { eq } from "drizzle-orm";

// Kenya statutory deduction calculators
export function computeNhif(grossPay: number, ratePercent: number = 2.75): number {
  return Math.round(grossPay * (ratePercent / 100) * 100) / 100;
}

export function computeNssf(grossPay: number, tier1Limit: number = 7000, tier1Employee: number = 420, tier2Limit: number = 36000, tier2Employee: number = 1740): { employee: number; employer: number; total: number } {
  let employee = 0;
  let employer = 0;
  if (grossPay > 0) {
    employee += tier1Employee;
    employer += tier1Employee; // same as tier1 employee
    if (grossPay > tier1Limit) {
      const tier2Pay = Math.min(grossPay, tier2Limit) - tier1Limit;
      const tier2Rate = tier2Employee / (tier2Limit - tier1Limit); // approx rate
      const t2e = Math.round(tier2Pay * tier2Rate * 100) / 100;
      employee += Math.min(t2e, tier2Employee);
      employer += Math.min(t2e, tier2Employee);
    }
  }
  return { employee: Math.round(employee * 100) / 100, employer: Math.round(employer * 100) / 100, total: Math.round((employee + employer) * 100) / 100 };
}

export function computePaye(taxableIncome: number, bands: { min: number; max: number | null; rate: number }[], personalRelief: number = 2400): number {
  let tax = 0;
  let remaining = taxableIncome;
  for (const band of bands) {
    if (remaining <= 0) break;
    const bandMax = band.max ?? Infinity;
    const bandSize = bandMax - band.min + (band.min === 0 ? 1 : 0);
    const taxableInBand = Math.min(remaining, bandSize);
    tax += taxableInBand * (band.rate / 100);
    remaining -= taxableInBand;
  }
  const netTax = Math.max(0, tax - personalRelief);
  return Math.round(netTax * 100) / 100;
}

export const payrollSettingsRouter = createRouter({
  get: authedQuery
    .input(z.object({ locationId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      const cond = input?.locationId ? [eq(payrollSettings.locationId, input.locationId)] : [];
      const rows = await db.select().from(payrollSettings).where(cond.length > 0 ? eq(payrollSettings.locationId, input!.locationId) : undefined).limit(1);
      return rows[0] ?? {
        nhifRate: "2.75", nssfTier1Limit: "7000.00", nssfTier1Employee: "420.00",
        nssfTier1Employer: "420.00", nssfTier2Limit: "36000.00", nssfTier2Employee: "1740.00",
        nssfTier2Employer: "1740.00", personalRelief: "2400.00", insuranceRelief: "0.00",
        payeBands: [
          { min: 0, max: 24000, rate: 10 },
          { min: 24001, max: 32333, rate: 25 },
          { min: 32334, max: 500000, rate: 30 },
          { min: 500001, max: 800000, rate: 32.5 },
          { min: 800001, max: null, rate: 35 },
        ],
      };
    }),

  update: authedQuery
    .input(z.object({
      id: z.number().optional(),
      locationId: z.number().optional(),
      nhifRate: z.string().optional(),
      nssfTier1Limit: z.string().optional(),
      nssfTier1Employee: z.string().optional(),
      nssfTier1Employer: z.string().optional(),
      nssfTier2Limit: z.string().optional(),
      nssfTier2Employee: z.string().optional(),
      nssfTier2Employer: z.string().optional(),
      personalRelief: z.string().optional(),
      insuranceRelief: z.string().optional(),
      payeBands: z.array(z.object({ min: z.number(), max: z.number().nullable(), rate: z.number() })).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, locationId, ...data } = input;
      if (id) {
        await db.update(payrollSettings).set(data as any).where(eq(payrollSettings.id, id));
        return { success: true };
      }
      const [result] = await db.insert(payrollSettings).values({ locationId, ...data } as any);
      return { id: Number(result.insertId), success: true };
    }),

  // Compute deductions for a given gross pay
  compute: authedQuery
    .input(z.object({
      grossPay: z.number(),
      locationId: z.number().optional(),
      insurancePremium: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const cond = input.locationId ? [eq(payrollSettings.locationId, input.locationId)] : [];
      const settings = await db.select().from(payrollSettings).where(cond.length > 0 ? eq(payrollSettings.locationId, input.locationId!) : undefined).limit(1);
      const s = settings[0];

      const nhifRate = parseFloat(s?.nhifRate ?? "2.75");
      const tier1Limit = parseFloat(s?.nssfTier1Limit ?? "7000");
      const tier1EE = parseFloat(s?.nssfTier1Employee ?? "420");
      const tier2Limit = parseFloat(s?.nssfTier2Limit ?? "36000");
      const tier2EE = parseFloat(s?.nssfTier2Employee ?? "1740");
      const personalRelief = parseFloat(s?.personalRelief ?? "2400");
      const insuranceRelief = parseFloat(s?.insuranceRelief ?? "0");
      const bands = (s?.payeBands as any[]) ?? [
        { min: 0, max: 24000, rate: 10 },
        { min: 24001, max: 32333, rate: 25 },
        { min: 32334, max: 500000, rate: 30 },
        { min: 500001, max: 800000, rate: 32.5 },
        { min: 800001, max: null, rate: 35 },
      ];

      const nhif = computeNhif(input.grossPay, nhifRate);
      const nssf = computeNssf(input.grossPay, tier1Limit, tier1EE, tier2Limit, tier2EE);
      const taxableIncome = Math.max(0, input.grossPay - nssf.employee);
      const insRelief = Math.min(insuranceRelief + (input.insurancePremium ?? 0) * 0.15, 5000);
      const paye = computePaye(taxableIncome, bands, personalRelief + insRelief);
      const totalDeductions = nhif + nssf.employee + paye;
      const netPay = Math.max(0, input.grossPay - totalDeductions);

      return {
        grossPay: input.grossPay.toFixed(2),
        nhif: nhif.toFixed(2),
        nssfEmployee: nssf.employee.toFixed(2),
        nssfEmployer: nssf.employer.toFixed(2),
        nssfTotal: nssf.total.toFixed(2),
        taxableIncome: taxableIncome.toFixed(2),
        paye: paye.toFixed(2),
        personalRelief: personalRelief.toFixed(2),
        insuranceRelief: insRelief.toFixed(2),
        totalDeductions: totalDeductions.toFixed(2),
        netPay: netPay.toFixed(2),
      };
    }),
});
