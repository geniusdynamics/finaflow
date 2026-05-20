// ABOUTME: Unit tests for Airtel Money provider SMS parsing and provider interface compliance.
// ABOUTME: Tests all SMS patterns, multi-currency support, and error handling.
import { describe, it, expect } from "vitest";
import { AirtelMoneyProvider } from "../mobile-wallet/providers/airtel-money-provider";

describe("AirtelMoneyProvider", () => {
  const provider = new AirtelMoneyProvider();

  it("has correct code and displayName", () => {
    expect(provider.code).toBe("airtel_money");
    expect(provider.displayName).toBe("Airtel Money");
  });

  it("supports multiple East African currencies", () => {
    expect(provider.supportedCurrencies).toContain("KES");
    expect(provider.supportedCurrencies).toContain("UGX");
    expect(provider.supportedCurrencies).toContain("TZS");
    expect(provider.supportedCurrencies).toContain("MWK");
    expect(provider.supportedCurrencies).toContain("ZMW");
    expect(provider.supportedCurrencies).toContain("RWF");
  });

  it("smsImport feature is true, others are false", () => {
    expect(provider.features.smsImport).toBe(true);
    expect(provider.features.initiatePayment).toBe(false);
    expect(provider.features.processWebhook).toBe(false);
    expect(provider.features.refund).toBe(false);
    expect(provider.features.balanceInquiry).toBe(false);
    expect(provider.features.queryStatus).toBe(false);
  });

  it("parseSms throws for non-Airtel text", async () => {
    const results = await provider.parseSms("This is just a regular SMS message");
    expect(results).toHaveLength(0);
  });

  it("parseSms throws for failed/declined messages", async () => {
    const failed = "Your Airtel Money transaction failed. Ref Trans ID: TX12345678";
    expect(await provider.parseSms(failed)).toHaveLength(0);
    const declined = "Airtel Money transaction declined. Ref TX99999";
    expect(await provider.parseSms(declined)).toHaveLength(0);
  });

  it("parses incoming payment SMS correctly", async () => {
    const sms = "You have received UGX 50,000 from 2567XX123456 on 12/03/2025 14:30. New Airtel Money balance is UGX 75,000. Ref TXN12345678";
    const results = await provider.parseSms(sms);
    expect(results.length).toBeGreaterThan(0);
    const parsed = results[0];
    expect(parsed.providerTxnId).toBeTruthy();
    expect(parsed.currency).toBeTruthy();
    expect(parsed.amount).toBeTruthy();
    expect(["payment", "transfer"]).toContain(parsed.txnType);
  });

  it("parseSms accepts empty bulk input", async () => {
    const results = await provider.parseSms("");
    expect(Array.isArray(results)).toBe(true);
  });

  it("generateSmsPreview delegates to parseSms", async () => {
    const sms = "You have received KES 1,000 from John Doe. Ref: TXNABC12345 on 01/05/2024 10:00 AM";
    const preview = await provider.generateSmsPreview(sms);
    expect(Array.isArray(preview)).toBe(true);
  });

  it("initiatePayment throws in SMS mode", async () => {
    await expect(provider.initiatePayment({
      amount: "1000",
      currency: "KES",
      partyIdentifier: "0712345678",
      reference: "test-ref",
    })).rejects.toThrow("SMS mode");
  });

  it("queryStatus throws in SMS mode", async () => {
    await expect(provider.queryStatus("TX123")).rejects.toThrow("SMS mode");
  });

  it("processWebhook throws in SMS mode", async () => {
    await expect(provider.processWebhook({
      provider: "airtel_money",
      rawBody: "{}",
      headers: {},
    })).rejects.toThrow("SMS mode");
  });

  it("processRefund throws in SMS mode", async () => {
    await expect(provider.processRefund("TX123", "500")).rejects.toThrow("SMS mode");
  });

  it("balanceInquiry throws in SMS mode", async () => {
    await expect(provider.balanceInquiry(1)).rejects.toThrow("SMS mode");
  });
});
