import { useState } from "react";
import { Link } from "react-router";
import { Helmet } from "react-helmet-async";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Landmark, TrendingUp, Users, ShieldCheck, Zap,
  CheckCircle, ArrowRight, Store, FileSpreadsheet, CreditCard, Bell,
  Menu, X, BarChart3, Wallet, Receipt, PiggyBank,
  ChevronRight, Globe, Lock,
  RefreshCw, Building2, Percent, HeartHandshake,
  Github, Star, Plus, Sparkles, HelpCircle, BookOpen, LogIn, UserPlus,
} from "lucide-react";

import cashflowDashImg from "/resources/cashflow dash.png";
import accountsImg from "/resources/accounts.png";
import billsImg from "/resources/bills.png";
import expensesImg from "/resources/expenses.png";
import reportsImg from "/resources/reports.png";
import budgetImg from "/resources/budget.png";
import ChangeablePricingSection, {
  type BillingCycle,
  type PricingPlan,
} from "@/components/pricing/ChangeablePricingSection";
import BillingCycleToggle from "@/components/pricing/BillingCycleToggle";
import PricingCard from "@/components/pricing/PricingCard";
import RotatingHeadline from "@/components/landing/RotatingHeadline";
import AnimatedCounter from "@/components/landing/AnimatedCounter";

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

const pricingPlans: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    description: "For solo founders trying Finaflow for the first time.",
    priceMonthly: "KES 0",
    priceYearly: "KES 0",
    features: [
      { text: "1 business · 1 branch · 1 user" },
      { text: "100 transactions per month" },
      { text: "Basic sales & expense tracking" },
      { text: "M-PESA SMS import" },
      { text: "Community support" },
    ],
    cta: "Get Started",
    highlight: false,
  },
  {
    id: "starter",
    name: "Starter",
    description: "For small shops ready to track every shilling in one place.",
    priceMonthly: "KES 500",
    priceYearly: "KES 417",
    featuresLabel: "Everything in Free, plus:",
    features: [
      { text: "3 users · unlimited transactions" },
      { text: "Recurring bills & suppliers" },
      { text: "Email support" },
    ],
    cta: "Start Trial",
    highlight: false,
  },
  {
    id: "growth",
    name: "Growth",
    description: "For multi-branch teams that need payroll & priority help.",
    priceMonthly: "KES 1,500",
    priceYearly: "KES 1,250",
    badge: "Popular",
    featuresLabel: "Everything in Starter, plus:",
    features: [
      { text: "3 businesses · 5 branches · 5 users" },
      { text: "Full payroll (PAYE, NHIF, NSSF)" },
      { text: "Priority support" },
    ],
    cta: "Start Trial",
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    description: "For chains, franchises, and agencies scaling across regions.",
    priceMonthly: "KES 3,000",
    priceYearly: "KES 2,500",
    featuresLabel: "Everything in Growth, plus:",
    features: [
      { text: "10 businesses · unlimited branches & users" },
      { text: "API access & webhooks" },
      { text: "White-label option" },
      { text: "Dedicated success manager" },
    ],
    cta: "Contact Sales",
    highlight: false,
  },
];

