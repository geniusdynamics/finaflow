// ABOUTME: Pure payroll maths shared by the router: gross pay (including casual daily/hourly),
// ABOUTME: statutory deductions, settlement status, and exact partial-payment splits.
import { d } from "./decimal";
import { computePaye, computeNhif, computeNssf, computeHousingLevy } from "./tax";

export type PayrollEmployee = { salaryType: string; basicSalary: string };

export type EntryAmounts = {
  basicPay: string;
  daysWorked: string | null;
  /** Gross excluding recovered advances — the part that is expensed. */
  grossExAdvances: string;
  nssf: string;
  nhif: string;
  paye: string;
  housingLevy: string;
  advancesDeducted: string;
  deductions: string;
  netPay: string;
};

export type PaymentStatus = "unpaid" | "partial" | "paid";

/**
 * Gross pay for the period. Monthly and weekly staff use their salary as-is;
 * daily and hourly staff are paid rate × units worked, so casuals are paid for
 * the days they actually turned up.
 */
export function computeGrossPay(
  employee: PayrollEmployee,
  daysWorked: number | string | null | undefined,
): { basicPay: string; daysWorked: string | null } {
  const rate = d(employee.basicSalary || "0");
  if (employee.salaryType === "daily" || employee.salaryType === "hourly") {
    const units = d(daysWorked ?? 0);
    return { basicPay: rate.times(units).toDecimalPlaces(2).toFixed(2), daysWorked: units.toFixed(2) };
  }
  return { basicPay: rate.toDecimalPlaces(2).toFixed(2), daysWorked: null };
}

export function computeEntryAmounts(
  employee: PayrollEmployee,
  daysWorked: number | string | null | undefined,
  advanceDeduction: string,
): EntryAmounts {
  const { basicPay, daysWorked: units } = computeGrossPay(employee, daysWorked);
  const grossNum = d(basicPay).toNumber();
  const nssf = d(computeNssf(grossNum).employee);
  const housingLevy = d(computeHousingLevy(grossNum)).toDecimalPlaces(2);
  const taxable = d(Math.max(0, grossNum - nssf.toNumber() - housingLevy.toNumber()));
  const nhif = d(computeNhif(grossNum)).toDecimalPlaces(2);
  const paye = d(computePaye(taxable.toNumber()));
  const advances = d(advanceDeduction || "0");
  const statutory = nssf.plus(nhif).plus(housingLevy).plus(paye);
  const deductions = statutory.plus(advances);
  const netPay = d(Math.max(0, d(basicPay).minus(deductions).toNumber())).toDecimalPlaces(2);
  return {
    basicPay,
    daysWorked: units,
    grossExAdvances: d(basicPay).minus(advances).toDecimalPlaces(2).toFixed(2),
    nssf: nssf.toFixed(2),
    nhif: nhif.toFixed(2),
    paye: paye.toFixed(2),
    housingLevy: housingLevy.toFixed(2),
    advancesDeducted: advances.toFixed(2),
    deductions: deductions.toFixed(2),
    netPay: netPay.toFixed(2),
  };
}

export function paymentStatusFor(netPay: string, paidAmount: string): PaymentStatus {
  const net = d(netPay);
  const paid = d(paidAmount);
  if (paid.lte(0)) return "unpaid";
  if (net.lte(0) || paid.gte(net)) return "paid";
  return "partial";
}

/**
 * Portion of a full amount owed for a single component (expense or one statutory
 * payable) that belongs to this payment. Rounded to cents, but the final payment
 * settles the remainder exactly so every component adds up across the period.
 */
export function splitComponent(
  total: string,
  net: string,
  amount: string,
  priorAmounts: string[],
  isFinal: boolean,
): string {
  const totalD = d(total);
  const netD = d(net);
  if (netD.lte(0)) return "0.00";
  if (isFinal) {
    const priorPosted = priorAmounts.reduce(
      (sum, prior) => sum.plus(totalD.times(d(prior)).div(netD).toDecimalPlaces(2)),
      d(0),
    );
    return totalD.minus(priorPosted).toFixed(2);
  }
  return totalD.times(d(amount)).div(netD).toDecimalPlaces(2).toFixed(2);
}
