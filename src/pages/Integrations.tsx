// ABOUTME: Integrations catalog — one card per supported connection, with live state for
// ABOUTME: adapter-backed systems and a setup path for everything reached through them.
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Plug, KeyRound, Plus, Search, Building2, Landmark, Globe, Smartphone,
  FileSpreadsheet, Link2, ArrowRight, Check, Loader2, type LucideIcon,
} from "lucide-react";

type CatalogueCard = {
  key: string;
  name: string;
  category: string;
  description: string;
  icon: LucideIcon;
  tone: string;
  chips: string[];
  to: string;
  connected?: boolean;
  configured?: boolean;
  lastSyncAt?: string | Date | null;
  adapter?: string;
};

const FEATURE_LABELS: Record<string, string> = {
  "daily_sales.ingest": "Daily sales",
  "supplier.push": "Suppliers",
  "journal.push": "Journals",
  "webhook.incoming": "Webhooks",
  fina_connect: "Fina Connect",
};

const CATALOGUE: Omit<CatalogueCard, "connected" | "configured" | "lastSyncAt" | "adapter">[] = [
  {
    key: "erpnext",
    name: "ERPNext",
    category: "Accounting",
    description: "Push journals, sales, suppliers and accounts to ERPNext through FinaBill.",
    icon: Building2,
    tone: "bg-[#EEF4FF] text-[#2563EB]",
    chips: ["Journals", "Suppliers", "Accounts"],
    to: "/settings?tab=integrations",
  },
  {
    key: "quickbooks",
    name: "QuickBooks",
    category: "Accounting",
    description: "Sync invoices, customers and journal entries with QuickBooks Online via FinaBill.",
    icon: Landmark,
    tone: "bg-[#EAF7EE] text-[#2E7D32]",
    chips: ["Invoices", "Customers", "Journals"],
    to: "/settings?tab=integrations",
  },
  {
    key: "xero",
    name: "Xero",
    category: "Accounting",
    description: "Reconcile accounts and push manual journals to Xero through FinaBill.",
    icon: Landmark,
    tone: "bg-[#E8F3FA] text-[#0288D1]",
    chips: ["Accounts", "Journals"],
    to: "/settings?tab=integrations",
  },
  {
    key: "api",
    name: "REST API & webhooks",
    category: "Developer",
    description: "Read and write your data with API keys, and receive signed events on key changes.",
    icon: Globe,
    tone: "bg-[#F1ECFA] text-[#6B4FA8]",
    chips: ["API keys", "Webhooks", "HMAC"],
    to: "/settings?tab=integrations",
  },
  {
    key: "wallet",
    name: "M-PESA & Airtel Money",
    category: "Payments",
    description: "Import statements or paste SMS batches; Finaflow parses, matches and reconciles them.",
    icon: Smartphone,
    tone: "bg-[#FFF1E8] text-[#ED6C02]",
    chips: ["Statements", "SMS import", "Auto-match"],
    to: "/wallet",
  },
  {
    key: "bank-statements",
    name: "Bank statements",
    category: "Payments",
    description: "Import PDF statements from major Kenyan banks and reconcile them against the ledger.",
    icon: FileSpreadsheet,
    tone: "bg-[#FFF7E6] text-[#D4A854]",
    chips: ["PDF import", "Reconciliation"],
    to: "/tools/bank-statement-converter",
  },
  {
    key: "fina-connect",
    name: "Fina Connect",
    category: "Partner",
    description: "Pair with other Fina apps and share sales, suppliers and journals securely.",
    icon: Link2,
    tone: "bg-[#FDECEC] text-[#C73E1D]",
    chips: ["Pairing", "Sync"],
    to: "/integrations/connect",
  },
];

const FILTERS = ["All", "Connected", "Accounting", "Payments", "Developer", "Partner"] as const;

function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return "Not synced yet";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Synced just now";
  if (minutes < 60) return `Synced ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Synced ${hours} h ago`;
  return `Synced ${Math.floor(hours / 24)} d ago`;
}

