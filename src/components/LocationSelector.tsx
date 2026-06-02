// ABOUTME: Reusable smart location dropdown with auto-selection, unassigned-location warnings, and enforcement support.
import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface LocationItem {
  id: number;
  name: string;
}

interface LocationSelectorProps {
  locations?: LocationItem[];
  userLocationId?: number | null;
  value: string;
  onChange: (value: string) => void;
  enforceAssigned?: boolean;
  label?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function LocationSelector({
  locations = [],
  userLocationId,
  value,
  onChange,
  enforceAssigned = false,
  label = "Location",
  required = false,
  placeholder = "Select",
  className = "",
  disabled = false,
}: LocationSelectorProps) {
  const hasAutoSelected = useRef(false);
  const [warnLocation, setWarnLocation] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (hasAutoSelected.current) return;
    if (!locations || locations.length === 0) return;
    if (value !== "") return;

    let defaultId: string | null = null;

    if (locations.length === 1) {
      defaultId = locations[0].id.toString();
    } else if (userLocationId != null) {
      const assignedLoc = locations.find(l => l.id === userLocationId);
      if (assignedLoc) {
        defaultId = assignedLoc.id.toString();
      }
    }

    if (!defaultId && locations.length > 0) {
      defaultId = locations[0].id.toString();
    }

    if (defaultId) {
      hasAutoSelected.current = true;
      onChange(defaultId);
    }
  }, [locations, userLocationId, value, onChange]);

  const isUserAssigned = userLocationId != null;

  const handleChange = (newValue: string) => {
    if (!newValue) {
      onChange(newValue);
      return;
    }

    if (isUserAssigned && parseInt(newValue) !== userLocationId) {
      if (enforceAssigned) {
        toast.error("You can only record entries for your assigned location.");
        const assignedLoc = locations.find(l => l.id === userLocationId);
        if (assignedLoc) {
          onChange(assignedLoc.id.toString());
        }
        return;
      }
      const locName = locations.find(l => l.id.toString() === newValue)?.name ?? "this location";
      setWarnLocation({ id: newValue, name: locName });
      return;
    }

    onChange(newValue);
  };

  const confirmUnassigned = () => {
    if (warnLocation) {
      onChange(warnLocation.id);
    }
    setWarnLocation(null);
  };

  const cancelUnassigned = () => {
    setWarnLocation(null);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <Label>{label}</Label>}
      <div className="relative">
        <select
          value={value}
          onChange={e => handleChange(e.target.value)}
          className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm"
          required={required}
          disabled={disabled}
        >
          <option value="">{placeholder}</option>
          {locations?.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        {isUserAssigned && value && parseInt(value) !== userLocationId && (
          <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            <span>Not your assigned location</span>
          </div>
        )}
      </div>

      {warnLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={cancelUnassigned}>
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-[#2D2A26]">Unassigned Location</h3>
            </div>
            <p className="mb-2 text-sm text-[#8D8A87]">
              You are about to enter records for <strong className="text-[#2D2A26]">{warnLocation.name}</strong>, which is not one of your assigned locations.
            </p>
            <p className="mb-6 text-sm text-[#8D8A87]">
              Do you want to continue or change to a different location?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelUnassigned}
                className="rounded-lg border border-[#E8E0D8] px-4 py-2 text-sm font-medium text-[#2D2A26] hover:bg-[#F5EDE6]"
              >
                Change Location
              </button>
              <button
                type="button"
                onClick={confirmUnassigned}
                className="rounded-lg bg-[#C73E1D] px-4 py-2 text-sm font-medium text-white hover:bg-[#C73E1D]/90"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
