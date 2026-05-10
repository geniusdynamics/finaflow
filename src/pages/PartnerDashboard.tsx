import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { formatKES } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building, DollarSign, TrendingUp, Gift, Link2, Copy, CheckCircle, Users, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export function PartnerDashboard() {
  const { data: clients } = trpc.partner.clients.useQuery();
  const { data: commissions } = trpc.partner.commissions.useQuery({});
  const { data: referrals } = trpc.businesses.myReferrals.useQuery();
  const { data: tier } = trpc.businesses.myTier.useQuery();
  const generateCode = trpc.businesses.generateReferralCode.useMutation({
    onSuccess: (data) => {
      toast.success(`Referral code generated: ${data.code}`);
      utils.businesses.myReferrals.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const calculate = trpc.partner.calculate.useMutation({
    onSuccess: () => { toast.success("Commissions recalculated"); utils.partner.commissions.invalidate(); },
    onError: (err) => toast.error(err.message),
  });
  const utils = trpc.useUtils();

  const [copied, setCopied] = useState(false);

  const referralCode = referrals?.referralCode ?? tier?.referralCode ?? null;
  const referralLink = referralCode
    ? `${window.location.origin}/login?ref=${referralCode}`
    : null;

  const totalCommission = commissions?.reduce((s, c) => s + parseFloat(c.commissionAmount ?? "0"), 0) ?? 0;
  const pendingCommission = commissions?.filter(c => c.status === "pending").reduce((s, c) => s + parseFloat(c.commissionAmount ?? "0"), 0) ?? 0;

  function copyLink() {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  const handleGenerateCode = () => {
    generateCode.mutate({});
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Partner Dashboard</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">Manage client businesses, referrals, and track revenue share</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleGenerateCode} disabled={generateCode.isPending}>
              <RefreshCw className="mr-1 h-4 w-4" />{generateCode.isPending ? "Generating..." : "Generate Code"}
            </Button>
            <Button onClick={() => calculate.mutate({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 })} disabled={calculate.isPending} className="bg-[#C73E1D]">
              <DollarSign className="mr-1 h-4 w-4" />{calculate.isPending ? "Calculating..." : "Calculate Commissions"}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card className="border-[#E8E0D8]"><CardContent className="p-4">
            <div className="flex items-center gap-2"><Building className="h-4 w-4 text-[#2E7D32]"/><span className="text-xs uppercase text-[#8D8A87]">Clients</span></div>
            <p className="mt-2 font-mono text-2xl font-semibold text-[#2E7D32]">{clients?.length ?? 0}</p>
          </CardContent></Card>
          <Card className="border-[#E8E0D8]"><CardContent className="p-4">
            <div className="flex items-center gap-2"><Gift className="h-4 w-4 text-[#C73E1D]"/><span className="text-xs uppercase text-[#8D8A87]">Referrals</span></div>
            <p className="mt-2 font-mono text-2xl font-semibold text-[#C73E1D]">{referrals?.referrals?.length ?? 0}</p>
          </CardContent></Card>
          <Card className="border-[#E8E0D8]"><CardContent className="p-4">
            <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-[#D4A854]"/><span className="text-xs uppercase text-[#8D8A87]">Total Commission</span></div>
            <p className="mt-2 font-mono text-2xl font-semibold text-[#D4A854]">{formatKES(totalCommission.toFixed(2))}</p>
          </CardContent></Card>
          <Card className="border-[#E8E0D8]"><CardContent className="p-4">
            <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-[#ED6C02]"/><span className="text-xs uppercase text-[#8D8A87]">Pending Payout</span></div>
            <p className="mt-2 font-mono text-2xl font-semibold text-[#ED6C02]">{formatKES(pendingCommission.toFixed(2))}</p>
          </CardContent></Card>
        </div>

        {/* Referral Section */}
        <Card className="border-[#E8E0D8] bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-lg flex items-center gap-2"><Gift className="h-5 w-5 text-[#C73E1D]"/> Refer & Earn</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[#8D8A87]">
              Share your referral link with business owners. Every new signup through your link gives them <strong>10% off their first month</strong> and tracks them to your portfolio.
            </p>

            {referralCode ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg border border-[#E8E0D8] bg-[#F5EDE6] px-3 py-2">
                  <Link2 className="h-4 w-4 text-[#8D8A87]" />
                  <span className="flex-1 text-sm font-mono text-[#2D2A26] truncate">{referralLink}</span>
                  <Button size="sm" variant="ghost" onClick={copyLink}>
                    {copied ? <CheckCircle className="h-4 w-4 text-[#2E7D32]" /> : <Copy className="h-4 w-4 text-[#8D8A87]" />}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#8D8A87]">Referral Code:</span>
                  <span className="rounded bg-[#C73E1D]/10 px-2 py-0.5 font-mono text-sm font-semibold text-[#C73E1D]">{referralCode}</span>
                  <Button size="sm" variant="ghost" onClick={handleGenerateCode} disabled={generateCode.isPending}>
                    <RefreshCw className="h-3 w-3" /> Regenerate
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm text-[#8D8A87]">No referral code yet. Generate one to start tracking referrals.</p>
                <Button size="sm" className="bg-[#C73E1D]" onClick={handleGenerateCode} disabled={generateCode.isPending}>
                  {generateCode.isPending ? "Generating..." : "Generate Code"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Referrals List */}
        {referrals?.referrals && referrals.referrals.length > 0 && (
          <Card className="border-[#E8E0D8]">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg flex items-center gap-2"><Users className="h-5 w-5 text-[#2E7D32]"/> Referred Businesses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b"><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Business</th><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Account ID</th><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Plan</th><th className="pb-2 text-center text-xs uppercase text-[#8D8A87]">Discount</th></tr></thead>
                  <tbody className="divide-y">{referrals.referrals.map(r => (
                    <tr key={r.id} className="hover:bg-[#F5EDE6]/50">
                      <td className="py-2 text-sm font-medium">{r.name}</td>
                      <td className="py-2 font-mono text-xs text-[#8D8A87]">{r.accountId}</td>
                      <td className="py-2 text-xs capitalize text-[#8D8A87]">{r.plan}</td>
                      <td className="py-2 text-center">{r.firstMonthDiscountApplied ? <span className="rounded-full bg-[#2E7D32]/10 px-2 py-0.5 text-xs text-[#2E7D32]">10% Applied</span> : <span className="text-xs text-[#8D8A87]">-</span>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Client List */}
        <Card className="border-[#E8E0D8]"><CardHeader className="pb-3"><CardTitle className="font-serif text-lg flex items-center gap-2"><Building className="h-5 w-5 text-[#2E7D32]"/> Client Businesses</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b"><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Name</th><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Plan</th><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Status</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Rev Share</th></tr></thead>
                <tbody className="divide-y">{clients?.map(c => (
                  <tr key={c.id} className="hover:bg-[#F5EDE6]/50">
                    <td className="py-3 text-sm font-medium">{c.name}{c.isDemo && <span className="ml-2 rounded bg-[#8D8A87]/10 px-1.5 py-0.5 text-[10px] text-[#8D8A87]">DEMO</span>}</td>
                    <td className="py-3 text-xs text-[#8D8A87]"><span className="rounded-full bg-[#F5EDE6] px-2 py-0.5 capitalize">{c.plan}</span></td>
                    <td className="py-3 text-xs"><span className={`rounded-full px-2 py-0.5 ${c.isActive ? "bg-[#2E7D32]/10 text-[#2E7D32]" : "bg-[#D32F2F]/10 text-[#D32F2F]"}`}>{c.isActive ? "Active" : "Inactive"}</span></td>
                    <td className="py-3 text-right font-mono text-sm">{c.revSharePercent}%</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {(!clients || clients.length === 0) && <p className="py-8 text-center text-sm text-[#8D8A87]">No client businesses yet.</p>}
          </CardContent>
        </Card>

        {/* Commission History */}
        {commissions && commissions.length > 0 && (
          <Card className="border-[#E8E0D8]"><CardHeader className="pb-3"><CardTitle className="font-serif text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5 text-[#D4A854]"/> Commission History</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b"><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Period</th><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Business</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Subscription</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Rate</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Commission</th><th className="pb-2 text-center text-xs uppercase text-[#8D8A87]">Status</th></tr></thead>
                  <tbody className="divide-y">{commissions.map(c => (
                    <tr key={c.id} className="hover:bg-[#F5EDE6]/50">
                      <td className="py-2 text-xs text-[#8D8A87]">{c.month}/{c.year}</td>
                      <td className="py-2 text-sm">{(c as any).businessName}</td>
                      <td className="py-2 text-right font-mono text-sm">{formatKES(c.subscriptionAmount)}</td>
                      <td className="py-2 text-right text-xs">{c.commissionPercent}%</td>
                      <td className="py-2 text-right font-mono text-sm font-semibold text-[#D4A854]">{formatKES(c.commissionAmount)}</td>
                      <td className="py-2 text-center"><span className={`rounded-full px-2 py-0.5 text-xs ${c.status === "paid" ? "bg-[#2E7D32]/10 text-[#2E7D32]" : "bg-[#ED6C02]/10 text-[#ED6C02]"}`}>{c.status}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
