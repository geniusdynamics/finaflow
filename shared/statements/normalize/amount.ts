// ABOUTME: String-first amount normalisation for statement rows (no float arithmetic, no precision loss).
// ABOUTME: Accepts thousands separators, currency prefixes, dashes, parentheses and trailing minus signs.

export interface NormalizedAmount {
  /** Two-decimal string, e.g. "1234.50" or "0.00". */
  value: string;
  /** False when the input was non-empty but could not be read as a number. */
  valid: boolean;
}

const MONEY_TOKEN = /^-?\d+(?:,\d{3})*\.\d{2}$/;

/** Strict test used to find amount tokens in a statement line. */
export function isMoneyToken(raw: string): boolean {
  return MONEY_TOKEN.test(raw.trim());
}

/** Normalises an amount cell to a 2dp string. Empty/dash means zero, which is valid. */
export function normalizeAmount(raw: unknown): NormalizedAmount {
  if (raw === null || raw === undefined) return { value: "0.00", valid: true };
  let text = String(raw).trim();
  if (text === "" || text === "-" || text === "—" || text === "–") {
    return { value: "0.00", valid: true };
  }

  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (/-$/.test(text)) {
    negative = true;
    text = text.slice(0, -1);
  }

  const hadDigits = /\d/.test(text);
  // Drop currency words/symbols but keep digits, separators and a leading minus.
  text = text.replace(/[^\d.,-]/g, "");
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  }
  text = text.replace(/,/g, "");
  if (text === "") return { value: "0.00", valid: hadDigits };

  if (!/^\d+(?:\.\d+)?$/.test(text)) return { value: "0.00", valid: false };

  const [intRaw, fracRaw = ""] = text.split(".");
  const intPart = intRaw.replace(/^0+(?=\d)/, "") || "0";
  const fracPart = (fracRaw + "00").slice(0, 2);
  const sign = negative && (intPart !== "0" || fracPart !== "00") ? "-" : "";
  return { value: `${sign}${intPart}.${fracPart}`, valid: true };
}

/** True when the amount is zero in either sign. */
export function isZeroAmount(value: string): boolean {
  return /^-?0+\.0{2}$/.test(value);
}

/** Compares two 2dp amount strings without floating point. */
export function compareAmounts(a: string, b: string): number {
  const toScaled = (v: string) => {
    const neg = v.startsWith("-");
    const [i, f = "00"] = (neg ? v.slice(1) : v).split(".");
    const n = BigInt(i) * 100n + BigInt((f + "00").slice(0, 2));
    return neg ? -n : n;
  };
  const av = toScaled(a);
  const bv = toScaled(b);
  return av === bv ? 0 : av < bv ? -1 : 1;
}

function toCents(value: string): bigint {
  const clean = value.replace(/,/g, "");
  const neg = clean.startsWith("-");
  const [intPart, fracPart = "00"] = (neg ? clean.slice(1) : clean).split(".");
  const cents = BigInt(intPart) * 100n + BigInt((fracPart + "00").slice(0, 2));
  return neg ? -cents : cents;
}

function fromCents(cents: bigint): string {
  const neg = cents < 0n;
  const abs = neg ? -cents : cents;
  const intPart = abs / 100n;
  const fracPart = abs % 100n;
  return `${neg && abs !== 0n ? "-" : ""}${intPart}.${String(fracPart).padStart(2, "0")}`;
}

/** Sums 2dp amount strings exactly (BigInt cents). */
export function sumAmounts(values: string[]): string {
  return fromCents(values.reduce((acc, v) => acc + toCents(v), 0n));
}

/** a - b, exactly, for 2dp amount strings. */
export function subtractAmounts(a: string, b: string): string {
  return fromCents(toCents(a) - toCents(b));
}

/** Absolute value of a 2dp amount string. */
export function absoluteAmount(value: string): string {
  return value.startsWith("-") ? value.slice(1) : value;
}
