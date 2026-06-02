import { useState } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2, Key, Copy, CheckCircle, XCircle, Trash2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function AllocationManagement() {
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);
  const [selectedRights, setSelectedRights] = useState<"view_only" | "create_view" | "manage">("view_only");
  const [generatedCode, setGeneratedCode] = useState<{ code: string; link: string } | null>(null);
  const [revokeAllocationId, setRevokeAllocationId] = useState<number | null>(null);

  const { data: user } = trpc.auth.me.useQuery();
  const { data: businesses } = trpc.businesses.list.useQuery();
  const { data: allocations, isLoading } = trpc.partner.listOwnerAllocations.useQuery();
  const utils = trpc.useUtils();

  const generateMutation = trpc.partner.generateInvite.useMutation({
    onSuccess: (data) => {
      setGeneratedCode(data);
      toast.success("Allocation code generated successfully!");
      utils.partner.listOwnerAllocations.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to generate allocation code");
    },
  });

  const revokeMutation = trpc.partner.revoke.useMutation({
    onSuccess: () => {
      toast.success("Allocation revoked successfully!");
      setRevokeAllocationId(null);
      utils.partner.listOwnerAllocations.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to revoke allocation");
    },
  });

  const handleGenerate = () => {
    if (!selectedBusinessId) {
      toast.error("Please select a business");
      return;
    }
    generateMutation.mutate({
      businessId: selectedBusinessId,
      rightsProfile: selectedRights,
    });
  };

  const handleRevoke = () => {
    if (revokeAllocationId) {
      revokeMutation.mutate({ allocationId: revokeAllocationId });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
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
        return <Badge className="bg-[#8D8A87]/10 text-[#8D8A87]">{status}</Badge>;
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

  const businessIds = user?.businessIds || [];
  const businessList = businesses || [];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Partner Allocation Management</h1>
          <p className="mt-1 text-sm text-[#8D8A87]">
            Grant controlled access to your businesses for partner consultants and accountants
          </p>
        </div>

        {/* Generate Allocation Code */}
        <Card className="border-[#E8E0D8] bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-lg flex items-center gap-2">
              <Key className="h-5 w-5 text-[#C73E1D]" />
              Generate Allocation Code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[#8D8A87]">
              Create a one-time allocation code to grant a partner access to a specific business with defined permissions.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="business" className="text-xs text-[#8D8A87]">
                  Select Business
                </Label>
                <Select
                  value={selectedBusinessId?.toString() || ""}
                  onValueChange={(value) => setSelectedBusinessId(parseInt(value))}
                >
                  <SelectTrigger id="business" className="border-[#E8E0D8]">
                    <SelectValue placeholder="Choose a business" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessList.map((biz) => (
                      <SelectItem key={biz.id} value={biz.id.toString()}>
                        {biz.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rights" className="text-xs text-[#8D8A87]">
                  Access Rights
                </Label>
                <Select
                  value={selectedRights}
                  onValueChange={(value: any) => setSelectedRights(value)}
                >
                  <SelectTrigger id="rights" className="border-[#E8E0D8]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view_only">View Only</SelectItem>
                    <SelectItem value="create_view">Create & View</SelectItem>
                    <SelectItem value="manage">Manage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !selectedBusinessId}
              className="bg-[#C73E1D] hover:bg-[#A33317]"
            >
              {generateMutation.isPending ? "Generating..." : "Generate Code"}
            </Button>

            {generatedCode && (
              <div className="mt-4 space-y-3 rounded-lg border border-[#2E7D32] bg-[#2E7D32]/5 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-[#2E7D32]" />
                  <span className="font-medium text-[#2E7D32]">Allocation Code Generated!</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#8D8A87]">Code:</span>
                    <code className="flex-1 rounded bg-white px-2 py-1 font-mono text-sm font-semibold text-[#2D2A26]">
                      {generatedCode.code}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(generatedCode.code, "Code")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-[#8D8A87]" />
                    <span className="flex-1 truncate text-xs text-[#8D8A87]">{generatedCode.link}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(generatedCode.link, "Link")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-[#8D8A87]">
                  Share this code with your partner. It can only be used once.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Allocations */}
        <Card className="border-[#E8E0D8]">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#2E7D32]" />
              Partner Allocations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center text-sm text-[#8D8A87]">Loading allocations...</div>
            ) : !allocations || allocations.length === 0 ? (
              <div className="py-8 text-center">
                <Building2 className="mx-auto h-12 w-12 text-[#E8E0D8]" />
                <p className="mt-3 text-sm text-[#8D8A87]">
                  No partner allocations yet. Generate a code above to get started.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E8E0D8]">
                      <th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Business</th>
                      <th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Partner</th>
                      <th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Rights</th>
                      <th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Status</th>
                      <th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Created</th>
                      <th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E0D8]">
                    {allocations.map((allocation) => (
                      <tr key={allocation.id} className="hover:bg-[#F5EDE6]/50">
                        <td className="py-3 text-sm font-medium text-[#2D2A26]">
                          {allocation.businessName || `Business #${allocation.ownerBusinessId}`}
                        </td>
                        <td className="py-3 text-xs text-[#8D8A87]">
                          {allocation.partnerUserName || `Partner #${allocation.partnerUserId}`}
                          {allocation.partnerUserEmail && (
                            <div className="text-[10px] text-[#8D8A87]/70">{allocation.partnerUserEmail}</div>
                          )}
                        </td>
                        <td className="py-3">{getRightsBadge(allocation.rightsProfile)}</td>
                        <td className="py-3">{getStatusBadge(allocation.status)}</td>
                        <td className="py-3 text-xs text-[#8D8A87]">
                          {formatDistanceToNow(new Date(allocation.createdAt), { addSuffix: true })}
                        </td>
                        <td className="py-3 text-right">
                          {allocation.status === "active" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setRevokeAllocationId(allocation.id)}
                              className="text-[#D32F2F] hover:bg-[#D32F2F]/10 hover:text-[#D32F2F]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
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

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={revokeAllocationId !== null} onOpenChange={() => setRevokeAllocationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Partner Access?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately remove the partner's access to your business. They will no longer be able to view or
              manage any data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-[#D32F2F] hover:bg-[#B71C1C]"
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? "Revoking..." : "Revoke Access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
