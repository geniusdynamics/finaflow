/**
 * M-PESA SMS Parser - Comprehensive Safaricom format handler
 * Supports: bank topups, till payments, P2P transfers, paybills,
 * bank transfers, airtime, data bundles, agent withdrawals, received from person
 */

export interface ParsedMpesaSms {
  txnId: string;
  date: string; // YYYY-MM-DD
  time: string;
  amount: string;
  txnType: "topup" | "expense" | "transfer" | "bank_transfer" | "airtime" | "utility" | "withdrawal";
  partyName: string;
  partyIdentifier?: string; // phone, account number, till number
  balance: string;
  txnFee: string;
  rawText: string;
  direction: "in" | "out";
}

/** Extract Ksh amount like 1,000.00 → 1000.00 */
function extractKshAmount(text: string, pattern: RegExp): string {
  const m = text.match(pattern);
  return m ? m[1].replace(/,/g, "") : "0";
}

/** Parse DD/M/YY or D/MM/YY → YYYY-MM-DD */
function parseDate(dateStr: string): string {
  const parts = dateStr.split("/");
  if (parts.length !== 3) return "";
  const day = parts[0].padStart(2, "0");
  const month = parts[1].padStart(2, "0");
  let year = parts[2];
  if (year.length === 2) year = "20" + year;
  return `${year}-${month}-${day}`;
}

/** Split pasted text into individual SMS chunks by transaction ID */
function splitIntoSmsChunks(text: string): string[] {
  // Find all 10-char uppercase IDs followed by optional space and "Confirmed." or "confirmed."
  const idRegex = /\b([A-Z0-9]{10})\s+(?:Confirmed\.|confirmed\.)/g;
  const positions: number[] = [];
  let match;
  while ((match = idRegex.exec(text)) !== null) {
    positions.push(match.index);
  }
  if (positions.length === 0) return [];

  const chunks: string[] = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i];
    const end = i < positions.length - 1 ? positions[i + 1] : text.length;
    chunks.push(text.slice(start, end).trim());
  }
  return chunks;
}

