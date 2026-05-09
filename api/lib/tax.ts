import { d } from "./decimal";

export const PERSONAL_RELIEF = 2400;
export const NSSF_RATE = 0.06;
export const NSSF_TIER1_MAX = 7000;
export const NSSF_TIER2_MAX = 36000;
export const HOUSING_LEVY_RATE = 0.015;
export const NHIF_RATE = parseFloat(process.env.NHIF_RATE || "2.75");

export const PAYE_BANDS = [
  { min: 0, max: 24000, rate: 0.10 },
  { min: 24000, max: 32333, rate: 0.25 },
  { min: 32333, max: 500000, rate: 0.30 },
  { min: 500000, max: 800000, rate: 0.325 },
  { min: 800000, max: Infinity, rate: 0.35 },
] as const;

export function computePaye(grossPay: number): number {
  const bands = PAYE_BANDS;
  let tax = 0;
  let remaining = grossPay;

  for (let i = bands.length - 1; i >= 0; i--) {
    const band = bands[i];
    if (remaining <= band.min) continue;
    const taxableInBand = Math.min(remaining - band.min, band.max - band.min);
    tax += taxableInBand * band.rate;
    remaining -= taxableInBand;
  }

  return Math.max(0, Math.round((tax - PERSONAL_RELIEF) * 100) / 100);
}

export function computeNhif(grossPay: number): number {
  return d(grossPay).mul(NHIF_RATE).div(100).toNumber();
}

export function computeNssf(grossPay: number): { employee: number; employer: number } {
  const tier1 = Math.min(grossPay, NSSF_TIER1_MAX) * NSSF_RATE;
  const tier2 = Math.max(0, Math.min(grossPay, NSSF_TIER2_MAX) - NSSF_TIER1_MAX) * NSSF_RATE;
  const employee = Math.round((tier1 + tier2) * 100) / 100;
  return { employee, employer: employee };
}

export function computeHousingLevy(grossPay: number): number {
  return grossPay * HOUSING_LEVY_RATE;
}
