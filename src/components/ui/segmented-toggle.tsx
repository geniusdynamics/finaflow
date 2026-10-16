// ABOUTME: Generic pill-style segmented toggle control used to switch between mutually exclusive view modes.
// ABOUTME: Renders real buttons with aria-pressed for keyboard/screen-reader accessibility and warm house palette.
import type { ReactNode, JSX } from "react";

export interface SegmentedToggleOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
}: {
  options: SegmentedToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}): JSX.Element {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex rounded-full border border-[#E8E0D8] bg-white p-1 ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            data-testid={`segmented-option-${option.value}`}
            onClick={() => onChange(option.value)}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors ${
              active
                ? "bg-[#C73E1D] text-white"
                : "text-[#8D8A87] hover:bg-[#F5EDE6] hover:text-[#2D2A26]"
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
