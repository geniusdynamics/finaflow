// ABOUTME: URL-driven platform support workspace with customer directories and audited controls.
// ABOUTME: Preserves the existing analytics and communications tools inside responsive navigation.
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Layout } from "@/components/Layout";
import { AdminReports } from "@/pages/Admin";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const sections = [
  "accounts",
  "users",
  "overview",
  "plans",
  "communications",
  "audit",
] as const;
const labels = [
  "Accounts",
  "Users",
  "Overview",
  "Usage & Plans",
  "Communications",
  "Audit",
];
const selectClass = "h-10 rounded-md border bg-white px-3 text-sm";

export default function AdminWorkspace() {
  const [params, setParams] = useSearchParams();
  const section = params.get("section") ?? "accounts";
  const [draft, setDraft] = useState(params.get("search") ?? "");
  const change = useCallback((values: Record<string, string>) =>
    setParams(current => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(values)) {
        if (value) next.set(key, value); else next.delete(key);
      }
      return next;
    }), [setParams]);
  useEffect(() => {
    setDraft(params.get("search") ?? "");
  }, [params]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft !== (params.get("search") ?? ""))
        change({ search: draft, page: "" });
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, params, change]);
  const page = Math.max(0, Number(params.get("page")) || 0);
  const accountId = params.get("account") ?? "";
  const accounts = trpc.admin.listAccounts.useQuery(
    {
      search: params.get("search") ?? "",
      plan: params.get("plan") || undefined,
      access: (params.get("access") ?? "all") as "all" | "held" | "active",
      limit: 25,
      offset: page * 25,
    },
    { enabled: section === "accounts" }
  );
  const users = trpc.admin.listUsers.useQuery(
    { search: params.get("search") ?? "", limit: 25, offset: page * 25 },
    { enabled: section === "users" }
  );
  const audit = trpc.admin.listAuditEvents.useQuery(
    { limit: 25, offset: page * 25 },
    { enabled: section === "audit" }
  );
  const active =
    section === "accounts" ? accounts : section === "users" ? users : audit;
  return (
    <Layout>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-[#2D2A26]">Platform admin</h1>
          <p className="text-sm text-muted-foreground">
            Customer support, access and platform activity
          </p>
        </header>
        <div className="lg:flex lg:gap-6">
          <nav
            aria-label="Admin sections"
            className="mb-5 flex gap-1 overflow-x-auto lg:w-48 lg:shrink-0 lg:flex-col"
          >
            {sections.map((item, index) => (
              <Button
                key={item}
                variant={section === item ? "secondary" : "ghost"}
                className="justify-start"
                onClick={() =>
                  change({ section: item, page: "", account: "", search: "" })
                }
              >
                {labels[index]}
              </Button>
            ))}
          </nav>
          <main className="min-w-0 flex-1 space-y-5">
            {section === "accounts" && accountId ? (
              <AccountWorkspace
                accountId={accountId}
                onBack={() => change({ account: "" })}
              />
            ) : ["accounts", "users", "audit"].includes(section) ? (
              <>
                {section === "accounts" && <RenewalQueue onOpen={id=>change({account:id})}/>}
                {section !== "audit" && (
                  <div className="flex flex-wrap gap-2">
                    <Input
                      aria-label="Search directory"
                      placeholder={
                        section === "users" ? "Search users" : "Search customers"
                      }
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      className="max-w-sm"
                    />
                    {section === "accounts" && (
                      <>
                        <select
                          aria-label="Plan filter"
                          className={selectClass}
                          value={params.get("plan") ?? ""}
                          onChange={e =>
                            change({ plan: e.target.value, page: "" })
                          }
                        >
                          <option value="">All plans</option>
                          {["free", "starter", "growth", "pro", "partner"].map(
                            p => (
                              <option key={p}>{p}</option>
                            )
                          )}
                        </select>
                        <select
                          aria-label="Access filter"
                          className={selectClass}
                          value={params.get("access") ?? "all"}
                          onChange={e =>
                            change({ access: e.target.value, page: "" })
                          }
                        >
                          <option value="all">All access states</option>
                          <option value="held">Billing hold</option>
                          <option value="active">Active</option>
                        </select>
                      </>
                    )}
                  </div>
                )}
                {active.isLoading ? (
                  <p role="status">Loading directory…</p>
                ) : active.error ? (
                  <div role="alert">
                    {active.error.message}
                    <Button onClick={() => active.refetch()}>Retry</Button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {active.data?.total ?? 0} results
                    </p>
                    <div className="divide-y rounded-lg border">
                      {section === "accounts"
                        ? accounts.data?.data.map(a => (
                            <button
                              key={a.id}
                              className="flex w-full flex-wrap justify-between gap-2 p-4 text-left hover:bg-muted"
                              onClick={() => change({ account: a.accountId })}
                            >
                              <span>
                                <strong>{a.name}</strong>
                                <span className="block text-sm">
                                  {a.accountId}
                                </span>
                              </span>
                              <span className="text-sm">
                                {a.plan} ·{" "}
                                {a.billingHoldAt
                                  ? "Billing hold"
                                  : a.subscriptionStatus}
                              </span>
                            </button>
                          ))
                        : section === "users"
                          ? users.data?.data.map(u => (
                              <div
                                key={u.id}
                                className="flex flex-wrap justify-between gap-2 p-4"
                              >
                                <span>
                                  <strong>{u.name || u.username}</strong>
                                  <span className="block text-sm">
                                    {u.email} · {u.role} ·{" "}
                                    {u.isActive ? "Active" : "Disabled"}
                                  </span>
                                </span>
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    change({
                                      section: "accounts",
                                      account: u.accountId ?? "",
                                    })
                                  }
                                >
                                  Open account
                                </Button>
                              </div>
                            ))
                          : audit.data?.data.map(a => (
                              <div
                                key={a.id}
                                className="break-words p-4 text-sm"
                              >
                                <strong>{a.action}</strong> · {a.tableName} #
                                {a.recordId}
                                <p>{new Date(a.createdAt).toLocaleString()}</p>
                                <pre className="whitespace-pre-wrap">
                                  {JSON.stringify(a.newValues, null, 2)}
                                </pre>
                              </div>
                            ))}
                      {active.data?.total === 0 && (
                        <p className="p-6">
                          No matching records. Adjust the filters to broaden
                          your search.
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        disabled={page === 0}
                        onClick={() => change({ page: String(page - 1) })}
                      >
                        Previous
                      </Button>
                      <span>Page {page + 1}</span>
                      <Button
                        variant="outline"
                        disabled={(page + 1) * 25 >= (active.data?.total ?? 0)}
                        onClick={() => change({ page: String(page + 1) })}
                      >
                        Next
                      </Button>
                    </div>
                  </>
                )}
              </>
            ) : section === "communications" ? (
              <>
                <nav
                  className="flex flex-wrap gap-2"
                  aria-label="Communications"
                >
                  {["email", "broadcast", "smtp"].map(item => (
                    <Button
                      key={item}
                      variant="outline"
                      onClick={() => change({ tool: item })}
                    >
                      {item === "email"
                        ? "Email logs"
                        : item === "smtp"
                          ? "SMTP"
                          : "Broadcasts"}
                    </Button>
                  ))}
                </nav>
                <AdminReports section={params.get("tool") ?? "email"} />
              </>
            ) : (
              <AdminReports
                section={section === "plans" ? "plans" : "overview"}
              />
            )}
          </main>
        </div>
      </div>
    </Layout>
  );
}

function RenewalQueue({onOpen}:{onOpen:(accountId:string)=>void}) {
  const query=trpc.admin.listRenewalRequests.useQuery({status:"pending",limit:25,offset:0});
  return <section aria-label="Pending renewal requests" className="space-y-3 rounded-lg border p-4"><h2 className="font-semibold">Renewal review queue</h2>{query.isLoading?<p role="status">Loading renewal requests…</p>:query.error?<div role="alert">{query.error.message}<Button variant="outline" onClick={()=>query.refetch()}>Retry</Button></div>:<><p className="text-sm">{query.data?.total ?? 0} pending requests</p>{query.data?.data.map(r=><div className="flex flex-wrap items-center justify-between gap-2 border-t py-3" key={r.id}><span>{r.accountName} · {r.paymentReference || "No payment reference"}</span><Button variant="outline" onClick={()=>onOpen(r.accountId)}>Review account</Button></div>)}</>}</section>;
}

function AccountWorkspace({
  accountId,
  onBack,
}: {
  accountId: string;
  onBack: () => void;
}) {
  const detail = trpc.admin.getAccountDetail.useQuery({ accountId });
  const holdAt = detail.data?.account?.billingHoldAt;
  const requests = trpc.admin.listRenewalRequests.useQuery({
    accountId,
    limit: 25,
    offset: 0,
  });
  const audit = trpc.admin.listAuditEvents.useQuery({
    accountId,
    limit: 25,
    offset: 0,
  });
  const [reason, setReason] = useState("");
  const [plan, setPlan] = useState<"free" | "starter" | "growth" | "pro">(
    "pro"
  );
  const [expiry, setExpiry] = useState("");
  const [resetLink, setResetLink] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const options = {
    onSuccess: () => {
      toast.success("Account updated");
      utils.admin.invalidate();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  };
  const hold = trpc.admin.setAccountBillingHold.useMutation(options);
  const restore = trpc.admin.restoreAccountAccess.useMutation(options);
  const status = trpc.admin.setUserStatus.useMutation(options);
  const changePlan = trpc.admin.changeAccountPlan.useMutation(options);
  const trial = trpc.admin.adjustAccountTrial.useMutation(options);
  const decline = trpc.admin.declineRenewalRequest.useMutation(options);
  const reset = trpc.admin.sendPasswordReset.useMutation({
    onSuccess: r => {
      if (r.delivered) {
        setResetLink(null);
        toast.success("Reset email sent");
      } else {
        setResetLink(r.resetUrl ?? null);
        toast.error(r.error ?? "Reset email was not delivered");
      }
    },
    onError: e => toast.error(e.message),
  });
  const pending =
    hold.isPending ||
    restore.isPending ||
    status.isPending ||
    changePlan.isPending ||
    trial.isPending ||
    decline.isPending;
  const account = detail.data?.account;
  useEffect(() => {
    if (
      account &&
      ["free", "starter", "growth", "pro"].some(
        supportedPlan => supportedPlan === account.plan
      )
    ) {
      setPlan(account.plan as typeof plan);
    }
  }, [account?.accountId, account?.plan]);
  const confirmAction = (description: string, action: () => void) => {
    if (reason.trim() && window.confirm(description)) action();
  };
  return (
    <div className="space-y-5">
      <Button variant="outline" onClick={onBack}>
        Back to accounts
      </Button>
      {detail.isLoading ? (
        <p>Loading account…</p>
      ) : detail.error ? (
        <div role="alert">
          {detail.error.message}
          <Button onClick={() => detail.refetch()}>Retry</Button>
        </div>
      ) : !account ? (
        <p>Account not found.</p>
      ) : (
        <>
          <h2 className="text-xl font-semibold">{account.name}</h2>
          {resetLink && <div role="alert" className="space-y-2 rounded-md border p-4"><p>Reset email was not delivered. Deliver this single-use link privately to the account holder.</p><Input aria-label="Manual password reset link" value={resetLink} readOnly/><Button variant="outline" onClick={()=>setResetLink(null)}>Dismiss reset link</Button></div>}
          <p>
            {accountId} · {account.plan} · {account.subscriptionStatus}
          </p>
          <label className="block text-sm">
            Support reason
            <Input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Required for management actions"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pending || !reason.trim()}
              onClick={() =>
                confirmAction("Place this account on billing hold?", () =>
                  hold.mutate({ accountId, reason })
                )
              }
            >
              Place billing hold
            </Button>
            <Button
              disabled={pending || !reason.trim() || !holdAt}
              onClick={() => {
                const at = holdAt ? new Date(holdAt).toISOString() : null;
                if (at)
                  confirmAction("Restore operational access?", () =>
                    restore.mutate({ accountId, holdAt: at, reason })
                  );
              }}
            >
              Restore access
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Assign plan"
              className={selectClass}
              value={plan}
              onChange={e => setPlan(e.target.value as typeof plan)}
            >
              {["free", "starter", "growth", "pro"].map(p => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <Button
              disabled={pending || !reason.trim()}
              onClick={() =>
                confirmAction(
                  "Apply this plan without charging the customer?",
                  () => changePlan.mutate({ accountId, plan, reason })
                )
              }
            >
              Apply plan
            </Button>
            <Input
              className="w-auto"
              aria-label="Trial expiry"
              type="date"
              value={expiry}
              onChange={e => setExpiry(e.target.value)}
            />
            <Button
              disabled={pending || !reason.trim() || !expiry || plan === "free"}
              onClick={() =>
                confirmAction("Set the selected trial and expiry?", () => {
                  if (plan !== "free")
                    trial.mutate({
                      accountId,
                      plan,
                      expiresOn: expiry,
                      reason,
                    });
                })
              }
            >
              Adjust trial
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Plan and trial edits do not restore a billing hold.
          </p>
          <h3 className="font-semibold">Businesses</h3>
          {detail.data?.businesses.map(b => (
            <div key={b.id} className="border-b py-2">
              {b.name} · {b.plan} · {b.isActive ? "Active" : "Disabled"}
            </div>
          ))}
          <h3 className="font-semibold">Users</h3>
          {detail.data?.users.map(u => (
            <div
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b py-3"
            >
              <span>
                {u.name || u.username} · {u.role} ·{" "}
                {u.isActive ? "Active" : "Disabled"}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={pending || !reason.trim()}
                  onClick={() =>
                    confirmAction(
                      `Set ${u.username} ${u.isActive ? "inactive" : "active"}?`,
                      () =>
                        status.mutate({
                          accountId,
                          userId: u.id,
                          isActive: !u.isActive,
                          reason,
                        })
                    )
                  }
                >
                  {u.isActive ? "Disable" : "Enable"}
                </Button>
                <Button
                  variant="outline"
                  disabled={reset.isPending}
                  onClick={() => {
                    if (window.confirm(`Send password reset to ${u.username}?`))
                      reset.mutate({ userId: u.id });
                  }}
                >
                  Reset password
                </Button>
              </div>
            </div>
          ))}
          <h3 className="font-semibold">Renewal requests</h3>
          {requests.error ? (
            <p role="alert">{requests.error.message}</p>
          ) : (
            requests.data?.data.map(r => (
              <div key={r.id} className="space-y-2 rounded-md border p-3">
                <p>
                  {r.status} · {r.paymentReference || "No reference"}
                </p>
                <p className="whitespace-pre-wrap">{r.note}</p>
                <p className="text-xs">
                  Hold: {new Date(r.holdAt).toISOString()}
                </p>
                {r.status === "pending" && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={pending || !reason.trim()}
                      onClick={() =>
                        confirmAction(
                          "Payment verified externally: restore access?",
                          () =>
                            restore.mutate({
                              accountId,
                              holdAt: new Date(r.holdAt).toISOString(),
                              reason,
                            })
                        )
                      }
                    >
                      Verify and restore
                    </Button>
                    <Button
                      variant="outline"
                      disabled={pending || !reason.trim()}
                      onClick={() =>
                        confirmAction("Decline this renewal request?", () =>
                          decline.mutate({
                            requestId: r.id,
                            holdAt: new Date(r.holdAt).toISOString(),
                            reason,
                          })
                        )
                      }
                    >
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
          {requests.data?.total === 0 && <p>No renewal requests.</p>}
          <h3 className="font-semibold">Support history</h3>
          {audit.data?.data.map(a => (
            <div key={a.id} className="break-words border-b py-2 text-sm">
              {a.action} · {new Date(a.createdAt).toLocaleString()}
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(a.newValues, null, 2)}
              </pre>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
