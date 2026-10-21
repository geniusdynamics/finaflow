// ABOUTME: Dedicated marketing page for mobile money agents and agent-outlet operators.
// ABOUTME: Every capability claimed here is verified against shipped code; anything not yet built is
// ABOUTME: listed in the explicitly-labelled roadmap section instead of being sold as available.
import { useState } from "react";
import { Link } from "react-router";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Landmark, Smartphone, Wallet, Banknote, PiggyBank, ArrowRight,
  ArrowUpRight, CheckCircle, AlertTriangle,
  Users, Receipt, Bell, FileSpreadsheet, Building2, Lock, RefreshCw,
  Sparkles, HelpCircle, BookOpen, LogIn, UserPlus, Plus, Github,
  Menu, X, Store, ShieldCheck, MapPin, Clock, Upload, ListChecks,
  CalendarDays, HandCoins, WalletCards, ClipboardList, TrendingUp,
} from "lucide-react";

const GITHUB_URL = "https://github.com/geniusdynamics/finaflow";

/* ------------------------------------------------------------------ *
 * Hero mock — mirrors the real CashPositionCard breakdown
 * (cash / bank / wallet / other) and per-branch balances.
 * ------------------------------------------------------------------ */
const cashBreakdown = [
  { label: "Cash", value: "KES 204,300", pct: 42, color: "bg-[#2E7D32]" },
  { label: "Wallet", value: "KES 170,100", pct: 35, color: "bg-[#C73E1D]" },
  { label: "Bank", value: "KES 87,600", pct: 18, color: "bg-[#1565C0]" },
  { label: "Other", value: "KES 24,200", pct: 5, color: "bg-[#D4A854]" },
];

const outletRows = [
  { name: "Town Branch", cash: "KES 96,400", wallet: "KES 78,900" },
  { name: "Market Stall", cash: "KES 61,250", wallet: "KES 52,300" },
  { name: "Stage Kiosk", cash: "KES 46,650", wallet: "KES 38,900" },
];

/* ------------------------------------------------------------------ *
 * Pain → capability pairs. Each capability maps to a shipped feature.
 * ------------------------------------------------------------------ */
const painPoints = [
  {
    icon: Clock,
    pain: "“I only know the position when someone tells me.”",
    answer: "Your dashboard shows total cash on hand across all branches, broken down by cash, bank, wallet and other — any time you open it, not when staff remember to text you.",
    evidence: "Dashboard summary + Cash Position card",
  },
  {
    icon: Smartphone,
    pain: "“Cash and e-money live in two separate worlds.”",
    answer: "Mobile wallet activity sits beside your cash accounts. Paste in M-PESA or Airtel Money messages and see inflows, outflows, fees and net flow for the period.",
    evidence: "Mobile Wallet module (M-PESA, Airtel Money)",
  },
  {
    icon: Receipt,
    pain: "“The outlet's running costs disappear into the day.”",
    answer: "Log transport, fuel, airtime and rent against the specific branch, attach a photo of the receipt, and see every outlet's costs in one list.",
    evidence: "Expenses module, location-tagged",
  },
  {
    icon: Users,
    pain: "“Either everyone sees the books, or nobody can record anything.”",
    answer: "Five roles with an editable permission matrix. Staff on the employee role can record sales and nothing else — they never see your balances.",
    evidence: "Roles + permission matrix",
  },
];

/* ------------------------------------------------------------------ *
 * Shipped capabilities only.
 * ------------------------------------------------------------------ */
