// ABOUTME: Shared public header for statement tools: brand, tool menu, back-to-home and sign-in.
// ABOUTME: Includes a compact mobile menu so every tool page has a way back to the main site.

import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Landmark, Menu, X } from "lucide-react";

interface Props {
  active?: "converter" | "bank" | "excel" | "accountants";
}

const LINKS: Array<{ to: string; label: string; key: Props["active"] }> = [
  { to: "/tools/mpesa-statement-converter", label: "M-PESA converter", key: "converter" },
  { to: "/tools/bank-statement-converter", label: "Bank converter", key: "bank" },
  { to: "/tools/mpesa-to-excel", label: "PDF to Excel", key: "excel" },
  { to: "/tools/mpesa-for-accountants", label: "For accountants", key: "accountants" },
];

export function ToolHeader({ active }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-[#E8E0D8] bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C73E1D]">
            <Landmark className="h-4 w-4 text-white" />
          </span>
          <span className="font-serif text-lg font-bold text-[#2D2A26]">FinaFlow</span>
        </Link>

        <nav className="hidden items-center gap-4 text-sm text-[#5C5853] md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={link.key === active ? "font-medium text-[#C73E1D]" : "hover:text-[#2D2A26]"}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8E0D8] px-2.5 py-1.5 text-sm text-[#2D2A26] hover:bg-[#F5EDE6]"
            title="Back to FinaFlow home"
            aria-label="Back to FinaFlow home"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="sm:hidden">Back</span>
            <span className="hidden sm:inline">Back to home</span>
          </Link>
          <Link
            to="/login"
            className="rounded-lg bg-[#2D2A26] px-3 py-1.5 text-sm text-white hover:bg-[#2D2A26]/90"
          >
            Sign in
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-lg border border-[#E8E0D8] p-2 text-[#2D2A26] md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[#E8E0D8] bg-[#FAF7F2] px-4 py-3 md:hidden">
          <div className="mx-auto flex max-w-5xl flex-col gap-2 text-sm">
            {LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className={link.key === active ? "font-medium text-[#C73E1D]" : "text-[#2D2A26]"}
              >
                {link.label}
              </Link>
            ))}
            <Link to="/" onClick={() => setOpen(false)} className="flex items-center gap-1.5 border-t border-[#E8E0D8] pt-2 text-[#2D2A26]">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to FinaFlow
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
