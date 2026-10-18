// ABOUTME: Public guide pages for the M-PESA tools: PDF-to-Excel and statements for accountants.
// ABOUTME: Marketing/SEO content; the actual work happens in the no-upload converter.

import { Link } from "react-router";
import { CheckCircle2, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { ToolHeader } from "@/components/tools/ToolHeader";

interface Props {
  kind: "excel" | "accountants";
}

const CONTENT = {
  excel: {
    eyebrow: "Free tool · no account",
    title: "Convert an M-PESA PDF to Excel",
    intro:
      "M-PESA statements arrive as password-protected PDFs. Convert one in your browser to a clean CSV you can open in Excel or Google Sheets — or import it into FinaFlow for a formatted workbook with analysis sheets.",
    steps: [
      "Open the free converter and select your M-PESA statement PDF.",
      "Enter the statement password (usually your national ID or phone number).",
      "Convert and download the CSV. It opens directly in Excel or Google Sheets.",
      "For a formatted workbook with summary, charges, categories and recurring payments, import it into FinaFlow and export XLSX.",
    ],
    faqs: [
      ["Does my statement leave my computer?", "No. The free converter parses the PDF in your browser. Nothing is uploaded or stored."],
      ["Can it open password-protected statements?", "Yes. Enter the password in the converter; unlocking happens locally."],
      ["What is in the workbook?", "Main transactions plus summary, money in/out, charges, reversals, daily balance, monthly/weekly breakdown, distribution, top contacts, recurring, time of day, day of week, pay bills & tills, categories and anomalies."],
    ],
  },
  accountants: {
    eyebrow: "For accountants & bookkeepers",
    title: "M-PESA statements for accountants",
    intro:
      "Client statements arrive in batches, each with its own password. Convert them locally, review fees and charges, and hand off a clean ledger — without uploading sensitive PDFs to a random converter.",
    steps: [
      "Collect the client PDFs and their passwords.",
      "Convert each statement in the browser, or import the batch into FinaFlow.",
      "Review the charges and fees sheet, balance continuity and uncategorised rows.",
      "Export CSV/XLSX/JSON for the accounting stack, or keep the workbook as working papers.",
    ],
    faqs: [
      ["Is this suitable for client data?", "The free converter is local-first: PDFs and passwords are handled on the device running the browser. FinaFlow never stores the original file or password."],
      ["Can I process many statements at once?", "Yes. The converter accepts up to 12 files; FinaFlow batches 12 per import with per-file passwords and results."],
      ["Which export helps with fee reconciliation?", "The Charges & Fees sheet links charges to their parent receipt and reports fee type and percentage. Pair it with the financial summary for cash-flow context."],
    ],
  },
} as const;

export default function StatementGuide({ kind }: Props) {
  const content = CONTENT[kind];
  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2D2A26]">
      <ToolHeader active={kind === "excel" ? "excel" : "accountants"} />

      <main className="mx-auto max-w-4xl px-4 py-10">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#C73E1D]">{content.eyebrow}</p>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight sm:text-4xl">{content.title}</h1>
        <p className="mt-3 max-w-2xl text-[#5C5853]">{content.intro}</p>
        <p className="mt-4 flex items-center gap-2 text-sm text-[#2E7D32]">
          <ShieldCheck className="h-4 w-4" /> Local-first: nothing uploaded, no account required.
        </p>

        <section className="mt-8 rounded-xl border border-[#E8E0D8] bg-white p-5">
          <h2 className="font-serif text-xl font-semibold">Steps</h2>
          <ol className="mt-3 space-y-3">
            {content.steps.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm text-[#5C5853]">
                <span className="font-serif text-lg font-semibold text-[#C73E1D]">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-6 rounded-xl border border-[#E8E0D8] bg-white p-5">
          <h2 className="font-serif text-xl font-semibold">FAQ</h2>
          <div className="mt-3 space-y-4">
            {content.faqs.map((faq) => {
              const [question, answer] = faq;
              return (
                <div key={question}>
                  <h3 className="text-sm font-medium">{question}</h3>
                  <p className="mt-1 text-sm text-[#5C5853]">{answer}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E8E0D8] bg-white p-5">
          <div className="flex items-start gap-2">
            <FileSpreadsheet className="mt-0.5 h-5 w-5 text-[#D4A854]" />
            <div>
              <h2 className="font-serif text-lg font-semibold">Ready to convert?</h2>
              <p className="text-sm text-[#8D8A87]">CSV and JSON in your browser, or a full workbook in FinaFlow.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/tools/mpesa-statement-converter" className="rounded-lg bg-[#C73E1D] px-3 py-2 text-sm font-medium text-white hover:bg-[#C73E1D]/90">
              Free converter
            </Link>
            <Link to="/login" className="rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm font-medium text-[#2D2A26] hover:bg-[#F5EDE6]">
              Open FinaFlow
            </Link>
          </div>
        </section>

        <section className="mt-6 grid gap-2 text-sm text-[#5C5853] sm:grid-cols-3">
          <p className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#2E7D32]" /> UTF-8 CSV with BOM</p>
          <p className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#2E7D32]" /> Fees kept separate</p>
          <p className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#2E7D32]" /> Balance checks</p>
        </section>
      </main>

      <footer className="border-t border-[#E8E0D8] bg-white py-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 text-xs text-[#8D8A87]">
          <span>FinaFlow · statement tools</span>
          <div className="flex gap-3">
            <Link to="/tools/mpesa-statement-converter" className="hover:text-[#2D2A26]">Converter</Link>
            <Link to="/tools/mpesa-to-excel" className="hover:text-[#2D2A26]">PDF to Excel</Link>
            <Link to="/tools/mpesa-for-accountants" className="hover:text-[#2D2A26]">For accountants</Link>
            <Link to="/" className="hover:text-[#2D2A26]">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
