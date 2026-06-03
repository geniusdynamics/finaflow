// ABOUTME: Searchable combobox for picking a Chart-of-Accounts entry or operational account in journal lines.
// ABOUTME: Groups options by account type and sub-type with live search, code preview, and rich selected-value display.
import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

type AccountOption = {
  id: number;
  name: string;
  code?: string | null;
  accountType?: string | null;
  accountSubType?: string | null;
  systemKey?: string | null;
  isOperational: boolean;
};

function formatSubType(value?: string | null): string {
  if (!value) return "";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatType(value?: string | null): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function AccountCombobox({
  value,
  onChange,
  disabled,
  excludeIds = [],
}: {
  value: string;
  onChange: (accountId: string) => void;
  disabled?: boolean;
  excludeIds?: number[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: journalAccounts, isLoading } = trpc.accounts.listForJournal.useQuery();

  const options = useMemo<AccountOption[]>(() => {
    if (!journalAccounts) return [];
    const result: AccountOption[] = [];
    for (const a of journalAccounts.coa ?? []) {
      result.push({
        id: a.id,
        name: a.name,
        code: a.accountCode,
        accountType: a.accountType,
        accountSubType: a.accountSubType,
        systemKey: a.systemKey,
        isOperational: false,
      });
    }
    for (const a of journalAccounts.operational ?? []) {
      result.push({
        id: a.id,
        name: a.name,
        code: a.accountCode,
        accountType: null,
        accountSubType: a.type,
        isOperational: true,
      });
    }
    return result;
  }, [journalAccounts]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((opt) => {
      const haystack = [opt.name, opt.code, opt.accountType, opt.accountSubType, opt.systemKey]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [options, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, AccountOption[]> = {};
    for (const opt of filtered) {
      if (excludeIds.includes(opt.id)) continue;
      let key: string;
      if (opt.isOperational) {
        key = "__operational__";
      } else {
        const t = formatType(opt.accountType);
        const s = formatSubType(opt.accountSubType);
        key = s ? `${t} → ${s}` : t || "Other";
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(opt);
    }
    return groups;
  }, [filtered, excludeIds]);

  const selected = options.find((o) => o.id === parseInt(value || "0", 10));

  const groupOrder = useMemo(() => {
    const preferred = [
      "Asset → Cash",
      "Asset → Bank",
      "Asset → Prepaid Expenses",
      "Asset → Accounts Receivable",
      "Asset → Fixed Assets",
      "Asset",
      "Liability → Accounts Payable",
      "Liability",
      "Equity",
      "Revenue",
      "Expense",
      "__operational__",
    ];
    return Object.keys(grouped).sort((a, b) => {
      const ai = preferred.indexOf(a);
      const bi = preferred.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [grouped]);

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
            "h-auto min-h-[2.25rem] w-full justify-between px-2 py-1.5 text-left text-sm font-normal",
            !selected && "text-muted-foreground",
          )}
        >
          {selected ? (
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-2">
                {selected.code && (
                  <span className="rounded bg-[#F5EDE6] px-1.5 py-0.5 font-mono text-[10px] text-[#2D2A26]">
                    {selected.code}
                  </span>
                )}
                <span className="truncate font-medium">{selected.name}</span>
              </div>
              <div className="mt-0.5 text-[10px] text-[#8D8A87]">
                {selected.isOperational
                  ? `Operational · ${formatSubType(selected.accountSubType)}`
                  : `${formatType(selected.accountType)}${selected.accountSubType ? ` · ${formatSubType(selected.accountSubType)}` : ""}`}
              </div>
            </div>
          ) : (
            <span className="text-xs">Select account…</span>
          )}
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-2">
            <Search className="mr-1 h-3.5 w-3.5 shrink-0 text-[#8D8A87]" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code, or type…"
              className="h-8 border-0 bg-transparent px-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {search && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setSearch("")}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <CommandList className="max-h-[320px]">
            {isLoading && (
              <div className="py-6 text-center text-xs text-[#8D8A87]">Loading accounts…</div>
            )}
            {!isLoading && groupOrder.length === 0 && (
              <CommandEmpty className="py-6 text-center text-xs text-[#8D8A87]">
                No accounts match “{search}”
              </CommandEmpty>
            )}
            {!isLoading &&
              groupOrder.map((groupKey) => {
                const items = grouped[groupKey] ?? [];
                if (items.length === 0) return null;
                return (
                  <CommandGroup
                    key={groupKey}
                    heading={
                      groupKey === "__operational__"
                        ? "Operational Accounts"
                        : groupKey
                    }
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[#8D8A87]"
                  >
                    {items.map((opt) => {
                      const isActive = parseInt(value || "0", 10) === opt.id;
                      return (
                        <CommandItem
                          key={opt.id}
                          value={String(opt.id)}
                          onSelect={() => {
                            onChange(String(opt.id));
                            setOpen(false);
                            setSearch("");
                          }}
                          className="flex items-start gap-2 py-1.5"
                        >
                          <Check
                            className={cn(
                              "mt-0.5 h-3.5 w-3.5 shrink-0",
                              isActive ? "opacity-100 text-[#C73E1D]" : "opacity-0",
                            )}
                          />
                          <div className="flex min-w-0 flex-1 flex-col">
                            <div className="flex items-center gap-2">
                              {opt.code && (
                                <span className="rounded bg-[#F5EDE6] px-1.5 py-0.5 font-mono text-[10px] text-[#2D2A26]">
                                  {opt.code}
                                </span>
                              )}
                              <span className="truncate text-sm">{opt.name}</span>
                            </div>
                            <div className="mt-0.5 text-[10px] text-[#8D8A87]">
                              {opt.isOperational
                                ? `Operational · ${formatSubType(opt.accountSubType)}`
                                : `${formatType(opt.accountType)}${opt.accountSubType ? ` · ${formatSubType(opt.accountSubType)}` : ""}`}
                            </div>
                          </div>
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
