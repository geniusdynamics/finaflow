// ABOUTME: Restricted account recovery screen for billing holds and manual renewal requests.
// ABOUTME: Shows verified server access state without mounting operational account features.
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { trpc, getQueryClient } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function Billing() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const summary = trpc.billing.summary.useQuery(undefined, {
    enabled: !!user?.accountAccess?.canManageBilling,
    retry: false,
  });
  const utils = trpc.useUtils();
  const request = trpc.billing.requestRenewal.useMutation({
    onSuccess: () => {
      toast.success("Renewal request submitted for review");
      utils.billing.summary.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  useEffect(() => {
    setOpen(true);
    const client = getQueryClient();
    client.removeQueries({
      predicate: q =>
        !JSON.stringify(q.queryKey).includes("localAuth") &&
        !JSON.stringify(q.queryKey).includes("billing"),
    });
  }, [location.key]);
  useEffect(() => {
    if (user?.accountAccess?.mode === "full")
      navigate("/dashboard", { replace: true });
  }, [user, navigate]);
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">Account billing</h1>
      <div className="rounded-lg border p-5">
        <h2 className="font-semibold">Your account is on billing hold</h2>
        <p className="mt-2">
          Owners and admins can request renewal here. Platform features become
          available after super admin verifies the renewal and restores access.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Dashboard", "Sales", "Reports"].map(label => (
            <Button key={label} variant="outline" onClick={() => setOpen(true)}>
              {label}
            </Button>
          ))}
        </div>
      </div>
      {summary.isLoading ? (
        <p role="status">Loading billing details…</p>
      ) : summary.error ? (
        <div role="alert">
          {summary.error.message}
          <Button onClick={() => summary.refetch()}>Retry</Button>
        </div>
      ) : (
        <>
          <p>
            {summary.data?.account.name} · {summary.data?.account.accountId} ·{" "}
            {summary.data?.account.plan}
          </p>
          {summary.data?.request?.status === "pending" ? (
            <p role="status">Your renewal request is pending review.</p>
          ) : (
            <form
              className="space-y-4"
              onSubmit={e => {
                e.preventDefault();
                request.mutate({
                  paymentReference: reference || undefined,
                  note: note || undefined,
                });
              }}
            >
              <label className="block">
                Payment reference (optional)
                <Input
                  value={reference}
                  maxLength={255}
                  onChange={e => setReference(e.target.value)}
                />
              </label>
              <label className="block">
                Note (optional)
                <textarea
                  className="mt-1 w-full rounded-md border p-3"
                  value={note}
                  maxLength={2000}
                  onChange={e => setNote(e.target.value)}
                />
              </label>
              <Button disabled={request.isPending}>
                Request renewal review
              </Button>
              <p className="text-sm text-muted-foreground">
                This request does not collect payment. Payment is verified
                externally.
              </p>
            </form>
          )}
        </>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => utils.localAuth.me.invalidate()}
        >
          Check access again
        </Button>
        <Button variant="outline" onClick={() => logout()}>
          Sign out / use another account
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renew your FinaFlow access</DialogTitle>
            <DialogDescription>
              Your account is on billing hold. Request renewal review below to
              restore platform access. Closing this message leaves the billing
              page available.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setOpen(false)}>Continue to billing</Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
