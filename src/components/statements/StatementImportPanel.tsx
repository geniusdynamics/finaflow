// ABOUTME: Statement import panel: file capture, password retry, preview and import for M-PESA PDFs.
// ABOUTME: Uses the shared parser through tRPC; files are held in the browser and never persisted server-side.

import { useMemo, useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocationSelector } from "@/components/LocationSelector";
import { formatKES } from "@/lib/utils";
import type { StatementAnalysis } from "@shared/statements/analyze";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Lock,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

interface PreviewRow {
  externalId: string;
  date: string;
  time: string | null;
  details: string;
  direction: "in" | "out";
  amount: string;
  suggestedCategoryId: number | null;
  suggestedCategoryName: string | null;
  alreadyImported: boolean;
}

interface Preview {
  fileName: string;
  provider: string;
  kind: string;
  sourceType: "pdf" | "csv";
  metadata: { periodStart?: string; periodEnd?: string };
  totals: { rowCount: number; totalIn: string; totalOut: string; totalFees: string };
  warnings: string[];
  rowsTotal: number;
  duplicateCount: number;
  byCategory: Array<{ key: string; count: number }>;
  rows: PreviewRow[];
  analysis: StatementAnalysis;
}

interface FileEntry {
  file: File;
  status: "pending" | "parsing" | "ready" | "error";
  preview?: Preview;
  code?: string;
  message?: string;
  /** Password that actually unlocked this file, reused at import time. */
  password?: string;
  /** externalId -> categoryId (null = explicitly no category). */
  overrides: Record<string, number | null>;
  /** externalIds the user chose to leave out of the import. */
  exclude: string[];
}

interface ImportFileResult {
  importId: number | null;
  fileName: string;
  status: "imported" | "failed";
  code?: string;
  error?: string;
  rowCount: number;
  imported: number;
  skipped: number;
  duplicates: number;
  excluded: number;
  warnings: string[];
  totals: { rowCount: number; totalIn: string; totalOut: string; totalFees: string } | null;
}

interface Props {
  locations: Array<{ id: number; name: string }> | undefined;
  locationId: number | null;
  onLocationChange: (value: string) => void;
  assignedLocationIds?: number[];
  enforceAssigned?: boolean;
  onImported?: () => void;
  fullPage?: boolean;
  /** "bank" changes the copy and offers an optional bank-account link. */
  mode?: "mobile" | "bank";
  bankAccounts?: Array<{ id: number; name: string; accountNumber?: string | null; locationId?: number | null }>;
}

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function friendlyError(code?: string, message?: string): string {
  switch (code) {
    case "PASSWORD_REQUIRED":
      return "This statement is password-protected. Enter the password below.";
    case "PASSWORD_INCORRECT":
      return "That password did not unlock the statement. Try again.";
    case "NO_TEXT_LAYER":
      return "This PDF is a scanned image. Scanned statements are not supported yet.";
    case "TOO_MANY_PAGES":
      return message ?? "This statement is too large. Split it into smaller files.";
    case "UNSUPPORTED_STATEMENT":
      return message ?? "This statement format is not recognised.";
    case "FILE_TOO_LARGE":
      return "Statements larger than 10 MB are not supported.";
    case "INVALID_FILE":
      return message ?? "This file is not a valid PDF.";
    default:
      return message ?? "Could not read this statement.";
  }
}

function isPasswordError(code?: string): boolean {
  return code === "PASSWORD_REQUIRED" || code === "PASSWORD_INCORRECT";
}

