/**
 * Country definitions with ISO 3166-1 alpha-2 codes and dial codes.
 * East African countries listed first, followed by commonly used markets.
 */

export interface CountryInfo {
  code: string;
  name: string;
  currencyCode: string;
  dialCode: string;
  flag: string;
}

export const COUNTRIES: readonly CountryInfo[] = [
  // ── East Africa ───────────────────────────────────────────────────────
  { code: "KE", name: "Kenya", currencyCode: "KES", dialCode: "+254", flag: "🇰🇪" },
  { code: "TZ", name: "Tanzania", currencyCode: "TZS", dialCode: "+255", flag: "🇹🇿" },
  { code: "UG", name: "Uganda", currencyCode: "UGX", dialCode: "+256", flag: "🇺🇬" },
  { code: "RW", name: "Rwanda", currencyCode: "RWF", dialCode: "+250", flag: "🇷🇼" },
  { code: "BI", name: "Burundi", currencyCode: "BIF", dialCode: "+257", flag: "🇧🇮" },
  { code: "SS", name: "South Sudan", currencyCode: "SSP", dialCode: "+211", flag: "🇸🇸" },
  { code: "ET", name: "Ethiopia", currencyCode: "ETB", dialCode: "+251", flag: "🇪🇹" },
  { code: "SO", name: "Somalia", currencyCode: "SOS", dialCode: "+252", flag: "🇸🇴" },
  { code: "DJ", name: "Djibouti", currencyCode: "DJF", dialCode: "+253", flag: "🇩🇯" },
  { code: "ER", name: "Eritrea", currencyCode: "ERN", dialCode: "+291", flag: "🇪🇷" },

  // ── Major International ───────────────────────────────────────────────
  { code: "US", name: "United States", currencyCode: "USD", dialCode: "+1", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", currencyCode: "GBP", dialCode: "+44", flag: "🇬🇧" },
  { code: "DE", name: "Germany", currencyCode: "EUR", dialCode: "+49", flag: "🇩🇪" },
  { code: "FR", name: "France", currencyCode: "EUR", dialCode: "+33", flag: "🇫🇷" },
  { code: "IT", name: "Italy", currencyCode: "EUR", dialCode: "+39", flag: "🇮🇹" },
  { code: "ES", name: "Spain", currencyCode: "EUR", dialCode: "+34", flag: "🇪🇸" },
  { code: "NL", name: "Netherlands", currencyCode: "EUR", dialCode: "+31", flag: "🇳🇱" },
  { code: "CH", name: "Switzerland", currencyCode: "CHF", dialCode: "+41", flag: "🇨🇭" },
  { code: "JP", name: "Japan", currencyCode: "JPY", dialCode: "+81", flag: "🇯🇵" },
  { code: "CN", name: "China", currencyCode: "CNY", dialCode: "+86", flag: "🇨🇳" },
  { code: "IN", name: "India", currencyCode: "INR", dialCode: "+91", flag: "🇮🇳" },
  { code: "CA", name: "Canada", currencyCode: "CAD", dialCode: "+1", flag: "🇨🇦" },
  { code: "AU", name: "Australia", currencyCode: "AUD", dialCode: "+61", flag: "🇦🇺" },

  // ── Africa ────────────────────────────────────────────────────────────
  { code: "ZA", name: "South Africa", currencyCode: "ZAR", dialCode: "+27", flag: "🇿🇦" },
  { code: "NG", name: "Nigeria", currencyCode: "NGN", dialCode: "+234", flag: "🇳🇬" },
  { code: "GH", name: "Ghana", currencyCode: "GHS", dialCode: "+233", flag: "🇬🇭" },
  { code: "MA", name: "Morocco", currencyCode: "MAD", dialCode: "+212", flag: "🇲🇦" },
  { code: "EG", name: "Egypt", currencyCode: "EGP", dialCode: "+20", flag: "🇪🇬" },
  { code: "SN", name: "Senegal", currencyCode: "XOF", dialCode: "+221", flag: "🇸🇳" },
  { code: "CM", name: "Cameroon", currencyCode: "XAF", dialCode: "+237", flag: "🇨🇲" },
  { code: "MW", name: "Malawi", currencyCode: "MWK", dialCode: "+265", flag: "🇲🇼" },
  { code: "ZM", name: "Zambia", currencyCode: "ZMW", dialCode: "+260", flag: "🇿🇲" },
  { code: "MZ", name: "Mozambique", currencyCode: "MZN", dialCode: "+258", flag: "🇲🇿" },
  { code: "BW", name: "Botswana", currencyCode: "BWP", dialCode: "+267", flag: "🇧🇼" },

  // ── Middle East / Asia ────────────────────────────────────────────────
  { code: "AE", name: "United Arab Emirates", currencyCode: "AED", dialCode: "+971", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia", currencyCode: "SAR", dialCode: "+966", flag: "🇸🇦" },
  { code: "QA", name: "Qatar", currencyCode: "QAR", dialCode: "+974", flag: "🇶🇦" },
  { code: "KW", name: "Kuwait", currencyCode: "KWD", dialCode: "+965", flag: "🇰🇼" },
  { code: "BH", name: "Bahrain", currencyCode: "BHD", dialCode: "+973", flag: "🇧🇭" },
  { code: "SG", name: "Singapore", currencyCode: "SGD", dialCode: "+65", flag: "🇸🇬" },
  { code: "MY", name: "Malaysia", currencyCode: "MYR", dialCode: "+60", flag: "🇲🇾" },
  { code: "TH", name: "Thailand", currencyCode: "THB", dialCode: "+66", flag: "🇹🇭" },
  { code: "KR", name: "South Korea", currencyCode: "KRW", dialCode: "+82", flag: "🇰🇷" },
  { code: "PK", name: "Pakistan", currencyCode: "PKR", dialCode: "+92", flag: "🇵🇰" },
  { code: "BD", name: "Bangladesh", currencyCode: "BDT", dialCode: "+880", flag: "🇧🇩" },

  // ── Americas ──────────────────────────────────────────────────────────
  { code: "BR", name: "Brazil", currencyCode: "BRL", dialCode: "+55", flag: "🇧🇷" },
  { code: "MX", name: "Mexico", currencyCode: "MXN", dialCode: "+52", flag: "🇲🇽" },
] as const;

export function getCountryByCode(code: string): CountryInfo | undefined {
  return COUNTRIES.find((c) => c.code === code.toUpperCase());
}

export function searchCountries(query: string): readonly CountryInfo[] {
  if (!query) return COUNTRIES;
  const lower = query.toLowerCase();
  return COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(lower) ||
      c.code.toLowerCase().includes(lower) ||
      c.dialCode.includes(query)
  );
}

export function getDialCode(countryCode: string): string | undefined {
  return COUNTRIES.find((c) => c.code === countryCode.toUpperCase())?.dialCode;
}

export function getCountryFromPhone(phone: string): CountryInfo | undefined {
  const stripped = phone.replace(/[\s\-()]/g, "");
  if (!stripped.startsWith("+")) return undefined;
  const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  return sorted.find((c) => stripped.startsWith(c.dialCode));
}

/** Map ISO country code → default currency code. */
export const COUNTRY_CURRENCY_MAP: Readonly<Record<string, string>> =
  Object.fromEntries(COUNTRIES.map((c) => [c.code, c.currencyCode]));

export function getDefaultCurrencyForCountry(countryCode: string): string | undefined {
  return COUNTRY_CURRENCY_MAP[countryCode.toUpperCase()];
}