const capabilities = [
  {
    icon: WalletCards,
    title: "Cash position across outlets",
    desc: "Total cash on hand across every branch in one figure, split into cash, bank, wallet and other so you can see where the money actually sits.",
  },
  {
    icon: Smartphone,
    title: "M-PESA & Airtel Money import",
    desc: "Paste a batch of M-PESA or Airtel Money SMS messages, preview how each one parses, then import. Duplicates are detected and skipped automatically.",
  },
  {
    icon: TrendingUp,
    title: "E-money movement",
    desc: "Inflows, outflows, transaction fees and net flow for any period, with fees broken down by transaction type and your top recipients by value.",
  },
  {
    icon: CalendarDays,
    title: "Daily wallet ledger",
    desc: "Record each wallet's opening balance, inflow, outflow and fees per day — Finaflow calculates the closing balance and stores the transaction count and notes.",
  },
  {
    icon: Banknote,
    title: "Deposits, drawings & transfers",
    desc: "Record money into and out of any account, move funds between accounts, and every movement posts to that account's ledger with a running balance.",
  },
  {
    icon: Receipt,
    title: "Outlet expenses with photos",
    desc: "Transport & delivery, fuel, airtime/data, rent and utilities are ready-made categories. Attach receipt photos, tag the branch, reverse with a reason if needed.",
  },
  {
    icon: Building2,
    title: "Per-outlet accounts",
    desc: "Each branch gets its own cash drawer, wallet and bank accounts, with configurable default accounts so entries land in the right place by default.",
  },
  {
    icon: Bell,
    title: "Bill alerts per branch",
    desc: "Overdue supplier bills raise notifications automatically, scoped to the branches you can see, so nothing quietly ages past its due date.",
  },
  {
    icon: FileSpreadsheet,
    title: "Reports & exports",
    desc: "Profit & loss, budget vs actual and a 30-day cash-flow forecast, with a branch filter — export sales, expenses, wallet transactions or a consolidated report.",
  },
];

/* ------------------------------------------------------------------ *
 * The daily loop, exactly as the product records it today.
 * ------------------------------------------------------------------ */
const dailyLoop = [
  {
    step: "01",
    icon: Upload,
    title: "Import the day's wallet messages",
    desc: "Paste the M-PESA and Airtel Money messages from the outlet's phone. Each line is previewed as a parsed transaction before anything is saved, and already-imported messages are skipped.",
    note: "Per branch and per provider",
  },
  {
    step: "02",
    icon: Banknote,
    title: "Record cash movements",
    desc: "Post deposits into the outlet account and drawings out of it, or transfer between the cash drawer and the wallet. Each entry updates the account balance and ledger.",
    note: "Deposit · Drawing · Transfer",
  },
  {
    step: "03",
    icon: Receipt,
    title: "Log the outlet's costs",
    desc: "Capture transport to the bank, airtime, bank charges and any other cost against that branch, with a photo of the receipt attached for the record.",
    note: "Tagged to the branch",
  },
  {
    step: "04",
    icon: ClipboardList,
    title: "Post the wallet daily ledger",
    desc: "Enter opening balance, inflow, outflow and fees for the day. Finaflow stores the closing balance, the number of transactions and your notes against that wallet and date.",
    note: "Opening → Closing, per wallet",
  },
];

/* ------------------------------------------------------------------ *
 * Honest roadmap. Nothing here ships today.
 * ------------------------------------------------------------------ */
const roadmapItems = [
  {
    icon: HandCoins,
    title: "Cash handover recording",
    desc: "Handovers between staff and supervisor, logged as a first-class event instead of a verbal note.",
  },
  {
    icon: CalendarDays,
    title: "Open day & close day per outlet",
    desc: "An opening ritual and an end-of-day close for each outlet, so the day has a defined start and finish.",
  },
  {
    icon: AlertTriangle,
    title: "Expected vs counted cash",
    desc: "Finaflow will show expected cash and expected e-float next to what was actually counted, and flag the difference.",
  },
  {
    icon: ListChecks,
    title: "Shortage & surplus review",
    desc: "Differences surfaced per outlet with an explanation, photo proof and a review status for the owner.",
  },
];

