// ABOUTME: Renders compact badges for lead lifecycle, referral usage, and commission status.
// ABOUTME: Keeps lead-state visuals consistent across the Partner Dashboard table and mobile cards.
import { Badge } from "@/components/ui/badge";

type LeadStatus = "new" | "contacted" | "converted" | "declined";

type LeadStatusBadgeProps = {
  status: LeadStatus;
  joinedAt?: string | Date | null;
  joinedViaReferral?: boolean | null;
  commissionEligible?: boolean | null;
};

export function LeadStatusBadge({
  status,
  joinedAt,
  joinedViaReferral,
  commissionEligible,
}: LeadStatusBadgeProps) {
  const statusClasses: Record<LeadStatus, string> = {
    new: "bg-[#0288D1]/10 text-[#0288D1]",
    contacted: "bg-[#ED6C02]/10 text-[#ED6C02]",
    converted: "bg-[#2E7D32]/10 text-[#2E7D32]",
    declined: "bg-[#D32F2F]/10 text-[#D32F2F]",
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Badge className={statusClasses[status]}>{status}</Badge>
      <Badge className={joinedAt ? "bg-[#2E7D32]/10 text-[#2E7D32]" : "bg-[#8D8A87]/10 text-[#8D8A87]"}>
        {joinedAt ? "Joined" : "Not Joined"}
      </Badge>
      <Badge className={joinedViaReferral ? "bg-[#C73E1D]/10 text-[#C73E1D]" : "bg-[#8D8A87]/10 text-[#8D8A87]"}>
        {joinedViaReferral ? "Referral Used" : "No Referral"}
      </Badge>
      <Badge className={commissionEligible ? "bg-[#2E7D32]/10 text-[#2E7D32]" : "bg-[#D4A854]/10 text-[#B8872E]"}>
        {commissionEligible ? "Commission Eligible" : "Information Only"}
      </Badge>
    </div>
  );
}
