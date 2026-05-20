// ABOUTME: Provides currency-aware formatting, supported currency definitions, and conversion display utilities.
// ABOUTME: Replaces the KES-only formatKES() with a generalized formatCurrency() while preserving backward compatibility.

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", decimalPlaces: 2 },
  { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2 },
  { code: "UGX", name: "Ugandan Shilling", symbol: "USh", decimalPlaces: 0 },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh", decimalPlaces: 2 },
  { code: "EUR", name: "Euro", symbol: "EUR", decimalPlaces: 2 },
  { code: "GBP", name: "British Pound", symbol: "GBP", decimalPlaces: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "JPY", decimalPlaces: 0 },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "KWD", decimalPlaces: 3 },
  { code: "MWK", name: "Malawian Kwacha", symbol: "MK", decimalPlaces: 2 },
  { code: "ZMW", name: "Zambian Kwacha", symbol: "ZK", decimalPlaces: 2 },
  { code: "RWF", name: "Rwandan Franc", symbol: "FRw", decimalPlaces: 0 },
  { code: "BWP", name: "Botswana Pula", symbol: "P", decimalPlaces: 2 },
  { code: "ZAR", name: "South African Rand", symbol: "R", decimalPlaces: 2 },
  { code: "NGN", name: "Nigerian Naira", symbol: "NGN", decimalPlaces: 2 },
  { code: "ETB", name: "Ethiopian Birr", symbol: "Br", decimalPlaces: 2 },
  { code: "MZN", name: "Mozambican Metical", symbol: "MT", decimalPlaces: 2 },
  { code: "AOA", name: "Angolan Kwanza", symbol: "Kz", decimalPlaces: 2 },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "GH", decimalPlaces: 2 },
  { code: "XAF", name: "CFA Franc BEAC", symbol: "FCFA", decimalPlaces: 0 },
  { code: "XOF", name: "CFA Franc BCEAO", symbol: "CFA", decimalPlaces: 0 },
];

const localeMap: Record<string, string> = {
  KES: "en-KE", USD: "en-US", UGX: "en-UG", TZS: "en-TZ",
  EUR: "de-DE", GBP: "en-GB", JPY: "ja-JP", KWD: "en-KW",
  MWK: "en-MW", ZMW: "en-ZM", RWF: "en-RW", BWP: "en-BW",
  ZAR: "en-ZA", NGN: "en-NG", ETB: "en-ET", MZN: "en-MZ",
  AOA: "en-AO", GHS: "en-GH", XAF: "en-CM", XOF: "en-SN",
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
