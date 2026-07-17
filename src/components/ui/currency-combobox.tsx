import { useState, useCallback, useMemo } from "react";
import { Check, ChevronsUpDown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SUPPORTED_CURRENCIES, getCurrencyInfo, type CurrencyInfo } from "@/lib/currency";

const EA_CODES = ["KES","TZS","UGX","RWF","BIF","SSP","ETB","SOS","DJF","ERN"];

interface CurrencyComboboxProps {
  value: string;
  onValueChange: (currencyCode: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  multiCurrency?: boolean;
  allowedCurrencies?: string[];
}

export function CurrencyCombobox({
  value, onValueChange, placeholder = "Select currency...",
  disabled = false, className, id, multiCurrency = false, allowedCurrencies,
}: CurrencyComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = getCurrencyInfo(value);

  const visibleCurrencies = useMemo(() => {
    if (!multiCurrency) {
      const cur = SUPPORTED_CURRENCIES.find((c) => c.code === value);
      return cur ? [cur] : [];
    }
    if (allowedCurrencies?.length) {
      const allowed = new Set(allowedCurrencies.map((c) => c.toUpperCase()));
      allowed.add(value.toUpperCase());
      return SUPPORTED_CURRENCIES.filter((c) => allowed.has(c.code));
    }
    return SUPPORTED_CURRENCIES;
  }, [multiCurrency, value, allowedCurrencies]);

  const handleSelect = useCallback((code: string) => {
    onValueChange(code);
    setOpen(false);
  }, [onValueChange]);

  const ea = visibleCurrencies.filter((c) => EA_CODES.includes(c.code));
  const intl = visibleCurrencies.filter((c) => !EA_CODES.includes(c.code));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id} variant="outline" role="combobox" aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <span className="font-medium">{selected.code}</span>
              <span className="truncate text-muted-foreground">{selected.name}</span>
              <span className="text-muted-foreground">{selected.symbol}</span>
            </span>
          ) : placeholder}
          {!multiCurrency
            ? <Lock className="ml-2 size-3.5 shrink-0 text-muted-foreground" />
            : <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search currency..." />
          <CommandList>
            <CommandEmpty>No currency found.</CommandEmpty>
            {ea.length > 0 && (
              <CommandGroup heading="East Africa">
                {ea.map((c) => (
                  <CommandItem key={c.code} value={`${c.code} ${c.name}`} onSelect={() => handleSelect(c.code)}>
                    <Check className={cn("mr-2 size-4 shrink-0", value === c.code ? "opacity-100" : "opacity-0")} />
                    <span className="w-10 font-medium">{c.code}</span>
                    <span className="flex-1 truncate text-muted-foreground">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.symbol}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {ea.length > 0 && intl.length > 0 && <CommandSeparator />}
            {intl.length > 0 && (
              <CommandGroup heading="International">
                {intl.map((c) => (
                  <CommandItem key={c.code} value={`${c.code} ${c.name}`} onSelect={() => handleSelect(c.code)}>
                    <Check className={cn("mr-2 size-4 shrink-0", value === c.code ? "opacity-100" : "opacity-0")} />
                    <span className="w-10 font-medium">{c.code}</span>
                    <span className="flex-1 truncate text-muted-foreground">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.symbol}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
