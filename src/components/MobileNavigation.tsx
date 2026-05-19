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
  Briefcase,
  Building,
  Building2,
  Smartphone,
  ShieldCheck,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Wallet,
} from "lucide-react";
import { useState } from "react";

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
  { path: "/locations", label: "Branches", icon: Building2 },
  { path: "/payroll", label: "Payroll", icon: Users },
  { path: "/mpesa", label: "M-PESA", icon: Smartphone },
  { path: "/wallet", label: "Wallet", icon: Wallet },
  { path: "/calendar", label: "Calendar", icon: CalendarDays },
  { path: "/reports", label: "Reports", icon: FileSpreadsheet },
  { path: "/users", label: "Users & Roles", icon: ShieldCheck },
  { path: "/settings", label: "Settings", icon: Settings },
  { path: "/businesses", label: "Businesses", icon: Briefcase },
  { path: "/partner", label: "Partner", icon: Handshake },
];

type MobileNavItem = {
  path: string;
  label: string;
  icon: any;
};

export function MobileBottomNavigation() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#E8E0D8] bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="flex h-16 items-center justify-around px-2">
        {mobileBottomNavItems.map((item, index) => {
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

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9999] bg-black/30 lg:hidden"
        onClick={onClose}
      />

      {/* Menu Panel */}
      <div className="fixed right-0 top-0 z-[9998] h-full w-3/4 max-w-sm bg-white shadow-2xl lg:hidden">
        <div className="flex items-center justify-between border-b border-[#E8E0D8] px-4 py-3 sticky top-0 z-10 bg-white">
          <span className="font-serif text-base font-bold text-[#2D2A26]">
            Menu
          </span>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-[#8D8A87] hover:bg-[#F5EDE6]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {mobileSecondaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={onClose}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[#C73E1D]/10 text-[#C73E1D]"
                        : "text-[#2D2A26] hover:bg-[#F5EDE6]"
                    }`}
                  >
                    <div className={`rounded-lg p-2 ${isActive ? "bg-[#C73E1D]/10" : "bg-[#F5EDE6]"}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span>{item.label}</span>
                    {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-[#E8E0D8] p-4">
          {/* Business selector */}
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-[#E8E0D8] bg-[#F5EDE6] px-3 py-2">
            <Building className="h-4 w-4 text-[#8D8A87]" />
            <span className="text-sm font-medium text-[#2D2A26]">
              Business
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