const faqs = [
  {
    q: "Does Finaflow process mobile money transactions?",
    a: "No. Finaflow is a control and record layer — it does not move money, hold a till, or act as an M-PESA or Airtel Money integration. It records and aggregates what already happened across your cash and wallet accounts so you can see the position and the movement.",
  },
  {
    q: "How does M-PESA data actually get into Finaflow?",
    a: "By pasting the SMS messages. You paste one or many messages, Finaflow previews how each line parses, then imports them — skipping ones you have already imported. To be clear, there is no CSV or statement upload for wallet transactions today; SMS paste is the import path, and CSV exists only as an export of your own data.",
  },
  {
    q: "Can I track my e-float position?",
    a: "There is no separate 'e-float' figure in Finaflow today, and we would rather say so than sell you one. What exists: wallet balances are tracked as accounts inside your cash position, and the daily wallet ledger records an opening and closing balance per wallet per day. A dedicated per-outlet e-float position is on the roadmap.",
  },
  {
    q: "Can I see each outlet separately?",
    a: "Yes. Sales, expenses, accounts, wallet activity and reports are all scoped to a branch, and you can filter by branch on the expenses, wallet and reports pages. If you want staff restricted to only their own outlet, the owner can turn on enforced location assignment.",
  },
  {
    q: "Can staff record activity without seeing the books?",
    a: "Yes. The employee role carries a single permission — recording sales — so someone working the counter can log activity without seeing balances, reports or account history. Owner, admin, manager, employee and viewer roles are all editable from the permission matrix.",
  },
  {
    q: "Does it do end-of-day closing and shortage checks?",
    a: "Not yet, and we are not going to pretend otherwise — no cash handover, no open/close day ritual and no short/surplus detection ships today. Today you get the per-day wallet ledger with opening and closing balances, deposits, drawings and branch-tagged expenses. Those close-out features are what we are building next.",
  },
  {
    q: "Do I have to replace my existing setup?",
    a: "No. Finaflow runs alongside whatever you already use. Keep your till and your provider relationship — Finaflow is where the numbers get recorded and rolled up so you can see across outlets.",
  },
];

