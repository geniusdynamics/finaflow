// ABOUTME: Verifies the Subscriptions page summary strip, cards view, view switcher and empty state render correctly.
// ABOUTME: Uses the repo's node-env renderToStaticMarkup + vi.mock("@/providers/trpc") style with no DOM testing library.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";

const mockState = vi.hoisted(() => {
  const sampleRows = [
    {
      id: 1,
      businessId: 1,
      locationId: null,
      postingLocationId: 1,
      name: "Internet Service",
      description: null,
      vendorId: 1,
      categoryId: 1,
      amount: "1200.00",
      currency: "KES",
      cycleUnit: "month",
      cycleCount: 1,
      isOneTime: false,
      startDate: "2026-01-01",
      nextDueDate: "2026-10-19",
      autoRenew: true,
      status: "active",
      cancellationDate: null,
      cancelledAt: null,
      cancelReason: null,
      replacedBySubscriptionId: null,
      trialEndsAt: null,
      defaultAccountId: 1,
      postingMode: "expense",
      externalSystem: null,
      externalId: null,
      url: "https://example.test",
      logoUrl: null,
      notifyEnabled: true,
      notifyDaysBefore: 3,
      notes: "Fibre plan",
      createdBy: 1,
      updatedBy: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
      monthlyNormalized: "1200.00",
      yearlyNormalized: "14400.00",
      convertedMonthly: "1200.00",
      convertedYearly: "14400.00",
      progress: 60,
      daysUntilDue: 3,
      isDueSoon: true,
      isOverdue: false,
      branchName: null,
      vendorName: "Safaricom",
      categoryName: "Utilities",
      postingModeLabel: "Create expense",
      lastPaidDate: "2026-10-16",
    },
    {
      id: 2,
      businessId: 1,
      locationId: 2,
      postingLocationId: 2,
      name: "Office Coffee",
      description: null,
      vendorId: null,
      categoryId: 2,
      amount: "1000.00",
      currency: "KES",
      cycleUnit: "month",
      cycleCount: 1,
      isOneTime: false,
      startDate: "2026-02-01",
      nextDueDate: "2026-10-11",
      autoRenew: false,
      status: "active",
      cancellationDate: null,
      cancelledAt: null,
      cancelReason: null,
      replacedBySubscriptionId: null,
      trialEndsAt: null,
      defaultAccountId: null,
      postingMode: "bill",
      externalSystem: null,
      externalId: null,
      url: null,
      logoUrl: null,
      notifyEnabled: true,
      notifyDaysBefore: null,
      notes: null,
      createdBy: 1,
      updatedBy: 1,
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
      deletedAt: null,
      monthlyNormalized: "1000.00",
      yearlyNormalized: "12000.00",
      convertedMonthly: null,
      convertedYearly: null,
      progress: 10,
      daysUntilDue: -5,
      isDueSoon: false,
      isOverdue: true,
      branchName: "Westlands",
      vendorName: null,
      categoryName: "Pantry",
      postingModeLabel: "Create bill",
      lastPaidDate: null,
    },
  ];
  return {
    rows: sampleRows as unknown[],
    totals: { monthly: "2200.00", yearly: "26400.00", currency: "KES", conversionUnavailable: 2 },
  };
});

