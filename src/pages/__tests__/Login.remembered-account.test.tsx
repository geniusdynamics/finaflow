// ABOUTME: Verifies that a returning visitor skips the account-ID step while keeping account switching available.
// ABOUTME: Mocks the device memory so the Login page can be rendered without a browser Storage.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";

const deviceMemory = vi.hoisted(() => ({
  accounts: [] as Array<{ accountId: string; name: string; lastUsedAt: number }>,
}));

vi.mock("@/lib/recent-accounts", () => ({
  readRecentAccounts: () => deviceMemory.accounts,
  saveRecentAccount: () => deviceMemory.accounts,
}));

vi.mock("@/providers/trpc", () => ({
  trpc: {
    useUtils: () => ({ localAuth: { me: { reset: vi.fn() } } }),
    localAuth: {
      me: { useQuery: () => ({ data: undefined, isLoading: false }) },
      checkAccountAvailability: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      lookupAccount: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      login: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      register: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  setCsrfFromResponse: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import Login from "../Login";

function renderLogin() {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={["/login"]}>
      <Login />
    </MemoryRouter>,
  );
}

describe("Login with a remembered account", () => {
  beforeEach(() => {
    deviceMemory.accounts = [];
  });

  it("opens straight on the credentials step for a return visit", () => {
    deviceMemory.accounts = [{ accountId: "GENIUS", name: "Genius Ltd", lastUsedAt: 1 }];

    const html = renderLogin();

    expect(html).toContain('id="login-username"');
    expect(html).toContain('id="login-password"');
    expect(html).not.toContain('id="accountId"');
    expect(html).toContain("Genius Ltd");
    expect(html).toContain("GENIUS");
  });

  it("offers a way to switch to a different account", () => {
    deviceMemory.accounts = [{ accountId: "GENIUS", name: "Genius Ltd", lastUsedAt: 1 }];

    const html = renderLogin();

    expect(html).toContain('data-testid="change-account"');
    expect(html).toContain("Different account");
  });

  it("stays on the account lookup when the device has no history", () => {
    const html = renderLogin();

    expect(html).toContain('id="accountId"');
    expect(html).not.toContain('id="login-username"');
    expect(html).toContain("Account ID or email");
  });
});
