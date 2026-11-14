// ABOUTME: Shared public navigation for every marketing page (home, solutions, free tools).
// ABOUTME: Groups the product, solutions and free tools into labelled menus so the same
// ABOUTME: structure follows a visitor from the landing page into a tool page.
import { useState } from "react";
import { Link } from "react-router";
import {
  Landmark, ChevronDown, Menu, X, LogIn, UserPlus, HeartHandshake,
  LayoutDashboard, Store, Wallet, Users, FileSpreadsheet, Smartphone,
  Receipt, Building2, ArrowRight,
} from "lucide-react";

export interface MenuItem {
  to: string;
  label: string;
  desc: string;
  icon: typeof Store;
  external?: boolean;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const GITHUB_URL = "https://github.com/geniusdynamics/finaflow";

// Anchor links stay on the page when the visitor is already on the home page,
// and jump back to it from a tool or solution page otherwise.
function anchorTarget(onHome: boolean, hash: string) {
  return onHome ? hash : `/${hash}`;
}

// In-page anchors use a plain <a> so the browser scrolls to the section;
// React Router would rewrite a hash-only link and skip the scroll.
export function SmartLink({ to, className, children, onClick }: { to: string; className?: string; children: React.ReactNode; onClick?: () => void }) {
  if (to.startsWith("#") || to.startsWith("/#")) {
    return (
      <a href={to} className={className} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

function buildMenus(onHome: boolean): MenuGroup[] {
  return [
    {
      label: "Product",
      items: [
        { to: anchorTarget(onHome, "#product"), label: "Platform overview", desc: "The whole business on one dashboard", icon: LayoutDashboard },
        { to: anchorTarget(onHome, "#features"), label: "Features", desc: "Sales, expenses, payroll, reports", icon: FileSpreadsheet },
        { to: anchorTarget(onHome, "#how-it-works"), label: "How it works", desc: "From signup to first report", icon: Receipt },
        { to: anchorTarget(onHome, "#integrations"), label: "Integrations", desc: "M-PESA, banks, ERPNext, QuickBooks & Xero", icon: Building2 },
      ],
    },
    {
      label: "Solutions",
      items: [
        { to: "/solutions/mobile-money-agents", label: "Mobile money agents", desc: "Cash, float and e-money across outlets", icon: Smartphone },
        { to: anchorTarget(onHome, "#solutions"), label: "Retail & multi-branch", desc: "Every till and branch accounted for", icon: Store },
        { to: anchorTarget(onHome, "#audiences"), label: "Accountants & consultants", desc: "Run client books, earn revenue share", icon: Users },
        { to: anchorTarget(onHome, "#audiences"), label: "Owners & finance leads", desc: "Decisions backed by real numbers", icon: Wallet },
      ],
    },
    {
      label: "Free tools",
      items: [
        { to: "/tools/mpesa-statement-converter", label: "M-PESA converter", desc: "PDF or CSV statements to clean data", icon: Smartphone },
        { to: "/tools/bank-statement-converter", label: "Bank statement converter", desc: "Convert bank PDFs to analyse", icon: Building2 },
        { to: "/tools/mpesa-to-excel", label: "PDF statement to Excel", desc: "Analysis-ready workbook export", icon: FileSpreadsheet },
        { to: "/tools/mpesa-for-accountants", label: "For accountants", desc: "Client-ready statement analysis", icon: Users },
      ],
    },
  ];
}

export function SiteHeader({ onHome = false }: { onHome?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menus = buildMenus(onHome);

  return (
    <nav className="sticky top-0 z-50 border-b border-[#E8E0D8] bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C73E1D]">
            <Landmark className="h-4 w-4 text-white" />
          </div>
          <span className="font-serif text-xl font-bold text-[#2D2A26]">Finaflow</span>
        </Link>

        {/* Desktop menus */}
        <div className="hidden items-center gap-1 text-sm text-[#2D2A26] lg:flex">
          {menus.map((group) => (
            <div key={group.label} className="group relative">
              <button
                type="button"
                className="flex items-center gap-1 rounded-md px-3 py-2 transition-colors hover:text-[#C73E1D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C73E1D]/40"
                aria-haspopup="true"
                aria-expanded={openMenu === group.label}
                onClick={() => setOpenMenu(openMenu === group.label ? null : group.label)}
                onMouseEnter={() => setOpenMenu(group.label)}
              >
                {group.label}
                <ChevronDown className="h-3 w-3" />
              </button>
              <div
                className={`absolute left-0 top-full z-50 w-80 pt-2 transition-opacity ${
                  openMenu === group.label
                    ? "visible opacity-100"
                    : "invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                }`}
              >
                <div className="rounded-xl border border-[#E8E0D8] bg-white p-2 shadow-lg">
                  {group.items.map((item) => (
                    <MenuLink key={`${group.label}-${item.label}`} item={item} onNavigate={() => setOpenMenu(null)} />
                  ))}
                </div>
              </div>
            </div>
          ))}
          <a href={anchorTarget(onHome, "#pricing")} className="rounded-md px-3 py-2 transition-colors hover:text-[#C73E1D]">
            Pricing
          </a>
          <a href={anchorTarget(onHome, "#faq")} className="rounded-md px-3 py-2 transition-colors hover:text-[#C73E1D]">
            FAQ
          </a>
        </div>

        {/* Auth actions */}
        <div className="flex items-center gap-2">
          <div
            role="tablist"
            aria-label="Sign in or sign up"
            className="flex rounded-lg border border-[#E8E0D8] bg-white p-1"
            data-testid="header-auth-tabs"
          >
            <Link
              to="/login"
              role="tab"
              aria-selected="true"
              data-testid="header-tab-signin"
              className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-md bg-[#C73E1D] px-3 py-1.5 text-xs font-medium text-white shadow-sm sm:min-h-[44px] sm:text-sm"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </Link>
            <Link
              to="/login?type=standard"
              role="tab"
              aria-selected="false"
              data-testid="header-tab-signup"
              className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-[#8D8A87] transition-all hover:text-[#2D2A26] sm:min-h-[44px] sm:text-sm"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Sign Up</span>
            </Link>
          </div>
          <Link
            to="/login?type=partner"
            data-testid="header-partner-cta"
            className="hidden min-h-[44px] items-center gap-1.5 rounded-md border border-[#D4A854] bg-white px-3 py-2 text-xs font-medium text-[#D4A854] transition-colors hover:bg-[#D4A854]/10 sm:text-sm md:flex"
          >
            <HeartHandshake className="h-3.5 w-3.5" />
            <span>Join as Partner</span>
          </Link>
          <Link
            to="/login"
            data-testid="header-mobile-signin"
            aria-label="Sign in"
            className="hidden min-h-[44px] items-center justify-center rounded-md bg-[#C73E1D] px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#C73E1D]/90 sm:flex sm:text-sm lg:hidden"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span className="ml-1.5">Sign In</span>
          </Link>
          <button
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 text-[#2D2A26] hover:bg-[#F5EDE6] lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-[#E8E0D8] px-4 py-3 lg:hidden">
          <div className="space-y-4">
            {menus.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8D8A87]">{group.label}</p>
                <div className="mt-1 space-y-0.5">
                  {group.items.map((item) => (
                    <MenuLink key={`m-${group.label}-${item.label}`} item={item} onNavigate={() => setMobileOpen(false)} compact />
                  ))}
                </div>
              </div>
            ))}
            <div className="space-y-0.5 border-t border-[#E8E0D8] pt-3 text-sm">
              <a href={anchorTarget(onHome, "#pricing")} onClick={() => setMobileOpen(false)} className="block py-1.5 text-[#2D2A26]">
                Pricing
              </a>
              <a href={anchorTarget(onHome, "#faq")} onClick={() => setMobileOpen(false)} className="block py-1.5 text-[#2D2A26]">
                FAQ
              </a>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="block py-1.5 text-[#2D2A26]">
                GitHub
              </a>
            </div>
            <div className="space-y-2 border-t border-[#E8E0D8] pt-3">
              <Link
                to="/login?type=standard"
                onClick={() => setMobileOpen(false)}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-md bg-[#C73E1D] py-3 font-medium text-white"
              >
                <UserPlus className="h-4 w-4" /> Get Started Free
              </Link>
              <Link
                to="/login?type=partner"
                onClick={() => setMobileOpen(false)}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-md border border-[#D4A854] py-3 font-medium text-[#D4A854]"
              >
                <HeartHandshake className="h-4 w-4" /> Join as Partner
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

function MenuLink({ item, onNavigate, compact }: { item: MenuItem; onNavigate: () => void; compact?: boolean }) {
  const Icon = item.icon;
  const inner = compact ? (
    <span className="flex items-center gap-2.5 py-1.5 text-sm text-[#2D2A26]">
      <Icon className="h-4 w-4 shrink-0 text-[#8D8A87]" />
      {item.label}
    </span>
  ) : (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F5EDE6] text-[#C73E1D]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-sm font-medium text-[#2D2A26] group-hover/item:text-[#C73E1D]">
          {item.label}
          {item.external && <ArrowRight className="h-3 w-3" />}
        </span>
        <span className="block text-xs leading-snug text-[#8D8A87]">{item.desc}</span>
      </span>
    </>
  );
  const className = compact
    ? "block"
    : "group/item flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-[#F5EDE6]";

  if (item.external) {
    return (
      <a href={item.to} className={className} target="_blank" rel="noopener noreferrer" onClick={onNavigate}>
        {inner}
      </a>
    );
  }
  // On-page anchors stay plain links so the browser handles the jump and
  // the href renders exactly as written (including on the static landing page).
  if (item.to.startsWith("#")) {
    return (
      <a href={item.to} className={className} onClick={onNavigate}>
        {inner}
      </a>
    );
  }
  return (
    <Link to={item.to} className={className} onClick={onNavigate}>
      {inner}
    </Link>
  );
}

export { GITHUB_URL };
