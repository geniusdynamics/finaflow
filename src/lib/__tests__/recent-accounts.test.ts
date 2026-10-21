// ABOUTME: Tests the device-level recent-account memory that lets returning users skip the account-ID step.
// ABOUTME: Uses an in-memory Storage double so the suite runs in the Node test environment.
import { describe, expect, it } from "vitest";
import {
  MAX_RECENT_ACCOUNTS,
  RECENT_ACCOUNTS_KEY,
  readRecentAccounts,
  saveRecentAccount,
} from "../recent-accounts";

function createStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("recent accounts", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(readRecentAccounts(createStorage())).toEqual([]);
  });

  it("stores the account and normalises the id", () => {
    const storage = createStorage();
    const result = saveRecentAccount({ accountId: " genius ", name: "Genius Ltd" }, storage);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ accountId: "GENIUS", name: "Genius Ltd" });
    expect(readRecentAccounts(storage)[0].accountId).toBe("GENIUS");
  });

  it("promotes an already-known account to the front instead of duplicating it", () => {
    const storage = createStorage();
    saveRecentAccount({ accountId: "FIRST", name: "First" }, storage);
    saveRecentAccount({ accountId: "SECOND", name: "Second" }, storage);

    const result = saveRecentAccount({ accountId: "FIRST", name: "First renamed" }, storage);

    expect(result.map((account) => account.accountId)).toEqual(["FIRST", "SECOND"]);
    expect(result[0].name).toBe("First renamed");
  });

  it("keeps only the most recent accounts", () => {
    const storage = createStorage();
    for (const accountId of ["ONE", "TWO", "THREE", "FOUR"]) {
      saveRecentAccount({ accountId }, storage);
    }

    const result = readRecentAccounts(storage);

    expect(result).toHaveLength(MAX_RECENT_ACCOUNTS);
    expect(result.map((account) => account.accountId)).toEqual(["FOUR", "THREE", "TWO"]);
  });

  it("ignores malformed storage instead of breaking the login page", () => {
    expect(readRecentAccounts(createStorage({ [RECENT_ACCOUNTS_KEY]: "not json" }))).toEqual([]);
    expect(readRecentAccounts(createStorage({ [RECENT_ACCOUNTS_KEY]: JSON.stringify({ accountId: "X" }) }))).toEqual([]);
    expect(readRecentAccounts(createStorage({
      [RECENT_ACCOUNTS_KEY]: JSON.stringify([{ accountId: "" }, { name: "no id" }, null]),
    }))).toEqual([]);
  });

  it("does not throw when storage writes fail", () => {
    const storage = createStorage();
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };

    expect(() => saveRecentAccount({ accountId: "GENIUS" }, storage)).not.toThrow();
  });
});
