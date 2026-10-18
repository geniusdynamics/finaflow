// ABOUTME: Public, no-upload M-PESA statement converter: parses PDFs in the browser and downloads CSV/JSON.
// ABOUTME: No API calls, no storage, no account. Reuses the shared parser, analysis and CSV export code.

import { useMemo, useState } from "react";
import { Link } from "react-router";
import Decimal from "decimal.js";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { parseMpesaStatement } from "@shared/statements/parsers/mpesa";
import { buildDelimitedDocument } from "@shared/statements/table/delimited";
import { buildStatementAnalysis, type StatementAnalysis } from "@shared/statements/analyze";
import { buildStatementCsv, type ExportTransaction } from "@shared/statements/export/csv";
import { CATEGORY_KEY_LABELS } from "@shared/statements/categorize/taxonomy";
import { StatementError } from "@shared/statements/errors";
import type { ParsedStatement } from "@shared/statements/types";
import { formatKES } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToolHeader } from "@/components/tools/ToolHeader";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Lock,
  ShieldCheck,
  Upload,
} from "lucide-react";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

interface ConvertedFile {
  fileName: string;
  parsed: ParsedStatement;
  analysis: StatementAnalysis;
}

function toExportRows(parsed: ParsedStatement): ExportTransaction[] {
  return parsed.rows.map((row) => ({
    receiptNo: row.groupId,
    date: row.date,
    time: row.time,
    details: row.details,
    status: row.status,
    paidIn: row.paidIn,
    withdrawn: row.withdrawn,
    balance: row.balance,
    direction: row.direction,
    txnType: row.txnType,
    rail: row.rail,
    groupId: row.groupId,
    counterpartyName: row.counterpartyName,
    categoryName: row.categoryKey ?? null,
  }));
}

function friendly(error: unknown): string {
  if (error instanceof StatementError) {
    switch (error.code) {
      case "PASSWORD_REQUIRED": return "This statement is password-protected. Enter the password.";
      case "PASSWORD_INCORRECT": return "That password did not unlock the statement. Try again.";
      case "NO_TEXT_LAYER": return "This PDF is a scanned image. Scanned statements are not supported yet.";
      case "TOO_MANY_PAGES": return error.message;
      case "FILE_TOO_LARGE": return "Statements larger than 10 MB are not supported.";
      case "INVALID_FILE": return "This file is not a valid PDF.";
      case "UNSUPPORTED_STATEMENT": return error.message;
      default: return error.message;
    }
  }
  return error instanceof Error ? error.message : "Could not convert this statement.";
}

