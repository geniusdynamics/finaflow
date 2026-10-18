// ABOUTME: Maps canonical statement category keys to a business's own expense-category names.
// ABOUTME: Best effort only: an unmatched key stays uncategorised instead of being forced into a bucket.

/** Canonical key -> acceptable category names, most specific first. */
export const CATEGORY_ALIASES: Record<string, string[]> = {
  fees: ["Bank Charges & Fees", "Bank Charges", "Bank Fees", "M-PESA Fees", "Transaction Fees", "Fees"],
  cash_withdrawal: ["Cash Withdrawals", "Cash Withdrawal", "Cash"],
  airtime: ["Airtime/Data", "Airtime & Data", "Airtime and Data", "Airtime"],
  loans_savings: ["Loans & Savings", "Loans and Savings", "Loan Repayments", "Loans", "Savings"],
  utilities: ["Utilities", "Utility Bills", "Electricity & Water"],
  food: ["Food Supplies", "Food & Dining", "Food and Beverage", "Groceries", "Food"],
  fuel: ["Fuel", "Petrol & Diesel", "Transport & Fuel"],
  rent: ["Rent", "Rent & Rates"],
  salaries: ["Salaries & Wages", "Salaries and Wages", "Salaries", "Payroll", "Wages"],
  transport: ["Transport & Delivery", "Transport and Delivery", "Transport", "Logistics"],
  marketing: ["Marketing", "Advertising"],
  supplies: ["Supplies", "Office Supplies", "General Supplies"],
};

/** Human labels for canonical keys, used when no business categories are available (public tool). */
export const CATEGORY_KEY_LABELS: Record<string, string> = {
  fees: "Fees & charges",
  cash_withdrawal: "Cash withdrawals",
  airtime: "Airtime & data",
  loans_savings: "Loans & savings",
  utilities: "Utilities",
  food: "Food & groceries",
  fuel: "Fuel",
  rent: "Rent",
  salaries: "Salaries & wages",
  transport: "Transport & delivery",
  marketing: "Marketing",
  supplies: "Supplies",
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface CategoryCandidate {
  id: number;
  name: string;
}

/**
 * Resolves a canonical key against the business's category names.
 * Returns the matching category, or null. Never invents a category.
 */
export function resolveCategory(
  key: string | null | undefined,
  categories: CategoryCandidate[],
): CategoryCandidate | null {
  if (!key) return null;
  const aliases = CATEGORY_ALIASES[key];
  if (!aliases) return null;

  const byName = new Map<string, CategoryCandidate>();
  for (const category of categories) {
    const normalized = normalizeName(category.name);
    if (!byName.has(normalized)) byName.set(normalized, category);
  }

  for (const alias of aliases) {
    const match = byName.get(normalizeName(alias));
    if (match) return match;
  }
  return null;
}
