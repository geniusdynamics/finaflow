// ABOUTME: Provides currency-aware formatting, supported currency definitions, and conversion display utilities.
// ABOUTME: Replaces the KES-only formatKES() with a generalized formatCurrency() while preserving backward compatibility.

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  // ── East Africa ─────────────────────────────────────────────────────
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", decimalPlaces: 2 },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh", decimalPlaces: 2 },
  { code: "UGX", name: "Ugandan Shilling", symbol: "USh", decimalPlaces: 0 },
  { code: "RWF", name: "Rwandan Franc", symbol: "FRw", decimalPlaces: 0 },
  { code: "BIF", name: "Burundian Franc", symbol: "FBu", decimalPlaces: 0 },
  { code: "SSP", name: "South Sudanese Pound", symbol: "£", decimalPlaces: 2 },
  { code: "ETB", name: "Ethiopian Birr", symbol: "Br", decimalPlaces: 2 },
  { code: "SOS", name: "Somali Shilling", symbol: "Sh", decimalPlaces: 2 },
  { code: "DJF", name: "Djiboutian Franc", symbol: "Fdj", decimalPlaces: 0 },
  { code: "ERN", name: "Eritrean Nakfa", symbol: "Nfk", decimalPlaces: 2 },

  // ── Major International ─────────────────────────────────────────────
  { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2 },
  { code: "EUR", name: "Euro", symbol: "€", decimalPlaces: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", decimalPlaces: 2 },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", decimalPlaces: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", decimalPlaces: 0 },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", decimalPlaces: 2 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", decimalPlaces: 2 },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", decimalPlaces: 2 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", decimalPlaces: 2 },

  // ── Africa ──────────────────────────────────────────────────────────
  { code: "ZAR", name: "South African Rand", symbol: "R", decimalPlaces: 2 },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", decimalPlaces: 2 },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "GH₵", decimalPlaces: 2 },
  { code: "MWK", name: "Malawian Kwacha", symbol: "MK", decimalPlaces: 2 },
  { code: "ZMW", name: "Zambian Kwacha", symbol: "ZK", decimalPlaces: 2 },
  { code: "MZN", name: "Mozambican Metical", symbol: "MT", decimalPlaces: 2 },
  { code: "AOA", name: "Angolan Kwanza", symbol: "Kz", decimalPlaces: 2 },
  { code: "BWP", name: "Botswana Pula", symbol: "P", decimalPlaces: 2 },
  { code: "XAF", name: "CFA Franc BEAC", symbol: "FCFA", decimalPlaces: 0 },
  { code: "XOF", name: "CFA Franc BCEAO", symbol: "CFA", decimalPlaces: 0 },

  // ── Middle East / Asia ──────────────────────────────────────────────
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", decimalPlaces: 2 },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼", decimalPlaces: 2 },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "د.ك", decimalPlaces: 3 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", decimalPlaces: 2 },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", decimalPlaces: 2 },
  { code: "THB", name: "Thai Baht", symbol: "฿", decimalPlaces: 2 },
  { code: "KRW", name: "South Korean Won", symbol: "₩", decimalPlaces: 0 },
  { code: "PKR", name: "Pakistani Rupee", symbol: "₨", decimalPlaces: 2 },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳", decimalPlaces: 2 },

  // ── Americas ────────────────────────────────────────────────────────
  { code: "BRL", name: "Brazilian Real", symbol: "R$", decimalPlaces: 2 },
  { code: "MXN", name: "Mexican Peso", symbol: "Mex$", decimalPlaces: 2 },
];

const localeMap: Record<string, string> = {
  KES: "en-KE", TZS: "en-TZ", UGX: "en-UG", RWF: "en-RW",
  BIF: "en-BI", SSP: "en-SS", ETB: "en-ET", SOS: "en-SO",
  DJF: "fr-DJ", ERN: "en-ER",
  USD: "en-US", EUR: "de-DE", GBP: "en-GB", CHF: "de-CH",
  JPY: "ja-JP", CNY: "zh-CN", INR: "en-IN", CAD: "en-CA",
  AUD: "en-AU",
  ZAR: "en-ZA", NGN: "en-NG", GHS: "en-GH", MWK: "en-MW",
  ZMW: "en-ZM", MZN: "en-MZ", AOA: "en-AO", BWP: "en-BW",
  XAF: "en-CM", XOF: "en-SN",
  AED: "ar-AE", SAR: "ar-SA", KWD: "en-KW", SGD: "en-SG",
  MYR: "ms-MY", THB: "th-TH", KRW: "ko-KR", PKR: "en-PK",
  BDT: "bn-BD",
  BRL: "pt-BR", MXN: "es-MX",
};

export function getCurrencyInfo(currency: string): CurrencyInfo {
  return SUPPORTED_CURRENCIES.find((c) => c.code === currency) ?? {
    code: currency,
    name: currency,
    symbol: currency,
    decimalPlaces: 2,
  };
}

export function formatCurrency(
  amount: string | number,
  currency: string = "KES",
  options?: { showCode?: boolean; compact?: boolean }
): string {
  const num = typeof amount === "string" ? parseFloat(amount.replace(/,/g, "")) : amount;
  if (isNaN(num)) return `${currency} 0.00`;

  const locale = localeMap[currency] || "en-US";
  const decimalInfo = getCurrencyInfo(currency);

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: options?.compact ? 0 : decimalInfo.decimalPlaces,
      maximumFractionDigits: options?.compact ? 0 : decimalInfo.decimalPlaces,
      currencyDisplay: options?.showCode ? "code" : "symbol",
    }).format(num);
  } catch {
    return `${currency} ${num.toFixed(decimalInfo.decimalPlaces)}`;
  }
}

export function getCurrencySymbol(currency: string): string {
  const info = getCurrencyInfo(currency);
  return info.symbol;
}

export function addCurrencySuffix(amount: string, currency: string): string {
  return `${amount} ${currency}`;
}

export function formatKES(amount: string | number): string {
  return formatCurrency(amount, "KES");
}

export function formatAmountInput(amount: string, currency: string): string {
  const info = getCurrencyInfo(currency);
  const parts = amount.split(".");
  if (parts.length > 1 && parts[1].length > info.decimalPlaces) {
    const truncated = `${parts[0]}.${parts[1].slice(0, info.decimalPlaces)}`;
    return info.decimalPlaces === 0 ? parts[0] : truncated;
  }
  if (parts.length > 1 && info.decimalPlaces === 0) {
    return parts[0];
  }
  return amount;
}
