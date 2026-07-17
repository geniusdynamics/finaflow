/**
 * Common timezone definitions grouped by region.
 * East African timezones listed first.
 */

export interface TimezoneInfo {
  id: string;
  label: string;
  region: string;
}

export const TIMEZONES: readonly TimezoneInfo[] = [
  // ── East Africa ───────────────────────────────────────────────────────
  { id: "Africa/Nairobi", label: "Africa/Nairobi (UTC+3)", region: "East Africa" },
  { id: "Africa/Dar_es_Salaam", label: "Africa/Dar_es_Salaam (UTC+3)", region: "East Africa" },
  { id: "Africa/Kampala", label: "Africa/Kampala (UTC+3)", region: "East Africa" },
  { id: "Africa/Kigali", label: "Africa/Kigali (UTC+2)", region: "East Africa" },
  { id: "Africa/Bujumbura", label: "Africa/Bujumbura (UTC+2)", region: "East Africa" },
  { id: "Africa/Juba", label: "Africa/Juba (UTC+2)", region: "East Africa" },
  { id: "Africa/Addis_Ababa", label: "Africa/Addis_Ababa (UTC+3)", region: "East Africa" },
  { id: "Africa/Mogadishu", label: "Africa/Mogadishu (UTC+3)", region: "East Africa" },
  { id: "Africa/Djibouti", label: "Africa/Djibouti (UTC+3)", region: "East Africa" },
  { id: "Africa/Asmara", label: "Africa/Asmara (UTC+3)", region: "East Africa" },

  // ── Africa ────────────────────────────────────────────────────────────
  { id: "Africa/Lagos", label: "Africa/Lagos (UTC+1)", region: "Africa" },
  { id: "Africa/Accra", label: "Africa/Accra (UTC+0)", region: "Africa" },
  { id: "Africa/Johannesburg", label: "Africa/Johannesburg (UTC+2)", region: "Africa" },
  { id: "Africa/Cairo", label: "Africa/Cairo (UTC+2)", region: "Africa" },
  { id: "Africa/Casablanca", label: "Africa/Casablanca (UTC+1)", region: "Africa" },
  { id: "Africa/Maputo", label: "Africa/Maputo (UTC+2)", region: "Africa" },
  { id: "Africa/Lusaka", label: "Africa/Lusaka (UTC+2)", region: "Africa" },
  { id: "Africa/Blantyre", label: "Africa/Blantyre (UTC+2)", region: "Africa" },
  { id: "Africa/Harare", label: "Africa/Harare (UTC+2)", region: "Africa" },

  // ── Europe ────────────────────────────────────────────────────────────
  { id: "Europe/London", label: "Europe/London (UTC+0/+1)", region: "Europe" },
  { id: "Europe/Paris", label: "Europe/Paris (UTC+1/+2)", region: "Europe" },
  { id: "Europe/Berlin", label: "Europe/Berlin (UTC+1/+2)", region: "Europe" },
  { id: "Europe/Madrid", label: "Europe/Madrid (UTC+1/+2)", region: "Europe" },
  { id: "Europe/Rome", label: "Europe/Rome (UTC+1/+2)", region: "Europe" },
  { id: "Europe/Amsterdam", label: "Europe/Amsterdam (UTC+1/+2)", region: "Europe" },
  { id: "Europe/Zurich", label: "Europe/Zurich (UTC+1/+2)", region: "Europe" },
  { id: "Europe/Moscow", label: "Europe/Moscow (UTC+3)", region: "Europe" },
  { id: "Europe/Istanbul", label: "Europe/Istanbul (UTC+3)", region: "Europe" },

  // ── Americas ──────────────────────────────────────────────────────────
  { id: "America/New_York", label: "America/New_York (UTC-5/-4)", region: "Americas" },
  { id: "America/Chicago", label: "America/Chicago (UTC-6/-5)", region: "Americas" },
  { id: "America/Denver", label: "America/Denver (UTC-7/-6)", region: "Americas" },
  { id: "America/Los_Angeles", label: "America/Los_Angeles (UTC-8/-7)", region: "Americas" },
  { id: "America/Toronto", label: "America/Toronto (UTC-5/-4)", region: "Americas" },
  { id: "America/Mexico_City", label: "America/Mexico_City (UTC-6/-5)", region: "Americas" },
  { id: "America/Sao_Paulo", label: "America/Sao_Paulo (UTC-3)", region: "Americas" },

  // ── Middle East ───────────────────────────────────────────────────────
  { id: "Asia/Dubai", label: "Asia/Dubai (UTC+4)", region: "Middle East" },
  { id: "Asia/Riyadh", label: "Asia/Riyadh (UTC+3)", region: "Middle East" },
  { id: "Asia/Qatar", label: "Asia/Qatar (UTC+3)", region: "Middle East" },

  // ── Asia / Pacific ────────────────────────────────────────────────────
  { id: "Asia/Kolkata", label: "Asia/Kolkata (UTC+5:30)", region: "Asia" },
  { id: "Asia/Dhaka", label: "Asia/Dhaka (UTC+6)", region: "Asia" },
  { id: "Asia/Singapore", label: "Asia/Singapore (UTC+8)", region: "Asia" },
  { id: "Asia/Kuala_Lumpur", label: "Asia/Kuala_Lumpur (UTC+8)", region: "Asia" },
  { id: "Asia/Bangkok", label: "Asia/Bangkok (UTC+7)", region: "Asia" },
  { id: "Asia/Shanghai", label: "Asia/Shanghai (UTC+8)", region: "Asia" },
  { id: "Asia/Tokyo", label: "Asia/Tokyo (UTC+9)", region: "Asia" },
  { id: "Asia/Seoul", label: "Asia/Seoul (UTC+9)", region: "Asia" },
  { id: "Australia/Sydney", label: "Australia/Sydney (UTC+10/+11)", region: "Asia" },
  { id: "Pacific/Auckland", label: "Pacific/Auckland (UTC+12/+13)", region: "Asia" },
] as const;

export function searchTimezones(query: string): readonly TimezoneInfo[] {
  if (!query) return TIMEZONES;
  const lower = query.toLowerCase();
  return TIMEZONES.filter(
    (tz) =>
      tz.id.toLowerCase().includes(lower) ||
      tz.label.toLowerCase().includes(lower) ||
      tz.region.toLowerCase().includes(lower)
  );
}
