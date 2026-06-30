// ABOUTME: Platform admin dashboard for user analytics, account insights, and SMTP configuration.
import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  Users, Building, Mail, TrendingUp, Activity, Search, Send, ShieldCheck, Megaphone,
} from "lucide-react";

const COLORS = ["#C73E1D", "#D4A854", "#0288D1", "#2E7D32", "#7B1FA2"];

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function statusColor(status: string): string {
  switch (status) {
    case "sent": return "bg-green-100 text-green-800 border-green-200";
    case "failed": return "bg-red-100 text-red-800 border-red-200";
    case "skipped": return "bg-yellow-100 text-yellow-800 border-yellow-200";
    default: return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

export default function Admin() {
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [search, setSearch] = useState("");

  const rangeParams = useMemo(() => ({
    from: dateRange.from || undefined,
    to: dateRange.to || undefined,
  }), [dateRange]);

  const { data: loginStats, isLoading: loginLoading } = trpc.admin.getLoginStats.useQuery(rangeParams);
  const { data: activeAccounts, isLoading: accountsLoading } = trpc.admin.getActiveAccounts.useQuery(rangeParams);
  const { data: newUsers, isLoading: newUsersLoading } = trpc.admin.getNewUsers.useQuery(rangeParams);
  const { data: sessionDuration, isLoading: durationLoading } = trpc.admin.getSessionDuration.useQuery(rangeParams);
  const { data: planStats, isLoading: planLoading } = trpc.admin.getPlanStats.useQuery(rangeParams);
  const { data: accountList, isLoading: accountListLoading } = trpc.admin.getAccountList.useQuery({ search, limit: 50, offset: 0 });
  const { data: smtpConfig } = trpc.admin.getSmtpConfig.useQuery();
  const { data: emailStats, isLoading: emailStatsLoading } = trpc.admin.getEmailStats.useQuery(rangeParams);
  const { data: emailLogs, isLoading: emailLogsLoading } = trpc.admin.getEmailLogs.useQuery({ limit: 50, offset: 0 });
  const { data: broadcasts, isLoading: broadcastsLoading } = trpc.admin.getOwnerBroadcasts.useQuery({ limit: 20, offset: 0 });
  const { data: notificationAnalytics, isLoading: analyticsLoading } = trpc.admin.getNotificationAnalytics.useQuery();

  const updateSmtp = trpc.admin.updateSmtpConfig.useMutation({
    onSuccess: () => {
      toast.success("SMTP configuration updated");
      utils.admin.getSmtpConfig.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const sendTestEmail = trpc.admin.sendTestEmail.useMutation({
    onSuccess: (res) => {
      if (res.delivered) toast.success("Test email sent");
      else toast.warning(res.skipped ? "Email skipped — SMTP not configured" : "Test email failed");
    },
    onError: (err) => toast.error(err.message),
  });
  const utils = trpc.useUtils();

  const [smtpForm, setSmtpForm] = useState({ host: "", port: "", user: "", pass: "", from: "" });
  const [testTo, setTestTo] = useState("");
  const [broadcast, setBroadcast] = useState({
    title: "",
    message: "",
    channels: { email: true, notification: false, banner: false },
    linkUrl: "",
    linkLabel: "",
  });

  const isSmtpDirty = smtpForm.host || smtpForm.port || smtpForm.user || smtpForm.pass || smtpForm.from;

  const sendBroadcast = trpc.admin.sendOwnerBroadcast.useMutation({
    onSuccess: (res) => {
      toast.success(`Broadcast sent to ${res.recipientCount} owners`);
      setBroadcast({ title: "", message: "", channels: { email: true, notification: false, banner: false }, linkUrl: "", linkLabel: "" });
      utils.admin.getOwnerBroadcasts.invalidate();
      utils.admin.getNotificationAnalytics.invalidate();
      utils.admin.getEmailStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  function saveSmtp(e: React.FormEvent) {
    e.preventDefault();
    updateSmtp.mutate({
      ...(smtpForm.host ? { host: smtpForm.host } : {}),
      ...(smtpForm.port ? { port: smtpForm.port } : {}),
      ...(smtpForm.user ? { user: smtpForm.user } : {}),
      ...(smtpForm.pass ? { pass: smtpForm.pass } : {}),
      ...(smtpForm.from ? { from: smtpForm.from } : {}),
    });
    setSmtpForm({ host: "", port: "", user: "", pass: "", from: "" });
  }

  const dailyChartData = loginStats?.daily.map((d) => ({
    date: d.date,
    logins: d.count,
    users: d.uniqueUsers,
  })) ?? [];

  const planChartData = planStats?.byPlan.map((p) => ({
    name: p.plan,
    value: p.count,
  })) ?? [];

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#2D2A26]">Admin Dashboard</h1>
            <p className="text-sm text-[#8D8A87]">Platform-wide analytics, accounts, and email configuration</p>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#C73E1D]" />
            <span className="text-sm font-medium text-[#2D2A26]">Super Admin</span>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-[#E8E0D8] bg-white p-4">
          <div>
            <Label className="text-xs text-[#8D8A87]">From</Label>
            <Input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value }))}
              className="w-40"
            />
          </div>
          <div>
            <Label className="text-xs text-[#8D8A87]">To</Label>
            <Input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value }))}
              className="w-40"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setDateRange({ from: "", to: "" })}
            className="border-[#E8E0D8]"
          >
            Reset
          </Button>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white border border-[#E8E0D8]">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="users">New Users</TabsTrigger>
            <TabsTrigger value="plans">Plans & Trials</TabsTrigger>
            <TabsTrigger value="email">Email Logs</TabsTrigger>
            <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
            <TabsTrigger value="smtp">SMTP</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard title="Total Logins" value={loginStats?.totalLogins ?? 0} icon={<Activity className="h-5 w-5" />} loading={loginLoading} />
              <MetricCard title="Unique Users" value={loginStats?.uniqueUsers ?? 0} icon={<Users className="h-5 w-5" />} loading={loginLoading} />
              <MetricCard title="Active Accounts" value={activeAccounts?.length ?? 0} icon={<Building className="h-5 w-5" />} loading={accountsLoading} />
              <MetricCard title="Avg Session" value={formatDuration(sessionDuration?.overall?.avgDuration ?? 0)} icon={<TrendingUp className="h-5 w-5" />} loading={durationLoading} />
            </div>

            <Card className="border-[#E8E0D8]">
              <CardHeader>
                <CardTitle className="text-lg">Login Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 w-full">
                  {dailyChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D8" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="logins" fill="#C73E1D" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="users" fill="#D4A854" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-[#8D8A87]">No login activity for the selected range</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accounts" className="space-y-6">
            <Card className="border-[#E8E0D8]">
              <CardHeader>
                <CardTitle className="text-lg">Active Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Unique Users</TableHead>
                      <TableHead>Total Logins</TableHead>
                      <TableHead>Last Login</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(activeAccounts ?? []).map((a) => (
                      <TableRow key={a.accountId ?? "unknown"}>
                        <TableCell>
                          <div className="font-medium">{a.accountName ?? a.accountId}</div>
                          <div className="text-xs text-[#8D8A87]">{a.accountId}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{a.plan ?? "—"}</Badge></TableCell>
                        <TableCell>{a.uniqueUsers}</TableCell>
                        <TableCell>{a.totalLogins}</TableCell>
                        <TableCell>{formatDate(a.lastLogin)}</TableCell>
                      </TableRow>
                    ))}
                    {!accountsLoading && (activeAccounts ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-[#8D8A87]">No active accounts in this range</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-[#E8E0D8]">
              <CardHeader>
                <CardTitle className="text-lg">All Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex items-center gap-2">
                  <Search className="h-4 w-4 text-[#8D8A87]" />
                  <Input
                    placeholder="Search by account ID or name"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Businesses</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(accountList ?? []).map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="font-medium">{a.name ?? a.accountId}</div>
                          <div className="text-xs text-[#8D8A87]">{a.accountId}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{a.plan}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{a.subscriptionStatus}</Badge></TableCell>
                        <TableCell>{a.businessCount}</TableCell>
                        <TableCell>{a.userCount}</TableCell>
                        <TableCell>{formatDate(a.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                    {!accountListLoading && (accountList ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-[#8D8A87]">No accounts found</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card className="border-[#E8E0D8]">
              <CardHeader>
                <CardTitle className="text-lg">New Users</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Logins</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Avg Session</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(newUsers ?? []).map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="font-medium">{u.name ?? u.username}</div>
                          <div className="text-xs text-[#8D8A87]">{u.email}</div>
                        </TableCell>
                        <TableCell>{u.accountId}</TableCell>
                        <TableCell>{formatDate(u.createdAt)}</TableCell>
                        <TableCell>{u.loginCount}</TableCell>
                        <TableCell>{formatDate(u.lastLogin)}</TableCell>
                        <TableCell>{formatDuration(u.avgSessionDuration)}</TableCell>
                      </TableRow>
                    ))}
                    {!newUsersLoading && (newUsers ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-[#8D8A87]">No new users in this range</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plans" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard title="Total Accounts" value={planStats?.totalAccounts ?? 0} icon={<Building className="h-5 w-5" />} loading={planLoading} />
              <MetricCard title="Trial Accounts" value={planStats?.byStatus.find((s) => s.status === "trial")?.count ?? 0} icon={<Activity className="h-5 w-5" />} loading={planLoading} />
              <MetricCard title="Extended Trials" value={planStats?.extendedTrials ?? 0} icon={<TrendingUp className="h-5 w-5" />} loading={planLoading} />
            </div>

            <Card className="border-[#E8E0D8]">
              <CardHeader>
                <CardTitle className="text-lg">Plan Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 w-full">
                  {planChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={planChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {planChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-[#8D8A87]">No plan data available</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#E8E0D8]">
              <CardHeader>
                <CardTitle className="text-lg">Subscription Statuses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {(planStats?.byStatus ?? []).map((s) => (
                    <Badge key={s.status} variant="outline" className="px-3 py-1 text-sm capitalize">
                      {s.status}: {s.count}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard title="Total Emails" value={emailStats?.total ?? 0} icon={<Mail className="h-5 w-5" />} loading={emailStatsLoading} />
              <MetricCard title="Sent" value={emailStats?.totalSent ?? 0} icon={<Send className="h-5 w-5" />} loading={emailStatsLoading} />
              <MetricCard title="Sent Today" value={emailStats?.sentToday ?? 0} icon={<Activity className="h-5 w-5" />} loading={emailStatsLoading} />
              <MetricCard title="Failed" value={emailStats?.totalFailed ?? 0} icon={<TrendingUp className="h-5 w-5" />} loading={emailStatsLoading} />
            </div>

            <Card className="border-[#E8E0D8]">
              <CardHeader>
                <CardTitle className="text-lg">Emails by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {(emailStats?.byType ?? []).map((t) => (
                    <Badge key={t.type} variant="outline" className="px-3 py-1 text-sm capitalize">
                      {t.type.replace(/_/g, " ")}: {t.count}
                    </Badge>
                  ))}
                  {!emailStatsLoading && (emailStats?.byType ?? []).length === 0 && (
                    <span className="text-sm text-[#8D8A87]">No email activity for the selected range</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#E8E0D8]">
              <CardHeader>
                <CardTitle className="text-lg">Recent Email Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(emailLogs ?? []).map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="capitalize">{log.type.replace(/_/g, " ")}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`capitalize ${statusColor(log.status)}`}>
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{timeAgo(log.sentAt ?? log.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                    {!emailLogsLoading && (emailLogs ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center text-[#8D8A87]">No email logs yet</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="broadcast" className="space-y-6">
            <Card className="border-[#E8E0D8]">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Megaphone className="h-5 w-5" />
                  Send Owner Broadcast
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={broadcast.title}
                    onChange={(e) => setBroadcast((b) => ({ ...b, title: e.target.value }))}
                    placeholder="Announcement title"
                  />
                </div>
                <div>
                  <Label>Message</Label>
                  <textarea
                    value={broadcast.message}
                    onChange={(e) => setBroadcast((b) => ({ ...b, message: e.target.value }))}
                    placeholder="Write the message you want to send to all system owners..."
                    rows={5}
                    className="w-full rounded-md border border-[#E8E0D8] bg-white px-3 py-2 text-sm text-[#2D2A26] placeholder:text-[#8D8A87] focus:outline-none focus:ring-2 focus:ring-[#C73E1D]"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Link URL (optional)</Label>
                    <Input
                      value={broadcast.linkUrl}
                      onChange={(e) => setBroadcast((b) => ({ ...b, linkUrl: e.target.value }))}
                      placeholder="https://example.com/page"
                    />
                  </div>
                  <div>
                    <Label>Link Label (optional)</Label>
                    <Input
                      value={broadcast.linkLabel}
                      onChange={(e) => setBroadcast((b) => ({ ...b, linkLabel: e.target.value }))}
                      placeholder="Learn more"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={broadcast.channels.email}
                      onChange={(e) => setBroadcast((b) => ({ ...b, channels: { ...b.channels, email: e.target.checked } }))}
                      className="h-4 w-4 accent-[#C73E1D]"
                    />
                    Email
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={broadcast.channels.notification}
                      onChange={(e) => setBroadcast((b) => ({ ...b, channels: { ...b.channels, notification: e.target.checked } }))}
                      className="h-4 w-4 accent-[#C73E1D]"
                    />
                    In-app Notification
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={broadcast.channels.banner}
                      onChange={(e) => setBroadcast((b) => ({ ...b, channels: { ...b.channels, banner: e.target.checked } }))}
                      className="h-4 w-4 accent-[#C73E1D]"
                    />
                    Popup Banner
                  </label>
                </div>
                <Button
                  onClick={() => {
                    const channels = [] as ("email" | "notification" | "banner")[];
                    if (broadcast.channels.email) channels.push("email");
                    if (broadcast.channels.notification) channels.push("notification");
                    if (broadcast.channels.banner) channels.push("banner");
                    if (channels.length > 0 && broadcast.title && broadcast.message) {
                      sendBroadcast.mutate({
                        title: broadcast.title,
                        message: broadcast.message,
                        channels,
                        ...(broadcast.linkUrl ? { linkUrl: broadcast.linkUrl } : {}),
                        ...(broadcast.linkLabel ? { linkLabel: broadcast.linkLabel } : {}),
                      });
                    }
                  }}
                  disabled={sendBroadcast.isPending || !broadcast.title || !broadcast.message}
                  className="bg-[#C73E1D] hover:bg-[#C73E1D]/90"
                >
                  Send to All Owners
                </Button>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard title="Broadcasts" value={notificationAnalytics?.totalBroadcasts ?? 0} icon={<Megaphone className="h-5 w-5" />} loading={analyticsLoading} />
              <MetricCard title="Total Reads" value={notificationAnalytics?.totalReads ?? 0} icon={<Users className="h-5 w-5" />} loading={analyticsLoading} />
              <MetricCard title="Link Clicks" value={notificationAnalytics?.totalClicks ?? 0} icon={<TrendingUp className="h-5 w-5" />} loading={analyticsLoading} />
              <MetricCard title="Dismissals" value={notificationAnalytics?.totalDismissals ?? 0} icon={<Activity className="h-5 w-5" />} loading={analyticsLoading} />
            </div>

            <Card className="border-[#E8E0D8]">
              <CardHeader>
                <CardTitle className="text-lg">Broadcast Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead>Reads</TableHead>
                      <TableHead>Clicks</TableHead>
                      <TableHead>Read %</TableHead>
                      <TableHead>CTR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(notificationAnalytics?.broadcasts ?? []).map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div className="font-medium">{b.title}</div>
                          <div className="max-w-xs truncate text-xs text-[#8D8A87]">{b.message}</div>
                        </TableCell>
                        <TableCell>{b.recipients}</TableCell>
                        <TableCell>{b.reads}</TableCell>
                        <TableCell>{b.clicks}</TableCell>
                        <TableCell>{b.readRate}%</TableCell>
                        <TableCell>{b.clickRate}%</TableCell>
                      </TableRow>
                    ))}
                    {!analyticsLoading && (notificationAnalytics?.broadcasts ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-[#8D8A87]">No broadcast analytics yet</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-[#E8E0D8]">
              <CardHeader>
                <CardTitle className="text-lg">Recent Broadcasts</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Channels</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead>Sent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(broadcasts ?? []).map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div className="font-medium">{b.title}</div>
                          <div className="max-w-xs truncate text-xs text-[#8D8A87]">{b.message}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(b.channels ?? []).map((c) => (
                              <Badge key={c} variant="outline" className="capitalize text-xs">{c}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{b.recipientCount}</TableCell>
                        <TableCell>{timeAgo(b.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                    {!broadcastsLoading && (broadcasts ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-[#8D8A87]">No broadcasts yet</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="smtp" className="space-y-6">
            <Card className="border-[#E8E0D8]">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  SMTP Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg bg-[#F5EDE6] p-4">
                    <div className="text-xs text-[#8D8A87]">Status</div>
                    <div className="font-medium">{smtpConfig?.isConfigured ? "Configured" : "Not configured"}</div>
                  </div>
                  <div className="rounded-lg bg-[#F5EDE6] p-4">
                    <div className="text-xs text-[#8D8A87]">Host</div>
                    <div className="font-medium">{smtpConfig?.host || "—"}</div>
                  </div>
                  <div className="rounded-lg bg-[#F5EDE6] p-4">
                    <div className="text-xs text-[#8D8A87]">Port</div>
                    <div className="font-medium">{smtpConfig?.port || "—"}</div>
                  </div>
                  <div className="rounded-lg bg-[#F5EDE6] p-4">
                    <div className="text-xs text-[#8D8A87]">From Address</div>
                    <div className="font-medium">{smtpConfig?.from || "—"}</div>
                  </div>
                </div>

                <form onSubmit={saveSmtp} className="space-y-4 rounded-lg border border-[#E8E0D8] p-4">
                  <h3 className="font-medium">Update SMTP Settings</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Host</Label>
                      <Input value={smtpForm.host} onChange={(e) => setSmtpForm((f) => ({ ...f, host: e.target.value }))} placeholder={smtpConfig?.host || "smtp.example.com"} />
                    </div>
                    <div>
                      <Label>Port</Label>
                      <Input value={smtpForm.port} onChange={(e) => setSmtpForm((f) => ({ ...f, port: e.target.value }))} placeholder={smtpConfig?.port || "587"} />
                    </div>
                    <div>
                      <Label>Username</Label>
                      <Input value={smtpForm.user} onChange={(e) => setSmtpForm((f) => ({ ...f, user: e.target.value }))} placeholder={smtpConfig?.user || "user@example.com"} />
                    </div>
                    <div>
                      <Label>Password</Label>
                      <Input type="password" value={smtpForm.pass} onChange={(e) => setSmtpForm((f) => ({ ...f, pass: e.target.value }))} placeholder={smtpConfig?.hasPassword ? "••••••••" : "Enter password"} />
                    </div>
                    <div className="md:col-span-2">
                      <Label>From Email</Label>
                      <Input value={smtpForm.from} onChange={(e) => setSmtpForm((f) => ({ ...f, from: e.target.value }))} placeholder={smtpConfig?.from || "noreply@example.com"} />
                    </div>
                  </div>
                  <Button type="submit" disabled={!isSmtpDirty || updateSmtp.isPending} className="bg-[#C73E1D] hover:bg-[#C73E1D]/90">
                    Save SMTP Settings
                  </Button>
                </form>

                <div className="space-y-2 rounded-lg border border-[#E8E0D8] p-4">
                  <h3 className="font-medium">Send Test Email</h3>
                  <div className="flex items-center gap-2">
                    <Input
                      type="email"
                      placeholder="recipient@example.com"
                      value={testTo}
                      onChange={(e) => setTestTo(e.target.value)}
                      className="max-w-sm"
                    />
                    <Button
                      onClick={() => testTo && sendTestEmail.mutate({ to: testTo })}
                      disabled={!testTo || sendTestEmail.isPending}
                      variant="outline"
                      className="border-[#E8E0D8]"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Send
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function MetricCard({ title, value, icon, loading }: { title: string; value: string | number; icon: React.ReactNode; loading?: boolean }) {
  return (
    <Card className="border-[#E8E0D8]">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[#8D8A87]">{title}</p>
            <p className="mt-1 text-2xl font-bold text-[#2D2A26]">{loading ? "—" : value}</p>
          </div>
          <div className="rounded-lg bg-[#F5EDE6] p-3 text-[#C73E1D]">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
