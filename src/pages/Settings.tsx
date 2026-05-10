import { useState } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, Camera, MessageSquare, Briefcase, Shield, Crown, Award, ArrowUpCircle, ArrowDownCircle, Users, MapPin, Gift, Clock } from "lucide-react";
import { toast } from "sonner";

const PLAN_DETAILS: Record<string, { label: string; price: string; businesses: number; branches: number; users: number; transactions: string; payroll: string; support: string; color: string; features: string[] }> = {
  free: { label: "Free", price: "KES 0/mo", businesses: 1, branches: 1, users: 1, transactions: "100 / month", payroll: "No", support: "Community", color: "text-[#8D8A87]", features: ["1 business", "1 branch", "1 user", "Basic sales & expenses", "M-PESA import"] },
  starter: { label: "Starter", price: "KES 500/mo", businesses: 1, branches: 1, users: 3, transactions: "5,000 / month", payroll: "No", support: "Email", color: "text-[#D4A854]", features: ["1 business", "1 branch", "3 users", "Recurring bills", "Email support"] },
  growth: { label: "Growth", price: "KES 1,500/mo", businesses: 3, branches: 5, users: 5, transactions: "20,000 / month", payroll: "Yes", support: "Priority", color: "text-[#2E7D32]", features: ["3 businesses", "5 branches", "5 users", "Full payroll", "Priority support"] },
  pro: { label: "Pro", price: "KES 3,000/mo", businesses: 10, branches: 99, users: 99, transactions: "Unlimited", payroll: "Yes", support: "Dedicated", color: "text-[#C73E1D]", features: ["10 businesses", "Unlimited branches", "Unlimited users", "API access", "Dedicated support"] },
};

type PlanKey = "free" | "starter" | "growth" | "pro";

