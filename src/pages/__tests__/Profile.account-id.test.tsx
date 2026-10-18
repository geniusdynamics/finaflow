// ABOUTME: Verifies the Profile page's Account Details card surfaces the sign-in Account ID.
// ABOUTME: Renders both the own-profile and admin-viewing-user variants without a browser.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";

const state = vi.hoisted(() => ({
  ownAccountId: "GENIUS" as string | null,
  viewedAccountId: "OTHERCO" as string | null,
}));

vi.mock("@/components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/providers/trpc", () => ({
  trpc: {
    useUtils: () => ({ localAuth: { me: { invalidate: vi.fn() } } }),
    users: {
      get: {
        useQuery: () => ({
          data: {
            id: 2,
            name: "Other User",
            username: "other",
            email: null,
            phone: null,
            role: "viewer",
            isActive: true,
            accountId: state.viewedAccountId,
          },
        }),
      },
      updateProfile: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      changePassword: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      name: "Genius",
      username: "genius",
      role: "owner",
      email: "genius@example.com",
      phone: null,
      locationId: null,
      assignedLocationIds: [],
      enforceUserLocation: false,
      isActive: true,
      userType: "standard",
      currentBusinessId: 1,
      currentBusiness: null,
      businessIds: [],
      businessRole: "owner",
      accountId: state.ownAccountId,
      permissions: [],
    },
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { Profile } from "../Profile";

function renderProfile(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Profile />
    </MemoryRouter>,
  );
}

describe("Profile Account Details", () => {
  it("shows the signed-in user's Account ID with a copy action", () => {
    state.ownAccountId = "GENIUS";

    const html = renderProfile("/profile");

    expect(html).toContain("Account ID:");
    expect(html).toContain("GENIUS");
    expect(html).toContain('aria-label="Copy Account ID"');
  });

  it("shows the viewed user's Account ID when an admin opens another profile", () => {
    state.viewedAccountId = "OTHERCO";

    const html = renderProfile("/profile?id=2");

    expect(html).toContain("Account ID:");
    expect(html).toContain("OTHERCO");
  });

  it("renders a dash instead of an empty field when the account ID is missing", () => {
    state.ownAccountId = null;

    const html = renderProfile("/profile");

    expect(html).toContain("Account ID:");
    expect(html).not.toContain('aria-label="Copy Account ID"');
  });
});
