// ABOUTME: Dedicated CoA-only searchable account picker for manual journal entries.
// ABOUTME: Pulls authoritative accounts from the journal router's listForJournalEntries endpoint,
// ABOUTME: groups by account type (Asset/Liability/Equity/Revenue/Expense), and shows code + name.
// ABOUTME: This is distinct from the operational-account selector used by the transfer module.
import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

const TYPE_ORDER = ["asset", "liability", "equity", "revenue", "expense"] as const;
const TYPE_LABELS: Record<(typeof TYPE_ORDER)[number], string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expense",
};

type CoaAccount = {
  id: number;
  name: string;
  accountCode: string | null;
  accountType: string | null;
  accountSubType: string | null;
  description: string | null;
  isContra: boolean | null;
  isActive: boolean | null;
};

export function CoAJournalAccountPicker({
  value,
  onChange,
  disabled,
  excludeIds = [],
  businessId,
  className,
}: {
  value: string;
  onChange: (accountId: string) => void;
  disabled?: boolean;
  excludeIds?: number[];
  businessId?: number | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading } = trpc.journal.listForJournalEntries.useQuery(
    businessId ? { businessId } : undefined,
  );

  const accounts = useMemo<CoaAccount[]>(() => data?.accounts ?? [], [data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return accounts;
    return accounts.filter((acc) => {
      const haystack = [acc.name, acc.accountCode, acc.accountType, acc.accountSubType, acc.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [accounts, search]);

  const grouped = useMemo(() => {
    const map: Record<string, CoaAccount[]> = {};
    for (const acc of filtered) {
      if (excludeIds.includes(acc.id)) continue;
      const t = (acc.accountType ?? "other") as string;
      if (!map[t]) map[t] = [];
      map[t].push(acc);
    }
    return map;
  }, [filtered, excludeIds]);

  const orderedTypes = useMemo(() => {
    const present = Object.keys(grouped).sort((a, b) => {
      const ai = TYPE_ORDER.indexOf(a as (typeof TYPE_ORDER)[number]);
      const bi = TYPE_ORDER.indexOf(b as (typeof TYPE_ORDER)[number]);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return present;
  }, [grouped]);

  const selected = useMemo(
    () => accounts.find((a) => a.id === parseInt(value || "0", 10)),
    [accounts, value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-[34px] w-full justify-between gap-2 px-3 text-left text-sm font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          {selected ? (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {selected.accountCode && (
                <span className="shrink-0 rounded bg-[#F5EDE6] px-1.5 py-0.5 font-mono text-[10px] text-[#2D2A26]">
                  {selected.accountCode}
                </span>
              )}
              <span className="truncate font-medium text-[#2D2A26]">{selected.name}</span>
              {selected.isContra && (
                <span className="shrink-0 rounded bg-[#FFF4E5] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[#C76D1D]">
                  Contra
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs">Select an account</span>
          )}
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] max-h-[var(--radix-popover-content-available-height)] overflow-hidden p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false} className="h-full max-h-full">
          <div className="flex shrink-0 items-center gap-1.5 border-b px-2.5 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-[#8D8A87]" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or code…"
              className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-[#A6A29C]"
            />
            {search && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={() => setSearch("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <CommandList className="max-h-[min(320px,var(--radix-popover-content-available-height)-56px)] flex-1 overflow-y-auto overscroll-contain">
            {isLoading && (
              <div className="py-6 text-center text-xs text-[#8D8A87]">Loading accounts…</div>
            )}
            {!isLoading && orderedTypes.length === 0 && (
              <CommandEmpty className="py-6 text-center text-xs text-[#8D8A87]">
                {accounts.length === 0
                  ? "No Chart-of-Accounts accounts are set up yet."
                  : `No accounts match “${search}”`}
              </CommandEmpty>
            )}
            {!isLoading &&
              orderedTypes.map((typeKey) => {
                const items = grouped[typeKey] ?? [];
                if (items.length === 0) return null;
                return (
                  <CommandGroup
                    key={typeKey}
                    heading={TYPE_LABELS[typeKey as keyof typeof TYPE_LABELS] ?? typeKey}
                    className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-[#2D2A26]"
                  >
                    {items.map((acc) => {
                      const isActive = parseInt(value || "0", 10) === acc.id;
                      return (
                        <CommandItem
                          key={acc.id}
                          value={`${acc.id}-${acc.name}-${acc.accountCode ?? ""}`}
                          onSelect={() => {
                            onChange(String(acc.id));
                            setOpen(false);
                            setSearch("");
                          }}
                          className={cn(
                            "flex items-center gap-1.5 py-1.5 pl-2 pr-2 text-sm",
                            isActive && "bg-[#E8F0FE] text-[#1A73E8]",
                          )}
                        >
                          {isActive ? (
                            <Check className="h-3.5 w-3.5 shrink-0" />
                          ) : acc.accountCode ? (
                            <span className="w-3.5 shrink-0" />
                          ) : null}
                          {acc.accountCode && (
                            <span className="shrink-0 font-mono text-[10px] text-[#5C5852]">
                              {acc.accountCode}
                            </span>
                          )}
                          <span className="truncate">{acc.name}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                );
              })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
