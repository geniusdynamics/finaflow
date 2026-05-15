// ABOUTME: Renders the filter controls for year, month, and branch selection.
// ABOUTME: Provides dropdown selectors for date range and branch filter options.
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ReportsToolbar() {
  return (
    <div className="flex flex-wrap gap-2">
      <Select>
        <SelectTrigger className="rounded border px-3 py-2 text-sm">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="2024">2024</SelectItem>
          <SelectItem value="2025">2025</SelectItem>
          <SelectItem value="2026">2026</SelectItem>
          <SelectItem value="2027">2027</SelectItem>
        </SelectContent>
      </Select>

      <Select>
        <SelectTrigger className="rounded border px-3 py-2 text-sm">
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 12 }, (_, i) => (
            <SelectItem key={i + 1} value={i + 1}>
              {new Date(2000, i).toLocaleDateString("en-KE", { month: "short" })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select>
        <SelectTrigger className="rounded border px-3 py-2 text-sm">
          <SelectValue placeholder="All Branches" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All Branches</SelectItem>
          {/* Branches will be populated dynamically from data */}
          <SelectItem value="1">Example Branch 1</SelectItem>
          <SelectItem value="2">Example Branch 2</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
