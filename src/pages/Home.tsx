import { useState } from "react";
import { Link } from "react-router";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Landmark, TrendingUp, Users, ShieldCheck, Zap,
  CheckCircle, ArrowRight, Store, FileSpreadsheet, CreditCard, Bell,
  Menu, X, BarChart3, Wallet, Receipt, PiggyBank,
  ChevronRight, Globe, Lock, Clock,
  RefreshCw, Building2, Percent, HeartHandshake,
  Github, Star, Plus, Sparkles, HelpCircle, BookOpen,
} from "lucide-react";

import cashflowDashImg from "/resources/cashflow dash.png";
import accountsImg from "/resources/accounts.png";
import billsImg from "/resources/bills.png";
import expensesImg from "/resources/expenses.png";
import reportsImg from "/resources/reports.png";
import budgetImg from "/resources/budget.png";

interface ShowcaseItem {
  title: string;
  subtitle: string;
  desc: string;
  img: string;
  icon: typeof BarChart3;
  stats: { label: string; value: string }[];
  reverse?: boolean;
}

const showcaseItems: ShowcaseItem[] = [
  {
    title: "Real-Time Cashflow Dashboard",
    subtitle: "See your money move",
    desc: "Get a bird's-eye view of your entire financial landscape. Track daily sales, monitor expenses, and watch your cash position update in real-time — no more waiting for end-of-month spreadsheets.",
    img: cashflowDashImg,
    icon: BarChart3,
    stats: [
      { label: "Sales Today", value: "KES 45,200" },
      { label: "Expenses", value: "KES 12,800" },
      { label: "Net Position", value: "KES 32,400" },
    ],
  },
  {
    title: "Accounts Management",
    subtitle: "Every shilling accounted for",
    desc: "Manage all your business accounts in one place. Track balances, monitor transaction history, reconcile payments, and maintain a complete audit trail — from M-Pesa to bank transfers.",
    img: accountsImg,
    icon: Wallet,
    stats: [
      { label: "Accounts", value: "M-Pesa, Cash, Bank" },
      { label: "Auto-Reconciliation", value: "Yes" },
      { label: "Audit Trail", value: "Full" },
    ],
    reverse: true,
  },
  {
    title: "Bills & Payables",
    subtitle: "Never miss a payment",
    desc: "Stay on top of supplier bills, recurring payments, and purchase orders. Get smart reminders before due dates, track payment history, and manage cash flow forecasts based on upcoming obligations.",
    img: billsImg,
    icon: Receipt,
    stats: [
      { label: "Bills Tracked", value: "Unlimited" },
      { label: "Due Reminders", value: "Automated" },
      { label: "Recurring", value: "Supported" },
    ],
  },
  {
    title: "Expense Tracking",
    subtitle: "Know where it's going",
    desc: "Categorize and track every operational expense with ease. Attach receipts, assign to departments or locations, and generate expense reports that make tax season a breeze.",
    img: expensesImg,
    icon: TrendingUp,
    stats: [
      { label: "Categories", value: "Custom" },
      { label: "Receipt Capture", value: "Built-in" },
      { label: "Tax Reports", value: "KRA-Ready" },
    ],
    reverse: true,
  },
  {
    title: "Reports & Analytics",
    subtitle: "Data-driven decisions",
    desc: "Generate P&L statements, cash flow forecasts, budget vs. actual comparisons, and COGS analysis — all exportable to PDF or Excel. Interactive charts powered by Recharts give you insights at a glance.",
    img: reportsImg,
    icon: FileSpreadsheet,
    stats: [
      { label: "Report Types", value: "10+" },
      { label: "Export Formats", value: "PDF, Excel" },
      { label: "Interactive Charts", value: "Yes" },
    ],
  },
  {
    title: "Budget Planning",
    subtitle: "Plan with precision",
    desc: "Set department-level budgets, track performance against targets, and get early warnings when you're trending over. Keep your business on track with proactive budget management tools.",
    img: budgetImg,
    icon: PiggyBank,
    stats: [
      { label: "Budgets", value: "Per Department" },
      { label: "Alerts", value: "Real-time" },
      { label: "Variance Analysis", value: "Automated" },
    ],
    reverse: true,
  },
];

