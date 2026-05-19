// ABOUTME: Concrete M-PESA wallet provider implementing the BaseWalletProvider interface.
// ABOUTME: SMS-based integration with KES-only currency lock. Migrated from the legacy mpesa-parser.ts.

import { BaseWalletProvider, ParsedWalletSms, WalletTransactionRequest, WalletTransactionResult, WalletStatusResult, WalletWebhookPayload, WalletWebhookResult, WalletBalanceResult, ProviderFeatures } from "../provider-interface";

export class MpesaProvider extends BaseWalletProvider {
  readonly code = "mpesa";
  readonly displayName = "M-PESA";
  readonly supportedCurrencies = ["KES"];
  readonly features: ProviderFeatures = {
    initiatePayment: false,
    queryStatus: false,
    processWebhook: false,
    refund: false,
    balanceInquiry: false,
    smsImport: true,
  };

  async initiatePayment(_request: WalletTransactionRequest): Promise<WalletTransactionResult> {
    throw new Error(`${this.displayName} does not support API-initiated payments in SMS mode`);
  }

  async queryStatus(_providerTxnId: string): Promise<WalletStatusResult> {
    throw new Error(`${this.displayName} does not support status queries in SMS mode`);
  }

  async processWebhook(_payload: WalletWebhookPayload): Promise<WalletWebhookResult> {
    throw new Error(`${this.displayName} does not support webhooks in SMS mode`);
  }

  async processRefund(_providerTxnId: string, _amount?: string): Promise<WalletTransactionResult> {
    throw new Error(`${this.displayName} does not support API-initiated refunds in SMS mode`);
  }

  async balanceInquiry(_accountId: number): Promise<WalletBalanceResult> {
    throw new Error(`${this.displayName} does not support balance inquiries in SMS mode`);
  }

  async parseSms(text: string): Promise<ParsedWalletSms[]> {
    return this.parseMpesaSmsBulk(text);
  }

  async generateSmsPreview(text: string): Promise<ParsedWalletSms[]> {
    return this.parseMpesaSmsBulk(text);
  }

  logError(context: string, error: unknown, metadata?: Record<string, unknown>): void {
    console.error(`[MpesaProvider] ${context}:`, error, metadata ?? "");
  }

  private parseMpesaSms(text: string): ParsedWalletSms | null {
    if (!text || text.length < 30) return null;

    const lowerText = text.toLowerCase();

    if (lowerText.includes("fuliza") && lowerText.includes("failed")) return null;
    if (lowerText.includes("is declined") || lowerText.includes("unsuccessful") || lowerText.includes("failed due to insufficient")) return null;
    if (lowerText.includes("cancelled")) return null;

    const txnId = this.extractValue(text, /([A-Z0-9]{6,20})/);
    if (!txnId || txnId === text.trim()) return null;

    if (!lowerText.includes("confirmed")) return null;

    const kshAmount = this.extractKshAmount(text);
    if (!kshAmount) return null;

    const dateStr = text.match(/\d{1,2}\/\d{1,2}\/\d{2}/)?.[0] ?? "";
    const timeStr = text.match(/\d{1,2}:\d{2}\s*(?:AM|PM)/i)?.[0] ?? "";
    const balanceStr = this.extractKshValue(text, /balance\s*:?\s*(?:ksh\s*)?([\d,]+(?:\.\d{1,2})?)/i);

    const rawTxnType = this.detectTxnType(lowerText, text);
    const direction = this.detectDirection(rawTxnType, lowerText);
    const partyName = this.extractPartyName(lowerText, rawTxnType, text);
    const txnFee = this.extractKshValue(text, /(?:transaction\s+fee|charge)\s*:?\s*(?:ksh\s*)?([\d,]+(?:\.\d{1,2})?)/i) ?? "0.00";

    return {
      providerTxnId: txnId,
      date: this.parseDate(dateStr),
      time: timeStr,
      amount: direction === "out" ? `-${kshAmount}` : kshAmount,
      currency: "KES",
      txnType: rawTxnType,
      direction,
      partyName: partyName || undefined,
      partyIdentifier: this.extractPartyIdentifier(text, lowerText) || undefined,
      balance: balanceStr || undefined,
      txnFee,
      rawText: text,
    };
  }

