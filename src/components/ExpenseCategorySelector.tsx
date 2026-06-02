import { type ReactNode, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";

interface CategoryItem {
  id: number;
  name: string;
}

interface ExpenseCategorySelectorProps {
  categories?: CategoryItem[];
  value: string;
  onChange: (value: string) => void;
  label?: ReactNode;
  required?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  hint?: string;
}

export function ExpenseCategorySelector({
  categories = [],
  value,
  onChange,
  label = "Category",
  required = false,
  placeholder = "Select",
  className = "",
  disabled = false,
  hint,
}: ExpenseCategorySelectorProps) {
  const hasAutoSelected = useRef(false);

  useEffect(() => {
    if (hasAutoSelected.current) return;
    if (!categories || categories.length === 0) return;
    if (value !== "") return;
    if (categories.length === 1) {
      hasAutoSelected.current = true;
      onChange(categories[0].id.toString());
    }
  }, [categories, value, onChange]);

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <Label>{label}</Label>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm"
        required={required}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {categories.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      {hint && <p className="text-xs text-[#2E7D32]">{hint}</p>}
    </div>
  );
}
