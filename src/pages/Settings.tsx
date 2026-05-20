import { useState } from "react";
import { useSearchParams } from "react-router";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Settings as SettingsIcon, Camera, Briefcase, Shield, Crown, Award, ArrowUpCircle, ArrowDownCircle, Users, MapPin, Gift, Clock, Key, Trash2, Plus, Copy, CheckCircle, Webhook, AlertCircle, Plug, MessageSquare, Eye, RefreshCw, DollarSign } from "lucide-react";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as "features" | "account" | "integrations" | "feedback" | null;
  const [tab, setTab] = useState<"features" | "account" | "integrations" | "feedback">(tabParam || "features");

  const handleTabChange = (newTab: typeof tab) => {
    setTab(newTab);
    setSearchParams({ tab: newTab }, { replace: true });
  };
  
  // Feedback state
  const [qOpen, setQOpen] = useState(false);
  const [qForm, setQForm] = useState({ title: "", description: "" });
  const [questions, setQuestions] = useState<{ id: string; text: string; type: "text" | "rating" | "choice" | "yes_no"; required: boolean; options?: string[] }[]>([]);
  const [viewQ, setViewQ] = useState<number | null>(null);

  // Integrations state
  const [keyOpen, setKeyOpen] = useState(false);
  const [hookOpen, setHookOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [keyForm, setKeyForm] = useState({ name: "", scopes: ["read"] as string[] });
  const [hookForm, setHookForm] = useState({ name: "", url: "", events: ["bill.overdue"] as string[], secret: "" });
  const [selectedHook, setSelectedHook] = useState<number | null>(null);

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

  // Feedback queries and mutations
  const { data: questionnaires } = trpc.feedback.questionnaires.useQuery();
  const { data: responses } = trpc.feedback.responses.useQuery(
    { questionnaireId: viewQ ?? 0 },
    { enabled: viewQ !== null }
  );
  const createQ = trpc.feedback.createQuestionnaire.useMutation({
    onSuccess: () => { setQOpen(false); setQForm({ title: "", description: "" }); setQuestions([]); utils.feedback.questionnaires.invalidate(); toast.success("Questionnaire created"); },
    onError: (err) => toast.error(err.message),
  });
  const deleteQ = trpc.feedback.deleteQuestionnaire.useMutation({
    onSuccess: () => { utils.feedback.questionnaires.invalidate(); toast.success("Questionnaire deleted"); },
  });
  const updateQ = trpc.feedback.updateQuestionnaire.useMutation({
    onSuccess: () => { utils.feedback.questionnaires.invalidate(); toast.success("Updated"); },
  });

  // Feedback helpers
  const addQuestion = () => {
    setQuestions(prev => [...prev, { id: crypto.randomUUID(), text: "", type: "text", required: true }]);
  };
  const updateQuestion = (id: string, field: string, value: any) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
  };
  const removeQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  // Integrations queries and mutations
  const { data: keys, refetch: refetchKeys } = trpc.integrations.listKeys.useQuery();
  const { data: hooks, refetch: refetchHooks } = trpc.integrations.listWebhooks.useQuery();
  const { data: deliveries } = trpc.integrations.listDeliveries.useQuery(
    { webhookId: selectedHook ?? 0, limit: 50 },
    { enabled: selectedHook !== null }
  );

  const createKey = trpc.integrations.createKey.useMutation({
    onSuccess: (data) => { setNewKey(data.key); setKeyOpen(false); setKeyForm({ name: "", scopes: ["read"] }); refetchKeys(); toast.success("API key created — copy it now!"); },
    onError: (err) => toast.error(err.message),
  });
  const revokeKey = trpc.integrations.revokeKey.useMutation({ onSuccess: () => { refetchKeys(); toast.success("Key revoked"); } });
  const deleteKey = trpc.integrations.deleteKey.useMutation({ onSuccess: () => { refetchKeys(); toast.success("Key deleted"); } });

  const createHook = trpc.integrations.createWebhook.useMutation({
    onSuccess: () => { setHookOpen(false); setHookForm({ name: "", url: "", events: ["bill.overdue"], secret: "" }); refetchHooks(); toast.success("Webhook created"); },
    onError: (err) => toast.error(err.message),
  });
  const updateHook = trpc.integrations.updateWebhook.useMutation({ onSuccess: () => refetchHooks() });
  const deleteHook = trpc.integrations.deleteWebhook.useMutation({ onSuccess: () => { refetchHooks(); toast.success("Webhook deleted"); } });

  const syncRates = trpc.walletManagement.rates.sync.useMutation({
    onSuccess: (data) => { if (data.success) toast.success(data.message); else toast.error(data.error || "Sync failed"); },
    onError: (err) => toast.error(err.message),
  });

  const toggle = (key: string) => {
    const current = settings?.[key] === "true";
    setSetting.mutate({ key, value: String(!current) });
  };

  const copyKey = () => {
    if (newKey) { navigator.clipboard.writeText(newKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }
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
          <button onClick={() => handleTabChange("features")} className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${tab === "features" ? "bg-[#C73E1D] text-white" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <SettingsIcon className="inline h-4 w-4 mr-1" />Features
          </button>
          <button onClick={() => handleTabChange("account")} className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${tab === "account" ? "bg-[#C73E1D] text-white" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <Shield className="inline h-4 w-4 mr-1" />Account
          </button>
          <button onClick={() => handleTabChange("integrations")} className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${tab === "integrations" ? "bg-[#C73E1D] text-white" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <Plug className="inline h-4 w-4 mr-1" />Integrations
          </button>
          <button onClick={() => handleTabChange("feedback")} className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${tab === "feedback" ? "bg-[#C73E1D] text-white" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <MessageSquare className="inline h-4 w-4 mr-1" />Feedback
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
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {allPlans.map((planKey) => {
                    const plan = PLAN_DETAILS[planKey];
                    const isCurrent = subscription?.plan === planKey;
                    const isUpgrade = allPlans.indexOf(planKey) > allPlans.indexOf((subscription?.plan as PlanKey) ?? "free");
                    return (
                      <div key={planKey} className={`rounded-lg border p-3 ${isCurrent ? "border-[#C73E1D] ring-1 ring-[#C73E1D]" : "border-[#E8E0D8]"}`}>
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-sm text-[#2D2A26]">{plan.label}</p>
                          {isCurrent && <span className="rounded-full bg-[#2E7D32]/10 px-2 py-0.5 text-[10px] text-[#2E7D32]">Subscribed</span>}
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
                            className={`mt-3 w-full ${isUpgrade ? "bg-[#C73E1D]" : "bg-[#2E7D32]"}`}
                            onClick={() => {
                              const confirmMsg = isUpgrade
                                ? `Upgrade to ${plan.label} (${plan.price})?`
                                : `Subscribe to ${plan.label} (${plan.price})?\n\nChanging your plan may affect existing branches and users.`;
                              if (confirm(confirmMsg)) {
                                changePlan.mutate({ plan: planKey });
                              }
                            }}
                            disabled={changePlan.isPending}
                          >
                            {isUpgrade ? <ArrowUpCircle className="mr-1 h-3 w-3" /> : <ArrowDownCircle className="mr-1 h-3 w-3" />}
                            {changePlan.isPending ? "..." : isUpgrade ? "Upgrade" : "Subscribe"}
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

        {tab === "integrations" && (
          <>
            {/* API Keys */}
            <Card className="border-[#E8E0D8]"><CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-lg flex items-center gap-2"><Key className="h-5 w-5 text-[#D4A854]"/> API Keys</CardTitle>
              <Dialog open={keyOpen} onOpenChange={setKeyOpen}><DialogTrigger asChild><Button size="sm" className="bg-[#C73E1D]"><Plus className="mr-1 h-3 w-3" />New Key</Button></DialogTrigger>
                <DialogContent className="bg-white"><DialogHeader><DialogTitle className="font-serif text-xl">Create API Key</DialogTitle></DialogHeader>
                  <form onSubmit={e => { e.preventDefault(); createKey.mutate(keyForm); }} className="space-y-3">
                    <div><Label>Name</Label><Input value={keyForm.name} onChange={e => setKeyForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. POS Integration" required /></div>
                    <div><Label>Scopes</Label>
                      <div className="flex flex-wrap gap-2">
                        {["read", "write", "sales", "expenses", "webhooks"].map(s => (
                          <label key={s} className="flex items-center gap-1 rounded-full border border-[#E8E0D8] px-3 py-1 text-xs cursor-pointer">
                            <input type="checkbox" checked={keyForm.scopes.includes(s)} onChange={e => {
                              setKeyForm(p => ({ ...p, scopes: e.target.checked ? [...p.scopes, s] : p.scopes.filter(x => x !== s) }));
                            }} /> {s}
                          </label>
                        ))}
                      </div>
                    </div>
                    <Button type="submit" className="w-full bg-[#C73E1D]" disabled={createKey.isPending}>Generate Key</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
              <CardContent>
                {newKey && (
                  <div className="mb-4 rounded-lg bg-[#F5EDE6] p-3">
                    <p className="text-xs text-[#8D8A87]">Your API key (copy now — shown once):</p>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="flex-1 rounded bg-white px-2 py-1 text-xs font-mono text-[#2D2A26]">{newKey}</code>
                      <Button size="sm" variant="ghost" onClick={copyKey}>{copied ? <CheckCircle className="h-4 w-4 text-[#2E7D32]" /> : <Copy className="h-4 w-4" />}</Button>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {keys?.map(k => (
                    <div key={k.id} className={`flex items-center justify-between rounded-lg border p-3 ${k.isActive ? "border-[#E8E0D8]" : "border-[#8D8A87]/30 opacity-50"}`}>
                      <div><p className="text-sm font-medium">{k.name}</p><p className="text-xs text-[#8D8A87]">{k.keyPrefix}*** • {k.scopes ? JSON.parse(JSON.stringify(k.scopes)).join(", ") : "read"}</p></div>
                      <div className="flex gap-1">
                        {k.isActive && <Button size="sm" variant="ghost" onClick={() => revokeKey.mutate({ id: k.id })}><AlertCircle className="h-4 w-4 text-[#ED6C02]" /></Button>}
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this key?")) deleteKey.mutate({ id: k.id }); }}><Trash2 className="h-4 w-4 text-[#D32F2F]" /></Button>
                      </div>
                    </div>
                  ))}
                  {(!keys || keys.length === 0) && <p className="text-sm text-[#8D8A87]">No API keys yet.</p>}
                </div>
              </CardContent>
            </Card>

            {/* Webhooks */}
            <Card className="border-[#E8E0D8]"><CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-lg flex items-center gap-2"><Webhook className="h-5 w-5 text-[#8D8A87]"/> Webhooks</CardTitle>
              <Dialog open={hookOpen} onOpenChange={setHookOpen}><DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="mr-1 h-3 w-3" />Add Webhook</Button></DialogTrigger>
                <DialogContent className="bg-white"><DialogHeader><DialogTitle className="font-serif text-xl">Add Webhook</DialogTitle></DialogHeader>
                  <form onSubmit={e => { e.preventDefault(); createHook.mutate({ name: hookForm.name, url: hookForm.url, events: hookForm.events as any, secret: hookForm.secret || undefined }); }} className="space-y-3">
                    <div><Label>Name</Label><Input value={hookForm.name} onChange={e => setHookForm(p => ({ ...p, name: e.target.value }))} required /></div>
                    <div><Label>URL</Label><Input value={hookForm.url} onChange={e => setHookForm(p => ({ ...p, url: e.target.value }))} placeholder="https://hooks.slack.com/..." required /></div>
                    <div><Label>Events</Label>
                      <div className="flex flex-wrap gap-2">
                        {["bill.overdue", "bill.paid", "sale.recorded", "expense.created", "payroll.processed", "low.balance"].map(ev => (
                          <label key={ev} className="flex items-center gap-1 rounded-full border border-[#E8E0D8] px-3 py-1 text-xs cursor-pointer">
                            <input type="checkbox" checked={hookForm.events.includes(ev)} onChange={e => {
                              setHookForm(p => ({ ...p, events: e.target.checked ? [...p.events, ev] : p.events.filter(x => x !== ev) }));
                            }} /> {ev}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div><Label>Secret (optional)</Label><Input value={hookForm.secret} onChange={e => setHookForm(p => ({ ...p, secret: e.target.value }))} placeholder="For HMAC signature" /></div>
                    <Button type="submit" className="w-full bg-[#C73E1D]" disabled={createHook.isPending}>Save Webhook</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {hooks?.map(h => (
                    <div key={h.id} className={`rounded-lg border p-3 ${h.isActive ? "border-[#E8E0D8]" : "border-[#8D8A87]/30 opacity-50"}`}>
                      <div className="flex items-center justify-between">
                        <div><p className="text-sm font-medium">{h.name}</p><p className="text-xs text-[#8D8A87]">{h.url}</p></div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setSelectedHook(h.id === selectedHook ? null : h.id)}><Clock className="h-4 w-4 text-[#8D8A87]" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => updateHook.mutate({ id: h.id, isActive: !h.isActive })}>{h.isActive ? "Pause" : "Enable"}</Button>
                          <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete?")) deleteHook.mutate({ id: h.id }); }}><Trash2 className="h-4 w-4 text-[#D32F2F]" /></Button>
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(h.events as string[]).map(e => <span key={e} className="rounded bg-[#F5EDE6] px-1.5 py-0.5 text-[10px] text-[#8D8A87]">{e}</span>)}
                      </div>
                      {selectedHook === h.id && deliveries && (
                        <div className="mt-2 rounded bg-[#F5EDE6] p-2">
                          <p className="text-xs font-medium text-[#8D8A87]">Recent Deliveries</p>
                          {deliveries.map(d => (
                            <div key={d.id} className="mt-1 flex items-center gap-2 text-xs">
                              <span className={`h-1.5 w-1.5 rounded-full ${d.status === "success" ? "bg-[#2E7D32]" : "bg-[#D32F2F]"}`} />
                              <span>{d.event}</span>
                              <span className="text-[#8D8A87]">{d.statusCode ?? "-"}</span>
                            </div>
                          ))}
                          {deliveries.length === 0 && <p className="text-xs text-[#8D8A87]">No deliveries yet</p>}
                        </div>
                      )}
                    </div>
                  ))}
                  {(!hooks || hooks.length === 0) && <p className="text-sm text-[#8D8A87]">No webhooks configured.</p>}
                </div>
              </CardContent>
            </Card>

            {/* Currency Exchanges */}
            <Card className="border-[#E8E0D8]"><CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg flex items-center gap-2"><DollarSign className="h-5 w-5 text-[#2E7D32]"/>Currency Exchanges</CardTitle>
            </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-[#E8E0D8] px-4 py-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#2D2A26]">Frankfurter</p>
                      <p className="text-xs text-[#8D8A87]">https://api.frankfurter.dev</p>
                    </div>
                    <span className="rounded-full bg-[#2E7D32]/10 px-2.5 py-0.5 text-xs font-medium text-[#2E7D32]">Active</span>
                  </div>
                  <p className="mb-3 text-xs text-[#8D8A87]">
                    Frankfurter is a free, open-source exchange rate API. You can self-host it and change the endpoint later.
                  </p>
                  <div className="flex items-center justify-between rounded-lg bg-[#F5EDE6] px-3 py-2">
                    <span className="text-xs text-[#2D2A26]">API URL</span>
                    <code className="font-mono text-xs text-[#8D8A87]">https://api.frankfurter.dev/v2/rates</code>
                  </div>
                  <div className="mt-3">
                    <Button
                      size="sm"
                      onClick={() => syncRates.mutate()}
                      disabled={syncRates.isPending}
                      className="gap-1 bg-[#C73E1D]"
                    >
                      <RefreshCw className={`h-4 w-4 ${syncRates.isPending ? "animate-spin" : ""}`} />
                      {syncRates.isPending ? "Syncing..." : "Sync Now"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {tab === "feedback" && (
          <>
            <Card className="border-[#E8E0D8]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-serif text-lg">
                  <MessageSquare className="h-5 w-5 text-[#C73E1D]" />
                  Feedback Settings
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
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="font-serif text-lg">Questionnaires</CardTitle>
                <Dialog open={qOpen} onOpenChange={setQOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-[#C73E1D]"><Plus className="mr-1 h-3 w-3" />New Questionnaire</Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[80vh] overflow-y-auto bg-white">
                    <DialogHeader><DialogTitle className="font-serif text-xl">Create Questionnaire</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>Title</Label><Input value={qForm.title} onChange={e => setQForm(p => ({ ...p, title: e.target.value }))} /></div>
                      <div><Label>Description</Label><Input value={qForm.description} onChange={e => setQForm(p => ({ ...p, description: e.target.value }))} /></div>
                      <div className="space-y-2">
                        <Label>Questions</Label>
                        {questions.map((q, idx) => (
                          <div key={q.id} className="flex gap-2 rounded-lg border border-[#E8E0D8] p-2">
                            <div className="flex-1 space-y-1">
                              <Input placeholder={`Question ${idx + 1}`} value={q.text} onChange={e => updateQuestion(q.id, "text", e.target.value)} className="text-sm" />
                              <div className="flex gap-2">
                                <select value={q.type} onChange={e => updateQuestion(q.id, "type", e.target.value)} className="rounded border px-2 py-1 text-xs">
                                  <option value="text">Text</option>
                                  <option value="rating">Rating (1-5)</option>
                                  <option value="choice">Multiple Choice</option>
                                  <option value="yes_no">Yes / No</option>
                                </select>
                                <label className="flex items-center gap-1 text-xs">
                                  <input type="checkbox" checked={q.required} onChange={e => updateQuestion(q.id, "required", e.target.checked)} /> Required
                                </label>
                              </div>
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => removeQuestion(q.id)}><Trash2 className="h-4 w-4 text-[#D32F2F]" /></Button>
                          </div>
                        ))}
                        <Button size="sm" variant="outline" onClick={addQuestion}><Plus className="mr-1 h-3 w-3" />Add Question</Button>
                      </div>
                      <Button
                        onClick={() => createQ.mutate({ title: qForm.title, description: qForm.description, questions })}
                        disabled={!qForm.title || questions.length === 0 || createQ.isPending}
                        className="w-full bg-[#2E7D32]"
                      >
                        {createQ.isPending ? "Creating..." : "Create Questionnaire"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {questionnaires?.map(q => (
                    <div key={q.id} className="rounded-lg border border-[#E8E0D8] p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-serif text-lg font-semibold text-[#2D2A26]">{q.title}</h3>
                          {q.description && <p className="text-sm text-[#8D8A87]">{q.description}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          {q.isActive ? (
                            <span className="rounded-full bg-[#2E7D32]/10 px-2 py-0.5 text-xs text-[#2E7D32]">Active</span>
                          ) : (
                            <span className="rounded-full bg-[#8D8A87]/10 px-2 py-0.5 text-xs text-[#8D8A87]">Inactive</span>
                          )}
                          {canManage && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => updateQ.mutate({ id: q.id, isActive: !q.isActive })}>
                                <CheckCircle className="h-4 w-4 text-[#2E7D32]" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this questionnaire?")) deleteQ.mutate({ id: q.id }); }}>
                                <Trash2 className="h-4 w-4 text-[#D32F2F]" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-[#8D8A87]">
                        {Array.isArray(q.questions) ? q.questions.length : JSON.parse(q.questions as string)?.length ?? 0} questions
                      </p>
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => setViewQ(q.id)}>
                        <Eye className="mr-1 h-3 w-3" /> View Responses
                      </Button>
                    </div>
                  ))}
                  {(!questionnaires || questionnaires.length === 0) && (
                    <p className="col-span-2 text-center text-sm text-[#8D8A87]">No questionnaires yet.</p>
                  )}
                </div>

                {viewQ !== null && responses && (
                  <div className="mt-4 rounded-lg border border-[#D4A854] p-4">
                    <h4 className="font-serif text-lg font-semibold text-[#2D2A26]">Responses</h4>
                    {responses.length === 0 ? (
                      <p className="mt-2 text-sm text-[#8D8A87]">No responses yet.</p>
                    ) : (
                      <div className="mt-3 space-y-3 max-h-96 overflow-y-auto">
                        {responses.map((r, idx) => (
                          <div key={r.id} className="rounded-lg border border-[#E8E0D8] p-3">
                            <p className="text-xs text-[#8D8A87]">#{idx + 1} · {r.respondentName ?? "Anonymous"} · {new Date(r.createdAt).toLocaleDateString()}</p>
                            <div className="mt-2 space-y-1">
                              {Object.entries(r.answers as Record<string, string>).map(([qid, ans]) => (
                                <p key={qid} className="text-sm"><span className="text-[#8D8A87]">{qid}:</span> {ans}</p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