function download(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function MpesaStatementConverter() {
  const [files, setFiles] = useState<File[]>([]);
  const [password, setPassword] = useState("");
  const [converted, setConverted] = useState<ConvertedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const aggregate = useMemo(() => {
    const rows = converted.reduce((sum, file) => sum + file.analysis.summary.rowCount, 0);
    const totalIn = converted.reduce((sum, file) => sum.plus(file.analysis.summary.totalIn), new Decimal(0));
    const totalOut = converted.reduce((sum, file) => sum.plus(file.analysis.summary.totalOut), new Decimal(0));
    const fees = converted.reduce((sum, file) => sum.plus(file.analysis.summary.totalFees), new Decimal(0));
    const categories = new Map<string, Decimal>();
    for (const file of converted) {
      for (const category of file.analysis.categories) {
        categories.set(category.name, (categories.get(category.name) ?? new Decimal(0)).plus(category.totalOut));
      }
    }
    return {
      rows,
      totalIn: totalIn.toFixed(2),
      totalOut: totalOut.toFixed(2),
      fees: fees.toFixed(2),
      categories: [...categories.entries()]
        .map(([name, total]) => [name, total.toNumber()] as const)
        .sort((a, b) => b[1] - a[1]),
    };
  }, [converted]);

  async function convert() {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    setConverted([]);
    const results: ConvertedFile[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`Reading ${file.name} (${i + 1}/${files.length})…`);
        if (file.size > MAX_FILE_BYTES) {
          throw new Error(`${file.name} is larger than 10 MB.`);
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        const isCsv = file.name.toLowerCase().endsWith(".csv");
        let parsed;
        if (isCsv) {
          parsed = parseMpesaStatement(buildDelimitedDocument(new TextDecoder("utf-8").decode(bytes)));
        } else {
          // Loaded on demand so a pdf.js failure can never blank the page.
          const { extractPdfDocumentInBrowser } = await import("@shared/statements/extract/pdf-browser");
          const doc = await extractPdfDocumentInBrowser(bytes, {
            password: password.trim() || undefined,
            workerSrc,
          });
          parsed = parseMpesaStatement(doc);
        }
        if (parsed.rows.length === 0) {
          throw new Error(`No transactions were found in ${file.name}.`);
        }
        const analysis = buildStatementAnalysis(parsed, {
          duplicateCount: 0,
          categoryOf: (row) => ({
            id: null,
            name: row.categoryKey ? CATEGORY_KEY_LABELS[row.categoryKey] ?? row.categoryKey : "No category",
          }),
        });
        results.push({ fileName: file.name, parsed, analysis });
      }
      setConverted(results);
    } catch (conversionError) {
      setError(friendly(conversionError));
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  function downloadCsv() {
    const rows = converted.flatMap((file) => toExportRows(file.parsed));
    const paybill = converted.some((file) => file.parsed.kind === "mobile_money_paybill");
    const csv = buildStatementCsv(rows, { sortOrder: "asc", paybillColumns: paybill });
    download(`mpesa-statement-${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
  }

  function downloadJson() {
    const payload = {
      generatedAt: new Date().toISOString(),
      files: converted.map((file) => ({
        meta: {
          fileName: file.fileName,
          provider: file.parsed.provider,
          kind: file.parsed.kind,
          periodStart: file.parsed.metadata.periodStart ?? null,
          periodEnd: file.parsed.metadata.periodEnd ?? null,
        },
        totals: file.parsed.totals,
        statementSummary: file.parsed.statementSummary ?? null,
        transactions: toExportRows(file.parsed),
        analysis: file.analysis,
      })),
    };
    download(
      `mpesa-statement-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      "application/json",
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2D2A26]">
      <ToolHeader active="converter" />

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#C73E1D]">Free tool · no account</p>
          <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-[#2D2A26] sm:text-4xl">
            M-PESA statement to CSV
          </h1>
          <p className="mt-3 text-[#5C5853]">
            Unlock an M-PESA statement PDF and download a clean CSV or JSON. Everything runs in your browser —
            the file and password never leave your device.
          </p>
          <p className="mt-3 flex items-center gap-2 text-sm text-[#2E7D32]">
            <ShieldCheck className="h-4 w-4" /> Processed on this device. Nothing uploaded, nothing stored.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-xl border border-[#E8E0D8] bg-white p-5">
            <div className="rounded-lg border border-dashed border-[#D4A854] bg-[#F5EDE6]/50 p-4">
              <div className="flex items-start gap-3">
                <Upload className="mt-0.5 h-5 w-5 text-[#C73E1D]" />
                <div className="min-w-0 flex-1">
                  <Label className="text-sm font-medium">M-PESA statement PDFs or CSV</Label>
                  <p className="mt-1 text-xs text-[#8D8A87]">Personal or paybill statements, PDF or CSV. Up to 12 files, 10 MB each.</p>
                  <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#C73E1D] px-3 py-2 text-sm font-medium text-white hover:bg-[#C73E1D]/90">
                    <FileText className="h-4 w-4" />
                    Choose files
                    <input
                      type="file"
                      accept="application/pdf,.pdf,text/csv,.csv"
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        setFiles(Array.from(event.target.files ?? []));
                        setConverted([]);
                        setError(null);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <p className="mt-2 text-xs text-[#8D8A87]">
                    {files.length > 0 ? files.map((file) => file.name).join(", ") : "No files selected"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Label className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Password (PDF only)</Label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Usually your national ID or phone number"
                autoComplete="off"
              />
            </div>

            <Button
              className="mt-4 w-full bg-[#C73E1D] hover:bg-[#C73E1D]/90"
              disabled={files.length === 0 || busy}
              onClick={() => void convert()}
            >
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {progress || "Converting…"}</> : "Convert statement"}
            </Button>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            {converted.length > 0 && (
              <div className="mt-5 space-y-3">
                <div className="flex items-center gap-2 text-sm text-[#2E7D32]">
                  <CheckCircle2 className="h-4 w-4" />
                  {converted.length} file{converted.length === 1 ? "" : "s"} converted · {aggregate.rows} transactions
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-[#F5EDE6] p-2">
                    <p className="text-xs uppercase tracking-wider text-[#8D8A87]">In</p>
                    <p className="font-mono text-sm font-semibold text-[#2E7D32]">{formatKES(aggregate.totalIn)}</p>
                  </div>
                  <div className="rounded-lg bg-[#F5EDE6] p-2">
                    <p className="text-xs uppercase tracking-wider text-[#8D8A87]">Out</p>
                    <p className="font-mono text-sm font-semibold text-[#D32F2F]">{formatKES(aggregate.totalOut)}</p>
                  </div>
                  <div className="rounded-lg bg-[#F5EDE6] p-2">
                    <p className="text-xs uppercase tracking-wider text-[#8D8A87]">Fees</p>
                    <p className="font-mono text-sm font-semibold text-[#8D6E00]">{formatKES(aggregate.fees)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={downloadCsv} className="bg-[#2D2A26] hover:bg-[#2D2A26]/90">
                    <Download className="mr-2 h-4 w-4" /> CSV
                  </Button>
                  <Button variant="outline" onClick={downloadJson}>
                    <Download className="mr-2 h-4 w-4" /> JSON
                  </Button>
                </div>
                <p className="text-xs text-[#8D8A87]">
                  The CSV opens directly in Excel or Google Sheets (UTF-8 BOM, plain amounts).
                </p>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="rounded-xl border border-[#E8E0D8] bg-white p-5">
              <h2 className="font-serif text-lg font-semibold">What you get</h2>
              <ul className="mt-3 space-y-2 text-sm text-[#5C5853]">
                <li>· Every transaction with receipt, time, details, paid in, withdrawn and running balance</li>
                <li>· Charges kept as their own rows, so fee totals are explicit</li>
                <li>· A financial summary, category hints and balance checks</li>
                <li>· CSV for Excel/Sheets, JSON for scripts and integrations</li>
              </ul>
            </div>
            <div className="rounded-xl border border-[#E8E0D8] bg-white p-5">
              <h2 className="font-serif text-lg font-semibold">Need categories and books?</h2>
              <p className="mt-2 text-sm text-[#5C5853]">
                Import the same statement into FinaFlow to categorise spending against your chart of accounts,
                reconcile the running balance and undo an import safely.
              </p>
              <Link to="/login" className="mt-3 inline-block text-sm font-medium text-[#C73E1D] hover:underline">
                Open FinaFlow →
              </Link>
            </div>
          </section>
        </div>

        {converted.length > 0 && aggregate.categories.length > 0 && (
          <section className="mt-8 rounded-xl border border-[#E8E0D8] bg-white p-5">
            <h2 className="font-serif text-lg font-semibold">Spending hints</h2>
            <p className="mt-1 text-xs text-[#8D8A87]">
              Merchant-based hints only; rows without a confident match stay uncategorised.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {aggregate.categories.slice(0, 10).map(([name, total]) => (
                <div key={name} className="flex items-center justify-between rounded-lg bg-[#F5EDE6] px-3 py-2 text-sm">
                  <span className="truncate">{name}</span>
                  <span className="font-mono text-[#5C5853]">{formatKES(total.toFixed(2))}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8 rounded-xl border border-[#E8E0D8] bg-white p-5">
          <h2 className="font-serif text-lg font-semibold">How to get your statement</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[#5C5853]">
            <li>Open the M-PESA app → Statements → Generate Statement.</li>
            <li>Choose the period and request the PDF. Safaricom emails it or saves it to your phone.</li>
            <li>Use the password from the message (usually your national ID or phone number).</li>
            <li>Select the PDF above and convert. Nothing is uploaded.</li>
          </ol>
        </section>
      </main>

      <footer className="border-t border-[#E8E0D8] bg-white py-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 text-xs text-[#8D8A87]">
          <span>FinaFlow · statement tools</span>
          <div className="flex gap-3">
            <Link to="/tools/mpesa-to-excel" className="hover:text-[#2D2A26]">PDF to Excel</Link>
            <Link to="/tools/mpesa-for-accountants" className="hover:text-[#2D2A26]">For accountants</Link>
            <Link to="/" className="hover:text-[#2D2A26]">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
