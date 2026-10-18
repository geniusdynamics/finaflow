// ABOUTME: Inline category editor for a wallet transaction, with optional "remember this merchant".
// ABOUTME: Saving sets classificationSource=manual; remembering writes a learned category rule.

import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ExpenseCategorySelector } from "@/components/ExpenseCategorySelector";
import { Loader2, Tag } from "lucide-react";

interface Category {
  id: number;
  name: string;
}

interface Props {
  walletTxnId: number;
  categoryId: number | null;
  categoryName: string | null;
  partyName: string | null;
  description: string | null;
  categories: Category[] | undefined;
  onSaved?: () => void;
}

export function CategoryCell({
  walletTxnId,
  categoryId,
  categoryName,
  partyName,
  description,
  categories,
  onSaved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>(categoryId ? String(categoryId) : "");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const save = trpc.wallet.statements.setCategory.useMutation({
    onSuccess: async () => {
      setOpen(false);
      setError(null);
      await Promise.all([
        utils.wallet.transactions.list.invalidate(),
        utils.wallet.transactions.stats.invalidate(),
        utils.wallet.statements.categoryRules.list.invalidate(),
      ]);
      onSaved?.();
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const merchant = (partyName ?? description ?? "").trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setSelected(categoryId ? String(categoryId) : "");
          setRemember(true);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex max-w-[150px] items-center gap-1 rounded-full bg-[#F5EDE6] px-2 py-0.5 text-xs text-[#2D2A26] hover:bg-[#E8E0D8]"
          title="Change category"
        >
          <Tag className="h-3 w-3 shrink-0 text-[#8D8A87]" />
          <span className="truncate">{categoryName ?? "No category"}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-[#2D2A26]">Categorise transaction</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {merchant && (
            <p className="rounded-lg bg-[#F5EDE6] px-3 py-2 text-sm text-[#2D2A26]">{merchant}</p>
          )}
          <ExpenseCategorySelector
            categories={categories}
            value={selected}
            onChange={setSelected}
            label="Category"
            hint={categories && categories.length === 0 ? "No categories yet. Create one in Expenses first." : undefined}
          />
          <label className="flex items-start gap-2 rounded-lg border border-[#E8E0D8] p-3 text-sm">
            <Checkbox checked={remember} onCheckedChange={(value) => setRemember(value === true)} />
            <span>
              <span className="font-medium text-[#2D2A26]">Remember this merchant</span>
              <span className="mt-0.5 block text-xs text-[#8D8A87]">
                Future statement imports will assign this category to {merchant || "the same merchant"}.
              </span>
            </span>
          </label>
          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-[#C73E1D] hover:bg-[#C73E1D]/90"
              disabled={!selected || save.isPending}
              onClick={() =>
                save.mutate({
                  walletTxnId,
                  categoryId: selected ? Number(selected) : null,
                  rememberMerchant: remember,
                })
              }
            >
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save category
            </Button>
            <Button
              variant="outline"
              disabled={save.isPending}
              onClick={() =>
                save.mutate({ walletTxnId, categoryId: null, rememberMerchant: false })
              }
            >
              Clear category
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={save.isPending}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
