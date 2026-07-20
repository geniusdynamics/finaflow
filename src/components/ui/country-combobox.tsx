import { useState, useCallback } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COUNTRIES, type CountryInfo } from "@/lib/countries";

interface CountryComboboxProps {
  value: string;
  onValueChange: (countryCode: string) => void;
  onSelect?: (country: CountryInfo) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function CountryCombobox({
  value, onValueChange, onSelect, placeholder = "Select country...",
  disabled = false, className, id,
}: CountryComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = COUNTRIES.find((c) => c.code === value);

  const handleSelect = useCallback((code: string) => {
    onValueChange(code);
    const country = COUNTRIES.find((c) => c.code === code);
    if (country) onSelect?.(country);
    setOpen(false);
  }, [onValueChange, onSelect]);

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
              <span>{selected.flag}</span>
              <span className="truncate">{selected.name}</span>
            </span>
          ) : placeholder}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search country..." />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {COUNTRIES.map((country) => (
                <CommandItem
                  key={country.code}
                  value={`${country.name} ${country.code} ${country.dialCode}`}
                  onSelect={() => handleSelect(country.code)}
                >
                  <Check className={cn("mr-2 size-4 shrink-0", value === country.code ? "opacity-100" : "opacity-0")} />
                  <span className="mr-2">{country.flag}</span>
                  <span className="flex-1 truncate">{country.name}</span>
                  <span className="text-xs text-muted-foreground">{country.dialCode}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