const features = [
  { icon: Store, title: "Multi-Location Management", desc: "Track sales, expenses, and accounts across all your branches from one dashboard." },
  { icon: CreditCard, title: "M-PESA Integration", desc: "Import and reconcile M-PESA SMS transactions automatically. No manual entry needed." },
  { icon: Users, title: "Payroll & Staff", desc: "Auto-calculate NHIF, NSSF, PAYE. Process advances, generate payslips." },
  { icon: Globe, title: "Multi-Currency Ready", desc: "Work across KES, USD, UGX, TZS and more with live exchange rate support." },
  { icon: ShieldCheck, title: "Role-Based Access", desc: "Owner, admin, manager, employee, viewer — each with precise permissions." },
  { icon: Bell, title: "Smart Alerts", desc: "Low balance warnings, overdue bill notifications, price change alerts." },
  { icon: Lock, title: "Enterprise Security", desc: "JWT httpOnly cookies, CSRF protection, rate limiting, and full audit logging." },
  { icon: RefreshCw, title: "Auto-Reconciliation", desc: "Match M-Pesa transactions to sales and payments automatically." },
  { icon: Building2, title: "Partner & Reseller Program", desc: "Earn 20% revenue share from every business client you onboard." },
];

const tiers = [
  { name: "Free", price: "0", businesses: 1, branches: 1, users: 1, transactions: "100 / month", payroll: "No", support: "Community", features: ["1 business", "1 branch", "1 user", "100 transactions/mo", "Basic sales & expenses", "M-PESA import"], cta: "Get Started", highlight: false },
  { name: "Starter", price: "500", businesses: 1, branches: 1, users: 3, transactions: "5,000 / month", payroll: "No", support: "Email", features: ["1 business", "1 branch", "3 users", "Unlimited transactions", "Recurring bills", "Email support"], cta: "Start Trial", highlight: false },
  { name: "Growth", price: "1,500", businesses: 3, branches: 5, users: 5, transactions: "20,000 / month", payroll: "Yes", support: "Priority", features: ["3 businesses", "5 branches", "5 users", "Unlimited transactions", "Full payroll", "Priority support"], cta: "Start Trial", highlight: true },
  { name: "Pro", price: "3,000", businesses: 10, branches: "∞", users: "∞", transactions: "Unlimited", payroll: "Yes", support: "Dedicated", features: ["10 businesses", "Unlimited branches", "Unlimited users", "API access", "Webhooks", "White-label option"], cta: "Contact Sales", highlight: false },
];

