// ABOUTME: Concrete Airtel Money wallet provider implementing the BaseWalletProvider interface.
// ABOUTME: SMS-based integration supporting multiple East African currencies (KES, UGX, TZS, MWK, ZMW, RWF).
// ABOUTME: Currency is detected from the SMS text, not hardcoded.

import { BaseWalletProvider, ParsedWalletSms, WalletTransactionRequest, WalletTransactionResult, WalletStatusResult, WalletWebhookPayload, WalletWebhookResult, WalletBalanceResult, ProviderFeatures } from "../provider-interface";

const CURRENCY_PATTERNS: [RegExp, string][] = [
  [/UGX/i, "UGX"],
  [/TZS/i, "TZS"],
  [/MWK/i, "MWK"],
  [/ZMW/i, "ZMW"],
  [/RWF/i, "RWF"],
  [/KES|KSh/i, "KES"],
];

function detectCurrency(text: string): string {
  for (const [pattern, code] of CURRENCY_PATTERNS) {
    if (pattern.test(text)) return code;
  }
  return "KES";
}

function extractCurrencyAmount(text: string): { amount: string; currency: string } | null {
  for (const [, code] of CURRENCY_PATTERNS) {
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`${escaped}\\s*([\\d,]+(?:\\.\\d{1,2})?)`, "i");
    const match = text.match(re);
    if (match) {
      return { amount: match[1].replace(/,/g, ""), currency: code };
    }
  }
  const fallback = text.match(/([\d,]+(?:\.\d{1,2})?)\s+(?:UGX|TZS|MWK|ZMW|RWF|KES|KSh)/i);
  if (fallback) {
    return { amount: fallback[1].replace(/,/g, ""), currency: detectCurrency(text) };
  }
  return null;
}

function extractAirtelTxnId(text: string): string | null {
  const patterns = [
    /(?:ref|txn|id|reference|trans)\s*[:.\s]*([A-Z0-9]{6,20})/i,
    /TXN\s*([A-Z0-9]{6,20})/i,
    /\b([A-Z0-9]{8,20})\b/,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) return m[1];
  }
  return null;
}

export class AirtelMoneyProvider extends BaseWalletProvider {
  readonly code = "airtel_money";
  readonly displayName = "Airtel Money";
  readonly supportedCurrencies = ["KES", "UGX", "TZS", "MWK", "ZMW", "RWF"];
  readonly features: ProviderFeatures = {
    initiatePayment: false,
    queryStatus: false,
    processWebhook: false,
    refund: false,
    balanceInquiry: false,
    smsImport: true,
  };

  async initiatePayment(
    _request: WalletTransactionRequest,
  ): Promise<WalletTransactionResult> {
    throw new Error(`${this.displayName} does not support API-initiated payments in SMS mode`);
  }

  async queryStatus(
    _providerTxnId: string,
  ): Promise<WalletStatusResult> {
    throw new Error(`${this.displayName} does not support status queries in SMS mode`);
  }

  async processWebhook(
    _payload: WalletWebhookPayload,
  ): Promise<WalletWebhookResult> {
    throw new Error(`${this.displayName} does not support webhooks in SMS mode`);
  }

  async processRefund(
    _providerTxnId: string,
    _amount?: string,
  ): Promise<WalletTransactionResult> {
    throw new Error(`${this.displayName} does not support API-initiated refunds in SMS mode`);
  }

  async balanceInquiry(
    _accountId: number,
  ): Promise<WalletBalanceResult> {
    throw new Error(`${this.displayName} does not support balance inquiries in SMS mode`);
  }

  async parseSms(text: string): Promise<ParsedWalletSms[]> {
    return this.parseAirtelBulk(text);
  }

  async generateSmsPreview(text: string): Promise<ParsedWalletSms[]> {
    return this.parseAirtelBulk(text);
  }

  logError(context: string, error: unknown, metadata?: Record<string, unknown>): void {
    console.error(`[AirtelMoneyProvider] ${context}:`, error, metadata ?? "");
  }

  private parseAirtelBulk(text: string): ParsedWalletSms[] {
    const chunks = this.splitIntoChunks(text);
    const results: ParsedWalletSms[] = [];
    for (const chunk of chunks) {
      const parsed = this.parseSingle(chunk);
      if (parsed) results.push(parsed);
    }
    return results;
  }