const stats: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}[] = [
  { label: "Businesses Onboarded", value: 500, suffix: "+" },
  { label: "Transactions Processed", value: 2, prefix: "KES ", suffix: "B+" },
  { label: "Active Users", value: 2000, suffix: "+" },
  { label: "Uptime", value: 99.9, suffix: "%", decimals: 1 },
];

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

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
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C73E1D]">
                <Landmark className="h-4 w-4 text-white" />
              </div>
              <span className="font-serif text-xl font-bold text-[#2D2A26]">Finaflow</span>
            </Link>
            <div className="hidden items-center gap-5 text-sm text-[#2D2A26] lg:flex">
              <a href="#showcase" className="hover:text-[#C73E1D]">Product</a>
              <a href="#features" className="hover:text-[#C73E1D]">Features</a>
              <a href="#how-it-works" className="hover:text-[#C73E1D]">How it works</a>
              <a href="#pricing" className="hover:text-[#C73E1D]">Pricing</a>
              <a href="#faq" className="hover:text-[#C73E1D]">FAQ</a>
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
            </div>
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
                  className="flex items-center justify-center gap-1.5 rounded-md bg-[#C73E1D] px-3 py-1.5 text-xs font-medium text-white shadow-sm min-h-[40px] sm:min-h-[44px] sm:text-sm"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/login?type=standard"
                  role="tab"
                  aria-selected="false"
                  data-testid="header-tab-signup"
                  className="flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-[#8D8A87] transition-all hover:text-[#2D2A26] min-h-[40px] sm:min-h-[44px] sm:text-sm"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Sign Up</span>
                </Link>
              </div>
              <Link
                to="/login?type=partner"
                data-testid="header-partner-cta"
                className="hidden items-center gap-1.5 rounded-md border border-[#D4A854] bg-white px-3 py-2 text-xs font-medium text-[#D4A854] transition-colors hover:bg-[#D4A854]/10 min-h-[44px] sm:text-sm md:flex"
              >
                <HeartHandshake className="h-3.5 w-3.5" />
                <span>Join as Partner</span>
              </Link>
              <Link
                to="/login"
                data-testid="header-mobile-signin"
                aria-label="Sign in"
                className="hidden items-center justify-center rounded-md bg-[#C73E1D] px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#C73E1D]/90 min-h-[44px] sm:text-sm sm:flex lg:hidden"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span className="ml-1.5">Sign In</span>
              </Link>
              <button
                className="flex items-center justify-center rounded-md p-2 text-[#2D2A26] hover:bg-[#F5EDE6] min-h-[44px] min-w-[44px] lg:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
          {mobileMenuOpen && (
            <div className="border-t border-[#E8E0D8] px-4 py-3 lg:hidden space-y-2 text-sm">
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
              <Link to="/login?type=standard" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center gap-2 rounded-md bg-[#C73E1D] py-3 font-medium text-white min-h-[48px]">
                <UserPlus className="h-4 w-4" /> Get Started
              </Link>
              <Link to="/login?type=partner" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center gap-2 rounded-md border border-[#D4A854] py-3 font-medium text-[#D4A854] min-h-[48px]">
                <HeartHandshake className="h-4 w-4" /> Join as Partner
              </Link>
            </div>
          )}
        </nav>

        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#F5EDE6] via-[#FAF4ED] to-[#F2E8DD]" aria-hidden />
          <motion.div
            aria-hidden
            className="absolute -top-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-[#A02E1A]/20 blur-3xl"
            animate={{ scale: [1, 1.08, 1], opacity: [0.55, 0.8, 0.55] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="absolute -bottom-40 -left-32 h-[32rem] w-[32rem] rounded-full bg-[#D4A854]/20 blur-3xl"
            animate={{ scale: [1, 1.12, 1], opacity: [0.45, 0.7, 0.45] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          />
          <motion.div
            aria-hidden
            className="absolute top-1/3 left-1/2 h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-[#E8A04A]/10 blur-3xl"
            animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.55, 0.3] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 3 }}
          />
          <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-28">
            <div className="grid items-center gap-12 md:grid-cols-2">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                  className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#C73E1D]/20 bg-[#C73E1D]/5 px-3 py-1 text-xs font-medium text-[#C73E1D]"
                >
                  <Zap className="h-3 w-3" /> Now with Partner & Reseller Program
                </motion.div>
                <RotatingHeadline />
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.5 }}
                  className="mt-8 flex flex-wrap gap-3"
                >
                  <motion.div
                    whileHover={{ scale: 1.03, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", bounce: 0.4, duration: 0.3 }}
                  >
                    <Link to="/login?type=standard">
                      <Button className="bg-[#C73E1D] px-8 py-6 text-base shadow-lg shadow-[#C73E1D]/20 hover:bg-[#C73E1D]/90">
                        Get Started Free
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.03, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", bounce: 0.4, duration: 0.3 }}
                  >
                    <Link to="/login?type=partner">
                      <Button variant="outline" className="border-[#C73E1D] bg-white/60 px-8 py-6 text-base text-[#C73E1D] backdrop-blur hover:bg-white">
                        <HeartHandshake className="mr-2 h-4 w-4" />
                        Join as Partner
                      </Button>
                    </Link>
                  </motion.div>
                </motion.div>
                {/* Prominent "already have an account" reminder so returning
                    users can reach the sign-in flow without having to dig
                    through the navigation. Full-width on mobile, comfortable
                    touch target. */}
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45, duration: 0.5 }}
                  className="mt-4 w-full sm:w-auto sm:max-w-xs"
                >
                  <Link
                    to="/login"
                    data-testid="hero-account-cta"
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-[#E8E0D8] bg-white/80 py-3 text-sm font-medium text-[#2D2A26] backdrop-blur transition-colors hover:bg-white min-h-[48px]"
                  >
                    <LogIn className="h-4 w-4 text-[#C73E1D]" />
                    Already have an account? <span className="text-[#C73E1D] underline">Sign In</span>
                  </Link>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className="mt-6 flex flex-wrap items-center gap-4 text-xs text-[#8D8A87]"
                >
                  <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-[#2E7D32]" />No credit card</span>
                  <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-[#2E7D32]" />Free forever plan</span>
                  <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-[#2E7D32]" />KRA-ready reports</span>
                </motion.div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="relative"
              >
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  className="relative"
                >
                  <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#C73E1D]/10 via-transparent to-[#D4A854]/10 blur-2xl" aria-hidden />
                  <div className="relative rounded-2xl border border-[#E8E0D8] bg-white/90 p-5 shadow-2xl shadow-[#C73E1D]/10 backdrop-blur">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-semibold text-[#2D2A26]">
                        <BarChart3 className="h-4 w-4 text-[#C73E1D]" />
                        Daily Overview
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-[#8D8A87]">
                        <motion.span
                          aria-hidden
                          className="h-2 w-2 rounded-full bg-[#2E7D32]"
                          animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        />
                        Live
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-gradient-to-br from-[#2E7D32]/5 to-[#2E7D32]/10 p-4">
                        <p className="text-xs text-[#8D8A87]">Today's Sales</p>
                        <p className="mt-1 font-mono text-xl font-bold text-[#2E7D32]">
                          KES <AnimatedCounter value={45200} duration={2.2} />
                        </p>
                      </div>
                      <div className="rounded-xl bg-gradient-to-br from-[#D32F2F]/5 to-[#D32F2F]/10 p-4">
                        <p className="text-xs text-[#8D8A87]">Expenses</p>
                        <p className="mt-1 font-mono text-xl font-bold text-[#D32F2F]">
                          KES <AnimatedCounter value={12800} duration={2.2} />
                        </p>
                      </div>
                      <div className="rounded-xl bg-gradient-to-br from-[#C73E1D]/5 to-[#C73E1D]/10 p-4">
                        <p className="text-xs text-[#8D8A87]">Net Position</p>
                        <p className="mt-1 font-mono text-xl font-bold text-[#C73E1D]">
                          KES <AnimatedCounter value={32400} duration={2.2} />
                        </p>
                      </div>
                      <div className="rounded-xl bg-gradient-to-br from-[#ED6C02]/5 to-[#ED6C02]/10 p-4">
                        <p className="text-xs text-[#8D8A87]">Bills Due</p>
                        <p className="mt-1 font-mono text-xl font-bold text-[#ED6C02]">
                          <AnimatedCounter value={3} duration={1.5} />
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Trust Stats */}
        <section className="relative overflow-hidden border-y border-[#E8E0D8] bg-[#F5EDE6]">
          <motion.div
            aria-hidden
            className="absolute -top-20 left-1/3 h-64 w-64 rounded-full bg-[#D4A854]/10 blur-3xl"
            animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="relative mx-auto max-w-6xl px-4 py-12">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {stats.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: i * 0.1, duration: 0.5, type: "spring", bounce: 0.25 }}
                  className="text-center"
                >
                  <p className="font-serif text-3xl font-bold text-[#C73E1D] md:text-4xl">
                    <AnimatedCounter
                      value={s.value}
                      prefix={s.prefix}
                      suffix={s.suffix}
                      decimals={s.decimals}
                    />
                  </p>
                  <p className="mt-1 text-sm text-[#8D8A87]">{s.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Screenshot Showcase */}
        <section id="showcase" className="py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mb-16 text-center"
            >
              <h2 className="font-serif text-4xl font-bold text-[#2D2A26]">
                See Finaflow in Action
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-[#8D8A87]">
                Every screen is designed to give you instant clarity on your business finances.
                No clutter. No complexity. Just the numbers that matter.
              </p>
            </motion.div>
            <div className="space-y-24">
              {showcaseItems.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
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
                    <motion.div
                      whileHover={{ y: -4 }}
                      transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
                      className="group relative overflow-hidden rounded-2xl border border-[#E8E0D8] bg-white shadow-lg shadow-[#C73E1D]/5 transition-shadow duration-300 hover:shadow-2xl hover:shadow-[#C73E1D]/15"
                    >
                      <img
                        src={item.img}
                        alt={item.title}
                        className="w-full object-contain transition-transform duration-700 group-hover:scale-[1.03]"
                        loading={i === 0 ? "eager" : "lazy"}
                      />
                    </motion.div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section id="how-it-works" className="py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mb-12 text-center"
            >
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#C73E1D]/20 bg-[#C73E1D]/5 px-3 py-1 text-xs font-medium text-[#C73E1D]">
                <Sparkles className="h-3 w-3" /> Live in minutes
              </div>
              <h2 className="font-serif text-4xl font-bold text-[#2D2A26]">
                From signup to first report in under 5 minutes
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-[#8D8A87]">
                No spreadsheets, no consultants, no setup fees. Just three simple steps.
              </p>
            </motion.div>
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
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: i * 0.12, duration: 0.55, type: "spring", bounce: 0.25 }}
                  whileHover={{ y: -4 }}
                  className="group relative rounded-2xl border border-[#E8E0D8] bg-white p-6 transition-shadow hover:shadow-lg hover:shadow-[#C73E1D]/10"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="font-mono text-3xl font-bold text-[#C73E1D]/20 transition-colors group-hover:text-[#C73E1D]/40">
                      {s.step}
                    </span>
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: -5 }}
                      transition={{ type: "spring", bounce: 0.5, duration: 0.4 }}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C73E1D]/10"
                    >
                      <s.icon className="h-5 w-5 text-[#C73E1D]" />
                    </motion.div>
                  </div>
                  <h3 className="text-base font-semibold text-[#2D2A26]">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#8D8A87]">{s.desc}</p>
                  <div className="mt-4 flex items-center gap-1.5 border-t border-[#E8E0D8] pt-3 text-xs font-medium text-[#2E7D32]">
                    <CheckCircle className="h-3 w-3" />
                    {s.detail}
                  </div>
                </motion.div>
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
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mb-12 text-center"
            >
              <h2 className="font-serif text-4xl font-bold text-[#2D2A26]">
                Everything you need to run your finances
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-[#8D8A87]">
                From daily sales to statutory payroll — all in one platform built for African businesses
              </p>
            </motion.div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: (i % 3) * 0.08, duration: 0.5, type: "spring", bounce: 0.25 }}
                  whileHover={{ y: -4 }}
                >
                  <Card className="group h-full cursor-default border-[#E8E0D8] bg-white transition-all duration-300 hover:border-[#C73E1D]/30 hover:shadow-lg hover:shadow-[#C73E1D]/10">
                    <CardContent className="p-5">
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ type: "spring", bounce: 0.5, duration: 0.4 }}
                        className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#C73E1D]/10 transition-colors group-hover:bg-[#C73E1D]/20"
                      >
                        <f.icon className="h-5 w-5 text-[#C73E1D]" />
                      </motion.div>
                      <h3 className="text-sm font-semibold text-[#2D2A26] transition-colors group-hover:text-[#C73E1D]">
                        {f.title}
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-[#8D8A87]">{f.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-20">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-10 text-center">
              <h2 className="font-serif text-4xl font-bold text-[#2D2A26]">Simple, transparent pricing</h2>
              <p className="mt-2 text-sm text-[#8D8A87]">Start free. Upgrade as you grow. All prices in KES.</p>
              <div className="mt-6 hidden md:flex md:justify-center">
                <BillingCycleToggle
                  value={billingCycle}
                  onChange={setBillingCycle}
                />
              </div>
              <AnimatePresence initial={false}>
                {billingCycle === "yearly" && (
                  <motion.p
                    key="yearly-note"
                    initial={{ opacity: 0, y: -4, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -4, height: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="mt-3 overflow-hidden text-xs text-[#2E7D32] font-medium"
                  >
                    Save ~17% on yearly — that's 2 months free on every paid plan.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <div className="md:hidden">
              <ChangeablePricingSection
                plans={pricingPlans}
                defaultPlanId="growth"
                yearlyDiscountNote="Save ~17% when you pay yearly — that's 2 months free."
                footerText="No credit card. No long-term contract. Cancel anytime."
                buttonText="Get Started"
                ctaHref="/login?type=standard"
              />
            </div>
            <div className="hidden md:grid md:gap-4 md:grid-cols-2 lg:hidden">
              {pricingPlans.map((plan, idx) => (
                <PricingCard
                  key={plan.id}
                  plan={plan}
                  billingCycle={billingCycle}
                  index={idx}
                />
              ))}
            </div>
            <div className="hidden lg:grid lg:gap-5 lg:grid-cols-4">
              {pricingPlans.map((plan, idx) => (
                <PricingCard
                  key={plan.id}
                  plan={plan}
                  billingCycle={billingCycle}
                  index={idx}
                />
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
        <section className="relative overflow-hidden border-t border-[#E8E0D8] py-20">
          <div className="absolute inset-0 bg-gradient-to-br from-[#2D2A26] via-[#1a1815] to-[#2D2A26]" aria-hidden />
          <motion.div
            aria-hidden
            className="absolute -top-20 left-1/4 h-72 w-72 rounded-full bg-[#D4A854]/20 blur-3xl"
            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="absolute -bottom-20 right-1/4 h-72 w-72 rounded-full bg-[#C73E1D]/15 blur-3xl"
            animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />
          <div className="relative mx-auto max-w-3xl px-4 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
              className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D4A854]/30 to-[#D4A854]/50 ring-1 ring-[#D4A854]/30"
            >
              <Percent className="h-7 w-7 text-[#D4A854]" />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="font-serif text-3xl font-bold text-white md:text-4xl"
            >
              Are you an accountant or consultant?
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/70"
            >
              Join our Partner Program and earn <strong className="text-[#D4A854]">20% revenue share</strong> from every business client you onboard.
              No caps. No quotas. Just recurring income from the businesses you already serve.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-8 flex flex-wrap justify-center gap-3"
            >
              <motion.div
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", bounce: 0.4, duration: 0.3 }}
              >
                <Link to="/login?type=partner">
                  <Button className="bg-[#D4A854] px-8 text-white shadow-lg shadow-[#D4A854]/20 hover:bg-[#D4A854]/90">
                    Join as Partner
                  </Button>
                </Link>
              </motion.div>
              <a href="#pricing" className="inline-flex items-center gap-1 self-center text-sm text-white/60 transition-colors hover:text-white">
                View pricing <ChevronRight className="h-3 w-3" />
              </a>
            </motion.div>
            {/* Prominent "already have an account" reminder — full-width on
                mobile, visually distinct from the primary "Join as Partner"
                call-to-action. */}
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-4 w-full sm:w-auto"
            >
              <Link
                to="/login"
                data-testid="partner-account-cta"
                className="flex w-full items-center justify-center gap-2 rounded-md border border-white/20 bg-white/10 py-3 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/15 min-h-[48px] sm:w-auto sm:px-5"
              >
                <LogIn className="h-4 w-4 text-white" />
                Already have an account? <span className="underline">Sign In</span>
              </Link>
            </motion.div>
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
