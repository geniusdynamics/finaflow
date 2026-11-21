// ABOUTME: Pins the signup referral handoff: URL parsing, the one-hour TTL and
// ABOUTME: the owner/admin gate, because a stale or malformed referral must not
// ABOUTME: open a link dialog for the wrong business.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONNECT_REFERRAL_KEY,
  CONNECT_REFERRAL_TTL_MS,
  canLinkAccounts,
  clearConnectReferral,
  readConnectReferral,
  saveConnectReferral,
} from "./connect-referral";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => [...data.keys()][index] ?? null,
    removeItem: key => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  } as Storage;
}

let store: Storage;

beforeEach(() => {
  store = memoryStorage();
  vi.stubGlobal("window", { sessionStorage: store });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const params = (query: string) => new URLSearchParams(query);

describe("connect referral", () => {
  it("persists the session, state and source from the signup URL", () => {
    const saved = saveConnectReferral(
      params(
        "connect=session-123&state=state-456&source=finaflow&source_account=ACC-1&source_name=Alpha"
      ),
      1_000
    );

    expect(saved).toMatchObject({
      connect: "session-123",
      state: "state-456",
      source: "finaflow",
      sourceAccount: "ACC-1",
      sourceName: "Alpha",
      startedAt: 1_000,
    });
    expect(store.getItem(CONNECT_REFERRAL_KEY)).not.toBeNull();
    expect(readConnectReferral(2_000)).toEqual(saved);
  });

  it("ignores a URL without both the session and the state", () => {
    expect(saveConnectReferral(params("connect=only"))).toBeNull();
    expect(saveConnectReferral(params("state=only"))).toBeNull();
    expect(store.getItem(CONNECT_REFERRAL_KEY)).toBeNull();
  });

  it("drops an expired referral and clears the storage entry", () => {
    saveConnectReferral(
      params("connect=session-123&state=state-456&source=finaflow"),
      1_000
    );

    expect(readConnectReferral(1_000 + CONNECT_REFERRAL_TTL_MS + 1)).toBeNull();
    expect(store.getItem(CONNECT_REFERRAL_KEY)).toBeNull();
  });

  it("clears on decline", () => {
    saveConnectReferral(
      params("connect=session-123&state=state-456&source=finaflow")
    );
    clearConnectReferral();
    expect(readConnectReferral()).toBeNull();
  });

  it("only lets owners and account admins link", () => {
    expect(canLinkAccounts("owner")).toBe(true);
    expect(canLinkAccounts("admin")).toBe(true);
    expect(canLinkAccounts("manager")).toBe(false);
    expect(canLinkAccounts("employee")).toBe(false);
    expect(canLinkAccounts(null)).toBe(false);
  });
});