/** Main single-SMS parser */
export function parseMpesaSms(text: string): ParsedMpesaSms | null {
  const rawText = text.trim();
  if (!rawText || rawText.length < 30) return null;

  // Skip failed / cancelled messages
  if (/Failed\.\s*Insufficient funds/i.test(rawText)) return null;
  if (/You have cancelled the transaction/i.test(rawText)) return null;
  if (/\bcancelled\b/i.test(rawText) && !rawText.includes("Confirmed")) return null;

  // Transaction ID
  const txnIdMatch = rawText.match(/^(\b[A-Z0-9]{10}\b)/);
  const txnId = txnIdMatch ? txnIdMatch[1] : "";
  if (!txnId) return null;

  // Transaction amount — first Ksh amount in the message
  const amountStr = extractKshAmount(rawText, /Ksh([0-9,]+\.\d{2})/);

  // Balance
  const balanceStr = extractKshAmount(rawText, /balance is Ksh([0-9,]+\.\d{2})/i);

  // Fee — handle "Transaction cost, KshX" or "Transaction cost, KshX.XX"
  const feeStr = extractKshAmount(rawText, /Transaction cost,\s*Ksh([0-9,]*\.\d{2})/i);

  // Date
  const dateMatch = rawText.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  const dateStr = dateMatch ? parseDate(dateMatch[1]) : "";

  // Time
  const timeMatch = rawText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
  const timeStr = timeMatch ? timeMatch[1] : "";

  let direction: "in" | "out" = "out";
  let txnType: ParsedMpesaSms["txnType"] = "transfer";
  let partyName = "";
  let partyIdentifier = "";

  const lowerText = rawText.toLowerCase();

  // ── PATTERN 1: "You have received KshX from [party] on DD/MM/YY" ── INFLOW
  if (lowerText.includes("you have received")) {
    direction = "in";
    // Check if from a bank → topup, otherwise person-to-person → transfer
    const fromMatch = rawText.match(/from\s+(.+?)\s+on\s+\d/);
    if (fromMatch) {
      partyName = fromMatch[1].trim();
      const lowerParty = partyName.toLowerCase();
      if (lowerParty.includes("kcb") || lowerParty.includes("bank") || lowerParty.includes("equity") || lowerParty.includes("co-operative") || lowerParty.includes("family bank")) {
        txnType = "topup";
      } else {
        txnType = "transfer"; // received from person
        // Try to extract phone number from party name
        const phoneMatch = partyName.match(/(\d{4}\*{3}\d{3,4}|\d{10,12})$/);
        if (phoneMatch) {
          partyIdentifier = phoneMatch[1];
          partyName = partyName.replace(phoneMatch[1], "").trim();
        }
      }
    }
  }

  // ── PATTERN 2: "KshX paid to [business]. on DD/MM/YY" ── OUTFLOW (Till payment)
  else if (lowerText.includes("paid to")) {
    direction = "out";
    txnType = "expense";
    // Match up to the last period before " on [date]"
    const paidToMatch = rawText.match(/paid to\s+(.+?)\.\s*on\s*\d/);
    if (paidToMatch) {
      partyName = paidToMatch[1].trim();
    }
  }

  // ── PATTERN 3: "KshX sent to [party] on DD/MM/YY" ── OUTFLOW
  else if (lowerText.includes("sent to")) {
    direction = "out";
    const sentToMatch = rawText.match(/sent to\s+(.+?)\s+on\s*\d/);
    if (sentToMatch) {
      const fullParty = sentToMatch[1].trim();

      // Check "for account" pattern (bank, utility, airtime)
      const forAccountMatch = fullParty.match(/(.+?)\s+for account\s+(.+)/i);
      if (forAccountMatch) {
        partyName = forAccountMatch[1].trim();
        partyIdentifier = forAccountMatch[2].trim();

        const lowerName = partyName.toLowerCase();
        if (lowerName.includes("bank") || lowerName.includes("co-operative") || lowerName.includes("equity") || lowerName.includes("national bank") || lowerName.includes("family bank") || lowerName.includes("kcb") || lowerName.includes("lipa na")) {
          txnType = "bank_transfer";
        } else if (lowerName.includes("kplc") || lowerName.includes("water") || lowerName.includes("nwsc")) {
          txnType = "utility";
        } else if (lowerName.includes("safaricom") || lowerName.includes("airtime") || lowerName.includes("data")) {
          txnType = "airtime";
        } else {
          txnType = "bank_transfer";
        }
      } else {
        // Person-to-person: "PAUL MAKAU 0790583667" or "AMIN ABDULLAHI" (no phone)
        const phoneMatch = fullParty.match(/(.+?)\s+(\d{10,12})$/);
        if (phoneMatch) {
          partyName = phoneMatch[1].trim();
          partyIdentifier = phoneMatch[2].trim();
        } else {
          partyName = fullParty;
        }
        txnType = "transfer";
      }
    }
  }

  // ── PATTERN 4: "You bought KshX of airtime on DD/MM/YY" ── OUTFLOW
  else if (lowerText.includes("bought") && lowerText.includes("airtime")) {
    direction = "out";
    txnType = "airtime";
    partyName = "Safaricom Airtime";
  }

  // ── PATTERN 5: "Withdraw KshX from [agent] on DD/MM/YY" ── OUTFLOW
  else if (lowerText.includes("withdraw")) {
    direction = "out";
    txnType = "withdrawal";
    const withdrawMatch = rawText.match(/Withdraw\s+Ksh[0-9,.]+\s+from\s+(.+?)\s+(?:New M-PESA balance|on\s*\d)/i);
    if (withdrawMatch) {
      partyName = withdrawMatch[1].trim();
      // Extract till/agent number if present
      const tillMatch = partyName.match(/^(\d{6,8})/);
      if (tillMatch) partyIdentifier = tillMatch[1];
    }
  }

  // Fallback classification for transfers to known businesses
  if (txnType === "transfer" && partyName) {
    const lowerName = partyName.toLowerCase();
    if (lowerName.includes("petroleum") || lowerName.includes("shell") || lowerName.includes("spiro") || lowerName.includes("fuel") || lowerName.includes("purejoy")) {
      txnType = "expense";
    } else if (lowerName.includes("naivas") || lowerName.includes("carrefour") || lowerName.includes("samrat") || lowerName.includes("books") || lowerName.includes("stationery") || lowerName.includes("kitchenware") || lowerName.includes("bashir") || lowerName.includes("salma") || lowerName.includes("lela")) {
      txnType = "expense";
    }
  }

  return {
    txnId,
    date: dateStr,
    time: timeStr,
    amount: amountStr,
    txnType,
    partyName,
    partyIdentifier,
    balance: balanceStr,
    txnFee: feeStr,
    rawText,
    direction,
  };
}

/**
 * Parse multiple M-PESA SMS messages from pasted text.
 * Handles both newline-separated and concatenated messages.
 */
export function parseMpesaSmsBulk(text: string): ParsedMpesaSms[] {
  const chunks = splitIntoSmsChunks(text);
  const results: ParsedMpesaSms[] = [];
  for (const chunk of chunks) {
    const parsed = parseMpesaSms(chunk);
    if (parsed && parsed.txnId && parsed.amount !== "0") {
      results.push(parsed);
    }
  }
  return results;
}
