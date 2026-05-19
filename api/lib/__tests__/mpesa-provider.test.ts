// ABOUTME: Unit tests for the M-PESA provider — SMS parsing of all 7 pattern types, KES lock, edge cases.
// ABOUTME: Covers all M-PESA SMS formats, failure handling, and data extraction.

import { describe, it, expect } from "vitest";
import { MpesaProvider } from "../mobile-wallet/providers/mpesa-provider";

const provider = new MpesaProvider();

describe("MpesaProvider", () => {
  describe("basic properties", () => {
    it("has correct code and name", () => {
      expect(provider.code).toBe("mpesa");
      expect(provider.displayName).toBe("M-PESA");
    });

    it("only supports KES", () => {
      expect(provider.supportedCurrencies).toEqual(["KES"]);
    });

    it("has smsImport feature enabled", () => {
      expect(provider.features.smsImport).toBe(true);
    });

    it("has other features disabled", () => {
      expect(provider.features.initiatePayment).toBe(false);
      expect(provider.features.queryStatus).toBe(false);
      expect(provider.features.processWebhook).toBe(false);
      expect(provider.features.refund).toBe(false);
      expect(provider.features.balanceInquiry).toBe(false);
    });
  });

  describe("unimplemented methods", () => {
    it("throws on initiatePayment", async () => {
      await expect(provider.initiatePayment({ amount: "100", currency: "KES", partyIdentifier: "0712345678", reference: "test" })).rejects.toThrow("does not support API-initiated payments");
    });

    it("throws on queryStatus", async () => {
      await expect(provider.queryStatus("ABC123")).rejects.toThrow("does not support status queries");
    });

    it("throws on processWebhook", async () => {
      await expect(provider.processWebhook({ provider: "mpesa", rawBody: "{}", headers: {} })).rejects.toThrow("does not support webhooks");
    });

    it("throws on balanceInquiry", async () => {
      await expect(provider.balanceInquiry(1)).rejects.toThrow("does not support balance inquiries");
    });
  });

  describe("parseSms - SMS received (inflow)", () => {
    const sms = "SGA23KQ1J2 Confirmed. You have received Ksh 5,000.00 from John Doe on 15/3/25 at 2:30 PM. New M-PESA balance is Ksh 12,000.00. Transaction cost, Ksh 0.00.";

    it("parses basic receive SMS", async () => {
      const results = await provider.parseSms(sms);
      expect(results).toHaveLength(1);
      expect(results[0].direction).toBe("in");
      expect(results[0].amount).toBe("5000.00");
      expect(results[0].currency).toBe("KES");
      expect(results[0].partyName).toBe("John Doe");
    });

    it("extracts transaction ID", async () => {
      const results = await provider.parseSms(sms);
      expect(results[0].providerTxnId).toBeTruthy();
    });

    it("detects payment type for person-to-person", async () => {
      const results = await provider.parseSms(sms);
      expect(results[0].txnType).toBe("payment");
    });
  });

  describe("parseSms - payment to business (outflow)", () => {
    const sms = "PGF12K3L4M Confirmed. Ksh 1,200.00 paid to KPLC Prepaid Token on 10/3/25 at 9:15 AM. New M-PESA balance is Ksh 8,500.00. Transaction fee, Ksh 10.00.";

    it("parses payment SMS", async () => {
      const results = await provider.parseSms(sms);
      expect(results).toHaveLength(1);
      expect(results[0].direction).toBe("out");
      expect(results[0].amount).toBe("-1200.00");
      expect(results[0].txnType).toBe("utility");
    });

    it("extracts transaction fee", async () => {
      const results = await provider.parseSms(sms);
      expect(results[0].txnFee).toBe("10.00");
    });
  });

  describe("parseSms - send to person (outflow)", () => {
    const sms = "TXN90K2L3P Confirmed. Ksh 500.00 sent to Jane Smith on 5/3/25 at 11:00 AM. New M-PESA balance is Ksh 3,200.00. Transaction cost, Ksh 0.00.";

    it("parses sent-to SMS", async () => {
      const results = await provider.parseSms(sms);
      expect(results).toHaveLength(1);
      expect(results[0].direction).toBe("out");
      expect(results[0].txnType).toBe("transfer");
    });
  });

  describe("parseSms - bank topup (inflow)", () => {
    const sms = "TUP45K6L7M Confirmed. Ksh 10,000.00 sent from KCB Bank to M-PESA on 1/3/25 at 8:00 AM. New M-PESA balance is Ksh 25,000.00. Transaction cost, Ksh 0.00.";

    it("parses bank topup", async () => {
      const results = await provider.parseSms(sms);
      expect(results).toHaveLength(1);
      expect(results[0].direction).toBe("in");
      expect(results[0].txnType).toBe("topup");
    });
  });

  describe("parseSms - withdrawal (outflow)", () => {
    const sms = "WDR78K9L0M Confirmed. Ksh 3,000.00 withdrawn from agent Jane's Shop on 20/3/25 at 4:45 PM. New M-PESA balance is Ksh 7,000.00. Transaction cost, Ksh 30.00.";

    it("parses withdrawal", async () => {
      const results = await provider.parseSms(sms);
      expect(results).toHaveLength(1);
      expect(results[0].direction).toBe("out");
      expect(results[0].txnType).toBe("withdrawal");
    });
  });

  describe("parseSms - airtime purchase (outflow)", () => {
    const sms = "AIR12K3L4M Confirmed. Ksh 500.00 bought airtime of Ksh 500.00 for 0712345678 on 18/3/25 at 10:30 AM. New M-PESA balance is Ksh 4,500.00. Transaction cost, Ksh 0.00.";

    it("parses airtime purchase", async () => {
      const results = await provider.parseSms(sms);
      expect(results).toHaveLength(1);
      expect(results[0].direction).toBe("out");
      expect(results[0].txnType).toBe("airtime");
    });
  });

  describe("parseSms - failed transactions", () => {
    it("skips failed Fuliza transactions", async () => {
      const results = await provider.parseSms("Fuliza failed due to insufficient limit.");
      expect(results).toHaveLength(0);
    });

    it("skips declined transactions", async () => {
      const results = await provider.parseSms("Transaction is declined. Insufficient funds.");
      expect(results).toHaveLength(0);
    });

    it("skips cancelled transactions", async () => {
      const results = await provider.parseSms("Transaction cancelled by user.");
      expect(results).toHaveLength(0);
    });
  });

  describe("parseSms - short/invalid messages", () => {
    it("skips messages shorter than 30 characters", async () => {
      const results = await provider.parseSms("Hello");
      expect(results).toHaveLength(0);
    });

    it("skips empty messages", async () => {
      const results = await provider.parseSms("");
      expect(results).toHaveLength(0);
    });
  });

  describe("bulk SMS parsing", () => {
    const bulkSms = `ABC123 Confirmed. Ksh 1,000.00 sent to John on 1/3/25 at 8:00 AM. Balance Ksh 5,000.00.
DEF456 Confirmed. Ksh 500.00 received from Jane on 1/3/25 at 9:00 AM. Balance Ksh 5,500.00.`;

    it("parses multiple SMS messages", async () => {
      const results = await provider.parseSms(bulkSms);
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("generateSmsPreview", () => {
    it("returns same results as parseSms", async () => {
      const sms = "TXN90K2L3P Confirmed. Ksh 500.00 sent to Jane Smith on 5/3/25 at 11:00 AM. New M-PESA balance is Ksh 3,200.00.";
      const parsed = await provider.parseSms(sms);
      const preview = await provider.generateSmsPreview(sms);
      expect(preview).toEqual(parsed);
    });
  });
});
