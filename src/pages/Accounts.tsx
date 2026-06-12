import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import { Layout } from "@/components/Layout";
import { AddDebtDialog } from "@/components/AddDebtDialog";
import { trpc } from "@/providers/trpc";
import { formatKES, formatDate, getLocalDateString } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Plus, Wallet, CreditCard, Landmark, BookOpen, ArrowDownLeft, ArrowUpRight, Pencil, Trash2, ArrowRightLeft, BarChart3, AlertTriangle, Tag, CheckCircle, FileText } from "lucide-react";
import { LocationSelector } from "@/components/LocationSelector";
import { toast } from "sonner";
import { ChartOfAccounts } from "./ChartOfAccounts";
import { JournalEntries } from "./JournalEntries";
import { Debts } from "./Debts";

const accountPalette = ["#2E7D32", "#388E3C", "#43A047", "#C77D2D", "#D4A854", "#B8872E", "#9E9D24", "#5D4037"];

export function Accounts() {
  type CoaAccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
  type OperationalSubType = "" | "cash" | "bank" | "prepaid_expense" | "accounts_receivable" | "fixed_asset";

  const { user } = useAuth();
  const canManage = hasPermission(user?.role ?? "viewer", PERMISSIONS.ACCOUNTS_MANAGE);
  const canManagePM = hasPermission(user?.role ?? "viewer", PERMISSIONS.PAYMENT_METHODS_MANAGE);
  const canViewPM = hasPermission(user?.role ?? "viewer", PERMISSIONS.PAYMENT_METHODS_VIEW);
  const { data: settings } = trpc.settings.list.useQuery();
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get("section");
  const tabParam = searchParams.get("tab");
  const [section, setSection] = useState<"accounts" | "chart-of-accounts" | "journal-entries">(
    sectionParam === "chart-of-accounts" || sectionParam === "journal-entries" ? sectionParam : "accounts"
  );
  const [tab, setTab] = useState<"accounts" | "payment-methods" | "debts">(
    tabParam === "payment-methods" ? "payment-methods" : tabParam === "debts" ? "debts" : "accounts"
  );

  useEffect(() => {
    const sp = searchParams.get("section");
    if (sp === "chart-of-accounts" || sp === "journal-entries") {
      setSection(sp);
    }
    const tp = searchParams.get("tab");
    if (tp === "payment-methods") {
      setTab("payment-methods");
    } else if (tp === "debts") {
      setTab("debts");
    }
  }, [searchParams]);

  const handleSectionChange = (newSection: "accounts" | "chart-of-accounts" | "journal-entries") => {
    setSection(newSection);
    setSearchParams(newSection === "accounts" ? {} : { section: newSection });
  };
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<number | null>(null);
  const [drawingOpen, setDrawingOpen] = useState<number | null>(null);
  const [depositOpen, setDepositOpen] = useState<number | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);

  // Payment Methods state - must be declared before queries that use them
  const [pmOpen, setPmOpen] = useState(false);
  const [pmEditId, setPmEditId] = useState<number | null>(null);
  const [tagOpen, setTagOpen] = useState(false);
  const [pmForm, setPmForm] = useState({ name: "", code: "", color: "#C73E1D", sortOrder: "0" });
  const [tagLocId, setTagLocId] = useState<string>("");
  const [assignAccountMap, setAssignAccountMap] = useState<Record<number, string>>({});

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    fromAccountId: "", description: "", date: getLocalDateString(),
    toAccounts: [{ accountId: "", amount: "", description: "" }],
  });
  const totalTransferOut = transferForm.toAccounts.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
  const todayDate = getLocalDateString();

  const [form, setForm] = useState({
    locationId: "", name: "",     type: "cash" as "cash" | "wallet" | "bank_account",
    accountCode: "", accountNumber: "", openingBalance: "0.00", isPaymentMethod: true,
    accountType: "asset" as CoaAccountType, accountSubType: "cash" as OperationalSubType, isContra: false, linkToCoa: false,
  });
  const [editForm, setEditForm] = useState({ name: "", accountCode: "", accountNumber: "", isPaymentMethod: true, isActive: true, accountType: "asset" as CoaAccountType, accountSubType: "" as OperationalSubType, isContra: false, linkToCoa: false });
  const [drawingForm, setDrawingForm] = useState({ amount: "", description: "", date: getLocalDateString() });
  const [depositForm, setDepositForm] = useState({ amount: "", description: "", date: getLocalDateString() });

  const { data: locations } = trpc.locations.list.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();
  const {
    data: balanceHistory,
    isLoading: isBalanceHistoryLoading,
    isError: isBalanceHistoryError,
  } = trpc.accounts.balanceHistory.useQuery(
    { days: 30 },
    {
      refetchInterval: 60000,
      refetchOnWindowFocus: false,
      placeholderData: (prev) => prev,
      staleTime: 30000,
    }
  );
  const { data: ledger } = trpc.accounts.ledger.useQuery(
    { accountId: selectedAccount ?? 0, limit: 50 },
    { enabled: selectedAccount !== null }
  );

  const utils = trpc.useUtils();
  const refreshAccountData = () => {
    utils.accounts.list.invalidate();
    utils.accounts.balanceHistory.invalidate();
    if (selectedAccount !== null) {
      utils.accounts.ledger.invalidate();
    }
  };

  const createAccount = trpc.accounts.create.useMutation({ onSuccess: () => { setOpen(false); refreshAccountData(); } });
  const updateAccount = trpc.accounts.update.useMutation({ onSuccess: () => { setEditOpen(null); refreshAccountData(); } });
  const adjustBalance = trpc.accounts.adjustBalance.useMutation({ onSuccess: () => refreshAccountData() });
  const recordDrawing = trpc.accounts.recordDrawing.useMutation({ onSuccess: () => { setDrawingOpen(null); refreshAccountData(); } });
  const recordDeposit = trpc.accounts.recordDeposit.useMutation({ onSuccess: () => { setDepositOpen(null); refreshAccountData(); } });
  const deleteAccount = trpc.accounts.delete.useMutation({ onSuccess: () => { setSelectedAccount(null); refreshAccountData(); } });
  const transfer = trpc.accounts.transfer.useMutation({
    onSuccess: () => { setTransferOpen(false); setTransferForm({ fromAccountId: "", description: "", date: getLocalDateString(), toAccounts: [{ accountId: "", amount: "", description: "" }] }); refreshAccountData(); },
  });

  // Payment Methods mutations
  const { data: paymentMethods, refetch: refetchPM } = trpc.paymentMethods.list.useQuery();
  const { data: locMethods } = trpc.paymentMethods.byLocation.useQuery(
    { locationId: +tagLocId },
    { enabled: !!tagLocId }
  );
  const createPM = trpc.paymentMethods.create.useMutation({
    onSuccess: () => { setPmOpen(false); setPmForm({ name: "", code: "", color: "#C73E1D", sortOrder: "0" }); refetchPM(); toast.success("Payment method added"); },
    onError: (err) => toast.error(err.message),
  });
  const updatePM = trpc.paymentMethods.update.useMutation({
    onSuccess: () => { setPmEditId(null); refetchPM(); toast.success("Updated"); },
    onError: (err) => toast.error(err.message),
  });
  const deletePM = trpc.paymentMethods.delete.useMutation({
    onSuccess: () => { refetchPM(); toast.success("Deleted"); },
  });
  const assignToLoc = trpc.paymentMethods.assignToLocation.useMutation({
    onSuccess: () => { utils.paymentMethods.byLocation.invalidate(); toast.success("Assigned"); },
  });
  const updateLocLink = trpc.paymentMethods.updateLocationLink.useMutation({
    onSuccess: () => { utils.paymentMethods.byLocation.invalidate(); toast.success("Account link updated"); },
  });
  const removeFromLoc = trpc.paymentMethods.removeFromLocation.useMutation({
    onSuccess: () => { utils.paymentMethods.byLocation.invalidate(); toast.success("Removed"); },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // ABOUTME: Accounts are ALWAYS auto-linked to CoA on the backend.
    // ABOUTME: The checkbox only controls whether the user wants to override the default CoA mapping.
    // ABOUTME: When unchecked, accountType/accountSubType are omitted and backend uses defaults.
    // ABOUTME: When checked, the user's selection is sent for manual override.
    createAccount.mutate({
      locationId: parseInt(form.locationId), name: form.name, type: form.type,
      accountCode: form.accountCode || undefined, accountNumber: form.accountNumber || undefined,
      openingBalance: form.openingBalance, isPaymentMethod: form.isPaymentMethod,
      accountType: form.linkToCoa ? (form.accountType || undefined) : undefined,
      accountSubType: form.linkToCoa ? (form.accountSubType || undefined) : undefined,
      isContra: form.linkToCoa ? form.isContra : undefined,
    });
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case "cash": return <Wallet className="h-5 w-5" />;
      case "wallet": return <Wallet className="h-5 w-5" />;
      case "bank_account": return <Landmark className="h-5 w-5" />;
      default: return <CreditCard className="h-5 w-5" />;
    }
  };

  const getAccountColor = (type: string) => {
    switch (type) {
      case "cash": return "bg-[#2E7D32]/10 text-[#2E7D32]";
      case "wallet": return "bg-[#C73E1D]/10 text-[#C73E1D]";
      case "bank_account": return "bg-[#D4A854]/10 text-[#D4A854]";
      default: return "bg-[#8D8A87]/10 text-[#8D8A87]";
    }
  };

  const chartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {
      cashTotal: { label: "Cash Total", color: "#2E7D32" },
      bankTotal: { label: "Bank Total", color: "#D4A854" },
      walletTotal: { label: "Wallet Total", color: "#C73E1D" },
      totalBalance: { label: "All Accounts Total", color: "#2D2A26" },
    };
    balanceHistory?.accountMeta?.forEach((account, index) => {
      config[account.key] = {
        label: `${account.name} (${account.type === "cash" ? "Cash" : "Bank"})`,
        color: account.type === "cash" ? accountPalette[index % 3] : accountPalette[3 + (index % 5)],
      };
    });
    return config;
  }, [balanceHistory]);

  const hasHistoryData = (balanceHistory?.series?.length ?? 0) > 0;
  const formatChartDate = (value: string) =>
    new Date(value).toLocaleDateString("en-KE", { month: "short", day: "numeric" });

  return (
    <Layout>
      <div className="space-y-6">
        {/* Outer section tabs */}
        <div className="flex items-center gap-2 border-b border-[#E8E0D8]">
          <button onClick={() => handleSectionChange("accounts")} className={`px-4 py-2 text-sm font-medium ${section === "accounts" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <Wallet className="mr-1 inline h-4 w-4"/>Accounts &amp; Payments
          </button>
          <button onClick={() => handleSectionChange("chart-of-accounts")} className={`px-4 py-2 text-sm font-medium ${section === "chart-of-accounts" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <BookOpen className="mr-1 inline h-4 w-4"/>Chart of Accounts
          </button>
          <button onClick={() => handleSectionChange("journal-entries")} className={`px-4 py-2 text-sm font-medium ${section === "journal-entries" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <FileText className="mr-1 inline h-4 w-4"/>Journal Entries
          </button>
        </div>

        {section === "accounts" && (
        <>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Accounts &amp; Payments</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">Track balances, manage payment methods, and record transactions</p>
          </div>
          {tab === "accounts" && (
            <div className="flex gap-2">
              <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-[#D4A854] text-[#D4A854]"><ArrowRightLeft className="mr-2 h-4 w-4" /> Transfer</Button>
                </DialogTrigger>
                <DialogContent className="bg-white max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle className="font-serif text-xl">Transfer Between Accounts</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); if (transferForm.date > todayDate) { toast.error("Transfer date cannot be in the future"); return; } transfer.mutate({ fromAccountId: +transferForm.fromAccountId, description: transferForm.description, date: transferForm.date, toAccounts: transferForm.toAccounts.filter(t => t.accountId && t.amount).map(t => ({ accountId: +t.accountId, amount: t.amount, description: t.description })) }); }} className="space-y-3">
                    <div className="space-y-2"><Label>From Account (Source)</Label>
                      <select value={transferForm.fromAccountId} onChange={e => setTransferForm(p => ({ ...p, fromAccountId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm" required>
                        <option value="">Select source account</option>
                        {accounts?.filter(a => a.isActive).map(a => { const loc = locations?.find(l => l.id === a.locationId)?.name ?? ""; return <option key={a.id} value={a.id}>{a.name} {loc ? `· ${loc}` : ""} · Bal: {formatKES(a.currentBalance)}</option>; })}
                      </select>
                    </div>
                    <div className="space-y-2"><Label>Description</Label><Input value={transferForm.description} onChange={e => setTransferForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Branch fund transfer" required /></div>
                    <div className="space-y-2"><Label>Date</Label><Input type="date" value={transferForm.date} max={todayDate} onChange={e => setTransferForm(p => ({ ...p, date: e.target.value }))} required /></div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between"><Label>To Accounts (Destinations)</Label><Button type="button" size="sm" variant="outline" onClick={() => setTransferForm(p => ({ ...p, toAccounts: [...p.toAccounts, { accountId: "", amount: "", description: "" }] }))}><Plus className="h-3 w-3" /></Button></div>
                      {transferForm.toAccounts.map((to, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-5"><select value={to.accountId} onChange={e => { const arr = [...transferForm.toAccounts]; arr[i] = { ...arr[i], accountId: e.target.value }; setTransferForm(p => ({ ...p, toAccounts: arr })); }} className="w-full rounded border px-2 py-2 text-sm" required><option value="">To account</option>{accounts?.filter(a => a.isActive && a.id.toString() !== transferForm.fromAccountId).map(a => { const loc = locations?.find(l => l.id === a.locationId)?.name ?? ""; return <option key={a.id} value={a.id}>{a.name} {loc ? `· ${loc}` : ""}</option>; })}</select></div>
                          <div className="col-span-3"><Input type="number" step="0.01" placeholder="Amount" value={to.amount} onChange={e => { const arr = [...transferForm.toAccounts]; arr[i] = { ...arr[i], amount: e.target.value }; setTransferForm(p => ({ ...p, toAccounts: arr })); }} required /></div>
                          <div className="col-span-3"><Input placeholder="Note" value={to.description} onChange={e => { const arr = [...transferForm.toAccounts]; arr[i] = { ...arr[i], description: e.target.value }; setTransferForm(p => ({ ...p, toAccounts: arr })); }} /></div>
                          <div className="col-span-1">{transferForm.toAccounts.length > 1 && <Button type="button" size="sm" variant="ghost" onClick={() => setTransferForm(p => ({ ...p, toAccounts: p.toAccounts.filter((_, idx) => idx !== i) }))}><Trash2 className="h-3 w-3 text-[#D32F2F]" /></Button>}</div>
                        </div>
                      ))}
                      <div className="rounded bg-[#F5EDE6] p-2 text-right">
                        <span className="text-xs text-[#8D8A87]">Total Out: </span>
                        <span className="font-mono font-semibold text-sm">{formatKES(totalTransferOut.toFixed(2))}</span>
                      </div>
                    </div>
                    <Button type="submit" className="w-full bg-[#C73E1D]" disabled={transfer.isPending || !transferForm.fromAccountId || totalTransferOut <= 0}>
                      {transfer.isPending ? "Transferring..." : "Record Transfer"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[#C73E1D] hover:bg-[#C73E1D]/90"><Plus className="mr-2 h-4 w-4" /> Add Account</Button>
                </DialogTrigger>
                <DialogContent className="bg-white">
                  <DialogHeader><DialogTitle className="font-serif text-xl text-[#2D2A26]">Add Account</DialogTitle></DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <LocationSelector
                        locations={locations}
                        assignedLocationIds={user?.assignedLocationIds ?? []}
                        value={form.locationId}
                        onChange={v => setForm(p => ({ ...p, locationId: v }))}
                        enforceAssigned={settings?.["enforceLocationAssignment"] === "true"}
                          required
                         />
                      </div>
                      <div className="space-y-2"><Label>Type</Label>
                        <select value={form.type} onChange={(e) => setForm(p => ({ ...p, type: e.target.value as "cash" | "wallet" | "bank_account" }))} className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm">
                          <option value="cash">Cash</option><option value="wallet">Wallet</option><option value="bank_account">Bank Account</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Main Cash Drawer" required /></div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2"><Label>Code</Label><Input value={form.accountCode} onChange={e => setForm(p => ({ ...p, accountCode: e.target.value }))} placeholder="CASH, MPESA, KCB" /></div>
                      <div className="space-y-2"><Label>Account Number</Label><Input value={form.accountNumber} onChange={e => setForm(p => ({ ...p, accountNumber: e.target.value }))} /></div>
                    </div>
                    <div className="space-y-2"><Label>Opening Balance</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#8D8A87]">KES</span>
                        <Input type="number" step="0.01" value={form.openingBalance} onChange={e => setForm(p => ({ ...p, openingBalance: e.target.value }))} className="pl-10" />
                      </div>
                    </div>
                    {/* ABOUTME: Accounts are ALWAYS auto-linked to CoA. The checkbox enables manual override. */}
                    <div className="flex items-center gap-2 pt-2">
                      <input type="checkbox" id="linkToCoa" checked={form.linkToCoa} onChange={e => setForm(p => ({ ...p, linkToCoa: e.target.checked }))} className="rounded" />
                      <Label htmlFor="linkToCoa" className="text-sm font-medium">Override CoA Mapping</Label>
                      <span className="group relative ml-1 inline-flex cursor-help">
                        <span className="text-xs text-[#8D8A87] underline decoration-dotted">(Auto-linked to {form.type === "bank_account" ? "Bank Accounts (asset/bank)" : form.type === "wallet" ? "Wallet Accounts (asset/cash)" : "Cash Accounts (asset/cash)"})</span>
                      </span>
                    </div>
                    {form.linkToCoa && (
                      <>
                        <p className="text-xs text-[#8D8A87]">Override the default CoA mapping. Select a different Asset sub-type for this account. Invalid assignments (e.g. Bank to Liability) are blocked.</p>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2"><Label>Account Type</Label>
                            <select value={form.accountType} onChange={e => {
                              const val = e.target.value as CoaAccountType;
                              // Reset sub-type when account type changes
                              setForm(p => ({ ...p, accountType: val, accountSubType: "" as OperationalSubType }));
                            }} className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm">
                              <option value="asset">Asset</option>
                              <option value="liability" disabled>Liability (not allowed for operational accounts)</option>
                              <option value="equity" disabled>Equity (not allowed for operational accounts)</option>
                              <option value="revenue" disabled>Revenue (not allowed for operational accounts)</option>
                              <option value="expense" disabled>Expense (not allowed for operational accounts)</option>
                            </select>
                          </div>
                          <div className="space-y-2"><Label>Sub-Type</Label>
                            <select value={form.accountSubType} onChange={e => setForm(p => ({ ...p, accountSubType: e.target.value as OperationalSubType }))} className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm">
                              <option value="">Select asset sub-type...</option>
                              <option value="cash">Cash</option>
                              <option value="bank">Bank</option>
                              <option value="prepaid_expense">Prepaid Expenses</option>
                              <option value="accounts_receivable">Accounts Receivable</option>
                              <option value="fixed_asset">Fixed Assets</option>
                            </select>
                          </div>
                        </div>
                      </>
                    )}
                    <Button type="submit" className="w-full bg-[#C73E1D] hover:bg-[#C73E1D]/90" disabled={createAccount.isPending}>
                      {createAccount.isPending ? "Creating..." : "Add Account"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
          {tab === "payment-methods" && canViewPM && (
            <div className="flex gap-2">
              <Dialog open={tagOpen} onOpenChange={setTagOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline"><Tag className="mr-1 h-4 w-4" /> Tag to Branches</Button>
                </DialogTrigger>
                <DialogContent className="bg-white max-h-[80vh] overflow-y-auto">
                  <DialogHeader><DialogTitle className="font-serif text-xl">Assign Payment Methods to Branches</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Select Branch</Label>
                      <select value={tagLocId} onChange={e => setTagLocId(e.target.value)} className="w-full rounded border px-3 py-2 text-sm">
                        <option value="">Select branch</option>
                        {locations?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                    {tagLocId && paymentMethods && paymentMethods.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs text-[#8D8A87]">Toggle methods ON for this branch, then pick the account to credit when sales are recorded.</p>
                        {paymentMethods.filter(m => !m.deletedAt).map(m => {
                          const isActive = locMethods?.some(lm => lm.id === m.id);
                          const activeJunction = locMethods?.find(lm => lm.id === m.id);
                          const currentAcctId = activeJunction?.linkedAccountId;
                          const currentAcctName = activeJunction?.linkedAccountName;
                          return (
                            <div key={m.id} className="rounded-lg border border-[#E8E0D8] p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: m.color ?? "#C73E1D" }} />
                                  <span className="text-sm font-medium">{m.name}</span>
                                  <span className="text-xs text-[#8D8A87]">({m.code})</span>
                                </div>
                                {isActive ? (
                                  <Button size="sm" variant="ghost" onClick={() => removeFromLoc.mutate({ locationId: +tagLocId, paymentMethodId: m.id })}>
                                    <CheckCircle className="h-4 w-4 text-[#2E7D32]" />
                                  </Button>
                                ) : (
                                  <Button size="sm" variant="outline" onClick={() => {
                                    const acctId = assignAccountMap[m.id] ? +assignAccountMap[m.id] : undefined;
                                    assignToLoc.mutate({ locationId: +tagLocId, paymentMethodId: m.id, linkedAccountId: acctId });
                                  }}>
                                    Add
                                  </Button>
                                )}
                              </div>
                              <div className="mt-2">
                                <div className="flex items-center gap-2">
                                  <CreditCard className="h-3 w-3 text-[#8D8A87]" />
                                  <select
                                    value={isActive ? (currentAcctId ?? "") : (assignAccountMap[m.id] ?? "")}
                                    onChange={e => {
                                      const val = e.target.value;
                                      if (isActive) {
                                        updateLocLink.mutate({
                                          locationId: +tagLocId,
                                          paymentMethodId: m.id,
                                          linkedAccountId: val ? +val : undefined,
                                        });
                                      } else {
                                        setAssignAccountMap(p => ({ ...p, [m.id]: val }));
                                      }
                                    }}
                                    className="flex-1 rounded border border-[#E8E0D8] px-2 py-1 text-xs"
                                  >
                                    <option value="">Link to account (optional)</option>
                                    {accounts?.map(a => <option key={a.id} value={a.id}>{a.name} · {a.type}</option>)}
                                  </select>
                                </div>
                                {isActive && currentAcctName && (
                                  <p className="mt-1 text-[10px] text-[#2E7D32]">Linked to: {currentAcctName}</p>
                                )}
                                {!isActive && !assignAccountMap[m.id] && (
                                  <p className="mt-1 text-[10px] text-[#D4A854]">Select an account before adding — sales will auto-ledger to this account</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={pmOpen} onOpenChange={setPmOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[#C73E1D]"><Plus className="mr-1 h-4 w-4" /> Add Method</Button>
                </DialogTrigger>
                <DialogContent className="bg-white">
                  <DialogHeader><DialogTitle className="font-serif text-xl">Add Payment Method</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); createPM.mutate({ name: pmForm.name, code: pmForm.code, color: pmForm.color, sortOrder: +pmForm.sortOrder }); }} className="space-y-3">
                    <div><Label>Name</Label><Input value={pmForm.name} onChange={e => setPmForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Visa Card" required /></div>
                    <div><Label>Code (unique ID)</Label><Input value={pmForm.code} onChange={e => setPmForm(p => ({ ...p, code: e.target.value.toLowerCase().replace(/\s+/g, "_") }))} placeholder="e.g. visa_card" required /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Color</Label><div className="flex items-center gap-2"><input type="color" value={pmForm.color} onChange={e => setPmForm(p => ({ ...p, color: e.target.value }))} className="h-10 w-10 rounded border p-0.5" /><span className="text-xs text-[#8D8A87]">{pmForm.color}</span></div></div>
                      <div><Label>Sort Order</Label><Input type="number" value={pmForm.sortOrder} onChange={e => setPmForm(p => ({ ...p, sortOrder: e.target.value }))} /></div>
                    </div>
                    <Button type="submit" className="w-full bg-[#2E7D32]" disabled={createPM.isPending}>{createPM.isPending ? "Adding..." : "Add Payment Method"}</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
          {tab === "debts" && canManage && (
            <div className="flex gap-2">
              <AddDebtDialog onSuccess={() => { utils.accounts.list.invalidate(); utils.accounts.balanceHistory.invalidate(); }} />
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E8E0D8]">
          <button onClick={() => setTab("accounts")} className={`px-4 py-2 text-sm font-medium ${tab === "accounts" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <Wallet className="mr-1 inline h-4 w-4"/>Accounts
          </button>
          <button onClick={() => setTab("payment-methods")} className={`px-4 py-2 text-sm font-medium ${tab === "payment-methods" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <CreditCard className="mr-1 inline h-4 w-4"/>Payment Methods
          </button>
          <button onClick={() => setTab("debts")} className={`px-4 py-2 text-sm font-medium ${tab === "debts" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <Landmark className="mr-1 inline h-4 w-4"/>Debts
          </button>
        </div>

        {tab === "accounts" && (
          <>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-[#E8E0D8] bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#2D2A26]">
              <BarChart3 className="h-5 w-5 text-[#2E7D32]" />
              Bank / Cash Balance Trend
            </CardTitle>
            <p className="text-xs text-[#8D8A87]">Last 30 days aggregate balance movement</p>
          </CardHeader>
          <CardContent>
            {isBalanceHistoryLoading && (
              <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-[#E8E0D8] text-sm text-[#8D8A87]">
                Loading balance trends...
              </div>
            )}
            {isBalanceHistoryError && (
              <div className="flex h-[260px] items-center justify-center gap-2 rounded-lg border border-[#D32F2F]/30 bg-[#D32F2F]/5 text-sm text-[#D32F2F]">
                <AlertTriangle className="h-4 w-4" />
                Unable to load balance trends.
              </div>
            )}
            {!isBalanceHistoryLoading && !isBalanceHistoryError && !hasHistoryData && (
              <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-[#E8E0D8] text-sm text-[#8D8A87]">
                No balance history available yet.
              </div>
            )}
            {!isBalanceHistoryLoading && !isBalanceHistoryError && hasHistoryData && (
              <ChartContainer config={chartConfig} className="h-[260px] w-full">
                <AreaChart data={balanceHistory?.series}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={formatChartDate} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} width={38} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(label) => formatChartDate(String(label))} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Area
                    type="monotone"
                    dataKey="cashTotal"
                    stroke="var(--color-cashTotal)"
                    fill="var(--color-cashTotal)"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="bankTotal"
                    stroke="var(--color-bankTotal)"
                    fill="var(--color-bankTotal)"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="walletTotal"
                    stroke="var(--color-walletTotal)"
                    fill="var(--color-walletTotal)"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalBalance"
                    stroke="var(--color-totalBalance)"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#E8E0D8] bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#2D2A26]">
              <BarChart3 className="h-5 w-5 text-[#D4A854]" />
              Account Balance History
            </CardTitle>
            <p className="text-xs text-[#8D8A87]">Historical account balances by account type</p>
          </CardHeader>
          <CardContent>
            {!isBalanceHistoryLoading && !isBalanceHistoryError && hasHistoryData && (
              <ChartContainer config={chartConfig} className="h-[260px] w-full">
                <LineChart data={balanceHistory?.series}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={formatChartDate} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} width={38} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(label) => formatChartDate(String(label))} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {(balanceHistory?.accountMeta ?? []).map((account) => (
                    <Line
                      key={account.key}
                      type="monotone"
                      dataKey={account.key}
                      stroke={`var(--color-${account.key})`}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            )}
            {(isBalanceHistoryLoading || isBalanceHistoryError || !hasHistoryData) && (
              <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-[#E8E0D8] text-sm text-[#8D8A87]">
                {!isBalanceHistoryLoading && isBalanceHistoryError ? "Unable to load account chart." : "Account trend chart will appear when historical data is available."}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-3">
            <h2 className="font-medium text-[#2D2A26]">Your Accounts</h2>
            {accounts?.map((account) => {
              const locationName = locations?.find(l => l.id === account.locationId)?.name ?? "";
              const isSelected = selectedAccount === account.id;
              return (
                <div
                  key={account.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedAccount(account.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedAccount(account.id);
                    }
                  }}
                  className={`w-full cursor-pointer rounded-xl border p-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C73E1D]/40 ${isSelected ? "border-[#C73E1D] bg-[#C73E1D]/5" : "border-[#E8E0D8] bg-white hover:border-[#D4A854]"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${getAccountColor(account.type)}`}>
                      {getAccountIcon(account.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#2D2A26] truncate">{account.name}</p>
                      <p className="text-xs text-[#8D8A87]">{account.type} {account.accountCode && `· ${account.accountCode}`} {locationName && `· ${locationName}`}</p>
                    </div>
                    <Dialog open={editOpen === account.id} onOpenChange={(v) => setEditOpen(v ? account.id : null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditOpen(account.id); setEditForm({ name: account.name, accountCode: account.accountCode ?? "", accountNumber: account.accountNumber ?? "", isPaymentMethod: account.isPaymentMethod, isActive: account.isActive, accountType: "asset", accountSubType: account.type === "bank_account" ? "bank" : "cash", isContra: false, linkToCoa: !!(account.accountType) }); }}>
                          <Pencil className="h-3 w-3 text-[#8D8A87]" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-white">
                        <DialogHeader><DialogTitle className="font-serif text-xl">Edit Account</DialogTitle></DialogHeader>
                        <form onSubmit={(e) => { e.preventDefault(); updateAccount.mutate({ id: account.id, name: editForm.name, accountCode: editForm.accountCode || undefined, accountNumber: editForm.accountNumber || undefined, accountType: editForm.linkToCoa ? (editForm.accountType || undefined) : undefined, accountSubType: editForm.linkToCoa ? (editForm.accountSubType || undefined) : undefined, isContra: editForm.linkToCoa ? editForm.isContra : undefined, isPaymentMethod: editForm.isPaymentMethod, isActive: editForm.isActive }); }} className="space-y-3">
                          <div className="space-y-2"><Label>Name</Label><Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} required /></div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2"><Label>Code</Label><Input value={editForm.accountCode} onChange={e => setEditForm(p => ({ ...p, accountCode: e.target.value }))} /></div>
                            <div className="space-y-2"><Label>Account Number</Label><Input value={editForm.accountNumber} onChange={e => setEditForm(p => ({ ...p, accountNumber: e.target.value }))} /></div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2"><Label>Current Balance</Label><Input value={account.currentBalance} disabled className="bg-[#F5EDE6]" /></div>
                            <div className="space-y-2"><Label>New Balance (optional adjust)</Label><Input type="number" step="0.01" placeholder="Leave empty to keep" onBlur={e => { if (e.target.value) adjustBalance.mutate({ id: account.id, newBalance: e.target.value, reason: "Manual balance adjustment" }); }} /></div>
                          </div>
                          <div className="flex items-center gap-2 pt-2">
                            <input type="checkbox" id="editLinkToCoa" checked={editForm.linkToCoa} onChange={e => setEditForm(p => ({ ...p, linkToCoa: e.target.checked }))} className="rounded" />
                            <Label htmlFor="editLinkToCoa" className="text-sm font-medium">Show in Chart of Accounts</Label>
                          </div>
                          {editForm.linkToCoa && (
                            <>
                              <p className="text-xs text-[#8D8A87]">This page only supports asset-side links for cash and bank operational accounts.</p>
                              <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2"><Label>Account Type</Label>
                                  <select value="asset" onChange={() => undefined} className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm" disabled>
                                    <option value="asset">Asset</option>
                                  </select>
                                </div>
                                <div className="space-y-2"><Label>Sub-Type</Label>
                                  <select value={editForm.accountSubType} onChange={e => setEditForm(p => ({ ...p, accountSubType: e.target.value as OperationalSubType }))} className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm">
                                    <option value="">Select asset sub-type...</option>
                                    {account.type === "bank_account" ? <option value="bank">Bank</option> : <option value="cash">Cash</option>}
                                  </select>
                                </div>
                              </div>
                            </>
                          )}
                          <Button type="submit" className="w-full bg-[#C73E1D]" disabled={updateAccount.isPending}>Save Changes</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete account "${account.name}"?`)) deleteAccount.mutate({ id: account.id }); }}>
                      <Trash2 className="h-3 w-3 text-[#D32F2F]" />
                    </Button>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-[#8D8A87]">Balance</span>
                    <span className={`font-mono font-semibold ${parseFloat(account.currentBalance) >= 0 ? "text-[#2E7D32]" : "text-[#D32F2F]"}`}>
                      {formatKES(account.currentBalance)}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-1">
                    <Dialog open={drawingOpen === account.id} onOpenChange={(v) => setDrawingOpen(v ? account.id : null)}>
                      <DialogTrigger asChild><Button size="sm" variant="outline" className="text-xs border-[#D32F2F] text-[#D32F2F]" onClick={e => e.stopPropagation()}><ArrowUpRight className="h-3 w-3 mr-1"/>Drawing</Button></DialogTrigger>
                      <DialogContent className="bg-white">
                        <DialogHeader><DialogTitle className="font-serif text-xl">Record Drawing</DialogTitle></DialogHeader>
                        <form onSubmit={(e) => { e.preventDefault(); if (drawingForm.date > todayDate) { toast.error("Drawing date cannot be in the future"); return; } recordDrawing.mutate({ accountId: account.id, ...drawingForm }); }} className="space-y-3">
                          <div className="rounded bg-[#F5EDE6] p-3"><p className="text-sm font-medium">{account.name}</p><p className="text-xs text-[#8D8A87]">Current: {formatKES(account.currentBalance)}</p></div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2"><Label>Amount</Label><Input type="number" step="0.01" value={drawingForm.amount} onChange={e => setDrawingForm(p => ({ ...p, amount: e.target.value }))} required /></div>
                            <div className="space-y-2"><Label>Date</Label><Input type="date" value={drawingForm.date} max={todayDate} onChange={e => setDrawingForm(p => ({ ...p, date: e.target.value }))} required /></div>
                          </div>
                          <div className="space-y-2"><Label>Description</Label><Input value={drawingForm.description} onChange={e => setDrawingForm(p => ({ ...p, description: e.target.value }))} placeholder="Owner drawing, petty cash, etc." /></div>
                          <Button type="submit" className="w-full bg-[#D32F2F]" disabled={recordDrawing.isPending}>Record Drawing</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                    <Dialog open={depositOpen === account.id} onOpenChange={(v) => setDepositOpen(v ? account.id : null)}>
                      <DialogTrigger asChild><Button size="sm" variant="outline" className="text-xs border-[#2E7D32] text-[#2E7D32]" onClick={e => e.stopPropagation()}><ArrowDownLeft className="h-3 w-3 mr-1"/>Deposit</Button></DialogTrigger>
                      <DialogContent className="bg-white">
                        <DialogHeader><DialogTitle className="font-serif text-xl">Record Deposit</DialogTitle></DialogHeader>
                        <form onSubmit={(e) => { e.preventDefault(); if (depositForm.date > todayDate) { toast.error("Deposit date cannot be in the future"); return; } recordDeposit.mutate({ accountId: account.id, ...depositForm }); }} className="space-y-3">
                          <div className="rounded bg-[#F5EDE6] p-3"><p className="text-sm font-medium">{account.name}</p><p className="text-xs text-[#8D8A87]">Current: {formatKES(account.currentBalance)}</p></div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2"><Label>Amount</Label><Input type="number" step="0.01" value={depositForm.amount} onChange={e => setDepositForm(p => ({ ...p, amount: e.target.value }))} required /></div>
                            <div className="space-y-2"><Label>Date</Label><Input type="date" value={depositForm.date} max={todayDate} onChange={e => setDepositForm(p => ({ ...p, date: e.target.value }))} required /></div>
                          </div>
                          <div className="space-y-2"><Label>Description</Label><Input value={depositForm.description} onChange={e => setDepositForm(p => ({ ...p, description: e.target.value }))} placeholder="Sales deposit, transfer in, etc." /></div>
                          <Button type="submit" className="w-full bg-[#2E7D32]" disabled={recordDeposit.isPending}>Record Deposit</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              );
            })}
            {(!accounts || accounts.length === 0) && (
              <div className="rounded-xl border border-[#E8E0D8] bg-white p-8 text-center text-sm text-[#8D8A87]">
                <CreditCard className="mx-auto mb-2 h-8 w-8 opacity-30" /> No accounts yet.
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            {selectedAccount ? (
              <Card className="border-[#E8E0D8] bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#2D2A26]">
                    <BookOpen className="h-5 w-5 text-[#C73E1D]" /> Ledger
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#E8E0D8]">
                          <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Ref</th>
                          <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Date</th>
                          <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Type</th>
                          <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Description</th>
                          <th className="pb-2 text-right text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Debit</th>
                          <th className="pb-2 text-right text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Credit</th>
                          <th className="pb-2 text-right text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8E0D8]">
                        {ledger?.map(entry => (
                          <tr key={entry.id} className="hover:bg-[#F5EDE6]/50">
                            <td className="py-2 text-xs font-mono text-[#8D8A87]">{entry.refNo || "-"}</td>
                            <td className="py-2 text-sm text-[#2D2A26]">{formatDate(entry.entryDate)}</td>
                            <td className="py-2 text-sm capitalize text-[#2D2A26]">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${entry.transactionType === "deposit" ? "bg-[#2E7D32]/10 text-[#2E7D32]" : entry.transactionType === "drawing" ? "bg-[#D32F2F]/10 text-[#D32F2F]" : entry.entryType === "credit" ? "bg-[#2E7D32]/10 text-[#2E7D32]" : "bg-[#D32F2F]/10 text-[#D32F2F]"}`}>{entry.transactionType.replace(/_/g, " ")}</span>
                            </td>
                            <td className="py-2 text-sm text-[#8D8A87]">{entry.description || "-"}</td>
                            <td className="py-2 text-right font-mono text-sm text-[#D32F2F]">{entry.entryType === "debit" ? formatKES(entry.amount) : "-"}</td>
                            <td className="py-2 text-right font-mono text-sm text-[#2E7D32]">{entry.entryType === "credit" ? formatKES(entry.amount) : "-"}</td>
                            <td className="py-2 text-right font-mono text-sm font-semibold text-[#2D2A26]">{formatKES(entry.balanceAfter)}</td>
                          </tr>
                        ))}
                        {(!ledger || ledger.length === 0) && (
                          <tr><td colSpan={7} className="py-8 text-center text-sm text-[#8D8A87]">No transactions yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-[#E8E0D8] bg-white p-12">
                <div className="text-center text-sm text-[#8D8A87]">
                  <BookOpen className="mx-auto mb-3 h-12 w-12 opacity-20" />
                  <p>Select an account to view its ledger</p>
                </div>
              </div>
            )}
          </div>
        </div>
        </>
        )}

        {tab === "payment-methods" && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {paymentMethods?.filter(m => !m.deletedAt).map(m => {
                const isEditing = pmEditId === m.id;
                return (
                  <Card key={m.id} className="border-[#E8E0D8]">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-4 w-4 rounded-full" style={{ backgroundColor: m.color ?? "#C73E1D" }} />
                          <CardTitle className="font-serif text-base">{m.name}</CardTitle>
                        </div>
                        {m.isActive ? <span className="rounded-full bg-[#2E7D32]/10 px-2 py-0.5 text-xs text-[#2E7D32]">Active</span> : <span className="rounded-full bg-[#8D8A87]/10 px-2 py-0.5 text-xs text-[#8D8A87]">Inactive</span>}
                      </div>
                      <p className="text-xs text-[#8D8A87]">Code: {m.code} · Order: {m.sortOrder}</p>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-xs text-[#8D8A87]">Account linking happens at the branch level. Open "Tag to Branches" to assign.</p>
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input defaultValue={m.name} onChange={e => updatePM.mutate({ id: m.id, name: e.target.value })} className="text-sm" />
                          <div className="flex gap-2">
                            <input type="color" defaultValue={m.color ?? "#C73E1D"} onChange={e => updatePM.mutate({ id: m.id, color: e.target.value })} className="h-8 w-10 rounded border p-0.5" />
                            <Button size="sm" onClick={() => setPmEditId(null)}>Done</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          {canManagePM && <Button size="sm" variant="ghost" onClick={() => setPmEditId(m.id)}><Pencil className="h-3 w-3" /></Button>}
                          {canManagePM && <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete?")) deletePM.mutate({ id: m.id }); }}><Trash2 className="h-3 w-3 text-[#D32F2F]" /></Button>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {(!paymentMethods || paymentMethods.filter(m => !m.deletedAt).length === 0) && (
                <p className="col-span-full text-center text-sm text-[#8D8A87]">No payment methods yet. Add your first to start recording sales.</p>
              )}
            </div>
          </>
        )}

        {tab === "debts" && <Debts embedded />}

        </>
        )}

        {section === "chart-of-accounts" && <ChartOfAccounts embedded />}

        {section === "journal-entries" && <JournalEntries embedded />}
      </div>
    </Layout>
  );
}
