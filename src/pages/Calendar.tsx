import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { formatKES, formatDate, getLocalDateString } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Receipt, TrendingDown, FileText, Landmark, AlertTriangle, Clock, Wallet, Repeat } from "lucide-react";
import { DailyPayments } from "./DailyPayments";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export function Calendar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get("section");
  const [section, setSection] = useState<"calendar" | "payments" | "subscriptions">(
    sectionParam === "payments" || sectionParam === "subscriptions" ? sectionParam : "calendar"
  );
  const [view, setView] = useState<"all" | "bills" | "sales" | "payroll">("all");
  const [daysAhead, setDaysAhead] = useState(90);
  // Source toggle (Subscriptions / Bills / Both) — which event streams the calendar shows.
  const [sources, setSources] = useState<{ subscriptions: boolean; bills: boolean }>({ subscriptions: true, bills: true });

  useEffect(() => {
    const sp = searchParams.get("section");
    if (sp === "payments" || sp === "subscriptions") {
      setSection(sp);
    }
  }, [searchParams]);

  const handleSectionChange = (newSection: "calendar" | "payments" | "subscriptions") => {
    setSection(newSection);
    setSearchParams(newSection === "calendar" ? {} : { section: newSection });
  };

  const [today] = useState(() => getLocalDateString());
  // Derived so the query range reacts to daysAhead changes.
  const futureDate = useMemo(() => getLocalDateString(new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)), [daysAhead]);

  const { user } = useAuth();
  const navigate = useNavigate();
  const permContext = user?.permissions?.length ? user.permissions : (user?.role ?? "viewer");
  const canViewSubscriptions = hasPermission(permContext, PERMISSIONS.SUBSCRIPTIONS_VIEW);

  // The ?section=subscriptions deep link locks the toggle to Subscriptions-only.
  const effectiveSources = section === "subscriptions" ? { subscriptions: true, bills: false } : sources;
  const sourceMode: "subscriptions" | "bills" | "both" =
    effectiveSources.subscriptions && effectiveSources.bills
      ? "both"
      : effectiveSources.subscriptions
        ? "subscriptions"
        : "bills";

  const handleSourceChange = (mode: "subscriptions" | "bills" | "both") => {
    if (section === "subscriptions") {
      // Unlock the deep-linked preset by returning to the main calendar with the tapped source.
      handleSectionChange("calendar");
    }
    setSources({ subscriptions: mode !== "bills", bills: mode !== "subscriptions" });
  };

  const { data: sales } = trpc.dailySales.list.useQuery({}, { enabled: sourceMode !== "subscriptions" });
  const { data: expenses } = trpc.expenses.list.useQuery({}, { enabled: sourceMode !== "subscriptions" });
  const { data: billCalendar } = trpc.dashboard.billCalendar.useQuery({ dateFrom: today, dateTo: futureDate }, { enabled: sourceMode !== "subscriptions" });
  const { data: payrollPeriods } = trpc.payroll.periods.useQuery({}, { enabled: sourceMode !== "subscriptions" });
  const { data: subCalendar } = trpc.subscriptions.calendar.useQuery(
    { dateFrom: today, dateTo: futureDate },
    { enabled: sourceMode !== "bills" && canViewSubscriptions },
  );
  const { data: subStats } = trpc.subscriptions.stats.useQuery(
    {},
    { enabled: sourceMode !== "bills" && canViewSubscriptions },
  );

  // Build events
  const billEvents = (billCalendar?.bills ?? []).map((b) => {
    const daysUntil = Math.ceil((new Date(b.dueDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = daysUntil < 0 || b.status === "overdue";
    const isDueSoon = daysUntil >= 0 && daysUntil <= 7;
    const priority = isOverdue ? 3 : isDueSoon ? 2 : daysUntil <= 30 ? 1 : 0;
    const titleSuffix = isOverdue ? "(OVERDUE)" : b.status === "partial" ? "(PARTIAL)" : daysUntil <= 0 ? "(DUE TODAY)" : `(Due in ${daysUntil} days)`;
    return { type: "bill" as const, date: b.dueDate, title: `${b.description} ${titleSuffix}`, amount: b.balanceDue, id: b.id, priority, status: b.status, isOverdue };
  });

  const subscriptionEvents = (subCalendar?.events ?? []).map((e) => {
    const titleSuffix = e.isOverdue ? "(OVERDUE)" : e.isDueToday ? "(DUE TODAY)" : "";
    return {
      type: "subscription" as const,
      date: e.date,
      title: `${e.name} ${titleSuffix}`.trim(),
      amount: e.amount,
      id: e.id,
      priority: e.isOverdue ? 3 : e.isDueToday ? 2 : 0,
      isOverdue: e.isOverdue,
      isDueToday: e.isDueToday,
      currency: e.currency,
      branchName: e.branchName,
    };
  });

  const allEvents = [
    ...(sourceMode !== "subscriptions" && (view === "all" || view === "sales") ? (sales?.map((s) => ({ type: "sale" as const, date: s.saleDate, title: `Sales: ${formatKES(s.netSales)}`, amount: s.netSales, id: s.id, priority: 0 })) ?? []) : []),
    ...(sourceMode !== "subscriptions" && (view === "all" || view === "sales") ? (expenses?.map((e) => ({ type: "expense" as const, date: e.expenseDate, title: e.description, amount: e.amount, id: e.id, priority: 0 })) ?? []) : []),
    ...(sourceMode !== "subscriptions" && (view === "all" || view === "bills") ? billEvents : []),
    ...(sourceMode !== "subscriptions" && (view === "all" || view === "payroll") ? (payrollPeriods?.map((p) => ({ type: "payroll" as const, date: p.paymentDate, title: `Payroll: ${p.periodName}`, amount: null, id: p.id, priority: p.status === "open" ? 1 : 0 })) ?? []) : []),
    ...(sourceMode !== "bills" ? subscriptionEvents : []),
  ].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const grouped = allEvents.reduce((acc, event) => {
    const month = event.date.slice(0, 7);
    if (!acc[month]) acc[month] = [];
    acc[month].push(event);
    return acc;
  }, {} as Record<string, typeof allEvents>);

  const overdueCount = allEvents.filter((e) => e.type === "bill" && e.priority === 3).length;
  const dueSoonCount = allEvents.filter((e) => e.type === "bill" && e.priority === 2).length;
  const totalBills = allEvents.filter((e) => e.type === "bill").reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Outer section tabs */}
        <div className="flex items-center gap-2 border-b border-[#E8E0D8]">
          <button onClick={() => handleSectionChange("calendar")} className={`px-4 py-2 text-sm font-medium ${section === "calendar" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <CalendarDays className="mr-1 inline h-4 w-4"/>Cashflow Calendar
          </button>
          <button onClick={() => handleSectionChange("payments")} className={`px-4 py-2 text-sm font-medium ${section === "payments" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <Wallet className="mr-1 inline h-4 w-4"/>Daily Payments
          </button>
          <button onClick={() => handleSectionChange("subscriptions")} className={`px-4 py-2 text-sm font-medium ${section === "subscriptions" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <Repeat className="mr-1 inline h-4 w-4"/>Subscriptions
          </button>
        </div>

        {(section === "calendar" || section === "subscriptions") && (
        <>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Cashflow Calendar</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">All financial events and upcoming bills</p>
          </div>
          <div className="flex items-center gap-2">
            <SegmentedToggle
              ariaLabel="Calendar sources"
              options={[
                { value: "subscriptions", label: "Subscriptions", icon: <Repeat className="h-4 w-4" /> },
                { value: "bills", label: "Bills" },
                { value: "both", label: "Both" },
              ]}
              value={sourceMode}
              onChange={handleSourceChange}
            />
            {sourceMode !== "subscriptions" && (
              <select value={view} onChange={(e) => setView(e.target.value as "all" | "bills" | "sales" | "payroll")} className="rounded-lg border border-[#E8E0D8] bg-white px-3 py-2 text-sm text-[#2D2A26]">
                <option value="all">All Events</option><option value="bills">Bills Only</option><option value="sales">Sales Only</option><option value="payroll">Payroll Only</option>
              </select>
            )}
            <select value={daysAhead} onChange={(e) => setDaysAhead(Number(e.target.value))} className="rounded-lg border border-[#E8E0D8] bg-white px-3 py-2 text-sm text-[#2D2A26]">
              <option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option><option value={180}>180 days</option>
            </select>
          </div>
        </div>

        {/* Source legend */}
        {sourceMode === "both" && (
          <div className="flex items-center gap-4 text-xs text-[#8D8A87]">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#6B4FA8]" /> Subscriptions</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#ED6C02]" /> Bills</span>
          </div>
        )}

        {/* Alert Cards */}
        {sourceMode !== "subscriptions" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card className="border-[#D32F2F]/30 bg-[#D32F2F]/5">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertTriangle className="h-8 w-8 text-[#D32F2F]" />
              <div>
                <p className="text-sm font-medium text-[#D32F2F]">{overdueCount} Overdue Bills</p>
                <p className="text-xs text-[#8D8A87]">Immediate action required</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#ED6C02]/30 bg-[#ED6C02]/5">
            <CardContent className="flex items-center gap-3 p-4">
              <Clock className="h-8 w-8 text-[#ED6C02]" />
              <div>
                <p className="text-sm font-medium text-[#ED6C02]">{dueSoonCount} Due Within 7 Days</p>
                <p className="text-xs text-[#8D8A87]">Schedule payments soon</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#8D8A87]/30 bg-[#8D8A87]/5">
            <CardContent className="flex items-center gap-3 p-4">
              <FileText className="h-8 w-8 text-[#8D8A87]" />
              <div>
                <p className="text-sm font-medium text-[#2D2A26]">Total Outstanding</p>
                <p className="font-mono text-sm font-semibold text-[#D32F2F]">{formatKES(totalBills)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Bill Priority List */}
        {sourceMode !== "subscriptions" && (view === "all" || view === "bills") && billCalendar && (
          <Card className="border-[#E8E0D8] bg-white">
            <CardHeader className="pb-3"><CardTitle className="font-serif text-lg text-[#2D2A26]">Bill Priority Queue</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {allEvents.filter((e) => e.type === "bill").slice(0, 15).map((event) => {
                  const daysUntil = Math.ceil((new Date(event.date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
                  const billEvent = event as { isOverdue?: boolean; status?: string };
                  return (
                    <div key={`bill-${event.id}`} className={`flex items-center gap-3 rounded-lg border p-3 ${
                      billEvent.isOverdue ? "border-[#D32F2F] bg-[#D32F2F]/5" :
                      event.priority === 2 ? "border-[#ED6C02] bg-[#ED6C02]/5" :
                      "border-[#E8E0D8] bg-white"
                    }`}>
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        billEvent.isOverdue ? "bg-[#D32F2F]/10" :
                        event.priority === 2 ? "bg-[#ED6C02]/10" :
                        "bg-[#8D8A87]/10"
                      }`}>
                        {billEvent.isOverdue ? <AlertTriangle className="h-5 w-5 text-[#D32F2F]" /> :
                         event.priority === 2 ? <Clock className="h-5 w-5 text-[#ED6C02]" /> :
                         <FileText className="h-5 w-5 text-[#8D8A87]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            billEvent.isOverdue ? "bg-[#D32F2F]/10 text-[#D32F2F]" :
                            event.priority === 2 ? "bg-[#ED6C02]/10 text-[#ED6C02]" :
                            billEvent.status === "partial" ? "bg-[#D4A854]/10 text-[#D4A854]" :
                            "bg-[#8D8A87]/10 text-[#8D8A87]"
                          }`}>{billEvent.isOverdue ? "OVERDUE" : event.priority === 2 ? "DUE SOON" : billEvent.status === "partial" ? "PARTIAL" : "UPCOMING"}</span>
                          <span className="text-xs text-[#8D8A87]">{formatDate(event.date)} · {daysUntil <= 0 ? "Today" : `${daysUntil} days`}</span>
                        </div>
                        <p className="mt-1 truncate text-sm font-medium text-[#2D2A26]">{event.title}</p>
                      </div>
                      <span className="shrink-0 font-mono text-sm font-semibold text-[#D32F2F]">{formatKES(event.amount || "0")}</span>
                    </div>
                  );
                })}
                {allEvents.filter((e) => e.type === "bill").length === 0 && (
                  <p className="py-6 text-center text-sm text-[#8D8A87]">No bills in this period.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Events Timeline */}
        <div className="space-y-6">
          {Object.entries(grouped).map(([monthKey, monthEvents]) => {
            const month = new Date(`${monthKey}-01`).toLocaleDateString("en-KE", { month: "long", year: "numeric" });
            const monthIncome = monthEvents.filter(e => e.type === "sale").reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);
            const monthOutflow = monthEvents.filter(e => e.type === "expense" || e.type === "bill").reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);
            const monthSubs = monthEvents.filter((e) => e.type === "subscription");
            const monthSubTotal = monthSubs.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);
            const monthBillTotal = monthEvents.filter((e) => e.type === "bill").reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);
            const monthBudget = subStats?.projection.find((p) => p.month === monthKey)?.budget ?? null;
            const overBudget = monthBudget !== null && Number(monthBudget) > 0 && monthSubTotal + monthBillTotal > Number(monthBudget);
            return (
            <div key={monthKey}>
              <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
                <h2 className="font-serif text-lg font-semibold text-[#2D2A26]">{month}</h2>
                <div className="flex gap-3 text-xs">
                  {monthIncome > 0 && <span className="text-[#2E7D32]">In: <span className="font-mono font-semibold">{formatKES(monthIncome.toFixed(2))}</span></span>}
                  {monthOutflow > 0 && <span className="text-[#D32F2F]">Out: <span className="font-mono font-semibold">{formatKES(monthOutflow.toFixed(2))}</span></span>}
                  <span className="text-[#8D8A87]">Net: <span className="font-mono font-semibold">{formatKES((monthIncome - monthOutflow).toFixed(2))}</span></span>
                </div>
              </div>
              {/* Monthly subscription strip (Wallos calendar-monthly-stats parity) */}
              {monthSubs.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#6B4FA8]/20 bg-[#6B4FA8]/5 px-3 py-2 text-xs text-[#2D2A26]">
                  <Repeat className="h-3.5 w-3.5 text-[#6B4FA8]" />
                  <span className="font-medium">{monthSubs.length} subscription{monthSubs.length === 1 ? "" : "s"} due</span>
                  <span className="text-[#8D8A87]">·</span>
                  <span>
                    <span className="font-mono">{formatKES(monthSubTotal.toFixed(2))}</span> subscriptions +{" "}
                    <span className="font-mono">{formatKES(monthBillTotal.toFixed(2))}</span> bills ={" "}
                    <span className="font-mono font-semibold">{formatKES((monthSubTotal + monthBillTotal).toFixed(2))}</span>
                  </span>
                  {overBudget && (
                    <span className="flex items-center gap-1 font-semibold text-[#D32F2F]">
                      <AlertTriangle className="h-3.5 w-3.5" /> Over budget ({formatKES(monthBudget as string)})
                    </span>
                  )}
                </div>
              )}
              <div className="space-y-2">
                {monthEvents.map((event) => {
                  const billEvent = event as { isOverdue?: boolean; status?: string };
                  const isSubEvent = event.type === "subscription";
                  const subOverdue = isSubEvent && (event as { isOverdue?: boolean }).isOverdue === true;
                  const subDueToday = isSubEvent && (event as { isDueToday?: boolean }).isDueToday === true;
                  const openSubscription = isSubEvent ? () => navigate(`/subscriptions?highlight=${event.id}`) : undefined;
                  return (
                  <Card
                    key={`${event.type}-${event.id}-${event.date}`}
                    className={`border-[#E8E0D8] bg-white ${isSubEvent ? "cursor-pointer transition-colors hover:bg-[#F5EDE6]" : ""}`}
                    onClick={openSubscription}
                    role={isSubEvent ? "button" : undefined}
                    tabIndex={isSubEvent ? 0 : undefined}
                    onKeyDown={isSubEvent ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSubscription?.(); } } : undefined}
                  >
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        event.type === "sale" ? "bg-[#2E7D32]/10" :
                        event.type === "expense" ? "bg-[#D32F2F]/10" :
                        event.type === "bill" ? billEvent.isOverdue ? "bg-[#D32F2F]/10" : event.priority >= 2 ? "bg-[#ED6C02]/10" : "bg-[#8D8A87]/10" :
                        isSubEvent ? subOverdue ? "bg-[#D32F2F]/10" : subDueToday ? "bg-[#6B4FA8]" : "bg-[#6B4FA8]/10" :
                        "bg-[#D4A854]/10"
                      }`}>
                        {event.type === "sale" ? <Receipt className="h-5 w-5 text-[#2E7D32]" /> :
                         event.type === "expense" ? <TrendingDown className="h-5 w-5 text-[#D32F2F]" /> :
                         event.type === "bill" ? billEvent.isOverdue ? <AlertTriangle className="h-5 w-5 text-[#D32F2F]" /> : <FileText className="h-5 w-5 text-[#ED6C02]" /> :
                         isSubEvent ? <Repeat className={`h-5 w-5 ${subOverdue ? "text-[#D32F2F]" : subDueToday ? "text-white" : "text-[#6B4FA8]"}`} /> :
                         <Landmark className="h-5 w-5 text-[#D4A854]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            event.type === "sale" ? "bg-[#2E7D32]/10 text-[#2E7D32]" :
                            event.type === "expense" ? "bg-[#D32F2F]/10 text-[#D32F2F]" :
                            event.type === "bill" && billEvent.isOverdue ? "bg-[#D32F2F]/10 text-[#D32F2F]" :
                            event.type === "bill" && event.priority >= 2 ? "bg-[#ED6C02]/10 text-[#ED6C02]" :
                            event.type === "bill" && billEvent.status === "partial" ? "bg-[#D4A854]/10 text-[#D4A854]" :
                            event.type === "bill" ? "bg-[#8D8A87]/10 text-[#8D8A87]" :
                            isSubEvent && subOverdue ? "bg-[#D32F2F]/10 text-[#D32F2F]" :
                            isSubEvent && subDueToday ? "bg-[#6B4FA8] text-white" :
                            isSubEvent ? "border border-[#6B4FA8] text-[#6B4FA8]" :
                            "bg-[#D4A854]/10 text-[#D4A854]"
                          }`}>{event.type}</span>
                          <span className="text-xs text-[#8D8A87]">{formatDate(event.date)}</span>
                          {billEvent.isOverdue && <span className="text-xs font-bold text-[#D32F2F]">OVERDUE</span>}
                          {event.priority === 2 && !billEvent.isOverdue && <span className="text-xs font-bold text-[#ED6C02]">DUE SOON</span>}
                          {billEvent.status === "partial" && !billEvent.isOverdue && event.priority !== 2 && <span className="text-xs font-bold text-[#D4A854]">PARTIAL</span>}
                        </div>
                        <p className="mt-1 truncate text-sm font-medium text-[#2D2A26]">{event.title}</p>
                        {isSubEvent && (event as { branchName?: string | null }).branchName !== undefined && (
                          <p className="mt-0.5 truncate text-xs text-[#8D8A87]">{(event as { branchName?: string | null }).branchName ?? "Whole business"}</p>
                        )}
                      </div>
                      {event.amount && (
                        <span className={`shrink-0 font-mono text-sm font-semibold ${
                          event.type === "sale" ? "text-[#2E7D32]" :
                          event.type === "expense" ? "text-[#D32F2F]" :
                          isSubEvent ? subOverdue ? "text-[#D32F2F]" : "text-[#6B4FA8]" :
                          "text-[#ED6C02]"
                        }`}>{formatKES(event.amount)}</span>
                      )}
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            </div>
          );})}
          {allEvents.length === 0 && (
            <div className="py-12 text-center text-sm text-[#8D8A87]">
              <CalendarDays className="mx-auto mb-3 h-12 w-12 opacity-20" />
              <p>No events in the selected period.</p>
            </div>
          )}
        </div>
        </>
        )}

        {section === "payments" && <DailyPayments embedded />}
      </div>
    </Layout>
  );
}
