// ABOUTME: Covers casual daily/hourly gross pay, settlement status transitions, and the
// ABOUTME: partial-payment split that lets a payroll be paid in parts without losing cents.
import { describe, expect, it } from "vitest";
import { computeEntryAmounts, computeGrossPay, paymentStatusFor, splitComponent } from "../lib/payroll-calc";
import { d } from "../lib/decimal";

describe("computeGrossPay", () => {
  it("pays a casual daily rate times the days worked", () => {
    const { basicPay, daysWorked } = computeGrossPay({ salaryType: "daily", basicSalary: "1000.00" }, 12);
    expect(basicPay).toBe("12000.00");
    expect(daysWorked).toBe("12.00");
  });

  it("treats a daily worker with no days recorded as zero pay", () => {
    expect(computeGrossPay({ salaryType: "daily", basicSalary: "1000.00" }, null).basicPay).toBe("0.00");
  });

  it("pays hourly staff per hour worked", () => {
    expect(computeGrossPay({ salaryType: "hourly", basicSalary: "250.00" }, 48).basicPay).toBe("12000.00");
  });

  it("ignores days worked for monthly staff", () => {
    const { basicPay, daysWorked } = computeGrossPay({ salaryType: "monthly", basicSalary: "50000.00" }, 12);
    expect(basicPay).toBe("50000.00");
    expect(daysWorked).toBeNull();
  });
});

describe("computeEntryAmounts", () => {
  it("deducts nothing statutorily for an unpaid casual day", () => {
    const amounts = computeEntryAmounts({ salaryType: "daily", basicSalary: "0.00" }, 0, "0");
    expect(amounts.netPay).toBe("0.00");
    expect(amounts.deductions).toBe("0.00");
  });

  it("keeps gross excluding advances consistent with net plus statutory", () => {
    const amounts = computeEntryAmounts({ salaryType: "monthly", basicSalary: "50000.00" }, null, "5000.00");
    const statutory = d(amounts.paye).plus(amounts.nssf).plus(amounts.nhif).plus(amounts.housingLevy);
    // net + statutory + advances should reconcile to gross pay.
    const reconstructed = d(amounts.netPay).plus(statutory).plus(amounts.advancesDeducted);
    expect(reconstructed.toFixed(2)).toBe(amounts.basicPay);
    // grossExAdvances is what gets expensed (advances were expensed when issued).
    expect(d(amounts.grossExAdvances).plus(amounts.advancesDeducted).toFixed(2)).toBe(amounts.basicPay);
  });
});

describe("paymentStatusFor", () => {
  it("moves unpaid -> partial -> paid as money arrives", () => {
    expect(paymentStatusFor("1000.00", "0.00")).toBe("unpaid");
    expect(paymentStatusFor("1000.00", "400.00")).toBe("partial");
    expect(paymentStatusFor("1000.00", "1000.00")).toBe("paid");
  });
});

describe("splitComponent", () => {
  it("splits a full amount across partial payments", () => {
    const total = "3000.00";
    const net = "1000.00";
    const first = splitComponent(total, net, "400.00", [], false);
    const second = splitComponent(total, net, "300.00", ["400.00"], false);
    const last = splitComponent(total, net, "300.00", ["400.00", "300.00"], true);
    expect(d(first).plus(second).plus(last).toFixed(2)).toBe("3000.00");
  });

  it("settles the remainder exactly even when the split does not divide evenly", () => {
    const total = "1000.00";
    const net = "3.00";
    const first = splitComponent(total, net, "1.00", [], false);
    const second = splitComponent(total, net, "1.00", ["1.00"], false);
    const last = splitComponent(total, net, "1.00", ["1.00", "1.00"], true);
    expect(first).toBe("333.33");
    expect(second).toBe("333.33");
    expect(last).toBe("333.34");
    expect(d(first).plus(second).plus(last).toFixed(2)).toBe("1000.00");
  });

  it("posts the whole component on a single full payment", () => {
    expect(splitComponent("750.00", "900.00", "900.00", [], true)).toBe("750.00");
  });
});
