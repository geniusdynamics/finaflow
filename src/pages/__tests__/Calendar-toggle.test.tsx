// ABOUTME: Verifies the Calendar source toggle — Both shows subscriptions + bills with legend and monthly strip,
// ABOUTME: ?section=subscriptions locks to a focused renewal view, and the toggle options render.
// ABOUTME: Uses the repo's node-env renderToStaticMarkup + vi.mock("@/providers/trpc") style.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";

const mockState = vi.hoisted(() => {
  const dayIn = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  return {
    subEvent: {
      id: 10,
      date: dayIn(5),
      name: "Google Workspace",
      amount: "1200.00",
      currency: "KES",
      type: "subscription",
      isOverdue: false,
      isDueToday: false,
      isOneTime: false,
      branchName: null,
    },
    bill: {
      id: 1,
      description: "Internet Bill",
      dueDate: dayIn(3),
      balanceDue: "500.00",
      status: "pending",
    },
  };
});

vi.mock("@/providers/trpc", () => ({
  trpc: {
    useUtils: () => ({
      subscriptions: {
        list: { invalidate: vi.fn() },
        get: { invalidate: vi.fn() },
        payments: { list: { invalidate: vi.fn() } },
        stats: { invalidate: vi.fn() },
        calendar: { invalidate: vi.fn() },
      },
    }),
    resetQueryClient: vi.fn(),
    dailySales: { list: { useQuery: () => ({ data: [] }) } },
    expenses: { list: { useQuery: () => ({ data: [] }) } },
    payroll: { periods: { useQuery: () => ({ data: [] }) } },
    dashboard: {
      billCalendar: {
        useQuery: () => ({ data: { bills: [mockState.bill], recurring: [], today: mockState.bill.dueDate } }),
      },
    },
    subscriptions: {
      calendar: { useQuery: () => ({ data: { events: [mockState.subEvent] } }) },
      stats: {
        useQuery: () => ({
          data: {
            baseCurrency: "KES",
            projection: [{ month: mockState.subEvent.date.slice(0, 7), total: "1200.00", budget: "500.00" }],
          },
        }),
      },
      list: {
        useQuery: () => ({
          data: { rows: [], totals: { monthly: "0.00", yearly: "0.00", currency: "KES", conversionUnavailable: 0 }, total: 0, page: 1, pageSize: 50, totalPages: 1 },
          isLoading: false,
          isError: false,
        }),
      },
      get: { useQuery: () => ({ data: undefined, isLoading: false }) },
      payments: { list: { useQuery: () => ({ data: { rows: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }, isLoading: false }) } },
    },
    locations: { list: { useQuery: () => ({ data: [] }) } },
    suppliers: { list: { useQuery: () => ({ data: [] }) } },
    accounts: { list: { useQuery: () => ({ data: [] }) } },
  },
  resetQueryClient: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      role: "owner",
      permissions: ["calendar:view", "subscriptions:view", "bills:view"],
      currentBusinessId: 1,
    },
    isLoading: false,
    logout: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Calendar hardcodes <Layout>; render just the page content so assertions stay on the toggle.
vi.mock("@/components/Layout", () => ({
  Layout: ({ children }: { children: unknown }) => children,
}));

import { Calendar } from "../Calendar";

function renderCalendar(path = "/calendar") {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Calendar />
    </MemoryRouter>,
  );
}

describe("Calendar source toggle", () => {
  it("renders the source toggle options and the legend in Both mode", () => {
    const html = renderCalendar();
    expect(html).toContain('data-testid="segmented-option-subscriptions"');
    expect(html).toContain('data-testid="segmented-option-bills"');
    expect(html).toContain('data-testid="segmented-option-both"');
    expect(html).toContain("Subscriptions");
    expect(html).toContain("Bills");
    expect(html).toContain("Both");
    // Legend present in Both mode
    expect(html).toMatch(/Bills<\/span>/);
  });

  it("shows both subscription and bill events in Both mode", () => {
    const html = renderCalendar();
    expect(html).toContain("Google Workspace");
    expect(html).toContain("Internet Bill");
  });

  it("renders the monthly subscription strip with the due count", () => {
    const html = renderCalendar();
    expect(html).toContain("1 subscription due");
    expect(html).toContain("subscriptions");
  });

  it("locks to subscriptions-only for ?section=subscriptions deep links", () => {
    const html = renderCalendar("/calendar?section=subscriptions");
    expect(html).toContain("Google Workspace");
    expect(html).not.toContain("Internet Bill");
    // Bill alert cards are hidden in the focused renewal view
    expect(html).not.toContain("Overdue Bills");
  });
});
