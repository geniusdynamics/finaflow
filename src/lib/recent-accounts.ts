// ABOUTME: Remembers the Finaflow accounts used on this browser so the login page can skip the account-ID step.
// ABOUTME: Storage access is defensive — a blocked or full localStorage never stops a user from signing in.

export type RecentAccount = {
  accountId: string;
  name: string;
  lastUsedAt: number;
};

export const RECENT_ACCOUNTS_KEY = "finaflow_recent_accounts";
export const MAX_RECENT_ACCOUNTS = 3;

/** The current browser's localStorage, or null during SSR, tests, or when storage is blocked. */
function getBrowserStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    // Access can throw when the browser has storage disabled.
    return null;
  }
}

function toRecentAccount(value: unknown): RecentAccount | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.accountId !== "string") return null;
  const accountId = candidate.accountId.trim().toUpperCase();
  if (!accountId) return null;
  return {
    accountId,
    name: typeof candidate.name === "string" ? candidate.name.trim() : "",
    lastUsedAt: typeof candidate.lastUsedAt === "number" && Number.isFinite(candidate.lastUsedAt)
      ? candidate.lastUsedAt
      : 0,
  };
}

/** Most recently used first. Malformed entries are dropped rather than surfaced as broken UI. */
export function readRecentAccounts(storage: Storage | null = getBrowserStorage()): RecentAccount[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(RECENT_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const seen = new Set<string>();
    const accounts: RecentAccount[] = [];
    for (const entry of parsed) {
      const account = toRecentAccount(entry);
      if (!account || seen.has(account.accountId)) continue;
      seen.add(account.accountId);
      accounts.push(account);
    }
    return accounts
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      .slice(0, MAX_RECENT_ACCOUNTS);
  } catch {
    return [];
  }
}

/** Adds or promotes an account to the front of the list and returns the refreshed list. */
export function saveRecentAccount(
  account: { accountId: string; name?: string },
  storage: Storage | null = getBrowserStorage(),
): RecentAccount[] {
  const normalized = toRecentAccount({
    accountId: account.accountId,
    name: account.name ?? "",
    lastUsedAt: Date.now(),
  });
  if (!normalized) return readRecentAccounts(storage);

  const existing = readRecentAccounts(storage).filter(
    (entry) => entry.accountId !== normalized.accountId,
  );
  const next = [normalized, ...existing].slice(0, MAX_RECENT_ACCOUNTS);

  if (storage) {
    try {
      storage.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify(next));
    } catch {
      // Quota or privacy-mode failures are non-fatal.
    }
  }
  return next;
}
