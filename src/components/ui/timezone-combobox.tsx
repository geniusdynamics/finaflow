import { useState, useCallback, useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TIMEZONES, type TimezoneInfo } from "@/lib/timezones";

interface TimezoneComboboxProps {
  value: string;
  onValueChange: (timezoneId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function TimezoneCombobox({
  value, onValueChange, placeholder = "Select timezone...",
  disabled = false, className, id,
}: TimezoneComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = TIMEZONES.find((tz) => tz.id === value);

  const uniqueTimezones = useMemo(() => {
    const seen = new Set<string>();
    return TIMEZONES.filter((tz) => { if (seen.has(tz.id)) return false; seen.add(tz.id); return true; });
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, TimezoneInfo[]>();
    for (const tz of uniqueTimezones) {
      const list = map.get(tz.region) ?? [];
      list.push(tz);
      map.set(tz.region, list);
    }
    return map;
  }, [uniqueTimezones]);

  const handleSelect = useCallback((id: string) => {
    onValueChange(id);
    setOpen(false);
  }, [onValueChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id} variant="outline" role="combobox" aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
        >
          {selected ? <span className="truncate">{selected.label}</span>
            : value ? <span className="truncate">{value}</span>
            : placeholder}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search timezone..." />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            {Array.from(grouped.entries()).map(([region, zones]) => (
              <CommandGroup key={region} heading={region}>
                {zones.map((tz) => (
                  <CommandItem key={tz.id} value={`${tz.id} ${tz.label}`} onSelect={() => handleSelect(tz.id)}>
                    <Check className={cn("mr-2 size-4 shrink-0", value === tz.id ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{tz.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
