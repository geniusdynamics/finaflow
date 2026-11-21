// ABOUTME: Client-side handoff for the "create an account on the sibling app"
// ABOUTME: referral. The connect session id and state ride in the signup URL;
// ABOUTME: they are kept in sessionStorage until the new owner accepts the link.

export const CONNECT_REFERRAL_KEY = "fina_connect_signup_referral";
/** A signup referral is valid for an hour, matching the connect session TTL. */
export const CONNECT_REFERRAL_TTL_MS = 60 * 60 * 1000;

export type StoredConnectReferral = {
  connect: string;
  state: string;
  source: string;
  sourceAccount: string | null;
  sourceName: string | null;
  startedAt: number;
};

type ParamReader = { get(name: string): string | null };

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Persist the referral carried by a signup URL. Returns null when absent. */
export function saveConnectReferral(
  params: ParamReader,
  now = Date.now()
): StoredConnectReferral | null {
  const connect = params.get("connect")?.trim();
  const state = params.get("state")?.trim();
  if (!connect || !state) return null;

  const referral: StoredConnectReferral = {
    connect,
    state,
    source: params.get("source")?.trim() || "finabill",
    sourceAccount: params.get("source_account")?.trim() || null,
    sourceName: params.get("source_name")?.trim() || null,
    startedAt: now,
  };

  const store = storage();
  if (store) {
    try {
      store.setItem(CONNECT_REFERRAL_KEY, JSON.stringify(referral));
    } catch {
      // Private mode or a full quota: the referral still works for this page.
    }
  }
  return referral;
}

/** Read a non-expired referral, clearing a stale one. */
export function readConnectReferral(
  now = Date.now()
): StoredConnectReferral | null {
  const store = storage();
  if (!store) return null;
  const raw = store.getItem(CONNECT_REFERRAL_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredConnectReferral>;
    if (
      typeof parsed.connect !== "string" ||
      typeof parsed.state !== "string" ||
      typeof parsed.startedAt !== "number" ||
      now - parsed.startedAt > CONNECT_REFERRAL_TTL_MS
    ) {
      store.removeItem(CONNECT_REFERRAL_KEY);
      return null;
    }
    return {
      connect: parsed.connect,
      state: parsed.state,
      source: typeof parsed.source === "string" ? parsed.source : "finabill",
      sourceAccount:
        typeof parsed.sourceAccount === "string" ? parsed.sourceAccount : null,
      sourceName:
        typeof parsed.sourceName === "string" ? parsed.sourceName : null,
      startedAt: parsed.startedAt,
    };
  } catch {
    store.removeItem(CONNECT_REFERRAL_KEY);
    return null;
  }
}

export function clearConnectReferral(): void {
  try {
    storage()?.removeItem(CONNECT_REFERRAL_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Owners and account admins may link systems; staff may not. */
export function canLinkAccounts(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}
