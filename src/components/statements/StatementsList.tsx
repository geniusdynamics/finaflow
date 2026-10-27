// ABOUTME: Statement import history for the Wallet page: period, counts, status and safe undo.
// ABOUTME: Reads wallet.statements.imports and never exposes the original file or password.

import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { FileText, Loader2, RotateCcw, Eye, Trash2 } from "lucide-react";
import { StatementDetail } from "./StatementDetail";

interface Props {
  locationId: number | null;
  onChanged?: () => void;
}

interface ImportRecord {
  id: number;
  fileName: string | null;
  provider: string;
  periodStart: string | null;
  periodEnd: string | null;
  rowCount: number;
  importedCount: number;
  skippedCount: number;
  duplicateCount: number;
  status: string;
  createdAt: string | Date;
  errorMessage: string | null;
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

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

export function StatementsList({ locationId, onChanged }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [openImportId, setOpenImportId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const { data, refetch } = trpc.wallet.statements.imports.useQuery({
    locationId: locationId ?? undefined,
    limit: 50,
  });
  const { data: rules, refetch: refetchRules } = trpc.wallet.statements.categoryRules.list.useQuery();

  const deleteRule = trpc.wallet.statements.categoryRules.delete.useMutation({
    onSuccess: async () => {
      await refetchRules();
    },
    onError: (error) => setMessage(error.message),
  });

  const undo = trpc.wallet.statements.undo.useMutation({
    onSuccess: async (result) => {
      if (!result) {
        setMessage("Statement import not found.");
        return;
      }
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setMessage(`Removed ${result.deleted} imported transaction${result.deleted === 1 ? "" : "s"}.`);
      await Promise.all([
        refetch(),
        utils.wallet.transactions.list.invalidate(),
        utils.wallet.transactions.stats.invalidate(),
        utils.wallet.dailyLedger.list.invalidate(),
      ]);
      onChanged?.();
    },
    onError: (error) => setMessage(error.message),
  });

  function handleUndo(record: ImportRecord) {
    const confirmed = window.confirm(
      `Undo this import?\n\n${record.fileName ?? "Statement"} · ${record.importedCount} transactions\n\n` +
      "Imported wallet transactions will be removed. Links to expenses or bills block the undo.",
    );
    if (!confirmed) return;
    setMessage(null);
    undo.mutate({ importId: record.id });
  }

  const items = (data?.items ?? []) as ImportRecord[];

  return (
    <div className="space-y-3">
      {message && (
        <div className="rounded-lg bg-[#F5EDE6] px-3 py-2 text-sm text-[#2D2A26]">{message}</div>
      )}

      <Card className="border-[#E8E0D8] bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E8E0D8] text-left text-xs uppercase tracking-wider text-[#8D8A87]">
                  <th className="px-4 py-3 font-medium">Imported</th>
                  <th className="px-4 py-3 font-medium">File</th>
                  <th className="px-4 py-3 font-medium">Period</th>
                  <th className="px-4 py-3 text-right font-medium">Rows</th>
                  <th className="px-4 py-3 text-right font-medium">Imported</th>
                  <th className="px-4 py-3 text-right font-medium">Already existed</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((record) => (
                  <tr key={record.id} className="border-b border-[#E8E0D8] last:border-0 hover:bg-[#F5EDE6]/50">
                    <td className="px-4 py-3 text-sm text-[#2D2A26]">{formatDate(record.createdAt)}</td>
                    <td className="max-w-[220px] px-4 py-3">
                      <p className="truncate text-sm text-[#2D2A26]">{record.fileName ?? "Statement"}</p>
                      <p className="text-xs text-[#8D8A87]">{record.provider.toUpperCase()}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#8D8A87]">
                      {record.periodStart ?? "?"} → {record.periodEnd ?? "?"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-[#2D2A26]">{record.rowCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-[#2E7D32]">{record.importedCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-[#8D6E00]">{record.duplicateCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusClass(record.status)}`}>
                        {statusLabel(record.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setOpenImportId(record.id)}
                          className="border-[#D4A854] text-[#D4A854]"
                          title="Open analysis"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUndo(record)}
                          disabled={record.status !== "imported" || undo.isPending}
                          className="border-[#C73E1D] text-[#C73E1D]"
                          title="Undo import"
                        >
                          {undo.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#8D8A87]">
                      <FileText className="mx-auto mb-2 h-8 w-8 opacity-30" />
                      <p>No statements imported yet.</p>
                      <p className="mt-1 text-xs">Use Import to add an M-PESA or bank statement PDF.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {openImportId !== null && (
        <StatementDetail importId={openImportId} onClose={() => setOpenImportId(null)} />
      )}

      {rules && rules.length > 0 && (
        <div className="rounded-lg border border-[#E8E0D8] bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[#2D2A26]">Remembered merchants</h3>
            <span className="text-xs text-[#8D8A87]">{rules.length} rule{rules.length === 1 ? "" : "s"}</span>
          </div>
          <div className="space-y-1">
            {rules.slice(0, 20).map((rule) => (
              <div key={rule.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-[#2D2A26]">
                  {rule.pattern} <span className="text-[#8D8A87]">→ {rule.categoryName ?? "category"}</span>
                </span>
                <button
                  type="button"
                  onClick={() => deleteRule.mutate({ ruleId: rule.id })}
                  disabled={deleteRule.isPending}
                  className="rounded p-1 text-[#8D8A87] hover:bg-[#F5EDE6] hover:text-[#D32F2F]"
                  title="Forget this merchant"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
