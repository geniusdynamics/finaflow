// ABOUTME: Chart of Accounts management page for accounting
import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { cn, formatKES } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, TrendingUp, TrendingDown, ChevronDown, ChevronRight, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export function ChartOfAccounts({ embedded }: { embedded?: boolean }) {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(["asset", "liability", "equity", "revenue", "expense"]));
  const [createOpen, setCreateOpen] = useState(false);
  const { user } = useAuth();
  const businessId = user?.currentBusinessId ?? null;

  const { data, isLoading, error } = trpc.chartOfAccounts.list.useQuery({ businessId: businessId || 0 }, { enabled: !!businessId });

  const toggleType = (type: string) => {
    const newExpanded = new Set(expandedTypes);
    if (newExpanded.has(type)) {
      newExpanded.delete(type);
    } else {
      newExpanded.add(type);
    }
    setExpandedTypes(newExpanded);
  };

  const groupedAccounts = data?.grouped || {
    asset: [],
    liability: [],
    equity: [],
    revenue: [],
    expense: [],
  };

  const summary = data?.summary || {
    asset: { count: 0, total: 0 },
    liability: { count: 0, total: 0 },
    equity: { count: 0, total: 0 },
    revenue: { count: 0, total: 0 },
    expense: { count: 0, total: 0 },
  };

  const accountTypeLabels: Record<string, { label: string; icon: any; color: string }> = {
    asset: { label: "1000 - Assets", icon: TrendingUp, color: "text-[#2E7D32]" },
    liability: { label: "2000 - Liabilities", icon: TrendingDown, color: "text-[#D32F2F]" },
    equity: { label: "3000 - Equity", icon: DollarSign, color: "text-[#D4A854]" },
    revenue: { label: "4000 - Revenue", icon: TrendingUp, color: "text-[#2E7D32]" },
    expense: { label: "5000 - Expenses", icon: TrendingDown, color: "text-[#D32F2F]" },
  };

  const content = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Chart of Accounts</h1>
          <p className="mt-1 text-sm text-[#8D8A87]">Complete list of all accounts</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#C73E1D] hover:bg-[#A33318]">
              <Plus className="h-4 w-4 mr-2" /> Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Create Account</DialogTitle>
            </DialogHeader>
            {businessId ? (
              <AccountForm onSuccess={() => setCreateOpen(false)} businessId={businessId} />
            ) : (
              <p className="text-sm text-[#8D8A87]">Select an active business before creating chart accounts.</p>
            )}
          </DialogContent>
        </Dialog>
      </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries(accountTypeLabels).map(([type, info]) => {
            const Icon = info.icon;
            const stats = summary[type as keyof typeof summary] || { count: 0, total: 0 };
            return (
              <Card key={type} className="border-[#E8E0D8]">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", info.color)} />
                    <span className="text-xs uppercase text-[#8D8A87]">{info.label}</span>
                  </div>
                  <p className="mt-2 font-mono text-xl font-semibold">{stats.count}</p>
                  <p className="text-xs text-[#8D8A87]">{formatKES(stats.total.toString())}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#C73E1D] border-t-transparent" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-lg border border-[#D32F2F]/30 bg-[#D32F2F]/5 p-4 text-sm text-[#D32F2F]">
            Failed to load accounts: {error.message}
          </div>
        )}

        {/* Accounts by Type */}
        {!isLoading && (
          <div className="space-y-4">
            {Object.entries(accountTypeLabels).map(([type, info]) => {
              const Icon = info.icon;
              const accounts = groupedAccounts[type as keyof typeof groupedAccounts] || [];
              const isExpanded = expandedTypes.has(type);

              return (
                <Card key={type} className="border-[#E8E0D8]">
                  <CardHeader
                    className="cursor-pointer pb-2"
                    onClick={() => toggleType(type)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 font-serif text-lg">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-[#8D8A87]" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-[#8D8A87]" />
                        )}
                        <Icon className={cn("h-5 w-5", info.color)} />
                        {info.label}
                        <span className="ml-2 rounded-full bg-[#F5EDE6] px-2 py-0.5 text-xs font-normal text-[#8D8A87]">
                          {accounts.length}
                        </span>
                      </CardTitle>
                      <span className="font-mono text-sm text-[#8D8A87]">
                        {formatKES(
                          accounts.reduce((sum: number, acc: any) => sum + (parseFloat(acc.currentBalance) || 0), 0).toString()
                        )}
                      </span>
                    </div>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent className="pt-0">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-t text-xs text-[#8D8A87]">
                            <th className="py-2 text-left">Code</th>
                            <th className="py-2 text-left">Account Name</th>
                            <th className="py-2 text-left">Type</th>
                            <th className="py-2 text-right">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accounts.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-4 text-center text-[#8D8A87]">
                                No accounts in this category
                              </td>
                            </tr>
                          ) : (
                            accounts.map((account: any) => (
                              <tr key={account.id} className="border-t hover:bg-[#F5EDE6]/50">
                                <td className="py-2 font-mono text-xs text-[#8D8A87]">
                                  {account.accountCode || "-"}
                                </td>
                                <td className="py-2">
                                  <div className="font-medium">{account.accountCode || "---"} - {account.name}</div>
                                  {account.description && (
                                    <div className="text-xs text-[#8D8A87]">{account.description}</div>
                                  )}
                                </td>
                                <td className="py-2">
                                  <span className="rounded bg-[#F5EDE6] px-2 py-0.5 text-xs">
                                    {account.accountSubType || account.type}
                                  </span>
                                </td>
                                <td className="py-2 text-right">
                                  <span className={cn(
                                    "font-mono",
                                    parseFloat(account.currentBalance || 0) < 0 ? "text-[#D32F2F]" : ""
                                  )}>
                                    {formatKES(account.currentBalance || "0")}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
  );

  if (embedded) {
    return content;
  }

  return <Layout>{content}</Layout>;
}

function AccountForm({ onSuccess, businessId }: { onSuccess: () => void; businessId: number }) {
  const [name, setName] = useState("");
  const [accountCode, setAccountCode] = useState("");
  const [accountType, setAccountType] = useState<string>("asset");
  const [accountSubType, setAccountSubType] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0.00");
  const [isContra, setIsContra] = useState(false);
  const [description, setDescription] = useState("");

  const utils = trpc.useUtils();
  const createMutation = trpc.chartOfAccounts.create.useMutation({
    onSuccess: () => {
      toast.success("Account created");
      utils.chartOfAccounts.list.invalidate();
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  const nextCodeQuery = trpc.chartOfAccounts.getNextAccountCode.useQuery(
    { businessId, accountType: accountType as any },
    { enabled: !!businessId }
  );

  useEffect(() => {
    if (nextCodeQuery.data?.nextCode && !accountCode) {
      setAccountCode(nextCodeQuery.data.nextCode);
    }
  }, [nextCodeQuery.data?.nextCode, accountCode]);

  const handleTypeChange = (type: string) => {
    setAccountType(type);
    setAccountCode("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      businessId,
      name,
      accountCode,
      accountType: accountType as any,
      accountSubType: accountSubType || undefined,
      openingBalance,
      isContra,
      description: description || undefined,
    });
  };

  const subTypesByType: Record<string, { value: string; label: string }[]> = {
    asset: [
      { value: "cash", label: "Cash" },
      { value: "bank", label: "Bank" },
      { value: "accounts_receivable", label: "Accounts Receivable" },
      { value: "inventory", label: "Inventory" },
      { value: "fixed_asset", label: "Fixed Asset" },
      { value: "accumulated_depreciation", label: "Accumulated Depreciation" },
      { value: "prepaid_expense", label: "Prepaid Expense" },
    ],
    liability: [
      { value: "accounts_payable", label: "Accounts Payable" },
      { value: "accrued_expense", label: "Accrued Expense" },
      { value: "current_loan", label: "Current Loan" },
      { value: "long_term_loan", label: "Long-term Loan" },
    ],
    equity: [
      { value: "capital", label: "Capital" },
      { value: "retained_earnings", label: "Retained Earnings" },
      { value: "drawings", label: "Drawings" },
    ],
    revenue: [
      { value: "sales_revenue", label: "Sales Revenue" },
      { value: "service_revenue", label: "Service Revenue" },
      { value: "other_income", label: "Other Income" },
    ],
    expense: [
      { value: "cogs", label: "Cost of Goods Sold" },
      { value: "operating_expense", label: "Operating Expense" },
      { value: "admin_expense", label: "Administrative Expense" },
      { value: "marketing_expense", label: "Marketing Expense" },
      { value: "depreciation_expense", label: "Depreciation Expense" },
      { value: "operating_expense", label: "Other Operating Expense" },
    ],
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm text-[#8D8A87]">Account Type</label>
          <select
            value={accountType}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full rounded border px-3 py-2"
            required
          >
            <option value="asset">Asset</option>
            <option value="liability">Liability</option>
            <option value="equity">Equity</option>
            <option value="revenue">Revenue</option>
            <option value="expense">Expense</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-[#8D8A87]">Account Code</label>
          <Input
            value={accountCode}
            onChange={(e) => setAccountCode(e.target.value)}
            placeholder="e.g., 1000"
            required
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-[#8D8A87]">Account Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Cash at Bank"
          required
        />
      </div>

      <div>
        <label className="text-sm text-[#8D8A87]">Sub-Type</label>
        <select
          value={accountSubType}
          onChange={(e) => setAccountSubType(e.target.value)}
          className="w-full rounded border px-3 py-2"
        >
          <option value="">Select sub-type</option>
          {subTypesByType[accountType]?.map((st) => (
            <option key={st.value} value={st.value}>
              {st.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm text-[#8D8A87]">Opening Balance</label>
          <Input
            type="number"
            step="0.01"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
          />
        </div>
        <div className="flex items-center pt-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isContra}
              onChange={(e) => setIsContra(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Contra Account</span>
          </label>
        </div>
      </div>

      <div>
        <label className="text-sm text-[#8D8A87]">Description</label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-[#C73E1D] hover:bg-[#A33318]"
        disabled={createMutation.isPending}
      >
        {createMutation.isPending ? "Creating..." : "Create Account"}
      </Button>
    </form>
  );
}
