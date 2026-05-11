import { Link, useLocation } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { resetQueryClient } from "@/providers/trpc";
import { trpc } from "@/providers/trpc";
import {
  LayoutDashboard, Receipt, TrendingDown, Users, FileText,
  CreditCard, CalendarDays, Smartphone, Menu, X, LogOut,
  Building2, ChevronRight, FileSpreadsheet, BookOpen,
  Wallet, ShieldCheck, Settings, MessageSquare, Briefcase,
  Building, Bell, TrendingUp, Plug, Handshake, Key,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions";

const allNavItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perms: [PERMISSIONS.SALES_VIEW] },
  { path: "/daily-sales", label: "Daily Sales", icon: Receipt, perms: [PERMISSIONS.SALES_VIEW] },
  { path: "/expenses", label: "Expenses", icon: TrendingDown, perms: [PERMISSIONS.EXPENSES_VIEW] },
  { path: "/suppliers", label: "Suppliers", icon: Users, perms: [PERMISSIONS.SUPPLIERS_VIEW] },
  { path: "/bills", label: "Bills", icon: FileText, perms: [PERMISSIONS.BILLS_VIEW] },
  { path: "/accounts", label: "Accounts", icon: CreditCard, perms: [PERMISSIONS.ACCOUNTS_VIEW] },
  { path: "/locations", label: "Branches", icon: Building2, perms: [PERMISSIONS.SETTINGS_MANAGE] },
  { path: "/payroll", label: "Payroll", icon: Users, perms: [PERMISSIONS.PAYROLL_VIEW] },
  { path: "/mpesa", label: "M-PESA", icon: Smartphone, perms: [PERMISSIONS.MPESA_VIEW] },
  { path: "/daily-payments", label: "Daily Payments", icon: Wallet, perms: [PERMISSIONS.BILLS_VIEW] },
  { path: "/calendar", label: "Calendar", icon: CalendarDays, perms: [PERMISSIONS.BILLS_VIEW] },
  { path: "/reports", label: "Reports", icon: FileSpreadsheet, perms: [PERMISSIONS.REPORTS_VIEW] },
  { path: "/users", label: "Users & Roles", icon: ShieldCheck, perms: [PERMISSIONS.USERS_MANAGE] },
  { path: "/feedback", label: "Feedback", icon: MessageSquare, perms: [PERMISSIONS.FEEDBACK_MANAGE] },
  { path: "/settings", label: "Settings", icon: Settings, perms: [PERMISSIONS.SETTINGS_MANAGE] },
  { path: "/businesses", label: "Businesses", icon: Briefcase, perms: [PERMISSIONS.BUSINESS_MANAGE] },
  { path: "/integrations", label: "Integrations", icon: Plug, perms: [PERMISSIONS.API_KEYS_MANAGE] },
  { path: "/partner", label: "Partner", icon: Handshake, perms: [PERMISSIONS.PARTNER_VIEW] },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bizOpen, setBizOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const role = user?.role ?? "viewer";

  const { data: alertList } = trpc.alerts.checkAll.useQuery(undefined, { refetchInterval: 60000 });
  const { data: notifCount } = trpc.notifications.unreadCount.useQuery(undefined, { refetchInterval: 30000 });
  const { data: notifList } = trpc.notifications.list.useQuery({ limit: 20, unreadOnly: false });
  const utils = trpc.useUtils();
  const markNotifRead = trpc.notifications.markRead.useMutation({ onSuccess: () => utils.notifications.invalidate() });
  const genOverdueNotifs = trpc.notifications.generateOverdueNotifications.useMutation({ onSuccess: () => utils.notifications.invalidate() });

  // Auto-generate overdue bill notifications on first load
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

  return (
    <div className="min-h-screen bg-[#FFF9F5]">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-[#E8E0D8] bg-white lg:flex">
        <div className="flex items-center gap-3 border-b border-[#E8E0D8] px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#C73E1D]">
            <Receipt className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-lg font-bold leading-tight text-[#2D2A26]">Finaflow</h1>
            <p className="text-[10px] uppercase tracking-wider text-[#8D8A87]">Cashflow Manager</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <li key={item.path}>
                  <Link to={item.path} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-[#C73E1D]/10 text-[#C73E1D]" : "text-[#2D2A26] hover:bg-[#F5EDE6]"}`}>
                    <Icon className="h-4 w-4" />{item.label}{active && <ChevronRight className="ml-auto h-4 w-4" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-[#E8E0D8] p-4">
          {/* Notifications Bell */}
          <div className="mb-3 relative">
            <button onClick={() => setAlertOpen(!alertOpen)} className="flex w-full items-center gap-2 rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm text-[#2D2A26] hover:bg-[#F5EDE6]">
              <Bell className="h-4 w-4 text-[#8D8A87]" />
              <span className="flex-1 text-left">Notifications</span>
              <div className="flex gap-1">
                {notifCount !== undefined && notifCount > 0 && (
                  <span className="rounded-full bg-[#D32F2F] px-2 py-0.5 text-[10px] font-bold text-white">{notifCount}</span>
                )}
                {alertList && alertList.length > 0 && (!notifCount || notifCount === 0) && (
                  <span className="rounded-full bg-[#ED6C02] px-2 py-0.5 text-[10px] font-bold text-white">{alertList.length}</span>
                )}
              </div>
            </button>
            {alertOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 max-h-72 overflow-y-auto rounded-lg border border-[#E8E0D8] bg-white shadow-lg">
                {/* Generate overdue notifications button */}
                <div className="border-b border-[#E8E0D8] px-3 py-2">
                  <button onClick={() => genOverdueNotifs.mutate()} disabled={genOverdueNotifs.isPending} className="w-full rounded bg-[#C73E1D] px-2 py-1.5 text-[10px] font-medium text-white hover:bg-[#C73E1D]/90 disabled:opacity-50">
                    {genOverdueNotifs.isPending ? "Scanning..." : "Check for overdue bills"}
                  </button>
                </div>
                {/* Notifications */}
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
                {/* System Alerts */}
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

          {/* Business selector */}
          {businesses && businesses.length > 1 && (
            <div className="mb-3 relative">
              <button
                onClick={() => setBizOpen(!bizOpen)}
                className="flex w-full items-center gap-2 rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm text-[#2D2A26] hover:bg-[#F5EDE6]"
              >
                <Building className="h-4 w-4 text-[#8D8A87]" />
                <span className="flex-1 truncate text-left">{user?.currentBusiness?.name ?? "Select Business"}</span>
                <ChevronRight className={`h-4 w-4 text-[#8D8A87] transition-transform ${bizOpen ? "rotate-90" : ""}`} />
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
                            onSuccess: () => {
                              resetQueryClient();
                              window.location.reload();
                            }
                          });
                        }
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[#F5EDE6] ${b.id === user?.currentBusinessId ? "text-[#C73E1D] font-medium" : "text-[#2D2A26]"}`}
                    >
                      <Building className="h-4 w-4" />
                      <span className="flex-1">{b.name}</span>
                      {b.isDemo && <span className="rounded bg-[#8D8A87]/10 px-1.5 py-0 text-[10px] text-[#8D8A87]">DEMO</span>}
                      {(b as any).allocationSource && (
                        <span className="rounded bg-[#0288D1]/10 px-1.5 py-0.5 text-[10px] text-[#0288D1]">
                          Allocated
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="mb-3 flex items-center gap-3 rounded-lg bg-[#F5EDE6] px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D4A854]/20">
              <Users className="h-4 w-4 text-[#D4A854]" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-[#2D2A26]">{user?.name ?? "User"}</p>
              <p className="text-xs capitalize text-[#8D8A87]">{role}</p>
            </div>
          </div>
          <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#8D8A87] hover:bg-[#F5EDE6] hover:text-[#2D2A26]">
            <LogOut className="h-4 w-4" />Sign Out
          </button>
        </div>
      </aside>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E8E0D8] bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C73E1D]"><Receipt className="h-4 w-4 text-white" /></div>
          <span className="font-serif text-base font-bold text-[#2D2A26]">Finaflow</span>
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="rounded-lg p-2 text-[#2D2A26] hover:bg-[#F5EDE6]">
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-64 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E8E0D8] px-4 py-3">
              <span className="font-serif text-base font-bold text-[#2D2A26]">Menu</span>
              <button onClick={() => setSidebarOpen(false)}><X className="h-5 w-5 text-[#8D8A87]" /></button>
            </div>
            <nav className="p-3">
              <ul className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <li key={item.path}>
                      <Link to={item.path} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${active ? "bg-[#C73E1D]/10 text-[#C73E1D]" : "text-[#2D2A26] hover:bg-[#F5EDE6]"}`}>
                        <Icon className="h-4 w-4" />{item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="border-t border-[#E8E0D8] p-4">
              <button onClick={() => { setSidebarOpen(false); logout(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#8D8A87] hover:bg-[#F5EDE6]">
                <LogOut className="h-4 w-4" />Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
      <main className="lg:ml-64 min-h-[calc(100vh-60px)] lg:min-h-screen">
        <div className="mx-auto max-w-7xl p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