  private splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    const separator = /(?:Transaction\s*ID|Ref\s*ID|Txn\s*ID|ref:\s*)/i;
    const parts = text.split(separator);
    for (let i = 0; i < parts.length; i++) {
      const chunk = (i > 0 && parts[i - 1] ? parts[i - 1] + " " : "") + parts[i];
      if (chunk.trim().length > 20) chunks.push(chunk.trim());
    }
    if (chunks.length === 0) {
      const wholeText = text.trim();
      if (wholeText.length > 20) chunks.push(wholeText);
    }
    return chunks.length > 0 ? chunks : [text.trim()];
  }

  private parseSingle(text: string): ParsedWalletSms | null {
    const t = text.trim();
    if (t.length < 15) return null;

    const lower = t.toLowerCase();
    if (lower.includes("failed") || lower.includes("declined") || lower.includes("error") || lower.includes("cancelled")) {
      return null;
    }
    if (!lower.includes("airtel") && !lower.includes("airtime")) return null;

    const currencyInfo = extractCurrencyAmount(t);
    if (!currencyInfo) return null;

    const amount = currencyInfo.amount;
    const currency = currencyInfo.currency;
    const txnId = extractAirtelTxnId(t);
    if (!txnId) return null;

    const txnType = this.detectTxnType(lower, t);
    const direction = this.detectDirection(txnType, lower);
    const partyName = this.extractPartyName(t, lower, txnType);
    const txnFee = this.extractFee(t, lower);
    const date = this.extractDate(t);
    const balance = this.extractBalance(t, lower);

    return {
      providerTxnId: txnId,
      date,
      amount: direction === "out" ? `-${amount}` : amount,
      currency,
      txnType,
      direction,
      partyName: partyName || undefined,
      txnFee,
      balance,
      rawText: t,
    };
  }

  private detectTxnType(
    lower: string,
    _original: string,
  ): ParsedWalletSms["txnType"] {
    if (lower.includes("received") || lower.includes("you have received")) return "payment";
    if (lower.includes("cashpower") || lower.includes("cash power")) return "utility";
    if (lower.includes("withdrawn") || lower.includes("withdraw")) return "withdrawal";
    if (lower.includes("airtime") && !lower.includes("received")) return "airtime";
    if (lower.includes("sent to") || lower.includes("paid to")) return "transfer";
    if (lower.includes("deposited")) return "topup";
    return "payment";
  }

  private detectDirection(txnType: string, lower: string): "in" | "out" {
    if (txnType === "payment" && lower.includes("you have received")) return "in";
    if (txnType === "topup") return "in";
    if (lower.includes("you have received")) return "in";
    return "out";
  }

  private extractPartyName(
    text: string,
    _lower: string,
    _txnType: string,
  ): string | null {
    const receivedMatch = text.match(/(?:from)\s+([A-Za-z0-9\s]{2,30})(?:\s+(?:on|at|Txn|$|,))?/i);
    if (receivedMatch) return receivedMatch[1].trim();
    const sentMatch = text.match(/(?:sent to|paid to)\s+([A-Za-z0-9\s]{2,30})(?:\s+(?:on|at|Txn|$|,))?/i);
    if (sentMatch) return sentMatch[1].trim();
    const nameMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/);
    if (nameMatch) return nameMatch[1].trim();
    return null;
  }

  private extractFee(
    text: string,
    _lower: string,
  ): string | undefined {
    const feeMatch = text.match(/(?:fee|charge|commission)\s*:?\s*([\d,]+\.?\d*)/i);
    if (feeMatch) return feeMatch[1].replace(/,/g, "");
    const deductedMatch = text.match(/deducted[:\s]+([\d,]+\.?\d*)/i);
    if (deductedMatch) return deductedMatch[1].replace(/,/g, "");
    return "0.00";
  }

  private extractDate(text: string): string {
    const dateMatch = text.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/);
    if (dateMatch) {
      const parts = dateMatch[1].split(/[/-]/);
      if (parts.length === 3) {
        const day = parts[0].padStart(2, "0");
        const month = parts[1].padStart(2, "0");
        let year = parts[2];
        if (year.length === 2) year = `20${year}`;
        return `${year}-${month}-${day}`;
      }
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  private extractBalance(
    text: string,
    _lower: string,
  ): string | undefined {
    const balMatch = text.match(/balance[:\s]+([\d,]+\.?\d*)/i);
    if (balMatch) return balMatch[1].replace(/,/g, "");
    return undefined;
  }
}

export const airtelMoneyProvider = new AirtelMoneyProvider();