  private parseMpesaSmsBulk(text: string): ParsedWalletSms[] {
    const chunks = this.splitIntoSmsChunks(text);
    const results: ParsedWalletSms[] = [];
    for (const chunk of chunks) {
      const parsed = this.parseMpesaSms(chunk);
      if (parsed) results.push(parsed);
    }
    return results;
  }

  private splitIntoSmsChunks(text: string): string[] {
    const parts = text.split(/(?=[A-Z0-9]{6,20}\s+Confirmed\.)/);
    return parts.filter((p) => p.trim().length > 0);
  }

  private extractValue(text: string, regex: RegExp): string | null {
    const match = text.match(regex);
    return match?.[1] ?? null;
  }

  private extractKshAmount(text: string): string | null {
    const patterns = [
      /(?:received|paid|sent|withdrawn|bought|transferred|deposited)\s+ksh\s*([\d,]+(?:\.\d{1,2})?)/i,
      /ksh\s*([\d,]+(?:\.\d{1,2})?)\s+(?:paid|sent|withdrawn|bought|transferred)/i,
      /ksh\s*([\d,]+(?:\.\d{1,2})?)/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].replace(/,/g, "");
    }
    return null;
  }

  private extractKshValue(text: string, regex: RegExp): string | null {
    const match = text.match(regex);
    if (match) return match[1].replace(/,/g, "");
    return null;
  }

  private detectTxnType(lowerText: string, originalText: string): ParsedWalletSms["txnType"] {
    if (lowerText.includes("you have received") || lowerText.includes("received from")) {
      if (lowerText.includes("kcb") || lowerText.includes("co-op") || lowerText.includes("equity") || lowerText.includes("bank")) {
        return "topup";
      }
      return "payment";
    }
    if (lowerText.includes("paid to")) return "payment";
    if (lowerText.includes("sent to")) return "transfer";
    if (lowerText.includes("withdrawn")) return "withdrawal";
    if (lowerText.includes("airtime")) return "airtime";
    if (lowerText.includes("utility") || lowerText.includes("till no") || lowerText.includes("kplc") || lowerText.includes("cashpower")) return "utility";
    if (lowerText.includes("transferred to")) return "transfer";
    if (lowerText.includes("sent from") || lowerText.includes("deposited")) {
      if (lowerText.includes("kcb") || lowerText.includes("co-op") || lowerText.includes("equity") || lowerText.includes("bank")) {
        return "topup";
      }
      return "payment";
    }
    return "transfer";
  }

  private detectDirection(txnType: string, lowerText: string): "in" | "out" {
    if (txnType === "topup") return "in";
    if (lowerText.includes("you have received") || lowerText.includes("received from") || lowerText.includes("sent from") || lowerText.includes("deposited")) {
      return "in";
    }
    return "out";
  }

  private extractPartyName(lowerText: string, txnType: string, originalText: string): string | null {
    if (txnType === "topup") {
      const bankMatch = originalText.match(/sent from\s+([A-Za-z\s]+?)(?:\s+to|\s+on\s+|$)/i);
      return bankMatch?.[1]?.trim() ?? null;
    }
    const patterns = [
      /(?:received|received from)\s+ksh[\d,.]+\s+from\s+(.+?)(?:\s+on\s+|\s+at\s+|\d{1,2}\/\d{1,2}|\s*$)/i,
      /(?:paid to|sent to)\s+(.+?)(?:\s+(?:on|at|via|using)|(?:ksh[\d,.]+\s+balance)|$)/i,
    ];
    for (const pattern of patterns) {
      const match = originalText.match(pattern);
      if (match) return match[1].trim();
    }
    return null;
  }

  private extractPartyIdentifier(text: string, lowerText: string): string | null {
    const phoneMatch = text.match(/0\d{9}/);
    if (phoneMatch) return phoneMatch[0];
    const tillMatch = text.match(/till\s*(?:no\.?)?\s*:?\s*(\d{5,10})/i);
    if (tillMatch) return `Till ${tillMatch[1]}`;
    return null;
  }

  private parseDate(dateStr: string): string {
    if (!dateStr) {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    }
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${year}-${month}-${day}`;
    }
    return dateStr;
  }
}

export const mpesaProvider = new MpesaProvider();