vi.mock("@/providers/trpc", () => ({
  trpc: {
    useUtils: () => ({
      subscriptions: {
        list: { invalidate: vi.fn() },
        get: { invalidate: vi.fn() },
        payments: { list: { invalidate: vi.fn() } },
      },
      suppliers: { list: { invalidate: vi.fn() } },
      expenses: { categories: { invalidate: vi.fn() } },
    }),
    subscriptions: {
      list: {
        useQuery: () => ({
          data: {
            rows: mockState.rows,
            totals: mockState.totals,
            total: mockState.rows.length,
            page: 1,
            pageSize: 50,
            totalPages: 1,
          },
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        }),
      },
      get: { useQuery: () => ({ data: undefined, isLoading: false }) },
      create: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) },
      update: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) },
      clone: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) },
      pause: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) },
      resume: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) },
      cancel: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) },
      renew: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) },
      recordPayment: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) },
      confirmPayment: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) },
      payments: {
        list: {
          useQuery: () => ({
            data: { rows: [], total: 0, page: 1, pageSize: 50, totalPages: 1 },
            isLoading: false,
          }),
        },
      },
    },
    locations: { list: { useQuery: () => ({ data: [{ id: 1, name: "Main" }, { id: 2, name: "Westlands" }] }) } },
    suppliers: {
      list: { useQuery: () => ({ data: [{ id: 1, name: "Safaricom" }] }) },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    expenses: {
      categories: { useQuery: () => ({ data: [{ id: 1, name: "Utilities" }, { id: 2, name: "Pantry" }] }) },
      createCategory: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    chartOfAccounts: { list: { useQuery: () => ({ data: [] }) } },
    accounts: {
      list: {
        useQuery: () => ({
          data: [{ id: 1, name: "Bank Account", type: "bank_account", locationId: null, deletedAt: null }],
        }),
      },
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      role: "owner",
      permissions: ["subscriptions:view", "subscriptions:manage", "subscriptions:pay"],
      currentBusinessId: 1,
    },
    isLoading: false,
    logout: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { Subscriptions } from "../Subscriptions";

function renderSubscriptions(path = "/subscriptions") {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Subscriptions embedded />
    </MemoryRouter>,
  );
}

describe("Subscriptions summary strip", () => {
  beforeEach(() => {
    mockState.rows = [
      {
        id: 1,
        name: "Internet Service",
        amount: "1200.00",
        currency: "KES",
        cycleUnit: "month",
        cycleCount: 1,
        isOneTime: false,
        startDate: "2026-01-01",
        nextDueDate: "2026-10-19",
        autoRenew: true,
        status: "active",
        locationId: null,
        vendorName: "Safaricom",
        categoryName: "Utilities",
        monthlyNormalized: "1200.00",
        yearlyNormalized: "14400.00",
        convertedMonthly: "1200.00",
        convertedYearly: "14400.00",
        progress: 60,
        daysUntilDue: 3,
        isDueSoon: true,
        isOverdue: false,
        branchName: null,
        postingModeLabel: "Create expense",
        lastPaidDate: "2026-10-16",
      },
      {
        id: 2,
        name: "Office Coffee",
        amount: "1000.00",
        currency: "KES",
        cycleUnit: "month",
        cycleCount: 1,
        isOneTime: false,
        startDate: "2026-02-01",
        nextDueDate: "2026-10-11",
        autoRenew: false,
        status: "active",
        locationId: 2,
        vendorName: null,
        categoryName: "Pantry",
        monthlyNormalized: "1000.00",
        yearlyNormalized: "12000.00",
        convertedMonthly: null,
        convertedYearly: null,
        progress: 10,
        daysUntilDue: -5,
        isDueSoon: false,
        isOverdue: true,
        branchName: "Westlands",
        postingModeLabel: "Create bill",
        lastPaidDate: null,
      },
    ];
    mockState.totals = { monthly: "2200.00", yearly: "26400.00", currency: "KES", conversionUnavailable: 2 };
  });

  it("renders monthly and yearly totals from the list query", () => {
    const html = renderSubscriptions();
    expect(html).toContain("Monthly Cost");
    expect(html).toContain("Yearly Cost");
    expect(html).toContain("KES 2,200.00");
    expect(html).toContain("KES 26,400.00");
  });

  it("shows due-this-month and overdue counts plus the conversion chip", () => {
    const html = renderSubscriptions();
    expect(html).toContain("Due this month");
    expect(html).toContain("Overdue");
    expect(html).toContain("conversion unavailable: 2");
  });
});

describe("Subscriptions cards view", () => {
  beforeEach(() => {
    mockState.rows = [
      {
        id: 1,
        name: "Internet Service",
        amount: "1200.00",
        currency: "KES",
        cycleUnit: "month",
        cycleCount: 1,
        isOneTime: false,
        startDate: "2026-01-01",
        nextDueDate: "2026-10-19",
        autoRenew: true,
        status: "active",
        locationId: null,
        vendorName: "Safaricom",
        categoryName: "Utilities",
        monthlyNormalized: "1200.00",
        yearlyNormalized: "14400.00",
        convertedMonthly: "1200.00",
        convertedYearly: "14400.00",
        progress: 60,
        daysUntilDue: 3,
        isDueSoon: true,
        isOverdue: false,
        branchName: null,
        postingModeLabel: "Create expense",
        lastPaidDate: "2026-10-16",
      },
      {
        id: 2,
        name: "Office Coffee",
        amount: "1000.00",
        currency: "KES",
        cycleUnit: "month",
        cycleCount: 1,
        isOneTime: false,
        startDate: "2026-02-01",
        nextDueDate: "2026-10-11",
        autoRenew: false,
        status: "active",
        locationId: 2,
        vendorName: null,
        categoryName: "Pantry",
        monthlyNormalized: "1000.00",
        yearlyNormalized: "12000.00",
        convertedMonthly: null,
        convertedYearly: null,
        progress: 10,
        daysUntilDue: -5,
        isDueSoon: false,
        isOverdue: true,
        branchName: "Westlands",
        postingModeLabel: "Create bill",
        lastPaidDate: null,
      },
    ];
  });

  it("renders subscription names and the Whole business chip for a null branch", () => {
    const html = renderSubscriptions();
    expect(html).toContain("Internet Service");
    expect(html).toContain("Whole business");
    expect(html).toContain('data-testid="subscription-card-1"');
    expect(html).toContain("Safaricom");
    expect(html).toContain("/ month");
  });

  it("colours Mark paid green when a payment exists and red when unpaid", () => {
    const html = renderSubscriptions();
    // Row 1 has a last payment -> green + check; row 2 was never paid -> red.
    expect(html).toContain("Last paid");
    expect(html).toContain("Not paid yet");
    expect(html).toContain("bg-[#2E7D32]");
    expect(html).toContain("bg-[#C73E1D]");
  });

  it("renders all three view options in the SegmentedToggle", () => {
    const html = renderSubscriptions();
    expect(html).toContain('data-testid="segmented-option-cards"');
    expect(html).toContain('data-testid="segmented-option-table"');
    expect(html).toContain('data-testid="segmented-option-split"');
  });
});

describe("Subscriptions empty state", () => {
  it("renders the empty state when the list is empty", () => {
    mockState.rows = [];
    mockState.totals = { monthly: "0.00", yearly: "0.00", currency: "KES", conversionUnavailable: 0 };
    const html = renderSubscriptions();
    expect(html).toContain("No subscriptions found");
  });
});
