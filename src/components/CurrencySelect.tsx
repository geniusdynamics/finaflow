// ABOUTME: Reusable currency selector using shadcn/ui Select with search, flag icons, and currency info display.
// ABOUTME: Supports filtering by active currencies, shows symbol + code, and integrates with react-hook-form.

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCurrencyInfo, SUPPORTED_CURRENCIES } from "@/lib/currency";

export interface CurrencySelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  includeInactive?: boolean;
  filterCurrencies?: string[];
  label?: string;
}

export function CurrencySelect({
  value,
  onValueChange,
  placeholder = "Select currency",
  disabled = false,
  className,
  includeInactive = false,
  filterCurrencies,
  label,
}: CurrencySelectProps) {
  const currencies = filterCurrencies
    ? SUPPORTED_CURRENCIES.filter((c) => filterCurrencies.includes(c.code))
    : includeInactive
      ? SUPPORTED_CURRENCIES
      : SUPPORTED_CURRENCIES.filter((c) => c.code === "KES" || c.code === "USD" || c.code === "UGX" || c.code === "TZS" || c.code === "EUR" || c.code === "GBP");

  const selectedInfo = value ? getCurrencyInfo(value) : null;

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {selectedInfo ? (
            <span className="flex items-center gap-2">
              <CurrencyFlag currency={value!} />
              <span>{selectedInfo.code}</span>
              <span className="text-muted-foreground text-xs">{selectedInfo.symbol}</span>
            </span>
          ) : (
            placeholder
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {label && <SelectLabel>{label}</SelectLabel>}
        <SelectGroup>
          {currencies.map((currency) => (
            <SelectItem key={currency.code} value={currency.code}>
              <span className="flex items-center gap-2">
                <CurrencyFlag currency={currency.code} />
                <span className="font-medium">{currency.code}</span>
                <span className="text-muted-foreground text-xs">{currency.name}</span>
                <span className="text-muted-foreground ml-auto text-xs">{currency.symbol}</span>
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function CurrencyFlag({ currency }: { currency: string }) {
  const flag = getCurrencyFlag(currency);
  if (!flag) return null;
  return <span className="text-base leading-none">{flag}</span>;
}

function getCurrencyFlag(currency: string): string {
  const flags: Record<string, string> = {
    KES: "🇰🇪",
    USD: "🇺🇸",
    UGX: "🇺🇬",
    TZS: "🇹🇿",
    EUR: "🇪🇺",
    GBP: "🇬🇧",
    JPY: "🇯🇵",
    KWD: "🇰🇼",
    MWK: "🇲🇼",
    ZMW: "🇿🇲",
    RWF: "🇷🇼",
    BWP: "🇧🇼",
    ZAR: "🇿🇦",
    NGN: "🇳🇬",
    ETB: "🇪🇹",
    MZN: "🇲🇿",
    AOA: "🇦🇴",
    GHS: "🇬🇭",
    XAF: "🇨🇲",
    XOF: "🇸🇳",
  };
  return flags[currency] ?? "";
}

export function CurrencyDisplay({ currency, showName = false }: { currency: string; showName?: boolean }) {
  const info = getCurrencyInfo(currency);
  const flag = getCurrencyFlag(currency);
  return (
    <span className="inline-flex items-center gap-1.5">
      {flag && <span className="text-base leading-none">{flag}</span>}
      <span className="font-medium">{info.code}</span>
      {showName && <span className="text-muted-foreground text-xs">{info.name}</span>}
    </span>
  );
}
