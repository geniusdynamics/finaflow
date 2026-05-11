import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, Key, CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export function AllocationsTab() {
  const [allocationCode, setAllocationCode] = useState("");
  const { data: allocations, isLoading } = trpc.partner.listPartnerAllocations.useQuery();
  const utils = trpc.useUtils();

  const claimMutation = trpc.partner.claimInvite.useMutation({
    onSuccess: () => {
      toast.success("Allocation claimed successfully!");
      setAllocationCode("");
      utils.partner.listPartnerAllocations.invalidate();
      utils.auth.me.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to claim allocation");
    },
  });

  const handleClaim = () => {
    if (!allocationCode.trim()) {
      toast.error("Please enter an allocation code");
      return;
    }
    claimMutation.mutate({ code: allocationCode.trim().toUpperCase() });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-[#2E7D32]/10 text-[#2E7D32] hover:bg-[#2E7D32]/20">
            <CheckCircle className="mr-1 h-3 w-3" />
            Active
          </Badge>
        );
      case "revoked":
        return (
          <Badge className="bg-[#D32F2F]/10 text-[#D32F2F] hover:bg-[#D32F2F]/20">
            <XCircle className="mr-1 h-3 w-3" />
            Revoked
          </Badge>
        );
      default:
        return (
          <Badge className="bg-[#8D8A87]/10 text-[#8D8A87]">
            <Clock className="mr-1 h-3 w-3" />
            {status}
          </Badge>
        );
    }
  };

  const getRightsBadge = (rights: string) => {
    const colors = {
      view_only: "bg-[#0288D1]/10 text-[#0288D1]",
      create_view: "bg-[#ED6C02]/10 text-[#ED6C02]",
      manage: "bg-[#C73E1D]/10 text-[#C73E1D]",
    };
    const labels = {
      view_only: "View Only",
      create_view: "Create & View",
      manage: "Manage",
    };
    return (
      <Badge className={colors[rights as keyof typeof colors] || "bg-[#8D8A87]/10 text-[#8D8A87]"}>
        {labels[rights as keyof typeof labels] || rights}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Claim Allocation Card */}
      <Card className="border-[#E8E0D8] bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Key className="h-5 w-5 text-[#C73E1D]" />
            Claim Business Allocation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[#8D8A87]">
            Enter the allocation code provided by your client to gain access to their business.
          </p>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="allocationCode" className="text-xs text-[#8D8A87]">
                Allocation Code
              </Label>
              <Input
                id="allocationCode"
                placeholder="Enter allocation code (e.g., ALLOC12345678)"
                value={allocationCode}
                onChange={(e) => setAllocationCode(e.target.value.toUpperCase())}
                className="mt-1 border-[#E8E0D8] focus:border-[#C73E1D]"
                disabled={claimMutation.isPending}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleClaim}
                disabled={claimMutation.isPending || !allocationCode.trim()}
                className="bg-[#C73E1D] hover:bg-[#A33317]"
              >
                {claimMutation.isPending ? "Claiming..." : "Claim Access"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Allocated Businesses */}
      <Card className="border-[#E8E0D8]">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#2E7D32]" />
            Allocated Client Businesses
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-sm text-[#8D8A87]">Loading allocations...</div>
          ) : !allocations || allocations.length === 0 ? (
            <div className="py-8 text-center">
              <Building2 className="mx-auto h-12 w-12 text-[#E8E0D8]" />
              <p className="mt-3 text-sm text-[#8D8A87]">
                No allocated businesses yet. Enter an allocation code above to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E8E0D8]">
                    <th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Business</th>
                    <th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Owner Account</th>
                    <th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Rights</th>
                    <th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Status</th>
                    <th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Allocated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E0D8]">
                  {allocations.map((allocation) => (
                    <tr key={allocation.id} className="hover:bg-[#F5EDE6]/50">
                      <td className="py-3 text-sm font-medium text-[#2D2A26]">
                        {allocation.businessName || `Business #${allocation.ownerBusinessId}`}
                      </td>
                      <td className="py-3 text-xs text-[#8D8A87]">
                        {allocation.businessAccountId || `Account #${allocation.ownerAccountId}`}
                      </td>
                      <td className="py-3">{getRightsBadge(allocation.rightsProfile)}</td>
                      <td className="py-3">{getStatusBadge(allocation.status)}</td>
                      <td className="py-3 text-xs text-[#8D8A87]">
                        {formatDistanceToNow(new Date(allocation.createdAt), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
