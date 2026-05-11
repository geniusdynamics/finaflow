import { useState } from "react";
import { Link } from "react-router";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Landmark, TrendingUp, Users, Smartphone, ShieldCheck, Zap, CheckCircle, ArrowRight, Store, FileSpreadsheet, CreditCard, Bell, Menu, X } from "lucide-react";

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    { icon: Store, title: "Multi-Location Management", desc: "Track sales, expenses, and accounts across all your branches from one dashboard." },
    { icon: CreditCard, title: "M-PESA Integration", desc: "Import and reconcile M-PESA SMS transactions automatically. No manual entry needed." },
    { icon: Users, title: "Payroll & Staff", desc: "Auto-calculate NHIF, NSSF, PAYE. Process advances, generate payslips." },
    { icon: FileSpreadsheet, title: "Financial Reports", desc: "P&L, cash flow forecasting, budget vs actual, COGS analysis — all exportable." },
    { icon: ShieldCheck, title: "Role-Based Access", desc: "Owner, admin, manager, employee, viewer — each with precise permissions." },
    { icon: Bell, title: "Smart Alerts", desc: "Low balance warnings, overdue bill notifications, price change alerts." },
  ];

  const tiers = [
    { name: "Free", price: "0", businesses: 1, branches: 1, users: 1, transactions: "100 / month", payroll: "No", support: "Community", features: ["1 business", "1 branch", "1 user", "100 transactions/mo", "Basic sales & expenses", "M-PESA import"], cta: "Get Started", highlight: false },
    { name: "Starter", price: "500", businesses: 1, branches: 1, users: 3, transactions: "5,000 / month", payroll: "No", support: "Email", features: ["1 business", "1 branch", "3 users", "Unlimited transactions", "Recurring bills", "Email support"], cta: "Start Trial", highlight: false },
    { name: "Growth", price: "1,500", businesses: 3, branches: 5, users: 5, transactions: "20,000 / month", payroll: "Yes", support: "Priority", features: ["3 businesses", "5 branches", "5 users", "Unlimited transactions", "Full payroll", "Priority support"], cta: "Start Trial", highlight: true },
    { name: "Pro", price: "3,000", businesses: 10, branches: "∞", users: "∞", transactions: "Unlimited", payroll: "Yes", support: "Dedicated", features: ["10 businesses", "Unlimited branches", "Unlimited users", "API access", "Webhooks", "White-label option"], cta: "Contact Sales", highlight: false },
  ];

  return (
    <>
      <Helmet>
        <title>Finaflow — Business Financial Tracking Platform</title>
        <meta name="description" content="Finaflow helps businesses track cashflow, manage payroll, process bills, and generate financial reports in real-time." />
        <meta property="og:title" content="Finaflow — Financial Tracking for African Businesses" />
        <meta property="og:description" content="Comprehensive business financial management platform with M-PESA integration, payroll, and reporting." />
        <meta property="og:type" content="website" />
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
        <nav className="sticky top-0 z-50 border-b border-[#E8E0D8] bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C73E1D]">
                <Landmark className="h-4 w-4 text-white" />
              </div>
              <span className="font-serif text-xl font-bold text-[#2D2A26]">Finaflow</span>
            </div>
            <div className="hidden items-center gap-6 text-sm text-[#2D2A26] md:flex">
              <a href="#features" className="hover:text-[#C73E1D]">Features</a>
              <a href="#pricing" className="hover:text-[#C73E1D]">Pricing</a>
              <Link to="/login" className="font-medium hover:text-[#C73E1D]">Sign In</Link>
              <Link to="/login"><Button className="bg-[#C73E1D] hover:bg-[#C73E1D]/90 text-sm">Get Started</Button></Link>
            </div>
            <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
          {mobileMenuOpen && (
            <div className="border-t border-[#E8E0D8] px-4 py-3 md:hidden space-y-2 text-sm">
              <a href="#features" className="block py-1">Features</a>
              <a href="#pricing" className="block py-1">Pricing</a>
              <Link to="/login" className="block py-1 font-medium">Sign In</Link>
              <Link to="/login" className="block py-1 font-medium text-[#C73E1D]">Get Started</Link>
            </div>
          )}
        </nav>
        <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#E8E0D8] bg-[#F5EDE6] px-3 py-1 text-xs font-medium text-[#C73E1D]">
                <Zap className="h-3 w-3" /> Now with Partner & Reseller Program
              </div>
              <h1 className="font-serif text-4xl font-bold leading-tight text-[#2D2A26] md:text-5xl">
                Business finances,<br />finally <span className="text-[#C73E1D]">made simple</span>
              </h1>
              <p className="mt-4 text-lg text-[#8D8A87]">
                Track sales, manage expenses, run payroll, and reconcile M-PESA — all in one place. Built for African Businesses.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/login"><Button className="bg-[#C73E1D] hover:bg-[#C73E1D]/90 px-6">Get Started Free</Button></Link>
                <Link to="/login"><Button variant="outline" className="border-[#C73E1D] text-[#C73E1D] px-6">Join as Partner</Button></Link>
              </div>
              <div className="mt-6 flex items-center gap-4 text-xs text-[#8D8A87]">
                <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-[#2E7D32]" />No credit card</span>
                <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-[#2E7D32]" />Free forever plan</span>
                <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-[#2E7D32]" />KRA-ready reports</span>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-xl border border-[#E8E0D8] bg-[#F5EDE6] p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-[#2D2A26]">Daily Overview</span>
                  <span className="text-xs text-[#8D8A87]">Today</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white p-3"><p className="text-xs text-[#8D8A87]">Sales</p><p className="font-mono text-lg font-semibold text-[#2E7D32]">KES 45,200</p></div>
                  <div className="rounded-lg bg-white p-3"><p className="text-xs text-[#8D8A87]">Expenses</p><p className="font-mono text-lg font-semibold text-[#D32F2F]">KES 12,800</p></div>
                  <div className="rounded-lg bg-white p-3"><p className="text-xs text-[#8D8A87]">Net</p><p className="font-mono text-lg font-semibold text-[#2D2A26]">KES 32,400</p></div>
                  <div className="rounded-lg bg-white p-3"><p className="text-xs text-[#8D8A87]">Bills Due</p><p className="font-mono text-lg font-semibold text-[#ED6C02]">3</p></div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="features" className="border-t border-[#E8E0D8] bg-[#F5EDE6] py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-10 text-center">
              <h2 className="font-serif text-3xl font-bold text-[#2D2A26]">Everything you need to run your finances</h2>
              <p className="mt-2 text-sm text-[#8D8A87]">From daily sales to statutory payroll — all in one platform</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f, i) => (
                <Card key={i} className="border-[#E8E0D8] bg-white">
                  <CardContent className="p-4">
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[#C73E1D]/10">
                      <f.icon className="h-4 w-4 text-[#C73E1D]" />
                    </div>
                    <h3 className="text-sm font-semibold text-[#2D2A26]">{f.title}</h3>
                    <p className="mt-1 text-xs text-[#8D8A87]">{f.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
        <section id="pricing" className="py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-10 text-center">
              <h2 className="font-serif text-3xl font-bold text-[#2D2A26]">Simple, transparent pricing</h2>
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
                    <Link to="/login" className="mt-4 block">
                      <Button className={`w-full ${t.highlight ? "bg-[#C73E1D]" : "bg-[#2D2A26]"}`} size="sm">{t.cta}</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
        <section className="border-t border-[#E8E0D8] bg-[#F5EDE6] py-16">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <h2 className="font-serif text-3xl font-bold text-[#2D2A26]">Are you an accountant or consultant?</h2>
            <p className="mt-3 text-sm text-[#8D8A87]">
              Join our Partner Program and earn <strong className="text-[#D4A854]">20% revenue share</strong> from every business client you onboard.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link to="/login"><Button className="bg-[#D4A854] text-white hover:bg-[#D4A854]/90">Join as Partner</Button></Link>
              <a href="#pricing" className="inline-flex items-center gap-1 text-sm text-[#8D8A87] hover:text-[#2D2A26]"><ArrowRight className="h-4 w-4" />View pricing</a>
            </div>
          </div>
        </section>
        <footer className="border-t border-[#E8E0D8] py-8">
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-[#C73E1D]">
                  <Landmark className="h-3 w-3 text-white" />
                </div>
                <span className="font-serif text-sm font-bold text-[#2D2A26]">Finaflow</span>
              </div>
              <p className="text-xs text-[#8D8A87]">© 2026 Finaflow. Built for African Businesses.</p>
              <div className="flex gap-4 text-xs text-[#8D8A87]">
                <Link to="/login" className="hover:text-[#2D2A26]">Sign In</Link>
                <Link to="/login" className="hover:text-[#2D2A26]">Sign Up</Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
