// ABOUTME: Unified bills pipeline card for the main dashboard.
// ABOUTME: Replaces the two separate Overdue / Due-in-7-Days cards with a single three-section timeline.
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatKES, formatDate } from "@/lib/utils";
import { AlertTriangle, Calendar, Clock, ChevronRight } from "lucide-react";

export type PipelineBill = {
  id: number;
  description: string;
  dueDate: string;
  balanceDue: string;
};

type BillsPipelineCardProps = {
  overdue: PipelineBill[];
  upcoming7: PipelineBill[];
  upcoming30: PipelineBill[];
};

const MAX_PER_SECTION = 3;

type SectionConfig = {
  key: "overdue" | "upcoming7" | "upcoming30";
  title: string;
  icon: typeof AlertTriangle;
  borderClass: string;
  bgClass: string;
  textClass: string;
};

const SECTIONS: SectionConfig[] = [
  {
    key: "overdue",
    title: "Overdue",
    icon: AlertTriangle,
    borderClass: "border-[#D32F2F]/30",
    bgClass: "bg-[#D32F2F]/5",
    textClass: "text-[#D32F2F]",
  },
  {
    key: "upcoming7",
    title: "Due in 7 Days",
    icon: Clock,
    borderClass: "border-[#ED6C02]/30",
    bgClass: "bg-[#ED6C02]/5",
    textClass: "text-[#ED6C02]",
  },
  {
    key: "upcoming30",
    title: "Due in 8–30 Days",
    icon: Calendar,
    borderClass: "border-[#D4A854]/30",
    bgClass: "bg-[#D4A854]/5",
    textClass: "text-[#D4A854]",
  },
];

export function BillsPipelineCard({ overdue, upcoming7, upcoming30 }: BillsPipelineCardProps) {
  const totalCount = overdue.length + upcoming7.length + upcoming30.length;
  const totalAmount =
    [...overdue, ...upcoming7, ...upcoming30].reduce(
      (s, b) => s + (parseFloat(b.balanceDue) || 0),
      0,
    );

  if (totalCount === 0) {
    return (
      <Card
        data-testid="bills-pipeline-card"
        className="border-[#E8E0D8] border-dashed bg-[#F5EDE6]/40"
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#2D2A26]">
            <Calendar className="h-5 w-5 text-[#2E7D32]" />
            Bills Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[#8D8A87]">
            You have no upcoming bills in the next 30 days. Add recurring bill templates to stay ahead of payments.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="bills-pipeline-card" className="border-[#E8E0D8] bg-white">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#2D2A26]">
          <Calendar className="h-5 w-5 text-[#C73E1D]" />
          Bills Pipeline
        </CardTitle>
        <div className="flex items-center gap-3 text-xs text-[#8D8A87]">
          <span>
            <span className="font-mono font-semibold text-[#2D2A26]">{totalCount}</span> bills
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="font-mono font-semibold text-[#D32F2F]">{formatKES(totalAmount)}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 lg:grid-cols-3">
          {SECTIONS.map((section) => {
            const bills = section.key === "overdue" ? overdue : section.key === "upcoming7" ? upcoming7 : upcoming30;
            return (
              <div
                key={section.key}
                data-testid={`bills-pipeline-section-${section.key}`}
                className={cn("rounded-lg border p-3", section.borderClass, section.bgClass)}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className={cn("flex items-center gap-1.5 text-xs font-semibold", section.textClass)}>
                    <section.icon className="h-3.5 w-3.5" />
                    {section.title}
                    <span className="text-[#8D8A87]">({bills.length})</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {bills.length === 0 ? (
                    <p className="py-2 text-center text-xs text-[#8D8A87]">None</p>
                  ) : (
                    bills.slice(0, MAX_PER_SECTION).map((bill) => (
                      <div
                        key={bill.id}
                        className="flex items-center justify-between rounded-md bg-white p-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-[#2D2A26]">
                            {bill.description}
                          </p>
                          <p className="text-[10px] text-[#8D8A87]">Due {formatDate(bill.dueDate)}</p>
                        </div>
                        <span className={cn("ml-2 font-mono text-xs font-semibold", section.textClass)}>
                          {formatKES(bill.balanceDue)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                {bills.length > MAX_PER_SECTION && (
                  <Link
                    to="/bills"
                    className={cn(
                      "mt-2 flex items-center justify-center gap-1 text-[10px] font-medium hover:underline",
                      section.textClass,
                    )}
                  >
                    View all {bills.length}
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
