// ABOUTME: Shared public header for the statement tools. Now delegates to the site-wide
// ABOUTME: navigation and adds a compact strip that switches between the free tools.
import { Link } from "react-router";
import { SiteHeader } from "@/components/marketing/SiteHeader";

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
  return (
    <>
      <SiteHeader />
      <div className="border-b border-[#E8E0D8] bg-[#FAF7F2]">
        <nav
          aria-label="Statement tools"
          className="mx-auto flex max-w-5xl gap-4 overflow-x-auto px-4 py-2 text-sm"
        >
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={
                link.key === active
                  ? "shrink-0 whitespace-nowrap font-medium text-[#C73E1D]"
                  : "shrink-0 whitespace-nowrap text-[#5C5853] hover:text-[#2D2A26]"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
