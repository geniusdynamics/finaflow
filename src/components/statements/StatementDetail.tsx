// ABOUTME: Statement import detail: metadata, export buttons, frozen analysis and imported rows.
// ABOUTME: Exports are generated server-side and downloaded as files; nothing is stored in the browser.

import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { StatementAnalysisPanel } from "./StatementAnalysisPanel";
import { CategoryCell } from "./CategoryCell";
import { formatKES } from "@/lib/utils";
import { isStatementAnalysis, type StatementAnalysis } from "@shared/statements/analyze";
import type { ConsolidatedReport } from "@shared/statements/consolidate";
import { Download, FileSpreadsheet, FileText, Loader2, X } from "lucide-react";

interface Props {
  importId: number;
  onClose: () => void;
}

type ExportFormat = "csv" | "xlsx" | "json";

function downloadBase64(fileName: string, mimeType: string, base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function statusClass(status: string): string {
  switch (status) {
    case "imported":
      return "bg-[#2E7D32]/10 text-[#2E7D32]";
    case "failed":
      return "bg-[#D32F2F]/10 text-[#D32F2F]";
    case "rolled_back":
      return "bg-[#8D6E00]/10 text-[#8D6E00]";
    default:
      return "bg-[#C73E1D]/10 text-[#C73E1D]";
  }
}

export function StatementDetail({ importId, onClose }: Props) {
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [excludeCharges, setExcludeCharges] = useState(false);
  const [maskPii, setMaskPii] = useState(false);
  const [dateFormat, setDateFormat] = useState<"iso" | "dd-mmm-yyyy" | "dd/mm/yyyy">("iso");
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [reportBusy, setReportBusy] = useState<"pdf" | "xlsx" | "csv" | null>(null);
  const utils = trpc.useUtils();

  const { data, isPending } = trpc.wallet.statements.get.useQuery({ importId, limit: 200 });
  const { data: liveReport } = trpc.wallet.statements.analyze.useQuery({ importId });
  const { data: categories } = trpc.expenses.categories.useQuery();
  const rawAnalysis = liveReport?.analysis ?? data?.import.analysis ?? null;
  const analysis: StatementAnalysis | null = isStatementAnalysis(rawAnalysis) ? rawAnalysis : null;

  async function downloadReport(kind: "pdf" | "xlsx" | "csv") {
    if (!liveReport) return;
    setError(null);
    setReportBusy(kind);
    try {
      const report = liveReport as ConsolidatedReport;
      if (kind === "pdf") {
        const { saveConsolidatedPdf } = await import("@/lib/statements/consolidated-pdf");
        saveConsolidatedPdf(report);
      } else if (kind === "xlsx") {
        const { saveConsolidatedXlsx } = await import("@/lib/statements/analysis-export");
        await saveConsolidatedXlsx(report);
      } else {
        const { saveConsolidatedCsvBundle } = await import("@/lib/statements/analysis-export");
        await saveConsolidatedCsvBundle(report);
      }
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "Could not generate the report.");
    } finally {
      setReportBusy(null);
    }
  }

  async function exportFile() {
    setError(null);
    setExporting(true);
    try {
      const file = await utils.client.wallet.statements.export.query({
        importId,
        format,
        excludeCharges: format === "csv" ? excludeCharges : undefined,
        dateFormat: format === "csv" ? dateFormat : undefined,
        maskPii: format === "csv" ? maskPii : undefined,
        sortOrder: "asc",
      });
      downloadBase64(file.fileName, file.mimeType, file.base64);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  if (isPending) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-[#E8E0D8] bg-white p-8">
        <Loader2 className="h-5 w-5 animate-spin text-[#C73E1D]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-[#E8E0D8] bg-white p-6 text-sm text-[#8D8A87]">
        Statement import not found.
      </div>
    );
  }

  const record = data.import;

  return (
    <div className="space-y-5 rounded-lg border border-[#E8E0D8] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-serif text-lg text-[#2D2A26]">{record.fileName ?? `Statement ${record.id}`}</h3>
          <p className="text-sm text-[#8D8A87]">
            {record.provider.toUpperCase()} · {record.periodStart ?? "?"} → {record.periodEnd ?? "?"} ·{" "}
            {record.sourceType.toUpperCase()} · {record.parserId ?? "parser"} v{record.parserVersion ?? "?"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass(record.status)}`}>
            {record.status.replace(/_/g, " ")}
          </span>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close statement detail">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
        <div className="rounded-lg bg-[#F5EDE6] p-2">
          <p className="text-xs uppercase tracking-wider text-[#8D8A87]">Rows</p>
          <p className="font-mono font-semibold text-[#2D2A26]">{record.rowCount}</p>
        </div>
        <div className="rounded-lg bg-[#F5EDE6] p-2">
          <p className="text-xs uppercase tracking-wider text-[#8D8A87]">Imported</p>
          <p className="font-mono font-semibold text-[#2E7D32]">{record.importedCount}</p>
        </div>
        <div className="rounded-lg bg-[#F5EDE6] p-2">
          <p className="text-xs uppercase tracking-wider text-[#8D8A87]">Already existed</p>
          <p className="font-mono font-semibold text-[#8D6E00]">{record.duplicateCount}</p>
        </div>
        <div className="rounded-lg bg-[#F5EDE6] p-2">
          <p className="text-xs uppercase tracking-wider text-[#8D8A87]">Fees</p>
          <p className="font-mono font-semibold text-[#2D2A26]">{formatKES(analysis?.summary.totalFees ?? "0.00")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-[#E8E0D8] p-3">
        <label className="space-y-1 text-xs text-[#8D8A87]">
          <span className="block font-medium uppercase tracking-wider">Format</span>
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value as ExportFormat)}
            className="rounded border border-[#E8E0D8] px-2 py-1.5 text-sm text-[#2D2A26]"
          >
            <option value="csv">CSV</option>
            <option value="xlsx">Excel (XLSX)</option>
            <option value="json">JSON</option>
          </select>
        </label>

        {format === "csv" && (
          <>
            <label className="space-y-1 text-xs text-[#8D8A87]">
              <span className="block font-medium uppercase tracking-wider">Dates</span>
              <select
                value={dateFormat}
                onChange={(event) => setDateFormat(event.target.value as typeof dateFormat)}
                className="rounded border border-[#E8E0D8] px-2 py-1.5 text-sm text-[#2D2A26]"
              >
                <option value="iso">YYYY-MM-DD</option>
                <option value="dd-mmm-yyyy">DD MMM YYYY</option>
                <option value="dd/mm/yyyy">DD/MM/YYYY</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pb-1.5 text-sm text-[#2D2A26]">
              <input type="checkbox" checked={excludeCharges} onChange={(event) => setExcludeCharges(event.target.checked)} />
              Hide charges
            </label>
            <label className="flex items-center gap-2 pb-1.5 text-sm text-[#2D2A26]">
              <input type="checkbox" checked={maskPii} onChange={(event) => setMaskPii(event.target.checked)} />
              Mask phones
            </label>
          </>
        )}

        <Button onClick={() => void exportFile()} disabled={exporting} className="ml-auto bg-[#C73E1D] hover:bg-[#C73E1D]/90">
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Export
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#E8E0D8] p-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#2D2A26]">Full analysis report</p>
          <p className="text-xs text-[#8D8A87]">
            Consolidated analysis with live categories and tags, 13 report sheets and per-statement coverage.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!liveReport || reportBusy !== null}
          onClick={() => void downloadReport("pdf")}
        >
          {reportBusy === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
          PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!liveReport || reportBusy !== null}
          onClick={() => void downloadReport("xlsx")}
        >
          {reportBusy === "xlsx" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
          Excel
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!liveReport || reportBusy !== null}
          onClick={() => void downloadReport("csv")}
        >
          {reportBusy === "csv" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          CSV bundle
        </Button>
      </div>
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {analysis ? (
        <StatementAnalysisPanel analysis={analysis} />
      ) : (
        <p className="rounded bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          This import has no analysis snapshot. Re-import the statement to generate one.
        </p>
      )}

      <div>
        <h4 className="mb-2 text-sm font-medium text-[#2D2A26]">
          Imported rows <span className="text-xs font-normal text-[#8D8A87]">(first {data.rows.length} of {data.totalRows})</span>
        </h4>
        <div className="max-h-72 overflow-auto rounded-lg border border-[#E8E0D8]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#F5EDE6] text-left text-[#8D8A87]">
              <tr>
                <th className="px-2 py-1.5 font-medium">Date</th>
                <th className="px-2 py-1.5 font-medium">Receipt</th>
                <th className="px-2 py-1.5 font-medium">Details</th>
                <th className="px-2 py-1.5 text-right font-medium">Amount</th>
                <th className="px-2 py-1.5 font-medium">Category</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => {
                const amount = Math.abs(Number(row.amount));
                return (
                  <tr key={row.id} className="border-t border-[#E8E0D8]">
                    <td className="whitespace-nowrap px-2 py-1.5 text-[#8D8A87]">{row.txnDate} {row.txnTime ?? ""}</td>
                    <td className="px-2 py-1.5 font-mono text-[#8D8A87]">{row.providerRef ?? row.providerTxnId}</td>
                    <td className="max-w-[320px] truncate px-2 py-1.5 text-[#2D2A26]">{row.description}</td>
                    <td className={`whitespace-nowrap px-2 py-1.5 text-right font-mono ${row.direction === "in" ? "text-[#2E7D32]" : "text-[#D32F2F]"}`}>
                      {row.direction === "in" ? "+" : "-"}{formatKES(amount.toFixed(2))}
                    </td>
                    <td className="px-2 py-1.5 text-[#8D8A87]">
                      <CategoryCell
                        walletTxnId={row.id}
                        categoryId={row.categoryId ?? null}
                        categoryName={row.categoryName ?? null}
                        partyName={row.partyName ?? null}
                        description={row.description ?? null}
                        categories={categories}
                        onSaved={() => {
                          void utils.wallet.statements.get.invalidate({ importId, limit: 200 });
                          void utils.wallet.statements.analyze.invalidate({ importId });
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
