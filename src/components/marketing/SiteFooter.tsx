// ABOUTME: Shared public footer that groups the product, solutions, free tools and company
// ABOUTME: links into columns, mirroring the header's information architecture.
import { Link } from "react-router";
import { Landmark, Github } from "lucide-react";
import { GITHUB_URL } from "./SiteHeader";

const columns = [
  {
    title: "Platform",
    links: [
      { to: "/#product", label: "Platform overview" },
      { to: "/#features", label: "Features" },
      { to: "/#how-it-works", label: "How it works" },
      { to: "/#integrations", label: "Integrations" },
      { to: "/#pricing", label: "Pricing" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { to: "/solutions/mobile-money-agents", label: "Mobile money agents" },
      { to: "/#solutions", label: "Retail & multi-branch" },
      { to: "/#audiences", label: "Accountants & consultants" },
      { to: "/login?type=partner", label: "Partner program" },
    ],
  },
  {
    title: "Free tools",
    links: [
      { to: "/tools/mpesa-statement-converter", label: "M-PESA converter" },
      { to: "/tools/bank-statement-converter", label: "Bank statement converter" },
      { to: "/tools/mpesa-to-excel", label: "PDF statement to Excel" },
      { to: "/tools/mpesa-for-accountants", label: "For accountants" },
    ],
  },
  {
    title: "Company",
    links: [
      { to: "/#faq", label: "FAQ" },
      { to: "/login", label: "Sign in" },
      { to: "/login?type=standard", label: "Create an account" },
      { to: GITHUB_URL, label: "GitHub", external: true },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[#E8E0D8] bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#C73E1D]">
                <Landmark className="h-4 w-4 text-white" />
              </div>
              <span className="font-serif text-lg font-bold text-[#2D2A26]">Finaflow</span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#8D8A87]">
              The financial command center for African businesses — sales, expenses, payroll, M-PESA and KRA-ready reports in one place.
            </p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-[#E8E0D8] px-3 py-1.5 text-xs font-medium text-[#2D2A26] transition-colors hover:bg-[#F5EDE6]"
            >
              <Github className="h-3.5 w-3.5" /> Star on GitHub
            </a>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8D8A87]">{column.title}</h3>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) =>
                  "external" in link && link.external ? (
                    <li key={link.label}>
                      <a
                        href={link.to}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[#2D2A26] transition-colors hover:text-[#C73E1D]"
                      >
                        {link.label}
                      </a>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <Link to={link.to} className="text-sm text-[#2D2A26] transition-colors hover:text-[#C73E1D]">
                        {link.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-[#E8E0D8] pt-6 text-xs text-[#8D8A87] sm:flex-row">
          <p>© 2026 Finaflow. Built for African businesses.</p>
          <p>
            Built by{" "}
            <a
              href="https://genius.africa"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#2D2A26] underline decoration-[#D4A854] decoration-2 underline-offset-4 transition-colors hover:text-[#C73E1D]"
            >
              genius
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
