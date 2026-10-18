// ABOUTME: Date and time normalisation for statement rows and statement metadata.
// ABOUTME: Handles ISO, slash/dash day-first dates, and long ordinals such as "1st January 2026".

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function toIso(year: number, month: number, day: number): string | null {
  return isValidDate(year, month, day) ? `${year}-${pad2(month)}-${pad2(day)}` : null;
}

/** True for tokens that look like a statement date (used to locate row starts). */
export function isDateToken(raw: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw)
    || /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(raw)
    || /^\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\s+\d{4}$/.test(raw);
}

/**
 * Normalises a statement date to YYYY-MM-DD.
 * Day-first is assumed for slash/dash dates (Kenyan convention), with a 2000s pivot for 2-digit years.
 */
export function normalizeDate(raw: string): string | null {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return toIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const slash = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(text);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const year = Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]);
    return toIso(year, month, day);
  }

  const long = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\s+(\d{4})$/i.exec(text);
  if (long) {
    const month = MONTHS[long[2].toLowerCase()];
    if (!month) return null;
    return toIso(Number(long[3]), month, Number(long[1]));
  }

  return null;
}

/** True for HH:MM or HH:MM:SS tokens. */
export function isTimeToken(raw: string): boolean {
  return /^\d{1,2}:\d{2}(?::\d{2})?$/.test(raw.trim());
}

/** Normalises a statement time to HH:MM:SS (24-hour). */
export function normalizeTime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.trim().toUpperCase();
  const ampm = /\b(AM|PM)\b/.exec(text);
  const core = text.replace(/\s*(AM|PM)\s*/, "");
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(core);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const second = Number(m[3] ?? 0);
  if (ampm) {
    if (hour < 1 || hour > 12) return null;
    if (ampm[1] === "PM" && hour !== 12) hour += 12;
    if (ampm[1] === "AM" && hour === 12) hour = 0;
  }
  if (hour > 23 || minute > 59 || second > 59) return null;
  return `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
}

/** Extracts the start/end of a statement period such as "1st January 2026 - 2nd July 2026". */
export function parsePeriod(raw: string): { start: string; end: string } | null {
  const parts = raw.split(/\s+(?:-|–|—|to)\s+/i);
  if (parts.length !== 2) return null;
  const start = normalizeDate(parts[0]);
  const end = normalizeDate(parts[1]);
  return start && end ? { start, end } : null;
}

/** Days between two ISO dates, inclusive. */
export function daysInclusive(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor((b - a) / 86_400_000) + 1;
}
