// ABOUTME: Hosts the partner workspace for referrals, leads, allocations, and commission history.
// ABOUTME: Keeps the dashboard role-aware by surfacing owner allocation management only to partner/admin users.
import { useEffect, useMemo, useState } from "react";
import {
  Building,
  CheckCircle,
  Copy,
  DollarSign,
  Eye,
  Gift,
  Key,
  Link2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { AllocationManagement } from "@/components/partner/AllocationManagement";
import { LeadsTab } from "@/components/partner/LeadsTab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { formatKES } from "@/lib/utils";
import { trpc } from "@/providers/trpc";

type DashboardTab = "overview" | "leads" | "allocations" | "commissions";

function getCommissionBusinessName(commission: object) {
  return "businessName" in commission && typeof commission.businessName === "string"
    ? commission.businessName
    : "Business";
}

export function PartnerDashboard() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const canSeePartnerPortfolio = user?.userType === "partner" || user?.role === "admin" || Boolean(user?.isSuperAdmin);
  const canManagePartnerAllocations = user?.role === "owner" || user?.userType === "partner" || user?.role === "admin" || Boolean(user?.isSuperAdmin);
  const { data: clients } = trpc.partner.clients.useQuery();
  const { data: commissions } = trpc.partner.commissions.useQuery({});
  const { data: ownerAllocations } = trpc.partner.listOwnerAllocations.useQuery(undefined, {
    enabled: canManagePartnerAllocations,
  });
  const { data: referrals } = trpc.businesses.myReferrals.useQuery();
  const { data: tier } = trpc.businesses.myTier.useQuery();
  const { data: leadStats } = trpc.leads.stats.useQuery();
  const [tab, setTab] = useState<DashboardTab>("overview");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!canManagePartnerAllocations && tab === "allocations") {
      setTab("overview");
    }
    if (!canSeePartnerPortfolio && tab === "commissions") {
      setTab("overview");
    }
  }, [canManagePartnerAllocations, canSeePartnerPortfolio, tab]);

  const generateCode = trpc.businesses.generateReferralCode.useMutation({
    onSuccess: (data) => {
      toast.success(`Referral code generated: ${data.code}`);
      utils.businesses.myReferrals.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const calculate = trpc.partner.calculate.useMutation({
    onSuccess: () => {
      toast.success("Commissions recalculated");
      utils.partner.commissions.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const referralCode = referrals?.referralCode ?? tier?.referralCode ?? null;
  const referralLink = referralCode
    ? `${window.location.origin}/login?ref=${referralCode}`
    : null;

  const totalCommission = useMemo(() => {
    return commissions?.reduce((sum, commission) => sum + parseFloat(commission.commissionAmount ?? "0"), 0) ?? 0;
  }, [commissions]);

  const pendingCommission = useMemo(() => {
    return commissions
      ?.filter((commission) => commission.status === "pending")
      .reduce((sum, commission) => sum + parseFloat(commission.commissionAmount ?? "0"), 0) ?? 0;
  }, [commissions]);

  const allocatedPartnersCount = useMemo(() => {
    if (!ownerAllocations || !user?.currentBusinessId) return 0;

    return new Set(
      ownerAllocations
        .filter((allocation) => allocation.ownerBusinessId === user.currentBusinessId && allocation.status === "active")
        .map((allocation) => allocation.partnerUserId),
    ).size;
  }, [ownerAllocations, user?.currentBusinessId]);

  const summaryCards = [
    ...(canSeePartnerPortfolio ? [
      { label: "Clients", value: clients?.length ?? 0, icon: Building, color: "text-[#2E7D32]" },
      { label: "Referrals", value: referrals?.referrals?.length ?? 0, icon: Gift, color: "text-[#C73E1D]" },
      { label: "Total Commission", value: formatKES(totalCommission.toFixed(2)), icon: DollarSign, color: "text-[#D4A854]" },
      { label: "Pending Payout", value: formatKES(pendingCommission.toFixed(2)), icon: DollarSign, color: "text-[#ED6C02]" },
    ] : []),
    ...(canManagePartnerAllocations ? [
      { label: "Allocated Partners", value: allocatedPartnersCount, icon: Key, color: "text-[#C73E1D]" },
    ] : []),
    { label: "Leads", value: leadStats?.total ?? 0, icon: Users, color: "text-[#0288D1]" },
    { label: "Joined Leads", value: leadStats?.joined ?? 0, icon: CheckCircle, color: "text-[#2E7D32]" },
    { label: "Referral Used", value: leadStats?.referralUsed ?? 0, icon: Link2, color: "text-[#C73E1D]" },
    { label: "Eligible Leads", value: leadStats?.commissionEligible ?? 0, icon: UserPlus, color: "text-[#D4A854]" },
  ];

  const copyLink = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Partner Dashboard</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">Manage client businesses, referrals, leads, and revenue share.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => calculate.mutate({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 })}
              disabled={calculate.isPending}
              className="w-full bg-[#C73E1D] sm:w-auto"
            >
              <DollarSign className="mr-1 h-4 w-4" />
              {calculate.isPending ? "Calculating..." : "Calculate Commissions"}
            </Button>
            <Button
              variant="outline"
              onClick={() => generateCode.mutate({})}
              disabled={generateCode.isPending}
              className="w-full sm:w-auto"
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              {generateCode.isPending ? "Generating..." : "Generate Code"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
          {summaryCards.map((card) => (
            <Card key={card.label} className="border-[#E8E0D8]">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
                  <span className="text-[11px] uppercase leading-tight text-[#8D8A87]">{card.label}</span>
                </div>
                <p className={`mt-1.5 font-mono text-xl font-semibold ${card.color}`}>{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[#E8E0D8]">
          <button
            type="button"
            onClick={() => setTab("overview")}
            className={`px-4 py-2 text-sm font-medium ${tab === "overview" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}
          >
            <Eye className="mr-1 inline h-4 w-4" />
            Overview
          </button>
          <button
            type="button"
            onClick={() => setTab("leads")}
            className={`px-4 py-2 text-sm font-medium ${tab === "leads" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}
            data-testid="partner-tab-leads"
          >
            <Users className="mr-1 inline h-4 w-4" />
            Leads
          </button>
          {canManagePartnerAllocations && (
            <button
              type="button"
              onClick={() => setTab("allocations")}
              className={`px-4 py-2 text-sm font-medium ${tab === "allocations" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}
              data-testid="partner-tab-allocations"
            >
              <Key className="mr-1 inline h-4 w-4" />
              Partner Allocations
            </button>
          )}
          {canSeePartnerPortfolio && (
            <button
              type="button"
              onClick={() => setTab("commissions")}
              className={`px-4 py-2 text-sm font-medium ${tab === "commissions" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}
            >
              <TrendingDown className="mr-1 inline h-4 w-4" />
              Commissions
            </button>
          )}
        </div>

        {tab === "overview" && (
          <div className="mt-6 space-y-6">
            <Card className="border-[#E8E0D8] bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-serif text-lg">
                  <Gift className="h-5 w-5 text-[#C73E1D]" />
                  Refer &amp; Earn
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-[#8D8A87]">
                  Share your referral link with business owners. Every new signup through your link gives them <strong>10% off their first month</strong> and tracks them to your portfolio.
                </p>

                {referralCode ? (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 rounded-lg border border-[#E8E0D8] bg-[#F5EDE6] px-3 py-2 sm:flex-row sm:items-center">
                      <Link2 className="h-4 w-4 shrink-0 text-[#8D8A87]" />
                      <span className="min-w-0 flex-1 truncate text-sm font-mono text-[#2D2A26]">{referralLink}</span>
                      <Button size="sm" variant="ghost" onClick={copyLink} className="shrink-0">
                        {copied ? <CheckCircle className="h-4 w-4 text-[#2E7D32]" /> : <Copy className="h-4 w-4 text-[#8D8A87]" />}
                      </Button>
                    </div>
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                      <span className="text-xs text-[#8D8A87]">Referral Code:</span>
                      <span className="rounded bg-[#C73E1D]/10 px-2 py-0.5 font-mono text-sm font-semibold text-[#C73E1D]">{referralCode}</span>
                      <Button size="sm" variant="ghost" onClick={() => generateCode.mutate({})} disabled={generateCode.isPending}>
                        <RefreshCw className="h-3 w-3" /> Regenerate
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-[#8D8A87]">No referral code yet. Generate one to start tracking referrals.</p>
                    <Button size="sm" className="bg-[#C73E1D]" onClick={() => generateCode.mutate({})} disabled={generateCode.isPending}>
                      {generateCode.isPending ? "Generating..." : "Generate Code"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {canSeePartnerPortfolio && referrals?.referrals && referrals.referrals.length > 0 && (
              <Card className="border-[#E8E0D8]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 font-serif text-lg">
                    <Users className="h-5 w-5 text-[#2E7D32]" />
                    Referred Businesses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Business</th>
                          <th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Account ID</th>
                          <th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Plan</th>
                          <th className="pb-2 text-center text-xs uppercase text-[#8D8A87]">Discount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {referrals.referrals.map((referral) => (
                          <tr key={referral.id} className="hover:bg-[#F5EDE6]/50">
                            <td className="py-2 text-sm font-medium">{referral.name}</td>
                            <td className="py-2 font-mono text-xs text-[#8D8A87]">{referral.accountId}</td>
                            <td className="py-2 text-xs capitalize text-[#8D8A87]">{referral.plan}</td>
                            <td className="py-2 text-center">
                              {referral.firstMonthDiscountApplied ? (
                                <span className="rounded-full bg-[#2E7D32]/10 px-2 py-0.5 text-xs text-[#2E7D32]">10% Applied</span>
                              ) : (
                                <span className="text-xs text-[#8D8A87]">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {referrals.referrals.map((referral) => (
                      <div key={referral.id} className="rounded-lg border border-[#E8E0D8] bg-[#F5EDE6]/30 p-4">
                        <p className="text-sm font-medium">{referral.name}</p>
                        <p className="mb-2 font-mono text-xs text-[#8D8A87]">{referral.accountId}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full bg-[#F5EDE6] px-2 py-0.5 capitalize text-[#8D8A87]">{referral.plan}</span>
                          {referral.firstMonthDiscountApplied ? (
                            <span className="rounded-full bg-[#2E7D32]/10 px-2 py-0.5 text-[#2E7D32]">10% Applied</span>
                          ) : (
                            <span className="text-[#8D8A87]">-</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {canSeePartnerPortfolio && (
              <Card className="border-[#E8E0D8]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 font-serif text-lg">
                    <Building className="h-5 w-5 text-[#2E7D32]" />
                    Client Businesses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Name</th>
                          <th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Plan</th>
                          <th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Status</th>
                          <th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Rev Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {clients?.map((client) => (
                          <tr key={client.id} className="hover:bg-[#F5EDE6]/50">
                            <td className="py-3 text-sm font-medium">
                              {client.name}
                              {client.isDemo && <span className="ml-2 rounded bg-[#8D8A87]/10 px-1.5 py-0.5 text-[10px] text-[#8D8A87]">DEMO</span>}
                            </td>
                            <td className="py-3 text-xs text-[#8D8A87]">
                              <span className="rounded-full bg-[#F5EDE6] px-2 py-0.5 capitalize">{client.plan}</span>
                            </td>
                            <td className="py-3 text-xs">
                              <span className={`rounded-full px-2 py-0.5 ${client.isActive ? "bg-[#2E7D32]/10 text-[#2E7D32]" : "bg-[#D32F2F]/10 text-[#D32F2F]"}`}>
                                {client.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="py-3 text-right font-mono text-sm">{client.revSharePercent}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {clients?.map((client) => (
                      <div key={client.id} className="rounded-lg border border-[#E8E0D8] bg-[#F5EDE6]/30 p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-sm font-medium">{client.name}</span>
                          {client.isDemo && <span className="rounded bg-[#8D8A87]/10 px-1.5 py-0.5 text-[10px] text-[#8D8A87]">DEMO</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full bg-[#F5EDE6] px-2 py-0.5 capitalize text-[#8D8A87]">{client.plan}</span>
                          <span className={`rounded-full px-2 py-0.5 ${client.isActive ? "bg-[#2E7D32]/10 text-[#2E7D32]" : "bg-[#D32F2F]/10 text-[#D32F2F]"}`}>
                            {client.isActive ? "Active" : "Inactive"}
                          </span>
                          <span className="font-mono text-[#8D8A87]">{client.revSharePercent}% rev share</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {(!clients || clients.length === 0) && <p className="py-8 text-center text-sm text-[#8D8A87]">No client businesses yet.</p>}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {tab === "leads" && (
          <div className="mt-6">
            <LeadsTab />
          </div>
        )}

        {tab === "allocations" && canManagePartnerAllocations && (
          <div className="mt-6" data-testid="partner-allocation-management">
            <AllocationManagement />
          </div>
        )}

        {tab === "commissions" && canSeePartnerPortfolio && (
          <div className="mt-6 space-y-6">
            {commissions && commissions.length > 0 ? (
              <Card className="border-[#E8E0D8]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 font-serif text-lg">
                    <TrendingUp className="h-5 w-5 text-[#D4A854]" />
                    Commission History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Period</th>
                          <th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Business</th>
                          <th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Subscription</th>
                          <th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Rate</th>
                          <th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Commission</th>
                          <th className="pb-2 text-center text-xs uppercase text-[#8D8A87]">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {commissions.map((commission) => (
                          <tr key={commission.id} className="hover:bg-[#F5EDE6]/50">
                            <td className="py-2 text-xs text-[#8D8A87]">{commission.month}/{commission.year}</td>
                            <td className="py-2 text-sm">{getCommissionBusinessName(commission)}</td>
                            <td className="py-2 text-right font-mono text-sm">{formatKES(commission.subscriptionAmount ?? "")}</td>
                            <td className="py-2 text-right text-xs">{commission.commissionPercent}%</td>
                            <td className="py-2 text-right font-mono text-sm font-semibold text-[#D4A854]">{formatKES(commission.commissionAmount ?? "")}</td>
                            <td className="py-2 text-center">
                              <span className={`rounded-full px-2 py-0.5 text-xs ${commission.status === "paid" ? "bg-[#2E7D32]/10 text-[#2E7D32]" : "bg-[#ED6C02]/10 text-[#ED6C02]"}`}>
                                {commission.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {commissions.map((commission) => (
                      <div key={commission.id} className="rounded-lg border border-[#E8E0D8] bg-[#F5EDE6]/30 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs text-[#8D8A87]">{commission.month}/{commission.year}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${commission.status === "paid" ? "bg-[#2E7D32]/10 text-[#2E7D32]" : "bg-[#ED6C02]/10 text-[#ED6C02]"}`}>
                            {commission.status}
                          </span>
                        </div>
                        <p className="mb-2 text-sm">{getCommissionBusinessName(commission)}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono">{formatKES(commission.subscriptionAmount ?? "")} sub</span>
                          <span className="text-[#8D8A87]">{commission.commissionPercent}% rate</span>
                          <span className="font-mono font-semibold text-[#D4A854]">{formatKES(commission.commissionAmount ?? "")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-[#E8E0D8]">
                <CardContent className="py-12 text-center">
                  <TrendingUp className="mx-auto h-12 w-12 text-[#E8E0D8]" />
                  <p className="mt-3 text-sm text-[#8D8A87]">No commission history yet.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default PartnerDashboard;