const stats = [
  { label: "Businesses Onboarded", value: "500+" },
  { label: "Transactions Processed", value: "KES 2B+" },
  { label: "Active Users", value: "2,000+" },
  { label: "Uptime", value: "99.9%" },
];

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <Helmet>
        <title>Finaflow — Business Financial Command Center for African SMEs</title>
        <meta name="description" content="Finaflow helps African businesses track cashflow, manage payroll, process bills, reconcile M-PESA, and generate KRA-ready financial reports — all in one platform." />
        <meta property="og:title" content="Finaflow — Financial Command Center for African Businesses" />
        <meta property="og:description" content="Track cashflow, manage payroll, reconcile M-PESA, and generate KRA-ready reports." />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/resources/cashflow%20dash.png" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Finaflow",
            "applicationCategory": "BusinessApplication",
            "description": "Business financial tracking platform for African businesses",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "KES" },
          })}
        </script>
      </Helmet>

      <div className="min-h-screen bg-white">
        {/* Navigation */}
        <nav className="sticky top-0 z-50 border-b border-[#E8E0D8] bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C73E1D]">
                <Landmark className="h-4 w-4 text-white" />
              </div>
              <span className="font-serif text-xl font-bold text-[#2D2A26]">Finaflow</span>
            </Link>
            <div className="hidden items-center gap-6 text-sm text-[#2D2A26] md:flex">
              <a href="#showcase" className="hover:text-[#C73E1D]">Product</a>
              <a href="#features" className="hover:text-[#C73E1D]">Features</a>
              <a href="#how-it-works" className="hover:text-[#C73E1D]">How it works</a>
              <a href="#pricing" className="hover:text-[#C73E1D]">Pricing</a>
              <a
                href="#faq"
                className="hover:text-[#C73E1D]"
              >
                FAQ
              </a>
              <a
                href="https://github.com/geniusdynamics/finaflow"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Star Finaflow on GitHub"
                className="group inline-flex items-center gap-1.5 rounded-md border border-[#2D2A26] bg-[#2D2A26] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[#1a1815]"
              >
                <Github className="h-3.5 w-3.5" />
                <Star className="h-3 w-3 transition-all group-hover:scale-110 group-hover:fill-yellow-400 group-hover:text-yellow-400" />
                <span>Star</span>
              </a>
              <Link to="/login" className="font-medium hover:text-[#C73E1D]">Sign In</Link>
              <Link to="/login?type=standard"><Button className="bg-[#C73E1D] hover:bg-[#C73E1D]/90 text-sm">Get Started</Button></Link>
            </div>
            <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
          {mobileMenuOpen && (
            <div className="border-t border-[#E8E0D8] px-4 py-3 md:hidden space-y-2 text-sm">
              <a href="#showcase" onClick={() => setMobileMenuOpen(false)} className="block py-1">Product</a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block py-1">Features</a>
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block py-1">How it works</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block py-1">Pricing</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="block py-1">FAQ</a>
              <a
                href="https://github.com/geniusdynamics/finaflow"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 py-1 font-medium"
              >
                <Github className="h-3.5 w-3.5" /> Star us on GitHub
              </a>
              <Link to="/login?type=standard" onClick={() => setMobileMenuOpen(false)} className="block py-1 font-medium">Sign In</Link>
              <Link to="/login?type=standard" onClick={() => setMobileMenuOpen(false)} className="block py-1 font-medium text-[#C73E1D]">Get Started</Link>
            </div>
          )}
        </nav>

        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#F5EDE6] to-white" />
          <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-28">
            <div className="grid items-center gap-12 md:grid-cols-2">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#C73E1D]/20 bg-[#C73E1D]/5 px-3 py-1 text-xs font-medium text-[#C73E1D]">
                  <Zap className="h-3 w-3" /> Now with Partner & Reseller Program
                </div>
                <h1 className="font-serif text-[2.5rem] leading-tight font-bold text-[#2D2A26] md:text-[3.5rem]">
                  Your Business Finances,{" "}
                  <span className="bg-gradient-to-r from-[#C73E1D] to-[#D4A854] bg-clip-text text-transparent">
                    Finally Made Simple
                  </span>
                </h1>
                <p className="mt-4 text-lg leading-relaxed text-[#8D8A87]">
                  Track sales, manage expenses, run payroll, and reconcile M-PESA — all in one platform. 
                  Built specifically for African SMEs who want real-time financial clarity without the complexity.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link to="/login?type=standard">
                    <Button className="bg-[#C73E1D] px-8 py-6 text-base hover:bg-[#C73E1D]/90">
                      Get Started Free
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/login?type=partner">
                    <Button variant="outline" className="border-[#C73E1D] px-8 py-6 text-base text-[#C73E1D]">
                      <HeartHandshake className="mr-2 h-4 w-4" />
                      Join as Partner
                    </Button>
                  </Link>
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-[#8D8A87]">
                  <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-[#2E7D32]" />No credit card</span>
                  <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-[#2E7D32]" />Free forever plan</span>
                  <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-[#2E7D32]" />KRA-ready reports</span>
                </div>
              </div>
              <div className="relative">
                <div className="rounded-2xl border border-[#E8E0D8] bg-white p-5 shadow-xl shadow-[#C73E1D]/5">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-semibold text-[#2D2A26]">
                      <BarChart3 className="h-4 w-4 text-[#C73E1D]" />
                      Daily Overview
                    </span>
                    <span className="flex items-center gap-1 text-xs text-[#8D8A87]">
                      <Clock className="h-3 w-3" />
                      Live
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-gradient-to-br from-[#2E7D32]/5 to-[#2E7D32]/10 p-4">
                      <p className="text-xs text-[#8D8A87]">Today's Sales</p>
                      <p className="mt-1 font-mono text-xl font-bold text-[#2E7D32]">KES 45,200</p>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-[#D32F2F]/5 to-[#D32F2F]/10 p-4">
                      <p className="text-xs text-[#8D8A87]">Expenses</p>
                      <p className="mt-1 font-mono text-xl font-bold text-[#D32F2F]">KES 12,800</p>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-[#C73E1D]/5 to-[#C73E1D]/10 p-4">
                      <p className="text-xs text-[#8D8A87]">Net Position</p>
                      <p className="mt-1 font-mono text-xl font-bold text-[#C73E1D]">KES 32,400</p>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-[#ED6C02]/5 to-[#ED6C02]/10 p-4">
                      <p className="text-xs text-[#8D8A87]">Bills Due</p>
                      <p className="mt-1 font-mono text-xl font-bold text-[#ED6C02]">3</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Stats */}
        <section className="border-y border-[#E8E0D8] bg-[#F5EDE6]">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {stats.map((s, i) => (
                <div key={i} className="text-center">
                  <p className="font-serif text-3xl font-bold text-[#C73E1D]">{s.value}</p>
                  <p className="mt-1 text-sm text-[#8D8A87]">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Screenshot Showcase */}
        <section id="showcase" className="py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-16 text-center">
              <h2 className="font-serif text-4xl font-bold text-[#2D2A26]">
                See Finaflow in Action
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-[#8D8A87]">
                Every screen is designed to give you instant clarity on your business finances. 
                No clutter. No complexity. Just the numbers that matter.
              </p>
            </div>
            <div className="space-y-24">
              {showcaseItems.map((item, i) => (
                <div
                  key={i}
                  className={`grid items-center gap-10 md:grid-cols-2 md:gap-16 ${
                    item.reverse ? "md:direction-rtl" : ""
                  }`}
                >
                  <div className={item.reverse ? "md:order-2" : ""}>
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#C73E1D]/5 px-3 py-1 text-xs font-medium text-[#C73E1D]">
                      <item.icon className="h-3 w-3" />
                      {item.subtitle}
                    </div>
                    <h3 className="mt-3 font-serif text-2xl font-bold text-[#2D2A26]">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-[#8D8A87]">
                      {item.desc}
                    </p>
                    <div className="mt-5 grid grid-cols-3 gap-3">
                      {item.stats.map((stat, j) => (
                        <div key={j} className="rounded-lg border border-[#E8E0D8] bg-white p-3">
                          <p className="text-[10px] text-[#8D8A87]">{stat.label}</p>
                          <p className="mt-0.5 text-xs font-semibold text-[#2D2A26]">{stat.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={item.reverse ? "md:order-1" : ""}>
                    <div className="group relative overflow-hidden rounded-2xl border border-[#E8E0D8] bg-white shadow-lg shadow-[#C73E1D]/5 transition-shadow duration-300 hover:shadow-xl hover:shadow-[#C73E1D]/10">
                      <img
                        src={item.img}
                        alt={item.title}
                        className="w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                        loading={i === 0 ? "eager" : "lazy"}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section id="how-it-works" className="py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-12 text-center">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#C73E1D]/20 bg-[#C73E1D]/5 px-3 py-1 text-xs font-medium text-[#C73E1D]">
                <Sparkles className="h-3 w-3" /> Live in minutes
              </div>
              <h2 className="font-serif text-4xl font-bold text-[#2D2A26]">
                From signup to first report in under 5 minutes
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-[#8D8A87]">
                No spreadsheets, no consultants, no setup fees. Just three simple steps.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  step: "01",
                  icon: Plus,
                  title: "Create your free account",
                  desc: "Sign up with your business name and you're in. No credit card, no commitments — the Free plan stays free forever.",
                  detail: "Takes ~30 seconds",
                },
                {
                  step: "02",
                  icon: RefreshCw,
                  title: "Connect or import your data",
                  desc: "Paste an M-Pesa SMS, upload a CSV, or start fresh with Demo Mode to explore the platform with realistic sample data.",
                  detail: "Optional — guided tour included",
                },
                {
                  step: "03",
                  icon: BarChart3,
                  title: "See your business clearly",
                  desc: "Your real-time dashboard, reports, and alerts are live the moment your first transaction is recorded. No more month-end surprises.",
                  detail: "Insights from day one",
                },
              ].map((s, i) => (
                <div key={i} className="relative rounded-2xl border border-[#E8E0D8] bg-white p-6 transition-shadow hover:shadow-md">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="font-mono text-3xl font-bold text-[#C73E1D]/20">{s.step}</span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C73E1D]/10">
                      <s.icon className="h-5 w-5 text-[#C73E1D]" />
                    </div>
                  </div>
                  <h3 className="text-base font-semibold text-[#2D2A26]">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#8D8A87]">{s.desc}</p>
                  <div className="mt-4 flex items-center gap-1.5 border-t border-[#E8E0D8] pt-3 text-xs font-medium text-[#2E7D32]">
                    <CheckCircle className="h-3 w-3" />
                    {s.detail}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Link to="/login?type=standard">
                <Button className="bg-[#C73E1D] px-6 py-5 text-sm hover:bg-[#C73E1D]/90">
                  Start your free account <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="border-t border-[#E8E0D8] bg-[#F5EDE6] py-20">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-12 text-center">
              <h2 className="font-serif text-4xl font-bold text-[#2D2A26]">
                Everything you need to run your finances
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-[#8D8A87]">
                From daily sales to statutory payroll — all in one platform built for African businesses
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f, i) => (
                <Card key={i} className="border-[#E8E0D8] bg-white transition-shadow hover:shadow-md">
                  <CardContent className="p-5">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#C73E1D]/10">
                      <f.icon className="h-5 w-5 text-[#C73E1D]" />
                    </div>
                    <h3 className="text-sm font-semibold text-[#2D2A26]">{f.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#8D8A87]">{f.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-20">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-12 text-center">
              <h2 className="font-serif text-4xl font-bold text-[#2D2A26]">Simple, transparent pricing</h2>
              <p className="mt-2 text-sm text-[#8D8A87]">Start free. Upgrade as you grow. All prices in KES.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {tiers.map((t, i) => (
                <Card key={i} className={`border ${t.highlight ? "border-[#C73E1D] ring-1 ring-[#C73E1D]" : "border-[#E8E0D8]"}`}>
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-[#2D2A26]">{t.name}</h3>
                    <div className="mt-2">
                      <div className="flex flex-wrap items-end gap-2" aria-label={`${t.name} plan price reduced to zero`}>
                        <span className="font-serif text-2xl font-bold text-[#8D8A87] line-through decoration-2">{t.price}</span>
                        <span className="font-serif text-3xl font-bold text-[#2D2A26]">0</span>
                        <span className="text-xs text-[#8D8A87]">/mo</span>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1.5 border-t border-[#E8E0D8] pt-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#8D8A87]">Businesses</span>
                        <span className="font-semibold text-[#2D2A26]">{t.businesses === 99 ? "∞" : t.businesses}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#8D8A87]">Branches</span>
                        <span className="font-semibold text-[#2D2A26]">{t.branches === 99 ? "∞" : t.branches}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#8D8A87]">Users</span>
                        <span className="font-semibold text-[#2D2A26]">{t.users === 99 ? "∞" : t.users}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#8D8A87]">Transactions</span>
                        <span className="font-semibold text-[#2D2A26]">{t.transactions}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#8D8A87]">Payroll</span>
                        <span className="font-semibold text-[#2D2A26]">{t.payroll}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#8D8A87]">Support</span>
                        <span className="font-semibold text-[#2D2A26]">{t.support}</span>
                      </div>
                    </div>
                    <ul className="mt-3 space-y-1.5 border-t border-[#E8E0D8] pt-3">
                      {t.features.map((f, j) => (
                        <li key={j} className="flex items-center gap-1.5 text-xs text-[#2D2A26]">
                          <CheckCircle className="h-3 w-3 shrink-0 text-[#2E7D32]" />{f}
                        </li>
                      ))}
                    </ul>
                    <Link to="/login?type=standard" className="mt-4 block">
                      <Button className={`w-full ${t.highlight ? "bg-[#C73E1D]" : "bg-[#2D2A26]"}`} size="sm">{t.cta}</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-[#E8E0D8] py-20 md:py-28">
          <div className="mx-auto max-w-3xl px-4">
            <div className="mb-12 text-center">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#C73E1D]/20 bg-[#C73E1D]/5 px-3 py-1 text-xs font-medium text-[#C73E1D]">
                <HelpCircle className="h-3 w-3" /> Questions, answered
              </div>
              <h2 className="font-serif text-4xl font-bold text-[#2D2A26]">
                Frequently asked questions
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-[#8D8A87]">
                Everything new users ask before getting started. Don't see your question? Reach out — we usually reply within a few hours.
              </p>
            </div>
            <div className="space-y-3">
              {[
                {
                  q: "Is my financial data really safe?",
                  a: "Yes. All traffic is encrypted in transit (HTTPS) and at rest. Authentication uses JWT in httpOnly cookies with CSRF protection, every mutation is rate-limited, and full audit logs are kept for sensitive operations. Your data is yours — we never share it with third parties.",
                },
                {
                  q: "How does the M-Pesa integration work?",
                  a: "Paste or forward any M-Pesa SMS to Finaflow and we automatically parse the transaction, match it to the right account, and reconcile it against your sales or bills. You can also upload CSV exports from your M-Pesa statement for bulk imports.",
                },
                {
                  q: "What does the Free plan include?",
                  a: "The Free plan includes 1 business, 1 branch, 1 user, and 100 transactions per month — with no time limit and no credit card required. It covers daily sales, basic expenses, M-Pesa import, and KRA-ready reports. Upgrade only when you outgrow it.",
                },
                {
                  q: "Can I import my existing data?",
                  a: "Yes. You can import sales, expenses, and account balances via CSV, or start with Demo Mode to explore the platform with realistic sample data first. Many users run a side-by-side comparison for a week before going live.",
                },
                {
                  q: "Do you support multi-location businesses?",
                  a: "Absolutely. Add as many branches as you need (from 1 on the Free plan up to unlimited on Pro), track sales and expenses per location, and roll up reports to a consolidated business view. Perfect for retail chains, restaurants, and service businesses with multiple offices.",
                },
                {
                  q: "Is Finaflow open source?",
                  a: "Yes — the core platform is open source on GitHub. You can self-host, audit the code, file issues, and contribute features. The hosted version at finaflow.app is maintained by the genius team and includes managed updates, backups, and support.",
                },
              ].map((item, i) => (
                <details
                  key={i}
                  className="group rounded-xl border border-[#E8E0D8] bg-white p-5 transition-shadow open:shadow-md hover:shadow-sm"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-[#2D2A26]">
                    <span className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 shrink-0 text-[#C73E1D]" />
                      {item.q}
                    </span>
                    <Plus className="h-4 w-4 shrink-0 text-[#8D8A87] transition-transform group-open:rotate-45" />
                  </summary>
                  <p className="mt-3 pl-6 text-sm leading-relaxed text-[#8D8A87]">{item.a}</p>
                </details>
              ))}
            </div>
            <div className="mt-10 flex flex-col items-center gap-2 rounded-2xl border border-[#C73E1D]/20 bg-[#C73E1D]/5 p-6 text-center">
              <p className="text-sm text-[#2D2A26]">
                Still have questions? We're happy to help.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link to="/login?type=standard">
                  <Button className="bg-[#C73E1D] px-5 py-2 text-sm hover:bg-[#C73E1D]/90">
                    Get started free
                  </Button>
                </Link>
                <a
                  href="https://github.com/geniusdynamics/finaflow/discussions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#2D2A26] bg-white px-5 py-2 text-sm font-medium text-[#2D2A26] transition-colors hover:bg-[#F5EDE6]"
                >
                  <Github className="h-4 w-4" />
                  Ask on GitHub
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Partner CTA */}
        <section className="border-t border-[#E8E0D8] bg-[#F5EDE6] py-20">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D4A854]/20 to-[#D4A854]/30">
              <Percent className="h-7 w-7 text-[#D4A854]" />
            </div>
            <h2 className="font-serif text-3xl font-bold text-[#2D2A26]">Are you an accountant or consultant?</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#8D8A87]">
              Join our Partner Program and earn <strong className="text-[#D4A854]">20% revenue share</strong> from every business client you onboard. 
              No caps. No quotas. Just recurring income from the businesses you already serve.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/login?type=partner"><Button className="bg-[#D4A854] px-8 text-white hover:bg-[#D4A854]/90">Join as Partner</Button></Link>
              <a href="#pricing" className="inline-flex items-center gap-1 text-sm text-[#8D8A87] hover:text-[#2D2A26]">
                View pricing <ChevronRight className="h-3 w-3" />
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[#E8E0D8] py-8">
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-[#C73E1D]">
                  <Landmark className="h-3 w-3 text-white" />
                </div>
                <span className="font-serif text-sm font-bold text-[#2D2A26]">Finaflow</span>
                <span className="text-xs text-[#8D8A87]">
                  by {" "}
                  <a
                    href="https://genius.africa"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#2D2A26] underline decoration-[#D4A854] decoration-2 underline-offset-4 transition-colors hover:text-[#C73E1D]"
                  >
                    genius
                  </a>
                </span>
              </div>
              <p className="text-xs text-[#8D8A87]">{"\u00A9"} 2026 Finaflow. Built for African Businesses.</p>
              <div className="flex items-center gap-4 text-xs text-[#8D8A87]">
                <a
                  href="https://github.com/geniusdynamics/finaflow"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Finaflow on GitHub"
                  className="flex items-center gap-1 transition-colors hover:text-[#2D2A26]"
                >
                  <Github className="h-3.5 w-3.5" />
                  <span>GitHub</span>
                </a>
                <Link to="/login" className="hover:text-[#2D2A26]">Sign In</Link>
                <Link to="/login?type=standard" className="hover:text-[#2D2A26]">Sign Up</Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
