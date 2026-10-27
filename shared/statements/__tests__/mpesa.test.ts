// ABOUTME: Contract tests for the M-PESA parser against a synthetic document modelled on a real statement.
// ABOUTME: Covers date/time splitting, wrapped details, receipt groups, Fuliza legs and summary totals.

import { describe, expect, it } from "vitest";
import { parseMpesaStatement, detectMpesaStatement, classifyMpesaDetails } from "../parsers/mpesa";
import { syntheticMpesaDocument, syntheticMpesaPaybillDocument, syntheticMpesaNegativeOutDocument } from "../__fixtures__/synthetic";
import { normalizeAmount, isMoneyToken, sumAmounts } from "../normalize/amount";
import { normalizeDate, normalizeTime, parsePeriod } from "../normalize/date";

describe("M-PESA parser", () => {
  const parsed = parseMpesaStatement(syntheticMpesaDocument());

  it("parses every row and skips page boilerplate", () => {
    expect(parsed.rows).toHaveLength(5);
    expect(parsed.rows.some((r) => /Disclaimer|guidance|self-help/i.test(r.details))).toBe(false);
    expect(parsed.rows.some((r) => /Page \d+ of \d+/i.test(r.details))).toBe(false);
  });

  it("joins wrapped details and keeps the completion time from the continuation line", () => {
    const received = parsed.rows.find((r) => r.externalId === "UG12KA6YJA")!;
    expect(received.details).toContain("Business Payment from 4133807 - ZENKA DIGITAL LIMITED");
    expect(received.time).toBe("18:27:16");
    expect(received.date).toBe("2026-07-01");
  });

  it("treats a shared receipt as an event group, not a duplicate", () => {
    const primary = parsed.rows.find((r) => r.externalId === "UG12KA80PR")!;
    const charge = parsed.rows.find((r) => r.externalId === "UG12KA80PR#2")!;

    expect(primary.groupId).toBe("UG12KA80PR");
    expect(primary.groupRole).toBe("primary");
    expect(primary.amount).toBe("400.00");
    expect(primary.rail).toBe("send_money");

    expect(charge.groupRole).toBe("charge");
    expect(charge.amount).toBe("7.00");
    expect(charge.txnType).toBe("charge");
    expect(charge.categoryKey).toBe("fees");
    expect(charge.linkedTxnExternalId).toBe("UG12KA80PR");
  });

  it("links Fuliza spend and overdraft legs without counting the overdraft as income category", () => {
    const spend = parsed.rows.find((r) => r.externalId === "UG12KA6JPI")!;
    const overdraft = parsed.rows.find((r) => r.externalId === "UG12KA6JPI#2")!;

    expect(spend.rail).toBe("till");
    expect(spend.details).toContain("Fuliza M-Pesa");
    expect(spend.fulizaFunded).toBe(true);
    expect(spend.fulizaOf).toBe("UG12KA6JPI#2");

    expect(overdraft.rail).toBe("fuliza_draw");
    expect(overdraft.txnType).toBe("loan_drawdown");
    expect(overdraft.direction).toBe("in");
    expect(overdraft.categoryKey).toBe("loans_savings");
    expect(overdraft.linkedTxnExternalId).toBe("UG12KA6JPI");
  });

  it("computes totals exactly and reconciles the statement summary", () => {
    expect(parsed.totals).toEqual({
      rowCount: 5,
      totalIn: "1751.37",
      totalOut: "657.00",
      totalFees: "7.00",
    });
    expect(parsed.statementSummary?.totalIn).toBe("1751.37");
    expect(parsed.statementSummary?.totalOut).toBe("657.00");
    expect(parsed.warnings.filter((w) => /do not match/i.test(w))).toEqual([]);
  });

  it("extracts metadata and period", () => {
    expect(parsed.metadata.customerName).toBe("TEST CUSTOMER");
    expect(parsed.metadata.periodStart).toBe("2026-01-01");
    expect(parsed.metadata.periodEnd).toBe("2026-07-02");
    expect(parsed.kind).toBe("mobile_money_personal");
  });

  it("returns a high confidence for an M-PESA document", () => {
    expect(detectMpesaStatement(syntheticMpesaDocument())).toBeGreaterThanOrEqual(0.9);
  });

  it("parses the paybill-owner layout and keeps Transaction Type / Other Party", () => {
    const paybill = parseMpesaStatement(syntheticMpesaPaybillDocument());
    expect(paybill.kind).toBe("mobile_money_paybill");
    expect(paybill.rows).toHaveLength(2);
    expect(paybill.totals).toMatchObject({ rowCount: 2, totalIn: "1000.00", totalOut: "500.00" });

    const payBillRow = paybill.rows.find((row) => row.receiptNo === "UG12KAPB01")!;
    expect(payBillRow.transactionType).toBe("Pay Bill");
    expect(payBillRow.otherParty).toBe("KPLC PREPAID");
    expect(payBillRow.rail).toBe("paybill");

    const received = paybill.rows.find((row) => row.receiptNo === "UG12KAPB02")!;
    expect(received.transactionType).toBe("Funds received");
    expect(received.otherParty).toBe("SAMPLE SENDER");
  });

  it("normalises a printed negative paid-out value to a positive magnitude", () => {
    const statement = parseMpesaStatement(syntheticMpesaNegativeOutDocument());
    const out = statement.rows.find((row) => row.externalId === "UG12NEG01")!;

    expect(out.paidIn).toBe("0.00");
    expect(out.withdrawn).toBe("108.00");
    expect(out.amount).toBe("108.00");
    expect(out.direction).toBe("out");
    expect(statement.totals).toMatchObject({ totalIn: "1000.00", totalOut: "108.00", totalFees: "0.00" });
    expect(statement.statementSummary?.totalOut).toBe("108.00");
    expect(statement.warnings.some((warning) => /negative sign/i.test(warning))).toBe(true);
  });
});