export function Settings() {
  const { user } = useAuth();
  const canManage = hasPermission(user?.role ?? "viewer", PERMISSIONS.SETTINGS_MANAGE);
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<"features" | "account">("features");

  const { data: settings } = trpc.settings.list.useQuery();
  const { data: subscription } = trpc.accountSubscriptions.mySubscription.useQuery();
  const changePlan = trpc.accountSubscriptions.changePlan.useMutation({
    onSuccess: (data) => { toast.success(data.message); utils.accountSubscriptions.mySubscription.invalidate(); },
    onError: (err) => toast.error(err.message),
  });
  const extendTrial = trpc.accountSubscriptions.extendTrial.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.accountSubscriptions.mySubscription.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const setSetting = trpc.settings.set.useMutation({
    onSuccess: () => { utils.settings.list.invalidate(); toast.success("Setting saved"); },
    onError: (err) => toast.error(err.message),
  });

  const toggle = (key: string) => {
    const current = settings?.[key] === "true";
    setSetting.mutate({ key, value: String(!current) });
  };

  const allPlans: PlanKey[] = ["free", "starter", "growth", "pro"];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Settings</h1>
          <p className="mt-1 text-sm text-[#8D8A87]">Configure Finaflow for your business needs</p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 rounded-lg border border-[#E8E0D8] bg-white p-1 w-fit">
          <button onClick={() => setTab("features")} className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${tab === "features" ? "bg-[#C73E1D] text-white" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <SettingsIcon className="inline h-4 w-4 mr-1" />Features
          </button>
          <button onClick={() => setTab("account")} className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${tab === "account" ? "bg-[#C73E1D] text-white" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <Shield className="inline h-4 w-4 mr-1" />Account
          </button>
        </div>

        {tab === "features" && (
          <>
            <Card className="border-[#E8E0D8]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-serif text-lg">
                  <Camera className="h-5 w-5 text-[#C73E1D]" />
                  Photos & Attachments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-[#8D8A87]">Enable or disable photo capture on entry screens to save storage.</p>
                <div className="flex items-center justify-between rounded-lg border border-[#E8E0D8] px-4 py-3">
                  <div>
                    <Label className="text-sm font-medium">Daily Sales Photos</Label>
                    <p className="text-xs text-[#8D8A87]">Allow attaching sales tickets and snapshots</p>
                  </div>
                  <Switch checked={settings?.photosDailySales === "true"} onCheckedChange={() => toggle("photosDailySales")} disabled={!canManage} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[#E8E0D8] px-4 py-3">
                  <div>
                    <Label className="text-sm font-medium">Expense Photos</Label>
                    <p className="text-xs text-[#8D8A87]">Allow attaching receipt photos to expenses</p>
                  </div>
                  <Switch checked={settings?.photosExpenses === "true"} onCheckedChange={() => toggle("photosExpenses")} disabled={!canManage} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[#E8E0D8] px-4 py-3">
                  <div>
                    <Label className="text-sm font-medium">Bill Photos</Label>
                    <p className="text-xs text-[#8D8A87]">Allow attaching photos to bills</p>
                  </div>
                  <Switch checked={settings?.photosBills === "true"} onCheckedChange={() => toggle("photosBills")} disabled={!canManage} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#E8E0D8]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-serif text-lg">
                  <MessageSquare className="h-5 w-5 text-[#D4A854]" />
                  Feedback & Support
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-[#E8E0D8] px-4 py-3">
                  <div>
                    <Label className="text-sm font-medium">Enable User Feedback</Label>
                    <p className="text-xs text-[#8D8A87]">Allow collecting feedback via questionnaires</p>
                  </div>
                  <Switch checked={settings?.feedbackEnabled === "true"} onCheckedChange={() => toggle("feedbackEnabled")} disabled={!canManage} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#E8E0D8]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-serif text-lg">
                  <Briefcase className="h-5 w-5 text-[#2E7D32]" />
                  Multi-Business
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-[#E8E0D8] px-4 py-3">
                  <div>
                    <Label className="text-sm font-medium">Enable Multi-Business Support</Label>
                    <p className="text-xs text-[#8D8A87]">Allow creating and switching between multiple businesses</p>
                  </div>
                  <Switch checked={settings?.multiBusiness === "true"} onCheckedChange={() => toggle("multiBusiness")} disabled={!canManage} />
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {tab === "account" && (
          <>
            {/* Current Plan Card */}
            <Card className="border-[#E8E0D8]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-serif text-lg">
                  <Crown className="h-5 w-5 text-[#D4A854]" />
                  Current Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {subscription ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-[#E8E0D8] bg-[#F5EDE6] p-4">
                      <div>
                        <p className="text-lg font-semibold text-[#2D2A26]">{PLAN_DETAILS[subscription.plan]?.label ?? subscription.plan}</p>
                        <p className="text-xs text-[#8D8A87]">{PLAN_DETAILS[subscription.plan]?.price ?? subscription.priceLabel ?? ""}</p>
                      </div>
                      <div className="text-right">
                        {subscription.isTrial ? (
                          <span className="rounded-full bg-[#D4A854]/10 px-3 py-1 text-xs font-medium text-[#D4A854]">
                            <Clock className="inline h-3 w-3 mr-1" />{subscription.trialDaysRemaining} days trial
                          </span>
                        ) : (
                          <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                            subscription.subscriptionStatus === "active" ? "bg-[#2E7D32]/10 text-[#2E7D32]" :
                            subscription.subscriptionStatus === "expired" ? "bg-[#D32F2F]/10 text-[#D32F2F]" :
                            "bg-[#ED6C02]/10 text-[#ED6C02]"
                          }`}>{subscription.subscriptionStatus}</span>
                        )}
                      </div>
                    </div>

                    {/* Usage stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-[#E8E0D8] p-3">
                        <div className="flex items-center gap-1 text-xs text-[#8D8A87]"><Briefcase className="h-3 w-3" /> Businesses</div>
                        <p className="mt-1 font-mono text-lg font-semibold text-[#2D2A26]">{subscription.currentBusinesses} / {subscription.maxBusinesses === 99 ? "∞" : subscription.maxBusinesses}</p>
                      </div>
                      <div className="rounded-lg border border-[#E8E0D8] p-3">
                        <div className="flex items-center gap-1 text-xs text-[#8D8A87]"><MapPin className="h-3 w-3" /> Branches</div>
                        <p className="mt-1 font-mono text-lg font-semibold text-[#2D2A26]">{subscription.currentBranches} / {subscription.maxBranches === 99 ? "∞" : subscription.maxBranches}</p>
                      </div>
                      <div className="rounded-lg border border-[#E8E0D8] p-3">
                        <div className="flex items-center gap-1 text-xs text-[#8D8A87]"><Users className="h-3 w-3" /> Users</div>
                        <p className="mt-1 font-mono text-lg font-semibold text-[#2D2A26]">{subscription.currentUsers} / {subscription.maxUsers === 99 ? "∞" : subscription.maxUsers}</p>
                      </div>
                      <div className="rounded-lg border border-[#E8E0D8] p-3">
                        <div className="flex items-center gap-1 text-xs text-[#8D8A87]"><Award className="h-3 w-3" /> Transactions</div>
                        <p className="mt-1 font-mono text-lg font-semibold text-[#2D2A26]">{subscription.transactionQuotaLabel}</p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border border-[#E8E0D8] p-3">
                        <p className="text-xs text-[#8D8A87]">Payroll</p>
                        <p className="mt-1 text-sm font-semibold text-[#2D2A26]">{subscription.payrollAvailable ? "Available" : "Not included"}</p>
                      </div>
                      <div className="rounded-lg border border-[#E8E0D8] p-3">
                        <p className="text-xs text-[#8D8A87]">Support Tier</p>
                        <p className="mt-1 text-sm font-semibold text-[#2D2A26]">{subscription.supportTier}</p>
                      </div>
                      <div className="rounded-lg border border-[#E8E0D8] p-3">
                        <p className="text-xs text-[#8D8A87]">Payment Method</p>
                        <p className="mt-1 text-sm font-semibold text-[#2D2A26]">{subscription.hasPaymentMethodOnFile ? "On file" : "Not on file"}</p>
                      </div>
                      <div className="rounded-lg border border-[#E8E0D8] p-3">
                        <p className="text-xs text-[#8D8A87]">Trial Extension</p>
                        <p className="mt-1 text-sm font-semibold text-[#2D2A26]">{subscription.trialExtensionUsedAt ? "Used" : subscription.canExtendTrial ? "Available" : "Not available"}</p>
                      </div>
                    </div>

                    {subscription.isTrial && (
                      <div className="rounded-lg border border-[#E8E0D8] bg-white p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-[#2D2A26]">Trial lifecycle</p>
                            <p className="text-xs text-[#8D8A87]">
                              {subscription.trialDaysRemaining} days remaining. {subscription.canExtendTrial ? "One 14-day extension is still available." : "No further extension is available."}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="border-[#C73E1D] text-[#C73E1D]"
                            disabled={!subscription.canExtendTrial || extendTrial.isPending}
                            onClick={() => extendTrial.mutate()}
                          >
                            {extendTrial.isPending ? "Extending..." : "Extend Trial by 14 Days"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Referred by */}
                    {subscription.referredBy && (
                      <div className="flex items-center gap-2 rounded-lg border border-[#E8E0D8] bg-[#F5EDE6] px-3 py-2">
                        <Gift className="h-4 w-4 text-[#C73E1D]" />
                        <span className="text-sm text-[#2D2A26]">
                          Referred by <strong>{subscription.referredBy.name}</strong>
                        </span>
                      </div>
                    )}

                    <div className="space-y-1 text-xs text-[#8D8A87]">
                      <p>
                        Subscription applies to all businesses under account <span className="font-mono text-[#2D2A26]">{subscription.accountId}</span>
                      </p>
                      <p>
                        Account ID: <span className="font-mono text-[#2D2A26]">{subscription.accountId}</span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[#8D8A87]">Loading plan info...</p>
                )}
              </CardContent>
            </Card>

            {/* Change Plan Card */}
            <Card className="border-[#E8E0D8]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-serif text-lg">
                  <Award className="h-5 w-5 text-[#C73E1D]" />
                  Change Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {allPlans.map((planKey) => {
                    const plan = PLAN_DETAILS[planKey];
                    const isCurrent = subscription?.plan === planKey;
                    const isUpgrade = allPlans.indexOf(planKey) > allPlans.indexOf(subscription?.plan ?? "free");
                    return (
                      <div key={planKey} className={`rounded-lg border p-3 ${isCurrent ? "border-[#C73E1D] ring-1 ring-[#C73E1D]" : "border-[#E8E0D8]"}`}>
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-sm text-[#2D2A26]">{plan.label}</p>
                          {isCurrent && <span className="rounded-full bg-[#C73E1D]/10 px-2 py-0.5 text-[10px] text-[#C73E1D]">Current</span>}
                        </div>
                        <p className="mt-1 text-xs text-[#8D8A87]">{plan.price}</p>
                        <div className="mt-2 space-y-1 text-[10px] text-[#8D8A87]">
                          <p>Businesses: {plan.businesses === 99 ? "Unlimited" : plan.businesses}</p>
                          <p>Branches / business: {plan.branches === 99 ? "Unlimited" : plan.branches}</p>
                          <p>Users: {plan.users === 99 ? "Unlimited" : plan.users}</p>
                          <p>Transactions: {plan.transactions}</p>
                          <p>Payroll: {plan.payroll}</p>
                          <p>Support: {plan.support}</p>
                        </div>
                        <ul className="mt-2 space-y-1">
                          {plan.features.map((f, i) => (
                            <li key={i} className="flex items-center gap-1 text-[10px] text-[#2D2A26]">
                              <span className="text-[#2E7D32]">✓</span> {f}
                            </li>
                          ))}
                        </ul>
                        {!isCurrent && (
                          <Button
                            size="sm"
                            className={`mt-3 w-full ${isUpgrade ? "bg-[#C73E1D]" : "bg-[#8D8A87]"}`}
                            onClick={() => {
                              const confirmMsg = isUpgrade
                                ? `Upgrade to ${plan.label} (${plan.price})?`
                                : `Downgrade to ${plan.label} (${plan.price})?\n\nDowngrading may limit existing branches and users.`;
                              if (confirm(confirmMsg)) {
                                changePlan.mutate({ plan: planKey });
                              }
                            }}
                            disabled={changePlan.isPending}
                          >
                            {isUpgrade ? <ArrowUpCircle className="mr-1 h-3 w-3" /> : <ArrowDownCircle className="mr-1 h-3 w-3" />}
                            {changePlan.isPending ? "..." : isUpgrade ? "Upgrade" : "Downgrade"}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
