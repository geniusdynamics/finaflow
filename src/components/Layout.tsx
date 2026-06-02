import { Link, useLocation } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { resetQueryClient } from "@/providers/trpc";
import { trpc } from "@/providers/trpc";
import {
  LayoutDashboard, Receipt, TrendingDown, Users, FileText,
  CreditCard, CalendarDays, Smartphone, Menu, X, LogOut,
  Building2, ChevronRight, FileSpreadsheet,
  ShieldCheck, Settings,
  Building, Bell, Handshake, Wallet,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions";
import { MobileBottomNavigation } from "@/components/MobileNavigation";

const allNavItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perms: [PERMISSIONS.DASHBOARD_VIEW] },
  { path: "/daily-sales", label: "Daily Sales", icon: Receipt, perms: [PERMISSIONS.SALES_VIEW] },
  { path: "/expenses", label: "Expenses", icon: TrendingDown, perms: [PERMISSIONS.EXPENSES_VIEW] },
  { path: "/suppliers", label: "Suppliers", icon: Users, perms: [PERMISSIONS.SUPPLIERS_VIEW] },
  { path: "/bills", label: "Bills", icon: FileText, perms: [PERMISSIONS.BILLS_VIEW] },
  { path: "/accounts", label: "Accounts", icon: CreditCard, perms: [PERMISSIONS.ACCOUNTS_VIEW] },
  { path: "/payroll", label: "Payroll", icon: Users, perms: [PERMISSIONS.PAYROLL_VIEW] },
  { path: "/mpesa", label: "M-PESA", icon: Smartphone, perms: [PERMISSIONS.MPESA_VIEW] },
  { path: "/wallet", label: "Wallet", icon: Wallet, perms: [PERMISSIONS.WALLET_VIEW] },
  { path: "/calendar", label: "Calendar", icon: CalendarDays, perms: [PERMISSIONS.CALENDAR_VIEW] },
  { path: "/reports", label: "Reports", icon: FileSpreadsheet, perms: [PERMISSIONS.REPORTS_VIEW] },
  { path: "/users", label: "Users & Roles", icon: ShieldCheck, perms: [PERMISSIONS.USERS_MANAGE] },
  
  { path: "/settings", label: "Settings", icon: Settings, perms: [PERMISSIONS.SETTINGS_MANAGE] },
  { path: "/partner", label: "Partner", icon: Handshake, perms: [PERMISSIONS.PARTNER_VIEW] },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bizOpen, setBizOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("finaflow_sidebar_collapsed");
    return saved === "true";
  });
  const role = user?.role ?? "viewer";

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("finaflow_sidebar_collapsed", String(next));
      return next;
    });
  };

  const { data: alertList } = trpc.alerts.checkAll.useQuery(undefined, { refetchInterval: 60000 });
  const { data: notifCount } = trpc.notifications.unreadCount.useQuery(undefined, { refetchInterval: 30000 });
  const { data: notifList } = trpc.notifications.list.useQuery({ limit: 20, unreadOnly: false });
  const utils = trpc.useUtils();
  const markNotifRead = trpc.notifications.markRead.useMutation({ onSuccess: () => utils.notifications.invalidate() });
  const genOverdueNotifs = trpc.notifications.generateOverdueNotifications.useMutation({ onSuccess: () => utils.notifications.invalidate() });

  useEffect(() => {
    const timer = setTimeout(() => { genOverdueNotifs.mutate(); }, 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: businesses } = trpc.businesses.list.useQuery();
  const switchBusiness = trpc.businesses.switch.useMutation({
    onSuccess: () => { utils.invalidate(); window.location.reload(); },
  });

  const navItems = allNavItems.filter((item) => hasAnyPermission(role, item.perms));
  const isActive = useCallback((path: string) => location.pathname === path, [location.pathname]);

  const pinnedSection = (
    <div className="border-t border-[#E8E0D8] p-4">
      <div className="mb-3 relative">
        <button
          onClick={() => setAlertOpen(!alertOpen)}
          className="flex w-full items-center gap-2 rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm text-[#2D2A26] hover:bg-[#F5EDE6]"
        >
          <Bell className="h-4 w-4 shrink-0 text-[#8D8A87]" />
          {!sidebarCollapsed && <><span className="flex-1 text-left">Notifications</span>
          <div className="flex gap-1">
            {notifCount !== undefined && notifCount > 0 && (
              <span className="rounded-full bg-[#D32F2F] px-2 py-0.5 text-[10px] font-bold text-white">{notifCount}</span>
            )}
            {alertList && alertList.length > 0 && (!notifCount || notifCount === 0) && (
              <span className="rounded-full bg-[#ED6C02] px-2 py-0.5 text-[10px] font-bold text-white">{alertList.length}</span>
            )}
          </div></>}
        </button>
        {alertOpen && (
          <div className="absolute bottom-full left-0 right-0 mb-1 max-h-72 overflow-y-auto rounded-lg border border-[#E8E0D8] bg-white shadow-lg">
            <div className="border-b border-[#E8E0D8] px-3 py-2">
              <button onClick={() => genOverdueNotifs.mutate()} disabled={genOverdueNotifs.isPending} className="w-full rounded bg-[#C73E1D] px-2 py-1.5 text-[10px] font-medium text-white hover:bg-[#C73E1D]/90 disabled:opacity-50">
                {genOverdueNotifs.isPending ? "Scanning..." : "Check for overdue bills"}
              </button>
            </div>
            {notifList && notifList.length > 0 && (
              <div className="border-b border-[#E8E0D8]">
                {notifList.slice(0, 10).map(n => (
                  <div key={n.id} onClick={() => !n.isRead && markNotifRead.mutate({ id: n.id })} className={`cursor-pointer border-b border-[#E8E0D8] px-3 py-2 text-xs ${n.severity === "critical" ? "bg-[#D32F2F]/5 text-[#D32F2F]" : n.severity === "warning" ? "bg-[#ED6C02]/5 text-[#EDA102]" : "text-[#2D2A26]"} ${!n.isRead ? "font-medium" : "opacity-60"}`}>
                    <p className="flex items-center gap-1"><span className="text-[10px]">{!n.isRead && "● "}</span>{n.title}</p>
                    <p className="text-[10px] opacity-70">{n.message}</p>
                  </div>
                ))}
              </div>
            )}
            {alertList?.map((alert, i) => (
              <div key={`a-${i}`} className={`border-b border-[#E8E0D8] px-3 py-2 text-xs ${alert.severity === "critical" ? "bg-[#D32F2F]/5 text-[#D32F2F]" : alert.severity === "warning" ? "bg-[#ED6C02]/5 text-[#ED6C02]" : "text-[#2D2A26]"}`}>
                <p className="font-medium">{alert.title}</p>
                <p className="text-[10px] opacity-80">{alert.message}</p>
              </div>
            ))}
            {(!notifList || notifList.length === 0) && (!alertList || alertList.length === 0) && (
              <p className="px-3 py-4 text-center text-xs text-[#8D8A87]">No notifications</p>
            )}
          </div>
        )}
      </div>

      {businesses && businesses.length > 1 && (
        <div className="mb-3 relative">
          <button
            onClick={() => setBizOpen(!bizOpen)}
            className="flex w-full items-center gap-2 rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm text-[#2D2A26] hover:bg-[#F5EDE6]"
          >
            <Building className="h-4 w-4 shrink-0 text-[#8D8A87]" />
            {!sidebarCollapsed && <>
              <span className="flex-1 truncate text-left">{user?.currentBusiness?.name ?? "Select Business"}</span>
              <ChevronRight className={`h-4 w-4 text-[#8D8A87] transition-transform ${bizOpen ? "rotate-90" : ""}`} />
            </>}
          </button>
          {bizOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-[#E8E0D8] bg-white shadow-lg">
              {businesses.map(b => (
                <button
                  key={b.id}
                  onClick={() => {
                    setBizOpen(false);
                    if (b.id !== user?.currentBusinessId) {
                      switchBusiness.mutate({ businessId: b.id }, {
                        onSuccess: () => { resetQueryClient(); window.location.reload(); }
                      });
                    }
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[#F5EDE6] ${b.id === user?.currentBusinessId ? "text-[#C73E1D] font-medium" : "text-[#2D2A26]"}`}
                >
                  <Building className="h-4 w-4" />
                  <span className="flex-1">{b.name}</span>
                  {b.isDemo && <span className="rounded bg-[#8D8A87]/10 px-1.5 py-0 text-[10px] text-[#8D8A87]">DEMO</span>}
                  {(b as any).allocationSource && (
                    <span className="rounded bg-[#0288D1]/10 px-1.5 py-0.5 text-[10px] text-[#0288D1]">Allocated</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mb-3 flex items-center gap-3 rounded-lg bg-[#F5EDE6] px-3 py-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#D4A854]/20">
          <Users className="h-4 w-4 text-[#D4A854]" />
        </div>
        {!sidebarCollapsed && (
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium text-[#2D2A26]">{user?.name ?? "User"}</p>
            <p className="text-xs capitalize text-[#8D8A87]">{role}</p>
          </div>
        )}
      </div>

      <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#8D8A87] hover:bg-[#F5EDE6] hover:text-[#2D2A26]">
        <LogOut className="h-4 w-4 shrink-0" />{!sidebarCollapsed && "Sign Out"}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FFF9F5]">
      {/* Desktop Sidebar */}
      <aside className={`fixed left-0 top-0 z-30 hidden h-screen flex-col border-r border-[#E8E0D8] bg-white transition-all duration-300 lg:flex ${sidebarCollapsed ? "w-16" : "w-64"}`}>
        {/* Header */}
        <div className={`flex items-center border-b border-[#E8E0D8] px-4 py-5 ${sidebarCollapsed ? "justify-center" : "gap-3 px-6"}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#C73E1D]">
            <Receipt className="h-5 w-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-lg font-bold leading-tight text-[#2D2A26]">Finaflow</h1>
              <p className="text-[10px] uppercase tracking-wider text-[#8D8A87]">Cashflow Manager</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
                      sidebarCollapsed
                        ? "justify-center px-2 py-3"
                        : "gap-3 px-3 py-2.5"
                    } ${active ? "bg-[#C73E1D]/10 text-[#C73E1D]" : "text-[#2D2A26] hover:bg-[#F5EDE6]"}`}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {!sidebarCollapsed && <><span>{item.label}</span>{active && <ChevronRight className="ml-auto h-4 w-4" />}</>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Toggle + Pinned */}
        <div className="border-t border-[#E8E0D8]">
          <button
            onClick={toggleSidebar}
            className={`flex w-full items-center gap-2 px-3 py-2.5 text-sm text-[#8D8A87] hover:bg-[#F5EDE6] hover:text-[#2D2A26] transition-colors ${sidebarCollapsed ? "justify-center" : ""}`}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /><span>Collapse</span></>}
          </button>
          {pinnedSection}
        </div>
      </aside>

      {/* Mobile Header + Bottom Nav */}
      <div className="lg:hidden">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E8E0D8] bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C73E1D]">
              <Receipt className="h-4 w-4 text-white" />
            </div>
            <span className="font-serif text-base font-bold text-[#2D2A26]">Finaflow</span>
          </div>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-2 text-[#2D2A26] hover:bg-[#F5EDE6]"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>
        <MobileBottomNavigation />
      </div>

      {/* Mobile Hamburger Overlay */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => setMenuOpen(false)}
          />
          <div className="fixed right-0 top-0 z-50 flex h-full w-80 max-w-[85vw] flex-col bg-white shadow-2xl lg:hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-[#E8E0D8] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C73E1D]">
                  <Receipt className="h-4 w-4 text-white" />
                </div>
                <span className="font-serif text-base font-bold text-[#2D2A26]">Finaflow</span>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="rounded-lg p-2 text-[#8D8A87] hover:bg-[#F5EDE6]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              <ul className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${active ? "bg-[#C73E1D]/10 text-[#C73E1D]" : "text-[#2D2A26] hover:bg-[#F5EDE6]"}`}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.label}</span>
                        {active && <ChevronRight className="ml-auto h-4 w-4" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="border-t border-[#E8E0D8] p-4">
              <div className="mb-3 flex items-center gap-3 rounded-lg bg-[#F5EDE6] px-3 py-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D4A854]/20">
                  <Users className="h-4 w-4 text-[#D4A854]" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium text-[#2D2A26]">{user?.name ?? "User"}</p>
                  <p className="text-xs capitalize text-[#8D8A87]">{role}</p>
                </div>
              </div>
              <button onClick={() => { setMenuOpen(false); logout(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#8D8A87] hover:bg-[#F5EDE6]">
                <LogOut className="h-4 w-4" />Sign Out
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className={`min-h-screen transition-all duration-300 ${sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"}`}>
        <div className="mx-auto max-w-7xl p-4 lg:p-8 pb-20 lg:pb-8">
          {children}
        </div>
      </main>
    </div>
  );
}