export function StatementImportPanel({
  locations,
  locationId,
  onLocationChange,
  assignedLocationIds,
  enforceAssigned,
  onImported,
  fullPage,
  mode = "mobile",
  bankAccounts = [],
}: Props) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [password, setPassword] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [results, setResults] = useState<ImportFileResult[] | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  const isBank = mode === "bank";
  const availableBankAccounts = bankAccounts.filter(
    (account) => !locationId || !account.locationId || account.locationId === locationId,
  );

  const utils = trpc.useUtils();
  const { data: categories } = trpc.expenses.categories.useQuery();
  const parseMutation = trpc.wallet.statements.parse.useMutation();
  const importMutation = trpc.wallet.statements.import.useMutation();

  const isParsing = files.some((entry) => entry.status === "parsing");
  const ready = files.length > 0 && files.every((entry) => entry.status === "ready");
  const needsPassword = files.some((entry) => isPasswordError(entry.code));

  const aggregate = useMemo(() => {
    const previews = files.map((entry) => entry.preview).filter((p): p is Preview => Boolean(p));
    const rows = previews.reduce((sum, p) => sum + p.totals.rowCount, 0);
    const duplicates = previews.reduce((sum, p) => sum + p.duplicateCount, 0);
    const categories = new Map<string, number>();
    for (const preview of previews) {
      for (const item of preview.byCategory) {
        categories.set(item.key, (categories.get(item.key) ?? 0) + item.count);
      }
    }
    return {
      files: previews.length,
      rows,
      duplicates,
      excluded: files.reduce((sum, entry) => sum + entry.exclude.length, 0),
      categories: [...categories.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [files]);

  async function parseEntry(file: File, passwordOverride?: string) {
    if (!locationId) {
      setBatchError("Select a location before importing a statement.");
      return;
    }
    const effectivePassword = (passwordOverride ?? password).trim();
    if (file.size > MAX_FILE_BYTES) {
      setFiles((prev) =>
        prev.map((entry) =>
          entry.file === file
            ? { ...entry, status: "error", code: "FILE_TOO_LARGE", message: friendlyError("FILE_TOO_LARGE") }
            : entry,
        ),
      );
      return;
    }

    setFiles((prev) =>
      prev.map((entry) => (entry.file === file ? { ...entry, status: "parsing", message: undefined } : entry)),
    );

    try {
      const fileBase64 = await toBase64(file);
      const result = await parseMutation.mutateAsync({
        locationId,
        fileName: file.name,
        fileBase64,
        password: effectivePassword || undefined,
        accountId: isBank && bankAccountId ? Number(bankAccountId) : undefined,
      });

      setFiles((prev) =>
        prev.map((entry) => {
          if (entry.file !== file) return entry;
          if (result.ok) {
            return {
              ...entry,
              status: "ready",
              preview: result.preview as Preview,
              code: undefined,
              message: undefined,
              password: effectivePassword || undefined,
            };
          }
          return {
            ...entry,
            status: "error",
            code: result.code,
            message: friendlyError(result.code, result.message),
            password: effectivePassword || undefined,
          };
        }),
      );
    } catch (error) {
      setFiles((prev) =>
        prev.map((entry) =>
          entry.file === file
            ? {
                ...entry,
                status: "error",
                code: "PARSE_FAILED",
                message: error instanceof Error ? error.message : "Could not read this statement.",
              }
            : entry,
        ),
      );
    }
  }

  function addFiles(selected: FileList | null) {
    if (!selected) return;
    if (!locationId) {
      setBatchError("Select a location before adding a statement.");
      return;
    }
    const next = Array.from(selected).map<FileEntry>((file) => ({
      file,
      status: "pending",
      overrides: {},
      exclude: [],
    }));
    setFiles((prev) => [...prev, ...next]);
    setResults(null);
    setBatchError(null);
    void (async () => {
      for (const entry of next) {
        await parseEntry(entry.file);
      }
    })();
  }

  function removeFile(file: File) {
    setFiles((prev) => prev.filter((entry) => entry.file !== file));
    setResults(null);
  }

  function toggleExcluded(file: File, externalId: string) {
    setFiles((prev) =>
      prev.map((entry) => {
        if (entry.file !== file) return entry;
        const excluded = entry.exclude.includes(externalId);
        return {
          ...entry,
          exclude: excluded
            ? entry.exclude.filter((id) => id !== externalId)
            : [...entry.exclude, externalId],
        };
      }),
    );
  }

  function setCategoryOverride(file: File, externalId: string, value: string) {
    const categoryId = value === "" ? null : Number(value);
    setFiles((prev) =>
      prev.map((entry) =>
        entry.file === file
          ? { ...entry, overrides: { ...entry.overrides, [externalId]: categoryId } }
          : entry,
      ),
    );
  }

  async function retryWithPassword() {
    const failed = files.filter((entry) => isPasswordError(entry.code));
    for (const entry of failed) {
      await parseEntry(entry.file, password);
    }
  }

  async function importAll() {
    if (!locationId || files.length === 0) return;
    setBatchError(null);
    try {
      const payload: Array<{
        fileName: string;
        fileBase64: string;
        password?: string;
        accountId?: number;
        overrides?: Record<string, number | null>;
        exclude?: string[];
      }> = [];
      for (const entry of files) {
        payload.push({
          fileName: entry.file.name,
          fileBase64: await toBase64(entry.file),
          password: entry.password ?? (password.trim() || undefined),
          accountId: isBank && bankAccountId ? Number(bankAccountId) : undefined,
          overrides: Object.keys(entry.overrides).length > 0 ? entry.overrides : undefined,
          exclude: entry.exclude.length > 0 ? entry.exclude : undefined,
        });
      }
      const result = await importMutation.mutateAsync({ locationId, files: payload });
      setResults(result.files as ImportFileResult[]);
      await Promise.all([
        utils.wallet.transactions.list.invalidate(),
        utils.wallet.transactions.stats.invalidate(),
        utils.wallet.statements.imports.invalidate(),
        utils.wallet.dailyLedger.list.invalidate(),
      ]);
      onImported?.();
    } catch (error) {
      setBatchError(error instanceof Error ? error.message : "Import failed.");
    }
  }

  const importedTotal = results?.reduce((sum, file) => sum + file.imported, 0) ?? 0;

  return (
    <div className={fullPage ? "space-y-6" : "space-y-4"}>
      <div className="space-y-2">
        <LocationSelector
          locations={locations}
          assignedLocationIds={assignedLocationIds ?? []}
          value={locationId ? String(locationId) : ""}
          onChange={(e) => onLocationChange(e)}
          enforceAssigned={enforceAssigned}
        />
        {locations && locations.length === 0 && (
          <p className="text-xs text-[#D32F2F]">No locations found for this business. Create one in Settings first.</p>
        )}
      </div>

      {isBank && (
        <div className="space-y-2">
          <Label>Bank account</Label>
          <select
            value={bankAccountId}
            onChange={(event) => setBankAccountId(event.target.value)}
            className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm"
          >
            <option value="">Link later / not specified</option>
            {availableBankAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}{account.accountNumber ? ` (${account.accountNumber})` : ""}
              </option>
            ))}
          </select>
          {availableBankAccounts.length === 0 ? (
            <p className="text-xs text-[#8D8A87]">
              No bank accounts yet. <Link to="/accounts" className="text-[#C73E1D] hover:underline">Add one in Accounts</Link> to link imported rows.
            </p>
          ) : (
            <p className="text-xs text-[#8D8A87]">
              Optional: links imported transactions to the selected bank account for reconciliation.
            </p>
          )}
        </div>
      )}

      <div className="rounded-lg border border-dashed border-[#D4A854] bg-[#F5EDE6]/40 p-4">
        <div className="flex items-start gap-3">
          <Upload className="mt-0.5 h-5 w-5 text-[#C73E1D]" />
          <div className="min-w-0 flex-1">
            <Label className="text-sm font-medium text-[#2D2A26]">
              {isBank ? "Bank statement PDFs" : "M-PESA statement PDFs or CSV"}
            </Label>
            <p className="mt-1 text-xs text-[#8D8A87]">
              {isBank
                ? "Drop one or more bank statement PDFs (up to 12, 10 MB each). KCB online statements are supported today; more banks are coming."
                : "Drop one or more PDF or CSV statements (up to 12, 10 MB each). Files are parsed in memory and never stored."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#C73E1D] px-3 py-2 text-sm font-medium text-white hover:bg-[#C73E1D]/90 ${!locationId ? "cursor-not-allowed opacity-50" : ""}`}>
                <FileText className="h-4 w-4" />
                Choose files
                <input
                  type="file"
                  accept={isBank ? "application/pdf,.pdf" : "application/pdf,.pdf,text/csv,.csv"}
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              <span className="text-xs text-[#8D8A87]">
                {files.length > 0 ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "No files selected"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" /> Statement password {isBank ? "(if any)" : ""}
        </Label>
        <div className="flex gap-2">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isBank ? "Leave empty if the PDF is not protected" : "Usually your national ID or phone number"}
            autoComplete="off"
          />
          {needsPassword && (
            <Button type="button" variant="outline" onClick={() => void retryWithPassword()} disabled={isParsing}>
              Retry
            </Button>
          )}
        </div>
        <p className="flex items-center gap-1 text-xs text-[#8D8A87]">
          <ShieldCheck className="h-3.5 w-3.5" /> The password is used once to unlock the PDF and is never stored.
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((entry) => (
            <div key={`${entry.file.name}-${entry.file.size}-${entry.file.lastModified}`} className="rounded-lg border border-[#E8E0D8] bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#2D2A26]">{entry.file.name}</p>
                  <p className="text-xs text-[#8D8A87]">
                    {(entry.file.size / 1024 / 1024).toFixed(2)} MB
                    {entry.preview ? ` · ${entry.preview.sourceType.toUpperCase()}` : ""}
                    {entry.preview ? ` · ${entry.preview.totals.rowCount} rows · ${entry.preview.metadata.periodStart ?? "?"} → ${entry.preview.metadata.periodEnd ?? "?"}` : ""}
                    {entry.preview ? ` · duplicate rows: ${entry.preview.duplicateCount}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {entry.status === "parsing" && <Loader2 className="h-4 w-4 animate-spin text-[#D4A854]" />}
                  {entry.status === "ready" && <CheckCircle2 className="h-4 w-4 text-[#2E7D32]" />}
                  {entry.status === "error" && <AlertCircle className="h-4 w-4 text-[#D32F2F]" />}
                  <button
                    type="button"
                    onClick={() => removeFile(entry.file)}
                    className="rounded p-1 text-[#8D8A87] hover:bg-[#F5EDE6] hover:text-[#2D2A26]"
                    aria-label={`Remove ${entry.file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {entry.status === "error" && (
                <p className="mt-2 rounded bg-red-50 px-2 py-1.5 text-xs text-red-700">{entry.message}</p>
              )}

              {entry.preview && entry.preview.warnings.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-[#8D6E00]">
                  {entry.preview.warnings.slice(0, 3).map((warning, index) => (
                    <li key={index}>· {warning}</li>
                  ))}
                </ul>
              )}

              {entry.preview && (
                <p
                  className={`mt-2 text-xs ${
                    entry.preview.analysis.reconciliation.matches ? "text-[#2E7D32]" : "text-[#8D6E00]"
                  }`}
                >
                  {entry.preview.analysis.reconciliation.matches
                    ? "Statement summary reconciles to the cent."
                    : "Statement summary differs — review before importing."}
                  {" · "}
                  {entry.preview.analysis.balance.continuity.unexplained} balance steps to review.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {ready && aggregate.files > 0 && (
        <div className="space-y-3 rounded-lg bg-[#F5EDE6] p-3">
          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
            <div>
              <p className="text-xs uppercase tracking-wider text-[#8D8A87]">Files</p>
              <p className="font-mono font-semibold text-[#2D2A26]">{aggregate.files}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[#8D8A87]">Rows</p>
              <p className="font-mono font-semibold text-[#2D2A26]">{aggregate.rows}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[#8D8A87]">Excluded</p>
              <p className="font-mono font-semibold text-[#8D6E00]">{aggregate.excluded}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[#8D8A87]">Already imported</p>
              <p className="font-mono font-semibold text-[#8D6E00]">{aggregate.duplicates}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[#8D8A87]">Ready</p>
              <p className="font-mono font-semibold text-[#2E7D32]">Yes</p>
            </div>
          </div>

          {aggregate.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {aggregate.categories.slice(0, 8).map(([key, count]) => (
                <span key={key} className="rounded-full bg-white px-2 py-0.5 text-xs text-[#2D2A26]">
                  {key} · {count}
                </span>
              ))}
            </div>
          )}

          <div className="space-y-3">
            {files
              .filter((entry) => entry.preview)
              .map((entry) => (
                <div
                  key={`${entry.file.name}-${entry.file.size}-${entry.file.lastModified}`}
                  className="overflow-hidden rounded border border-[#E8E0D8] bg-white"
                >
                  <div className="flex items-center justify-between gap-2 bg-[#F5EDE6] px-2 py-1.5 text-xs">
                    <span className="truncate font-medium text-[#2D2A26]">{entry.file.name}</span>
                    <span className="shrink-0 text-[#8D8A87]">
                      {entry.preview!.rows.length} shown of {entry.preview!.rowsTotal}
                      {entry.exclude.length > 0 ? ` · ${entry.exclude.length} excluded` : ""}
                    </span>
                  </div>
                  <div className="max-h-56 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white text-left text-[#8D8A87]">
                        <tr className="border-b border-[#E8E0D8]">
                          <th className="px-2 py-1.5 font-medium">In</th>
                          <th className="px-2 py-1.5 font-medium">Date</th>
                          <th className="px-2 py-1.5 font-medium">Details</th>
                          <th className="px-2 py-1.5 text-right font-medium">Amount</th>
                          <th className="px-2 py-1.5 font-medium">Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.preview!.rows.map((row) => {
                          const included = !entry.exclude.includes(row.externalId);
                          const selected = Object.prototype.hasOwnProperty.call(entry.overrides, row.externalId)
                            ? entry.overrides[row.externalId]
                            : row.suggestedCategoryId;
                          return (
                            <tr
                              key={`${entry.file.name}-${row.externalId}`}
                              className={`border-t border-[#E8E0D8] ${included ? "" : "opacity-50"}`}
                            >
                              <td className="px-2 py-1.5">
                                <input
                                  type="checkbox"
                                  checked={included}
                                  onChange={() => toggleExcluded(entry.file, row.externalId)}
                                  aria-label={`Include ${row.externalId}`}
                                />
                              </td>
                              <td className="whitespace-nowrap px-2 py-1.5 text-[#8D8A87]">{row.date}</td>
                              <td className="max-w-[300px] truncate px-2 py-1.5 text-[#2D2A26]">{row.details}</td>
                              <td className={`whitespace-nowrap px-2 py-1.5 text-right font-mono ${row.direction === "in" ? "text-[#2E7D32]" : "text-[#D32F2F]"}`}>
                                {row.direction === "in" ? "+" : "-"}
                                {formatKES(row.amount)}
                              </td>
                              <td className="px-2 py-1.5">
                                <select
                                  value={selected === null || selected === undefined ? "" : String(selected)}
                                  onChange={(event) => setCategoryOverride(entry.file, row.externalId, event.target.value)}
                                  disabled={!included}
                                  className="max-w-[170px] rounded border border-[#E8E0D8] px-1.5 py-1 text-xs text-[#2D2A26]"
                                  aria-label={`Category for ${row.externalId}`}
                                >
                                  <option value="">No category</option>
                                  {(categories ?? []).map((category) => (
                                    <option key={category.id} value={category.id}>{category.name}</option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
          </div>
          <p className="text-xs text-[#8D8A87]">
            Showing up to 200 rows per file. Untick anything you do not want, and adjust categories before importing.
            Later changes stay available in Wallet → Transactions.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => void importAll()}
          disabled={!locationId || !ready || isParsing || importMutation.isPending}
          className="bg-[#C73E1D] hover:bg-[#C73E1D]/90"
        >
          {importMutation.isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing…</>
          ) : (
            <><Upload className="mr-2 h-4 w-4" /> Import {aggregate.rows - aggregate.excluded > 0 ? `${aggregate.rows - aggregate.excluded} rows` : "statement"}</>
          )}
        </Button>
        {files.length > 0 && (
          <Button
            variant="ghost"
            onClick={() => {
              setFiles([]);
              setResults(null);
              setBatchError(null);
            }}
            disabled={importMutation.isPending}
          >
            Clear
          </Button>
        )}
      </div>

      {batchError && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{batchError}</div>
      )}

      {results && (
        <div className={`space-y-2 rounded-lg p-3 ${importedTotal > 0 ? "bg-green-50" : "bg-yellow-50"}`}>
          <p className={`text-sm font-medium ${importedTotal > 0 ? "text-green-700" : "text-yellow-700"}`}>
            {importedTotal > 0
              ? `Imported ${importedTotal} transaction${importedTotal === 1 ? "" : "s"} from ${results.length} file${results.length === 1 ? "" : "s"}.`
              : "No new transactions were imported."}
          </p>
          <ul className="space-y-1 text-xs text-[#2D2A26]">
            {results.map((file) => (
              <li key={file.fileName}>
                {file.fileName}: {file.status === "imported"
                  ? `${file.imported} imported · ${file.duplicates} already existed · ${file.skipped} skipped`
                  : `failed — ${file.error ?? "unknown error"}`}
              </li>
            ))}
          </ul>
          {importedTotal > 0 && (
            <p className="text-xs text-[#8D8A87]">
              Rows are now in Wallet → Transactions and the Statements tab. Undo is available there.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
