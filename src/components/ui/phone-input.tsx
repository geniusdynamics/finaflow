import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COUNTRIES, getDialCode, getCountryByCode, getCountryFromPhone, type CountryInfo } from "@/lib/countries";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  countryCode?: string;
  onCountryChange?: (country: CountryInfo) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

function stripLocal(fullNumber: string, dialCode: string): string {
  if (!fullNumber) return "";
  const cleaned = fullNumber.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith(dialCode)) return cleaned.slice(dialCode.length);
  if (cleaned.startsWith("+")) {
    const detected = getCountryFromPhone(cleaned);
    if (detected) return cleaned.slice(detected.dialCode.length);
    return cleaned;
  }
  return cleaned;
}

export function PhoneInput({
  value, onChange, countryCode, onCountryChange,
  placeholder = "712 244 244", disabled = false, className, id,
}: PhoneInputProps) {
  const [selectedCode, setSelectedCode] = useState(countryCode ?? "");
  useEffect(() => { if (countryCode && countryCode !== selectedCode) setSelectedCode(countryCode); }, [countryCode]);

  const selectedCountry = selectedCode ? getCountryByCode(selectedCode) : undefined;
  const dialCode = selectedCountry?.dialCode;
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uniqueCountries = useMemo(() => {
    const seen = new Map<string, CountryInfo>();
    for (const c of COUNTRIES) { if (!seen.has(c.dialCode)) seen.set(c.dialCode, c); }
    return [...seen.values()];
  }, []);

  const [localNumber, setLocalNumber] = useState(() => dialCode ? stripLocal(value, dialCode) : value);
  useEffect(() => { setLocalNumber(dialCode ? stripLocal(value, dialCode) : value); }, [value, dialCode]);

  const emitFull = useCallback((local: string, dial: string | undefined) => {
    if (!local) onChange("");
    else if (dial) onChange(dial + local.replace(/[^\d]/g, ""));
    else onChange(local);
  }, [onChange]);

  const handleCountrySelect = useCallback((country: CountryInfo) => {
    setSelectedCode(country.code);
    setOpen(false);
    const digits = localNumber.replace(/[^\d+]/g, "").replace(/^\+/, "");
    onChange(country.dialCode + digits);
    onCountryChange?.(country);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [localNumber, onChange, onCountryChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw) { setLocalNumber(""); onChange(""); return; }
    if (raw.startsWith("+")) {
      const cleaned = raw.replace(/[\s\-()]/g, "");
      setLocalNumber(cleaned);
      const detected = getCountryFromPhone(cleaned);
      if (detected) { setSelectedCode(detected.code); onCountryChange?.(detected); }
      onChange(cleaned);
      return;
    }
    const digitsOnly = raw.replace(/[^\d]/g, "");
    setLocalNumber(digitsOnly);
    emitFull(digitsOnly, dialCode);
  }, [dialCode, emitFull, onChange, onCountryChange]);

  return (
    <div className={cn("flex", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button" disabled={disabled}
            className={cn(
              "inline-flex items-center gap-1 rounded-l-md border border-r-0 border-input bg-muted px-2.5 text-sm whitespace-nowrap",
              "hover:bg-accent hover:text-accent-foreground transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            {selectedCountry ? (
              <span className="flex items-center gap-1.5">
                <span>{selectedCountry.flag}</span>
                <span className="text-muted-foreground">{selectedCountry.dialCode}</span>
              </span>
            ) : <span className="text-muted-foreground">+...</span>}
            <ChevronDown className="size-3 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start" side="bottom"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <Command>
            <CommandInput placeholder="Search country or dial code..." />
            <CommandList>
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {uniqueCountries.map((country) => (
                  <CommandItem
                    key={country.code}
                    value={`${country.dialCode} ${country.name} ${country.code}`}
                    onSelect={() => handleCountrySelect(country)}
                  >
                    <Check className={cn("mr-2 size-4 shrink-0", selectedCode === country.code ? "opacity-100" : "opacity-0")} />
                    <span className="mr-1.5">{country.flag}</span>
                    <span className="flex-1 truncate">{country.name}</span>
                    <span className="text-xs text-muted-foreground">{country.dialCode}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        ref={inputRef} id={id} type="tel" value={localNumber}
        onChange={handleChange} placeholder={placeholder} disabled={disabled}
        className="rounded-l-none focus-visible:ring-offset-0"
      />
    </div>
  );
}