describe("detail classification", () => {
  const cases: Array<[string, string, string]> = [
    ["OverDraft of Credit Party", "fuliza_draw", "loan_drawdown"],
    ["OD Loan Repayment to 232323 - M-PESA Overdraw", "fuliza_repay", "loan_repayment"],
    ["Customer Transfer of Funds Charge", "charge", "charge"],
    ["Pay Bill Charge", "charge", "charge"],
    ["Customer Transfer Fuliza M-Pesa to 254*****8959 - salim", "send_money", "transfer"],
    ["Customer Transfer to 254*****8959 - salim", "send_money", "transfer"],
    ["Pay Bill Online to 622645 - ONFON MEDIA 1. Acc. 254*****2666", "paybill", "payment"],
    ["Pay Bill Online Fuliza M-Pesa to 622645 - ONFON MEDIA", "paybill", "payment"],
    ["Merchant Payment Online to 915251 - Total New Ukunda", "till", "payment"],
    ["Merchant Payment Fuliza M-Pesa Online to 915251 - Total", "till", "payment"],
    ["Funds received from 254*****2666 - ESTHER WAMBUA", "received", "topup"],
    ["Business Payment from 979992 - ZENKA DIGITAL", "received", "topup"],
    ["Deposit of Funds at Agent Till 123456 - Zarum inv", "agent_deposit", "bank_transfer"],
    ["Customer Withdrawal At Agent Till 123456 - BRIDGEWAYS", "agent_withdrawal", "withdrawal"],
    ["Pay Merchant Reversal From 123456 - TINGG", "reversal", "refund"],
    ["Airtime Purchase", "airtime", "airtime"],
    ["Card Pay Utility to 903370 - M-PESA GlobalPay", "paybill", "payment"],
  ];

  it.each(cases)("classifies %s", (details, rail, txnType) => {
    const result = classifyMpesaDetails(details);
    expect(result.rail).toBe(rail);
    expect(result.txnType).toBe(txnType);
  });

  it("suggests categories only when confident, otherwise leaves them empty", () => {
    expect(classifyMpesaDetails("Pay Bill Online to 622645 - ONFON MEDIA").categoryKey).toBeNull();
    expect(classifyMpesaDetails("Pay Bill Online to 888880 - KPLC PREPAID").categoryKey).toBe("utilities");
    expect(classifyMpesaDetails("Merchant Payment Online to 111222 - NAIVAS SUPERMARKET").categoryKey).toBe("food");
    expect(classifyMpesaDetails("Customer Transfer to 254*****8959 - salim").categoryKey).toBeNull();
    expect(classifyMpesaDetails("OverDraft of Credit Party").categoryKey).toBe("loans_savings");
  });

  it("treats inbound send/paybill rows as income, not spend", () => {
    const inbound = classifyMpesaDetails(
      "Offnet B2C Transfer by 966888 - AIRTEL MONEY via API to 254*****2884 - MARTIN OTIENO",
      "in",
    );
    expect(inbound.rail).toBe("received");
    expect(inbound.txnType).toBe("topup");
    expect(inbound.categoryKey).toBeNull();

    const businessPayment = classifyMpesaDetails(
      "Small Business Payment to Customer via API from - 254724***647 BAKARI MWAKOI",
      "in",
    );
    expect(businessPayment.rail).toBe("received");
    expect(businessPayment.txnType).toBe("topup");
  });
});

describe("amount and date normalisation", () => {
  it("normalises statement amounts without floats", () => {
    expect(normalizeAmount("1,234.50").value).toBe("1234.50");
    expect(normalizeAmount("Ksh 1,234.50").value).toBe("1234.50");
    expect(normalizeAmount("-").value).toBe("0.00");
    expect(normalizeAmount("").value).toBe("0.00");
    expect(normalizeAmount("(1,234.50)").value).toBe("-1234.50");
    expect(normalizeAmount("1,234.5").value).toBe("1234.50");
    expect(normalizeAmount("abc").valid).toBe(false);
    expect(isMoneyToken("0.00")).toBe(true);
    expect(isMoneyToken("-12.00")).toBe(true);
    expect(isMoneyToken("12")).toBe(false);
    expect(sumAmounts(["0.10", "0.20"])).toBe("0.30");
    expect(sumAmounts(["1,000.00", "0.05"])).toBe("1000.05");
  });

  it("normalises dates and times", () => {
    expect(normalizeDate("2026-07-01")).toBe("2026-07-01");
    expect(normalizeDate("1/7/2026")).toBe("2026-07-01");
    expect(normalizeDate("01/07/26")).toBe("2026-07-01");
    expect(normalizeDate("1st January 2026")).toBe("2026-01-01");
    expect(normalizeDate("31/02/2026")).toBeNull();
    expect(normalizeTime("7:05")).toBe("07:05:00");
    expect(normalizeTime("7:05 PM")).toBe("19:05:00");
    expect(normalizeTime("12:00 AM")).toBe("00:00:00");
    expect(parsePeriod("1st January 2026 - 2nd July 2026")).toEqual({ start: "2026-01-01", end: "2026-07-02" });
  });
});

