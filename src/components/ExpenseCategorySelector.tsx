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
  onAddNew?: () => void;
  addNewLabel?: string;
}

const ADD_NEW_VALUE = "__add_new__";

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
  onAddNew,
  addNewLabel,
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

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    if (next === ADD_NEW_VALUE) {
      onAddNew?.();
      return;
    }
    onChange(next);
  };

  const resolvedAddNewLabel = addNewLabel ?? `Add ${typeof label === "string" ? label.toLowerCase() : "category"}`;

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <Label>{label}</Label>}
      <select
        value={value}
        onChange={handleChange}
        className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm"
        required={required}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {categories.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
        {onAddNew && (
          <option value={ADD_NEW_VALUE}>+ {resolvedAddNewLabel}</option>
        )}
      </select>
      {hint && <p className="text-xs text-[#2E7D32]">{hint}</p>}
    </div>
  );
}