export function Integrations() {
  const [filter, setFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();

  const { data: adapters, isLoading } = trpc.integrations.overview.useQuery();
  const toggle = trpc.integrations.toggleConnection.useMutation({
    onSuccess: (res) => {
      utils.integrations.overview.invalidate();
      toast.success(res.isActive ? "Integration resumed" : "Integration paused");
    },
    onError: (error) => toast.error(error.message),
  });

  const cards = useMemo<CatalogueCard[]>(() => {
    const adapterCards: CatalogueCard[] = (adapters ?? []).map((adapter) => ({
      key: adapter.targetSystem,
      name: adapter.name,
      category: adapter.targetSystem === "finabill" ? "Accounting" : "Commerce",
      description: adapter.description,
      icon: Plug,
      tone: "bg-[#FDECEC] text-[#C73E1D]",
      chips: adapter.features.map((feature) => FEATURE_LABELS[feature] ?? feature).slice(0, 3),
      to: "/settings?tab=integrations",
      connected: adapter.connected,
      configured: adapter.configured,
      lastSyncAt: adapter.lastSyncAt,
      adapter: adapter.targetSystem,
    }));
    return [...adapterCards, ...CATALOGUE];
  }, [adapters]);

  const connectedCount = cards.filter((card) => card.connected).length;
  const availableCount = cards.length - connectedCount;

  const visible = cards.filter((card) => {
    if (filter === "Connected" && !card.connected) return false;
    if (filter !== "All" && filter !== "Connected" && card.category !== filter) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return `${card.name} ${card.category} ${card.description}`.toLowerCase().includes(term);
  });

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Integrations</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">
              Connect Finaflow to the tools your business already uses.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="border-[#E8E0D8]">
              <Link to="/settings?tab=integrations"><KeyRound className="mr-2 h-4 w-4" />API keys</Link>
            </Button>
            <Button asChild className="bg-[#2D2A26] hover:bg-[#1a1815]">
              <Link to="/feedback"><Plus className="mr-2 h-4 w-4" />Request integration</Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((item) => {
              const count = item === "All" ? cards.length : item === "Connected" ? connectedCount : undefined;
              const active = filter === item;
              return (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-[#2D2A26] bg-white text-[#2D2A26] shadow-sm"
                      : "border-[#E8E0D8] bg-white/60 text-[#6F6A64] hover:bg-white"
                  }`}
                >
                  {item}
                  {count !== undefined && (
                    <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-[#2D2A26] text-white" : "bg-[#F0EBE5] text-[#8D8A87]"}`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="text-xs text-[#8D8A87]">
              {connectedCount} connected · {availableCount} available
            </span>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8D8A87]" />
              <Input
                aria-label="Search integrations"
                placeholder="Search integrations"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 w-full pl-8 text-sm sm:w-64"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-[#8D8A87]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading integrations…
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.key} className="flex flex-col rounded-xl border border-[#E8E0D8] bg-white p-5">
                  <div className="flex items-start gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.tone}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-semibold text-[#2D2A26]">{card.name}</h2>
                      <p className="text-xs text-[#8D8A87]">{card.category}</p>
                    </div>
                    {card.connected ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#EAF7EE] px-2 py-0.5 text-[10px] font-semibold text-[#2E7D32]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#2E7D32]" /> Connected
                      </span>
                    ) : (
                      <Button asChild size="sm" variant="outline" className="shrink-0 border-[#E8E0D8] text-xs">
                        <Link to={card.to}>Connect</Link>
                      </Button>
                    )}
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-[#6F6A64]">{card.description}</p>

                  <div className="mt-4 flex flex-wrap gap-1.5 border-t border-[#E8E0D8] pt-3">
                    {card.chips.map((chip) => (
                      <span key={chip} className="inline-flex items-center gap-1 rounded-full bg-[#F5EDE6] px-2 py-0.5 text-[10px] font-medium text-[#6F6A64]">
                        <Check className="h-2.5 w-2.5" />{chip}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#E8E0D8] pt-3 text-[11px] text-[#8D8A87]">
                    <span className="truncate">
                      {card.adapter
                        ? (card.connected ? timeAgo(card.lastSyncAt) : card.configured ? "Paused" : "Not configured")
                        : "Setup required"}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      {card.adapter && card.configured ? (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={Boolean(card.connected)}
                          aria-label={`${card.connected ? "Pause" : "Resume"} ${card.name}`}
                          disabled={toggle.isPending}
                          onClick={() => toggle.mutate({ targetSystem: card.adapter! })}
                          className={`relative h-5 w-9 rounded-full transition-colors disabled:opacity-50 ${card.connected ? "bg-[#C73E1D]" : "bg-[#D8D2CB]"}`}
                        >
                          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${card.connected ? "translate-x-[1.1rem]" : "translate-x-0.5"}`} />
                        </button>
                      ) : (
                        <Link to={card.to} className="inline-flex items-center gap-1 font-medium text-[#C73E1D] hover:underline">
                          Setup guide <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && visible.length === 0 && (
          <p className="rounded-xl border border-[#E8E0D8] bg-white p-8 text-center text-sm text-[#8D8A87]">
            No integrations match that filter. Try another category or clear the search.
          </p>
        )}
      </div>
    </Layout>
  );
}