export default function MobileMoneyAgents() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <Helmet>
        <title>Finaflow for Mobile Money Agents — Track Cash &amp; E-Money Across Every Outlet</title>
        <meta
          name="description"
          content="Finaflow gives mobile money agents and agent-outlet owners one place to see cash position, M-PESA and Airtel Money movement, daily wallet ledgers, deposits, drawings and outlet expenses across every branch."
        />
        <meta property="og:title" content="Finaflow for Mobile Money Agents & Agent Outlets" />
        <meta
          property="og:description"
          content="Cash position, e-money movement and outlet costs across every branch — without waiting for a WhatsApp message."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/resources/cashflow%20dash.png" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Finaflow",
            applicationCategory: "BusinessApplication",
            audience: {
              "@type": "Audience",
              audienceType: "Mobile money agents and agent outlet operators",
            },
            description:
              "Financial control layer for mobile money agent outlets: cash position, mobile wallet movement, daily wallet ledgers, deposits, drawings, outlet expenses and per-branch reporting.",
            offers: { "@type": "Offer", price: "0", priceCurrency: "KES" },
          })}
        </script>
      </Helmet>

      <div className="min-h-screen bg-white">
        {/* Navigation */}
        <nav className="sticky top-0 z-50 border-b border-[#E8E0D8] bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C73E1D]">
                <Landmark className="h-4 w-4 text-white" />
              </div>
              <span className="font-serif text-xl font-bold text-[#2D2A26]">Finaflow</span>
            </Link>
            <div className="hidden items-center gap-5 text-sm text-[#2D2A26] lg:flex">
              <a href="#capabilities" className="hover:text-[#C73E1D]">What you get</a>
              <a href="#daily-loop" className="hover:text-[#C73E1D]">How it works</a>
              <a href="#outlets" className="hover:text-[#C73E1D]">Multi-outlet</a>
              <a href="#roadmap" className="hover:text-[#C73E1D]">What&apos;s next</a>
              <a href="#faq" className="hover:text-[#C73E1D]">FAQ</a>
            </div>
            <div className="flex items-center gap-2">
              <div
                role="tablist"
                aria-label="Sign in or sign up"
                className="flex rounded-lg border border-[#E8E0D8] bg-white p-1"
                data-testid="agent-header-auth-tabs"
              >
                <Link
                  to="/login"
                  role="tab"
                  aria-selected="true"
                  className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-md bg-[#C73E1D] px-3 py-1.5 text-xs font-medium text-white shadow-sm sm:min-h-[44px] sm:text-sm"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/login?type=standard"
                  role="tab"
                  aria-selected="false"
                  className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-[#8D8A87] transition-all hover:text-[#2D2A26] sm:min-h-[44px] sm:text-sm"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Sign Up</span>
                </Link>
              </div>
              <button
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 text-[#2D2A26] hover:bg-[#F5EDE6] lg:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
          {mobileMenuOpen && (
            <div className="space-y-2 border-t border-[#E8E0D8] px-4 py-3 text-sm lg:hidden">
              <a href="#capabilities" onClick={() => setMobileMenuOpen(false)} className="block py-1">What you get</a>
              <a href="#daily-loop" onClick={() => setMobileMenuOpen(false)} className="block py-1">How it works</a>
              <a href="#outlets" onClick={() => setMobileMenuOpen(false)} className="block py-1">Multi-outlet</a>
              <a href="#roadmap" onClick={() => setMobileMenuOpen(false)} className="block py-1">What&apos;s next</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="block py-1">FAQ</a>
              <Link
                to="/login?type=standard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-md bg-[#C73E1D] py-3 font-medium text-white"
              >
                <UserPlus className="h-4 w-4" /> Get Started
              </Link>
            </div>
          )}
        </nav>

        {/* Hero */}
        <section className="relative overflow-hidden" data-testid="agent-hero">
          <div className="absolute inset-0 bg-gradient-to-br from-[#F5EDE6] via-[#FAF4ED] to-[#F2E8DD]" aria-hidden />
          <motion.div
            aria-hidden
            className="absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-[#A02E1A]/20 blur-3xl"
            animate={{ scale: [1, 1.08, 1], opacity: [0.55, 0.8, 0.55] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="absolute -bottom-40 -left-32 h-[32rem] w-[32rem] rounded-full bg-[#D4A854]/20 blur-3xl"
            animate={{ scale: [1, 1.12, 1], opacity: [0.45, 0.7, 0.45] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          />
          <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-24">
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
                  <Smartphone className="h-3 w-3" /> For mobile money agents &amp; agent outlets
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="font-serif text-[1.75rem] font-bold leading-[1.15] tracking-tight text-[#1a1815] md:text-[2.75rem]"
                >
                  See the position of{" "}
                  <span className="bg-gradient-to-r from-[#A02E1A] via-[#D4A854] to-[#E8A04A] bg-clip-text text-transparent">
                    every outlet
                  </span>
                  , without waiting for a message
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="mt-6 max-w-xl text-base leading-relaxed text-[#4A4742] md:text-lg"
                >
                  Finaflow pulls your M-PESA and Airtel Money activity, deposits, drawings and outlet
                  costs into one place — so the cash position of each branch is a number you can open,
                  not a question you have to ask.
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="mt-8 flex flex-wrap gap-3"
                >
                  <motion.div whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.98 }} transition={{ type: "spring", bounce: 0.4, duration: 0.3 }}>
                    <Link to="/login?type=standard" data-testid="agent-hero-cta">
                      <Button className="bg-[#C73E1D] px-8 py-6 text-base shadow-lg shadow-[#C73E1D]/20 hover:bg-[#C73E1D]/90">
                        Get Started Free
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.98 }} transition={{ type: "spring", bounce: 0.4, duration: 0.3 }}>
                    <a href="#daily-loop">
                      <Button variant="outline" className="border-[#C73E1D] bg-white/60 px-8 py-6 text-base text-[#C73E1D] backdrop-blur hover:bg-white">
                        See how it works
                      </Button>
                    </a>
                  </motion.div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45, duration: 0.5 }}
                  className="mt-4 w-full sm:w-auto sm:max-w-xs"
                >
                  <Link
                    to="/login"
                    data-testid="agent-account-cta"
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md border border-[#E8E0D8] bg-white/80 py-3 text-sm font-medium text-[#2D2A26] backdrop-blur transition-colors hover:bg-white"
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
                  <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-[#2E7D32]" />Free plan for 1 outlet</span>
                  <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-[#2E7D32]" />No API needed — paste SMS</span>
                </motion.div>
              </motion.div>

              {/* Hero mock */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="relative"
              >
                <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} className="relative">
                  <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#C73E1D]/10 via-transparent to-[#D4A854]/10 blur-2xl" aria-hidden />
                  <div className="relative rounded-2xl border border-[#E8E0D8] bg-white/90 p-5 shadow-2xl shadow-[#C73E1D]/10 backdrop-blur">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-semibold text-[#2D2A26]">
                        <Wallet className="h-4 w-4 text-[#C73E1D]" />
                        Cash Position
                      </span>
                      <span className="rounded-full bg-[#F5EDE6] px-2 py-0.5 text-[10px] font-medium text-[#8D8A87]">Illustrative data</span>
                    </div>
                    <p className="font-mono text-3xl font-bold text-[#2D2A26]">KES 486,200</p>
                    <p className="mt-1 text-xs text-[#8D8A87]">Total cash on hand across all branches</p>

                    <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-[#F5EDE6]" role="img" aria-label="Cash position breakdown by account type">
                      {cashBreakdown.map((part) => (
                        <div key={part.label} className={part.color} style={{ width: `${part.pct}%` }} title={`${part.label}: ${part.value}`} />
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
                      {cashBreakdown.map((part) => (
                        <div key={part.label} className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${part.color}`} />
                          <span className="text-[#8D8A87]">{part.label}</span>
                          <span className="font-mono font-medium text-[#2D2A26]">{part.value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 border-t border-[#E8E0D8] pt-4">
                      <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-[#8D8A87]">
                        <Building2 className="h-3.5 w-3.5" /> By outlet
                      </p>
                      <div className="space-y-2">
                        {outletRows.map((row) => (
                          <div key={row.name} className="flex items-center justify-between rounded-lg bg-[#F5EDE6]/60 px-3 py-2">
                            <span className="flex items-center gap-2 text-xs font-medium text-[#2D2A26]">
                              <MapPin className="h-3 w-3 text-[#C73E1D]" />
                              {row.name}
                            </span>
                            <span className="flex items-center gap-3 font-mono text-[11px] text-[#8D8A87]">
                              <span>{row.cash}</span>
                              <span className="text-[#C73E1D]">{row.wallet}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Honest positioning bar */}
        <section className="border-y border-[#E8E0D8] bg-[#2D2A26]">
          <div className="mx-auto max-w-6xl px-4 py-8">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <ShieldCheck className="h-5 w-5 text-[#D4A854]" />
              </div>
              <p className="text-sm leading-relaxed text-white/80">
                <strong className="text-white">To be clear about what this is:</strong> Finaflow does not
                process mobile money transactions, hold a till, or act as a provider integration. It is the
                control and record layer — it records what happened across your cash and wallet accounts and
                rolls it up per outlet, so the numbers stop living in someone else&apos;s phone.
              </p>
            </div>
          </div>
        </section>

        {/* Pain → answer */}
        <section className="py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mb-14 text-center"
            >
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#C73E1D]/20 bg-[#C73E1D]/5 px-3 py-1 text-xs font-medium text-[#C73E1D]">
                <Sparkles className="h-3 w-3" /> The problem, honestly answered
              </div>
              <h2 className="font-serif text-3xl font-bold text-[#2D2A26] md:text-4xl">
                You cannot sit in every outlet
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-[#8D8A87]">
                So the numbers have to come to you. Here is what owners of agent outlets tell us, and the
                part of Finaflow that answers it today.
              </p>
            </motion.div>

            <div className="grid gap-5 md:grid-cols-2">
              {painPoints.map((item, i) => (
                <motion.div
                  key={item.pain}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: (i % 2) * 0.1, duration: 0.55, type: "spring", bounce: 0.25 }}
                  whileHover={{ y: -4 }}
                >
                  <Card className="h-full border-[#E8E0D8] bg-white transition-all duration-300 hover:border-[#C73E1D]/30 hover:shadow-lg hover:shadow-[#C73E1D]/10">
                    <CardContent className="p-6">
                      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#C73E1D]/10">
                        <item.icon className="h-5 w-5 text-[#C73E1D]" />
                      </div>
                      <p className="font-serif text-lg font-semibold italic text-[#8D8A87]">{item.pain}</p>
                      <p className="mt-3 text-sm leading-relaxed text-[#2D2A26]">{item.answer}</p>
                      <p className="mt-4 flex items-center gap-1.5 border-t border-[#E8E0D8] pt-3 text-xs font-medium text-[#2E7D32]">
                        <CheckCircle className="h-3 w-3" />
                        {item.evidence}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Capabilities */}
        <section id="capabilities" className="border-t border-[#E8E0D8] bg-[#F5EDE6] py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mb-12 text-center"
            >
              <h2 className="font-serif text-3xl font-bold text-[#2D2A26] md:text-4xl">
                What you get on day one
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-[#8D8A87]">
                Nine capabilities that ship in Finaflow today. Everything listed here is in the product,
                not on a slide.
              </p>
            </motion.div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((cap, i) => (
                <motion.div
                  key={cap.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: (i % 3) * 0.08, duration: 0.5, type: "spring", bounce: 0.25 }}
                  whileHover={{ y: -4 }}
                >
                  <Card className="group h-full border-[#E8E0D8] bg-white transition-all duration-300 hover:border-[#C73E1D]/30 hover:shadow-lg hover:shadow-[#C73E1D]/10">
                    <CardContent className="p-5">
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ type: "spring", bounce: 0.5, duration: 0.4 }}
                        className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#C73E1D]/10 transition-colors group-hover:bg-[#C73E1D]/20"
                      >
                        <cap.icon className="h-5 w-5 text-[#C73E1D]" />
                      </motion.div>
                      <h3 className="text-sm font-semibold text-[#2D2A26] transition-colors group-hover:text-[#C73E1D]">
                        {cap.title}
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-[#8D8A87]">{cap.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Daily loop */}
        <section id="daily-loop" className="py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mb-12 text-center"
            >
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#C73E1D]/20 bg-[#C73E1D]/5 px-3 py-1 text-xs font-medium text-[#C73E1D]">
                <RefreshCw className="h-3 w-3" /> The daily routine
              </div>
              <h2 className="font-serif text-3xl font-bold text-[#2D2A26] md:text-4xl">
                Your day, as Finaflow records it
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-[#8D8A87]">
                Four steps, in the order you would actually do them. No new hardware, no provider
                paperwork, no integration project.
              </p>
            </motion.div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {dailyLoop.map((s, i) => (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: i * 0.1, duration: 0.55, type: "spring", bounce: 0.25 }}
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
                    {s.note}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Multi-outlet */}
        <section id="outlets" className="border-t border-[#E8E0D8] bg-[#F5EDE6] py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <div className="grid items-center gap-12 md:grid-cols-2">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#C73E1D]/20 bg-[#C73E1D]/5 px-3 py-1 text-xs font-medium text-[#C73E1D]">
                  <Building2 className="h-3 w-3" /> Two outlets or twenty
                </div>
                <h2 className="font-serif text-3xl font-bold text-[#2D2A26] md:text-4xl">
                  Every outlet side by side
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-[#8D8A87]">
                  Each branch carries its own accounts, so the cash drawer in one outlet is never confused
                  with the cash drawer in another. Reporting, wallet activity and expenses all roll up — and
                  all filter back down to a single branch when you need to look closer.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    "Per-branch cash, wallet and bank accounts with configurable defaults",
                    "Branch filter on expenses, wallet activity and reports",
                    "Overdue bill alerts scoped to the branches you can see",
                    "Optional enforced location assignment so staff only see their own outlet",
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-sm text-[#2D2A26]">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#2E7D32]" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Link to="/login?type=standard">
                    <Button className="bg-[#C73E1D] px-6 py-5 text-sm hover:bg-[#C73E1D]/90">
                      Set up your first outlet <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: 0.15, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="overflow-hidden rounded-2xl border border-[#E8E0D8] bg-white shadow-lg shadow-[#C73E1D]/5">
                  <div className="flex items-center justify-between border-b border-[#E8E0D8] px-5 py-3">
                    <span className="flex items-center gap-2 text-sm font-semibold text-[#2D2A26]">
                      <Store className="h-4 w-4 text-[#C73E1D]" /> Outlets
                    </span>
                    <span className="rounded-full bg-[#F5EDE6] px-2 py-0.5 text-[10px] font-medium text-[#8D8A87]">Illustrative data</span>
                  </div>
                  <div className="divide-y divide-[#E8E0D8]">
                    <div className="grid grid-cols-3 gap-2 bg-[#F5EDE6]/60 px-5 py-2 text-[10px] font-medium uppercase tracking-wider text-[#8D8A87]">
                      <span>Outlet</span>
                      <span className="text-right">Cash</span>
                      <span className="text-right">Wallet</span>
                    </div>
                    {outletRows.map((row) => (
                      <div key={row.name} className="grid grid-cols-3 items-center gap-2 px-5 py-3">
                        <span className="flex items-center gap-2 text-xs font-medium text-[#2D2A26]">
                          <Store className="h-3 w-3 text-[#8D8A87]" />
                          {row.name}
                        </span>
                        <span className="text-right font-mono text-xs text-[#2D2A26]">{row.cash}</span>
                        <span className="text-right font-mono text-xs text-[#C73E1D]">{row.wallet}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t border-[#E8E0D8] px-5 py-3 text-xs text-[#8D8A87]">
                    <span>Total cash on hand</span>
                    <span className="font-mono text-sm font-bold text-[#2D2A26]">KES 486,200</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Roadmap — explicitly not available */}
        <section id="roadmap" data-testid="agent-roadmap" className="py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mb-12 text-center"
            >
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#ED6C02]/30 bg-[#ED6C02]/10 px-3 py-1 text-xs font-medium text-[#ED6C02]">
                <Clock className="h-3 w-3" /> Not available yet — being built
              </div>
              <h2 className="font-serif text-3xl font-bold text-[#2D2A26] md:text-4xl">
                What we have not built yet
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-[#8D8A87]">
                These are the outlet-control features we are working on next. We are listing them openly
                because you would find out anyway — and because they are not part of the product today.
              </p>
            </motion.div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {roadmapItems.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="rounded-2xl border border-dashed border-[#E8E0D8] bg-[#F5EDE6]/40 p-5"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white ring-1 ring-[#E8E0D8]">
                    <item.icon className="h-4 w-4 text-[#8D8A87]" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#2D2A26]">{item.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#8D8A87]">{item.desc}</p>
                </motion.div>
              ))}
            </div>
            <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-[#8D8A87]">
              Want to influence the order these land in? Tell us which one matters most to your outlets via
              the in-app feedback form or{" "}
              <a href={`${GITHUB_URL}/discussions`} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#2D2A26]">
                GitHub discussions
              </a>
              .
            </p>
          </div>
        </section>

        {/* Pricing snapshot */}
        <section className="border-t border-[#E8E0D8] bg-[#F5EDE6] py-20 md:py-24">
          <div className="mx-auto max-w-4xl px-4">
            <div className="mb-10 text-center">
              <h2 className="font-serif text-3xl font-bold text-[#2D2A26] md:text-4xl">
                Pick the plan that matches your outlets
              </h2>
              <p className="mt-3 text-sm text-[#8D8A87]">
                Start on the free plan with one outlet. Move up when you add branches — not before.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { name: "Free", price: "KES 0", fit: "1 business · 1 branch · 1 user", note: "Trying Finaflow on a single outlet" },
                { name: "Growth", price: "KES 1,500", fit: "3 businesses · 5 branches · 5 users", note: "Owner running a handful of outlets", highlight: true },
                { name: "Pro", price: "KES 3,000", fit: "10 businesses · unlimited branches", note: "Larger operator or franchise" },
              ].map((plan) => (
                <motion.div
                  key={plan.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5 }}
                  className={`rounded-2xl border bg-white p-5 ${
                    plan.highlight ? "border-[#C73E1D]/40 shadow-lg shadow-[#C73E1D]/10" : "border-[#E8E0D8]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-lg font-bold text-[#2D2A26]">{plan.name}</h3>
                    {plan.highlight && (
                      <span className="rounded-full bg-[#C73E1D]/10 px-2 py-0.5 text-[10px] font-semibold text-[#C73E1D]">Popular</span>
                    )}
                  </div>
                  <p className="mt-2 font-mono text-2xl font-bold text-[#C73E1D]">{plan.price}</p>
                  <p className="text-xs text-[#8D8A87]">per month</p>
                  <p className="mt-3 text-xs font-medium text-[#2D2A26]">{plan.fit}</p>
                  <p className="mt-1 text-xs text-[#8D8A87]">{plan.note}</p>
                </motion.div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/login?type=standard">
                <Button className="bg-[#C73E1D] px-6 py-5 text-sm hover:bg-[#C73E1D]/90">
                  Start free <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="/#pricing" className="text-sm font-medium text-[#C73E1D] underline underline-offset-4 hover:text-[#A02E1A]">
                See full pricing &amp; features
              </a>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20 md:py-24">
          <div className="mx-auto max-w-3xl px-4">
            <div className="mb-12 text-center">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#C73E1D]/20 bg-[#C73E1D]/5 px-3 py-1 text-xs font-medium text-[#C73E1D]">
                <HelpCircle className="h-3 w-3" /> Straight answers
              </div>
              <h2 className="font-serif text-3xl font-bold text-[#2D2A26] md:text-4xl">
                Questions agent owners ask
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-[#8D8A87]">
                Including the ones where the answer is &ldquo;not yet&rdquo;.
              </p>
            </div>
            <div className="space-y-3">
              {faqs.map((item, i) => (
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
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden border-t border-[#E8E0D8] py-20">
          <div className="absolute inset-0 bg-gradient-to-br from-[#2D2A26] via-[#1a1815] to-[#2D2A26]" aria-hidden />
          <motion.div
            aria-hidden
            className="absolute -top-20 left-1/4 h-72 w-72 rounded-full bg-[#D4A854]/20 blur-3xl"
            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="relative mx-auto max-w-3xl px-4 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
              className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D4A854]/30 to-[#D4A854]/50 ring-1 ring-[#D4A854]/30"
            >
              <Smartphone className="h-7 w-7 text-[#D4A854]" />
            </motion.div>
            <h2 className="font-serif text-3xl font-bold text-white md:text-4xl">
              Start with one outlet. Add branches when you are ready.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/70">
              The free plan covers a single outlet with no time limit and no card. Set up takes minutes,
              and there is nothing to integrate.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <motion.div whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.98 }} transition={{ type: "spring", bounce: 0.4, duration: 0.3 }}>
                <Link to="/login?type=standard">
                  <Button className="bg-[#C73E1D] px-8 text-white shadow-lg shadow-[#C73E1D]/20 hover:bg-[#C73E1D]/90">
                    Get Started Free
                  </Button>
                </Link>
              </motion.div>
              <Link
                to="/login"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md border border-white/20 bg-white/10 px-5 py-3 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/15"
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-5 text-xs text-white/50">
              <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Roles for counter staff</span>
              <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Encrypted, audited access</span>
              <span className="flex items-center gap-1.5"><PiggyBank className="h-3.5 w-3.5" />Open source core</span>
            </div>
          </div>
        </section>

        {/* Related solutions */}
        <section className="border-t border-[#E8E0D8] py-14">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="mb-6 text-center font-serif text-xl font-bold text-[#2D2A26]">
              Not running agent outlets?
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { icon: Landmark, title: "Retail & multi-branch", desc: "Per-branch sales, expenses and reporting for shops and chains.", to: "/#solutions" },
                { icon: ArrowUpRight, title: "Accountants & consultants", desc: "Manage client books and earn 20% revenue share.", to: "/login?type=partner" },
                { icon: FileSpreadsheet, title: "See the whole product", desc: "Cashflow, payroll, bills, budgets and KRA-ready reports.", to: "/#features" },
              ].map((card) => (
                <a
                  key={card.title}
                  href={card.to}
                  className="group flex items-start gap-3 rounded-2xl border border-[#E8E0D8] bg-white p-5 transition-all hover:border-[#C73E1D]/30 hover:shadow-lg hover:shadow-[#C73E1D]/10"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C73E1D]/10">
                    <card.icon className="h-5 w-5 text-[#C73E1D]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#2D2A26] transition-colors group-hover:text-[#C73E1D]">{card.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-[#8D8A87]">{card.desc}</p>
                  </div>
                </a>
              ))}
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
                  by{" "}
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
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Finaflow on GitHub"
                  className="flex items-center gap-1 transition-colors hover:text-[#2D2A26]"
                >
                  <Github className="h-3.5 w-3.5" />
                  <span>GitHub</span>
                </a>
                <a href="/#solutions" className="hover:text-[#2D2A26]">Solutions</a>
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
