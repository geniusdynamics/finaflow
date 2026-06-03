// ABOUTME: Journal Entries management page for double-entry bookkeeping
import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { formatKES } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, BookOpen, CheckCircle, XCircle, RotateCcw, Trash2, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export function JournalEntries({ embedded }: { embedded?: boolean }) {
  const [page, setPage] = useState(1);
  const [isPosted, setIsPosted] = useState<boolean | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const { user } = useAuth();
  const businessId = user?.currentBusinessId ?? null;

  const journalQuery = trpc.journal.list.useQuery({
    businessId: businessId || 0,
    page,
    pageSize: 20,
    isPosted,
  }, { enabled: !!businessId });

  const utils = trpc.useUtils();
  const selectedEntryQuery = trpc.journal.getById.useQuery(
    businessId && selectedEntryId ? { id: selectedEntryId, businessId } : undefined!,
    { enabled: !!businessId && selectedEntryId !== null }
  );

  const postMutation = trpc.journal.post.useMutation({
    onSuccess: () => {
      toast.success("Journal entry posted");
      utils.journal.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const reverseMutation = trpc.journal.reverse.useMutation({
    onSuccess: () => {
      toast.success("Journal entry reversed");
      utils.journal.list.invalidate();
      setSelectedEntryId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const entries = journalQuery.data?.entries || [];
  const total = journalQuery.data?.total || 0;
  const totalPages = journalQuery.data?.totalPages || 1;

  const viewDetails = (id: number) => {
    setSelectedEntryId(id);
  };

  const content = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Journal Entries</h1>
          <p className="mt-1 text-sm text-[#8D8A87]">Double-entry bookkeeping</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#C73E1D] hover:bg-[#A33318]">
              <Plus className="h-4 w-4 mr-2" /> New Journal Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Create Journal Entry</DialogTitle>
            </DialogHeader>
            {businessId ? (
              <JournalEntryForm onSuccess={() => setCreateOpen(false)} businessId={businessId} />
            ) : (
              <p className="text-sm text-[#8D8A87]">Select an active business before creating journal entries.</p>
            )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={isPosted === undefined ? "default" : "outline"}
            onClick={() => { setIsPosted(undefined); setPage(1); }}
            className={isPosted === undefined ? "bg-[#C73E1D]" : ""}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={isPosted === true ? "default" : "outline"}
            onClick={() => { setIsPosted(true); setPage(1); }}
            className={isPosted === true ? "bg-[#C73E1D]" : ""}
          >
            Posted
          </Button>
          <Button
            size="sm"
            variant={isPosted === false ? "default" : "outline"}
            onClick={() => { setIsPosted(false); setPage(1); }}
            className={isPosted === false ? "bg-[#C73E1D]" : ""}
          >
            Draft
          </Button>
        </div>

        {/* Loading State */}
        {journalQuery.isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#C73E1D] border-t-transparent" />
          </div>
        )}

        {/* Error State */}
        {journalQuery.error && (
          <div className="rounded-lg border border-[#D32F2F]/30 bg-[#D32F2F]/5 p-4 text-sm text-[#D32F2F]">
            Failed to load journal entries: {journalQuery.error.message}
          </div>
        )}

        {/* Entries List */}
        {!journalQuery.isLoading && (
          <div className="space-y-3">
            {entries.length === 0 ? (
              <Card className="border-[#E8E0D8]">
                <CardContent className="flex flex-col items-center justify-center py-12 text-[#8D8A87]">
                  <BookOpen className="h-12 w-12 mb-4 opacity-50" />
                  <p>No journal entries found</p>
                </CardContent>
              </Card>
            ) : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              entries.map((entry: any) => (
                <Card key={entry.id} className="border-[#E8E0D8] hover:border-[#C73E1D]/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-semibold">{entry.entryNumber}</span>
                          {entry.isPosted ? (
                            <span className="flex items-center gap-1 rounded-full bg-[#2E7D32]/10 px-2 py-0.5 text-xs text-[#2E7D32]">
                              <CheckCircle className="h-3 w-3" /> Posted
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 rounded-full bg-[#ED6C02]/10 px-2 py-0.5 text-xs text-[#ED6C02]">
                              <XCircle className="h-3 w-3" /> Draft
                            </span>
                          )}
                          {entry.isReversed && (
                            <span className="flex items-center gap-1 rounded-full bg-[#D32F2F]/10 px-2 py-0.5 text-xs text-[#D32F2F]">
                              <RotateCcw className="h-3 w-3" /> Reversed
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-[#2D2A26]">{entry.description}</p>
                        <p className="mt-1 text-xs text-[#8D8A87]">
                          {entry.entryDate} {entry.reference ? `• ${entry.reference}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => viewDetails(entry.id)}
                        >
                          View
                        </Button>
                        {!entry.isPosted && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => businessId && postMutation.mutate({ id: entry.id, businessId })}
                            disabled={postMutation.isPending}
                          >
                            Post
                          </Button>
                        )}
                        {entry.isPosted && !entry.isReversed && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => businessId && reverseMutation.mutate({ id: entry.id, businessId })}
                            disabled={reverseMutation.isPending}
                          >
                            Reverse
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#8D8A87]">
              Page {page} of {totalPages} ({total} entries)
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Entry Details Dialog */}
        {selectedEntryId && (
          <Dialog open={!!selectedEntryId} onOpenChange={() => setSelectedEntryId(null)}>
            <DialogContent className="bg-white max-w-2xl">
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">
                  Journal Entry: {selectedEntryQuery.data?.entry?.entryNumber}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[#8D8A87]">Date:</span>
                    <span className="ml-2 font-medium">{selectedEntryQuery.data?.entry?.entryDate}</span>
                  </div>
                  <div>
                    <span className="text-[#8D8A87]">Status:</span>
                    <span className={`ml-2 font-medium ${selectedEntryQuery.data?.entry?.isPosted ? "text-[#2E7D32]" : "text-[#ED6C02]"}`}>
                      {selectedEntryQuery.data?.entry?.isPosted ? "Posted" : "Draft"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[#8D8A87]">Description:</span>
                    <span className="ml-2 font-medium">{selectedEntryQuery.data?.entry?.description}</span>
                  </div>
                  {selectedEntryQuery.data?.entry?.reference && (
                    <div>
                      <span className="text-[#8D8A87]">Reference:</span>
                      <span className="ml-2 font-medium">{selectedEntryQuery.data?.entry?.reference}</span>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <h4 className="mb-2 font-semibold">Journal Lines</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Account</th>
                        <th className="text-right py-2">Debit</th>
                        <th className="text-right py-2">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}                      {selectedEntryQuery.data?.lines?.map((line: any, idx: number) => (
                        <tr key={idx} className="border-b">
                          <td className="py-2">
                            <div className="font-medium">{line.accountName || `Account #${line.accountId}`}</div>
                            {line.accountCode && <div className="text-xs text-[#8D8A87]">{line.accountCode}</div>}
                          </td>
                          <td className="text-right font-mono py-2">
                            {parseFloat(line.debit) > 0 ? formatKES(line.debit) : ""}
                          </td>
                          <td className="text-right font-mono py-2">
                            {parseFloat(line.credit) > 0 ? formatKES(line.credit) : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
  );

  if (embedded) {
    return content;
  }

  return <Layout>{content}</Layout>;
}

function JournalEntryForm({ onSuccess, businessId }: { onSuccess: () => void; businessId: number }) {
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState([{ accountId: "", debit: "", credit: "", description: "" }]);
  const [postImmediately, setPostImmediately] = useState(true);
  const [searchTerms, setSearchTerms] = useState<string[]>([]);

  const utils = trpc.useUtils();
  const createMutation = trpc.journal.create.useMutation({
    onSuccess: () => {
      toast.success("Journal entry created");
      utils.journal.list.invalidate();
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  // Fetch both operational accounts and CoA entries for hierarchical dropdown
  const { data: journalAccounts } = trpc.accounts.listForJournal.useQuery();

  // Build a hierarchical structure for the account dropdown
  const hierarchicalAccounts = useMemo(() => {
    const groups: Record<string, { label: string; options: { id: number; name: string; code?: string; subType?: string }[] }> = {};

    // Add CoA accounts grouped by type/subtype
    if (journalAccounts?.coa) {
      for (const acc of journalAccounts.coa) {
        const typeLabel = acc.accountType ? acc.accountType.charAt(0).toUpperCase() + acc.accountType.slice(1) : "Unclassified";
        const subTypeLabel = acc.accountSubType ? acc.accountSubType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "";
        const groupKey = `coa-${typeLabel}-${subTypeLabel}`;
        if (!groups[groupKey]) {
          groups[groupKey] = {
            label: `${typeLabel}${subTypeLabel ? ` → ${subTypeLabel}` : ""}`,
            options: [],
          };
        }
        groups[groupKey].options.push({
          id: acc.id,
          name: acc.name,
          code: acc.accountCode || undefined,
          subType: acc.accountSubType || undefined,
        });
      }
    }

    // Add operational accounts grouped by type
    if (journalAccounts?.operational) {
      const opGroupKey = "operational";
      if (!groups[opGroupKey]) {
        groups[opGroupKey] = {
          label: "Operational Accounts",
          options: [],
        };
      }
      for (const acc of journalAccounts.operational) {
        groups[opGroupKey].options.push({
          id: acc.id,
          name: acc.name,
          code: acc.accountCode || acc.type,
        });
      }
    }

    return groups;
  }, [journalAccounts]);

  // Flatten options for search functionality
  const allOptions = useMemo(() => {
    const opts: { id: number; label: string; groupLabel: string }[] = [];
    for (const [, group] of Object.entries(hierarchicalAccounts)) {
      for (const opt of group.options) {
        opts.push({
          id: opt.id,
          label: opt.code ? `${opt.code} - ${opt.name}` : opt.name,
          groupLabel: group.label,
        });
      }
    }
    return opts;
  }, [hierarchicalAccounts]);

  const addLine = () => {
    setLines([...lines, { accountId: "", debit: "", credit: "", description: "" }]);
    setSearchTerms([...searchTerms, ""]);
  };

  const removeLine = (idx: number) => {
    if (lines.length > 2) {
      setLines(lines.filter((_, i) => i !== idx));
      setSearchTerms(searchTerms.filter((_, i) => i !== idx));
    }
  };

  const updateLine = (idx: number, field: string, value: string) => {
    const updated = [...lines];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updated[idx] as any)[field] = value;
    setLines(updated);
  };

  const updateSearchTerm = (idx: number, value: string) => {
    const updated = [...searchTerms];
    updated[idx] = value;
    setSearchTerms(updated);
  };

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  // Check if all lines have accounts selected
  const allAccountsSelected = lines.every((l) => !!l.accountId);

  // Check if any line has both debit and credit (not allowed)
  const hasInvalidLines = lines.some((l) => parseFloat(l.debit) > 0 && parseFloat(l.credit) > 0);

  // Check if any line has neither debit nor credit
  const hasEmptyLines = lines.some((l) => !l.debit && !l.credit);

  // Filter options based on search term for a specific line
  const getFilteredOptions = (idx: number) => {
    const term = searchTerms[idx]?.toLowerCase() || "";
    if (!term) return hierarchicalAccounts;

    const filtered: typeof hierarchicalAccounts = {};
    for (const [key, group] of Object.entries(hierarchicalAccounts)) {
      const matchingOptions = group.options.filter(
        (opt) =>
          opt.name.toLowerCase().includes(term) ||
          (opt.code && opt.code.toLowerCase().includes(term))
      );
      if (matchingOptions.length > 0) {
        filtered[key] = { ...group, options: matchingOptions };
      }
    }
    return filtered;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // ABOUTME: Double-entry validation — enforce balanced journal entries
    if (!isBalanced) {
      toast.error("Journal entry must be balanced (Debits = Credits)");
      return;
    }

    // ABOUTME: Ensure all lines have accounts selected
    if (!allAccountsSelected) {
      toast.error("All journal lines must have an account selected");
      return;
    }

    // ABOUTME: Prevent lines with both debit and credit
    if (hasInvalidLines) {
      toast.error("Each journal line can have either a debit OR a credit amount, not both");
      return;
    }

    // ABOUTME: Ensure all lines have at least one amount
    if (hasEmptyLines) {
      toast.error("All journal lines must have a debit or credit amount");
      return;
    }

    createMutation.mutate({
      businessId,
      entryDate,
      description,
      reference: reference || undefined,
      lines: lines.map((l) => ({
        accountId: parseInt(l.accountId),
        debit: l.debit || "0.00",
        credit: l.credit || "0.00",
        description: l.description,
      })),
      postImmediately,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm text-[#8D8A87]">Entry Date</label>
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="w-full rounded border px-3 py-2"
            required
          />
        </div>
        <div>
          <label className="text-sm text-[#8D8A87]">Reference</label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional reference" />
        </div>
      </div>
      <div>
        <label className="text-sm text-[#8D8A87]">Description</label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description of this transaction"
          required
        />
      </div>

      <div className="border-t pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="font-semibold">Journal Lines</h4>
          <Button type="button" size="sm" variant="outline" onClick={addLine}>
            <Plus className="h-4 w-4 mr-1" /> Add Line
          </Button>
        </div>

        <div className="space-y-2">
          {lines.map((line, idx) => {
            const filteredGroups = getFilteredOptions(idx);
            return (
              <div key={idx} className="flex items-start gap-2 rounded border p-2">
                <div className="flex-1">
                  {/* Search input for filtering accounts */}
                  <div className="relative mb-1">
                    <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#8D8A87]" />
                    <input
                      type="text"
                      value={searchTerms[idx] || ""}
                      onChange={(e) => updateSearchTerm(idx, e.target.value)}
                      placeholder="Search accounts..."
                      className="w-full rounded border border-[#E8E0D8] pl-7 pr-2 py-1 text-xs"
                    />
                  </div>
                  {/* Hierarchical account selector */}
                  <select
                    value={line.accountId}
                    onChange={(e) => updateLine(idx, "accountId", e.target.value)}
                    className="w-full rounded border px-2 py-1 text-sm"
                    required
                    size={5}
                  >
                    <option value="">Select Account</option>
                    {Object.entries(filteredGroups).map(([groupKey, group]) => (
                      <optgroup key={groupKey} label={group.label}>
                        {group.options.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.code ? `${opt.code} - ${opt.name}` : opt.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {/* Show CoA details for selected account */}
                  {line.accountId && journalAccounts && (
                    <div className="mt-1 text-xs text-[#8D8A87]">
                      {(() => {
                        const allAccs = [...(journalAccounts.coa || []), ...(journalAccounts.operational || [])];
                        const sel = allAccs.find((a) => a.id === parseInt(line.accountId));
                        if (!sel) return null;
                        const parts: string[] = [];
                        if (sel.accountType) parts.push(sel.accountType.charAt(0).toUpperCase() + sel.accountType.slice(1));
                        if (sel.accountSubType) parts.push(sel.accountSubType.replace(/_/g, " "));
                        if (sel.accountCode) parts.push(`Code: ${sel.accountCode}`);
                        return parts.length > 0 ? <span>{parts.join(" · ")}</span> : null;
                      })()}
                    </div>
                  )}
                </div>
                <div className="w-28">
                  <input
                    type="number"
                    step="0.01"
                    value={line.debit}
                    onChange={(e) => {
                      updateLine(idx, "debit", e.target.value);
                      if (e.target.value) updateLine(idx, "credit", "");
                    }}
                    placeholder="Debit"
                    className="w-full rounded border px-2 py-1 text-sm text-right"
                  />
                </div>
                <div className="w-28">
                  <input
                    type="number"
                    step="0.01"
                    value={line.credit}
                    onChange={(e) => {
                      updateLine(idx, "credit", e.target.value);
                      if (e.target.value) updateLine(idx, "debit", "");
                    }}
                    placeholder="Credit"
                    className="w-full rounded border px-2 py-1 text-sm text-right"
                  />
                </div>
                <div className="w-32">
                  <input
                    type="text"
                    value={line.description}
                    onChange={(e) => updateLine(idx, "description", e.target.value)}
                    placeholder="Memo (optional)"
                    className="w-full rounded border px-2 py-1 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeLine(idx)}
                  disabled={lines.length <= 2}
                >
                  <Trash2 className="h-4 w-4 text-[#D32F2F]" />
                </Button>
              </div>
            );
          })}
        </div>

        {/* Balance validation summary */}
        <div className="mt-2 flex items-center justify-between border-t pt-2">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-[#8D8A87]">
              Total Debit: <span className="font-mono font-semibold">{formatKES(totalDebit.toString())}</span>
            </span>
            <span className="text-[#8D8A87]">
              Total Credit: <span className="font-mono font-semibold">{formatKES(totalCredit.toString())}</span>
            </span>
          </div>
          {isBalanced && totalDebit > 0 ? (
            <span className="flex items-center gap-1 text-xs text-[#2E7D32]">
              <CheckCircle className="h-3 w-3" /> Balanced
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-[#D32F2F]">
              <AlertTriangle className="h-3 w-3" /> Not balanced
            </span>
          )}
        </div>

        {/* Inline validation messages */}
        {!isBalanced && totalDebit > 0 && (
          <p className="text-center text-xs text-[#D32F2F]">
            ⚠️ Entry is not balanced! Debits ({formatKES(totalDebit.toString())}) must equal Credits ({formatKES(totalCredit.toString())}).
          </p>
        )}
        {hasInvalidLines && (
          <p className="text-center text-xs text-[#D32F2F]">
            ⚠️ Each journal line can have either a debit OR a credit amount, not both.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="postImmediately"
          checked={postImmediately}
          onChange={(e) => setPostImmediately(e.target.checked)}
        />
        <label htmlFor="postImmediately" className="text-sm">
          Post immediately (affect account balances)
        </label>
      </div>

      <Button
        type="submit"
        className="w-full bg-[#C73E1D] hover:bg-[#A33318]"
        disabled={createMutation.isPending || !isBalanced || !allAccountsSelected || hasInvalidLines}
      >
        {createMutation.isPending ? "Creating..." : "Create Journal Entry"}
      </Button>
    </form>
  );
}
