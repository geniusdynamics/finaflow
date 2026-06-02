// eslint-disable react-refresh/only-export-components
import { Link, useLocation } from "react-router";
import {
  LayoutDashboard,
  Receipt,
  TrendingDown,
  FileText,
  FileSpreadsheet,
  CreditCard,
  CalendarDays,
  Users,
  Settings,
  Handshake,
  Building,
  ShieldCheck,
  X,
  ChevronRight,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { resetQueryClient, trpc } from "@/providers/trpc";

// Primary navigation items - always visible at bottom
export const mobileBottomNavItems = [
  { path: "/dashboard", label: "Dashboard", icon: () => <LayoutDashboard className="h-5 w-5" /> },
  { path: "/daily-sales", label: "Sales", icon: () => <Receipt className="h-5 w-5" /> },
  { path: "/expenses", label: "Expenses", icon: () => <TrendingDown className="h-5 w-5" /> },
  { path: "/bills", label: "Bills", icon: () => <FileText className="h-5 w-5" /> },
  { path: "/reports", label: "Reports", icon: () => <FileSpreadsheet className="h-5 w-5" /> },
];

// Secondary navigation items - shown in hamburger menu
export const mobileSecondaryNavItems = [
  { path: "/suppliers", label: "Suppliers", icon: Building },
  { path: "/bills", label: "Bills", icon: FileText },
  { path: "/accounts", label: "Accounts", icon: CreditCard },
  { path: "/payroll", label: "Payroll", icon: Users },
  { path: "/wallet", label: "Wallet", icon: Wallet },
  { path: "/calendar", label: "Calendar", icon: CalendarDays },
  { path: "/reports", label: "Reports", icon: FileSpreadsheet },
  { path: "/users", label: "Users & Roles", icon: ShieldCheck },
  { path: "/settings", label: "Settings", icon: Settings },
  { path: "/partner", label: "Partner", icon: Handshake },
];

export function MobileBottomNavigation() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#E8E0D8] bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="flex h-16 items-center justify-around px-2">
        {mobileBottomNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 rounded-xl px-4 py-2 transition-all ${
                isActive
                  ? "text-[#C73E1D]"
                  : "text-[#8D8A87] hover:text-[#2D2A26]"
              }`}
            >
              <div className={`rounded-lg p-2 ${isActive ? "bg-[#C73E1D]/10" : "bg-[#F5EDE6]"}`}>
                {item.icon()}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileHamburgerMenu({
  onClose,
}: {
  onClose: () => void;
}) {
  const location = useLocation();
  const { user } = useAuth();
  const { data: businesses } = trpc.businesses.list.useQuery();
  const switchBusiness = trpc.businesses.switch.useMutation({
    onSuccess: () => {
      trpc.useUtils().invalidate();
      window.location.reload();
    },
  });
  const [bizOpen, setBizOpen] = useState(false);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9999] bg-black/30 lg:hidden"
        onClick={onClose}
      />

      {/* Menu Panel */}
      <div className="fixed right-0 top-0 z-[9998] h-full w-fit min-w-[180px] max-w-[70vw] bg-white shadow-2xl lg:hidden">
        <div className="flex items-center justify-between border-b border-[#E8E0D8] px-3 py-2.5 sticky top-0 z-10 bg-white">
          <span className="font-serif text-sm font-bold text-[#2D2A26]">
            Menu
          </span>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8D8A87] hover:bg-[#F5EDE6]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-0.5">
            {mobileSecondaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={onClose}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[#C73E1D]/10 text-[#C73E1D]"
                        : "text-[#2D2A26] hover:bg-[#F5EDE6]"
                    }`}
                  >
                    <div className={`rounded-lg p-1.5 ${isActive ? "bg-[#C73E1D]/10" : "bg-[#F5EDE6]"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span>{item.label}</span>
                    {isActive && <ChevronRight className="ml-auto h-3 w-3" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-[#E8E0D8] p-3">
          {businesses && businesses.length > 1 && (
            <div className="mb-2">
              <button
                onClick={() => setBizOpen(!bizOpen)}
                className="flex w-full items-center gap-2 rounded-lg border border-[#E8E0D8] px-2.5 py-2 text-sm text-[#2D2A26] hover:bg-[#F5EDE6]"
              >
                <Building className="h-3.5 w-3.5 shrink-0 text-[#8D8A87]" />
                <span className="flex-1 truncate text-left">{user?.currentBusiness?.name ?? "Select Business"}</span>
                <ChevronRight className={`h-3 w-3 shrink-0 text-[#8D8A87] transition-transform ${bizOpen ? "rotate-90" : ""}`} />
              </button>
              {bizOpen && (
                <div className="mt-0.5 space-y-0.5 rounded-lg border border-[#E8E0D8] bg-white">
                  {businesses.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        setBizOpen(false);
                        onClose();
                        if (b.id !== user?.currentBusinessId) {
                          switchBusiness.mutate(
                            { businessId: b.id },
                            {
                              onSuccess: () => {
                                resetQueryClient();
                                window.location.reload();
                              },
                            },
                          );
                        }
                      }}
                      className={`flex w-full items-center gap-2 px-2.5 py-2 text-sm text-left hover:bg-[#F5EDE6] first:rounded-t-lg last:rounded-b-lg ${b.id === user?.currentBusinessId ? "text-[#C73E1D] font-medium" : "text-[#2D2A26]"}`}
                    >
                      <Building className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1">{b.name}</span>
                      {b.isDemo && (
                        <span className="rounded bg-[#8D8A87]/10 px-1 py-0 text-[10px] text-[#8D8A87]">DEMO</span>
                      )}
                      {(b as { allocationSource?: unknown }).allocationSource && (
                        <span className="rounded bg-[#0288D1]/10 px-1 py-0.5 text-[10px] text-[#0288D1]">Allocated</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
