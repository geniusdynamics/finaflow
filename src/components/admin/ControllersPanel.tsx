// ABOUTME: Superadmin panel for the FinaBill controllers allowed to drive this FinaFlow instance.
// ABOUTME: Issues one-time fic_ keys, rotates/revokes them, and never redisplay the secret.
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  Link2,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type InstanceScope = "instance:read" | "instance:manage";

const SCOPE_OPTIONS: {
  value: InstanceScope;
  label: string;
  description: string;
}[] = [
  {
    value: "instance:read",
    label: "Read",
    description: "List this instance's status and catalogue metadata.",
  },
  {
    value: "instance:manage",
    label: "Manage",
    description: "Hold/resume accounts, change plans and manage users.",
  },
];

function relative(value: Date | string | null | undefined) {
  if (!value) return "Never";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return formatDistanceToNow(date, { addSuffix: true });
}

function exact(value: Date | string | null | undefined) {
  if (!value) return "Never";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString();
}

export function ControllersPanel() {
  const utils = trpc.useUtils();
  const controllers = trpc.admin.controllers.list.useQuery();

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [controllerId, setControllerId] = useState("");
  const [scopes, setScopes] = useState<InstanceScope[]>([
    "instance:read",
    "instance:manage",
  ]);
  const [issuedKey, setIssuedKey] = useState<{
    key: string;
    name: string;
  } | null>(null);
  const [pending, setPending] = useState<{
    action: "rotate" | "revoke" | "remove";
    id: number;
    name: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = () => utils.admin.controllers.list.invalidate();
  const onError = (error: { message: string }) => toast.error(error.message);

  const create = trpc.admin.controllers.create.useMutation({
    onSuccess: result => {
      setAddOpen(false);
      setName("");
      setControllerId("");
      setScopes(["instance:read", "instance:manage"]);
      setIssuedKey({ key: result.key, name: result.controller.name });
      toast.success("Controller created");
      void refresh();
    },
    onError,
  });
  const rotate = trpc.admin.controllers.rotate.useMutation({
    onSuccess: result => {
      setPending(null);
      setIssuedKey({ key: result.key, name: result.controller.name });
      toast.success("Key rotated");
      void refresh();
    },
    onError,
  });
  const revoke = trpc.admin.controllers.revoke.useMutation({
    onSuccess: () => {
      setPending(null);
      toast.success("Controller revoked");
      void refresh();
    },
    onError,
  });
  const remove = trpc.admin.controllers.remove.useMutation({
    onSuccess: () => {
      setPending(null);
      toast.success("Controller deleted");
      void refresh();
    },
    onError,
  });

  const busy = rotate.isPending || revoke.isPending || remove.isPending;

  const toggleScope = (scope: InstanceScope) =>
    setScopes(current =>
      current.includes(scope)
        ? current.filter(item => item !== scope)
        : [...current, scope]
    );

  const copyKey = async () => {
    if (!issuedKey) return;
    try {
      await navigator.clipboard.writeText(issuedKey.key);
      setCopied(true);
      toast.success("Key copied");
    } catch {
      toast.error("Could not copy the key; select it manually");
    }
  };

  const confirmPending = () => {
    if (!pending) return;
    if (pending.action === "rotate") rotate.mutate({ id: pending.id });
    else if (pending.action === "revoke") revoke.mutate({ id: pending.id });
    else remove.mutate({ id: pending.id });
  };

  return (
    <section className="space-y-5">
      <div className="rounded-xl border border-[#E8E0D8] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5EDE6] text-[#C73E1D]">
              <Link2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-semibold text-[#2D2A26]">
                FinaBill controllers
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Allow a FinaBill instance to manage this FinaFlow instance. The
                controller ID is the FinaBill account ID (for example{" "}
                <code className="rounded bg-[#FAF8F5] px-1">FNB-PLATFORM</code>{" "}
                or <code className="rounded bg-[#FAF8F5] px-1">ACC-…</code>),
                and it must match the{" "}
                <code className="rounded bg-[#FAF8F5] px-1">
                  X-Fina-Controller-Id
                </code>{" "}
                header FinaBill sends. The <code>fic_</code> key is shown once —
                store it in FinaBill immediately.
              </p>
            </div>
          </div>
          <Button
            className="bg-[#C73E1D] hover:bg-[#A33317]"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add controller
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E8E0D8] bg-white">
        {controllers.isLoading ? (
          <p role="status" className="p-6 text-sm text-muted-foreground">
            Loading controllers…
          </p>
        ) : controllers.error ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 p-6">
            <span className="text-sm">{controllers.error.message}</span>
            <Button variant="outline" onClick={() => controllers.refetch()}>
              Retry
            </Button>
          </div>
        ) : !controllers.data?.length ? (
          <div className="p-8 text-center">
            <KeyRound
              className="mx-auto h-8 w-8 text-[#8D8A87]"
              aria-hidden="true"
            />
            <p className="mt-3 font-medium text-[#2D2A26]">
              No controllers yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add the FinaBill account that should be able to drive this
              instance.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E8E0D8] bg-[#FAF8F5] text-xs uppercase tracking-wide text-[#8D8A87]">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Controller ID
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Key prefix
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Scopes
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Last used
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Created
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E0D8]">
                {controllers.data.map(controller => (
                  <tr key={controller.id} className="align-top">
                    <td className="px-4 py-3 font-medium text-[#2D2A26]">
                      {controller.name}
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-[#FAF8F5] px-1.5 py-0.5 text-xs">
                        {controller.controllerId}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs text-[#514D49]">
                        {controller.keyPrefix}…
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {controller.scopes.map(scope => (
                          <Badge
                            key={scope}
                            className="bg-[#C73E1D]/10 text-[#C73E1D]"
                          >
                            {scope === "instance:manage"
                              ? "Manage"
                              : scope === "instance:read"
                                ? "Read"
                                : scope}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {controller.isActive ? (
                        <Badge className="bg-[#2E7D32]/10 text-[#2E7D32]">
                          <Check className="mr-1 h-3 w-3" aria-hidden="true" />
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-[#8D8A87]/10 text-[#8D8A87]">
                          <XCircle
                            className="mr-1 h-3 w-3"
                            aria-hidden="true"
                          />
                          Revoked
                        </Badge>
                      )}
                    </td>
                    <td
                      className="px-4 py-3 text-[#514D49]"
                      title={exact(controller.lastUsedAt)}
                    >
                      {relative(controller.lastUsedAt)}
                    </td>
                    <td
                      className="px-4 py-3 text-[#514D49]"
                      title={exact(controller.createdAt)}
                    >
                      {relative(controller.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!controller.isActive || busy}
                          title={
                            controller.isActive
                              ? "Issue a new key and invalidate the current one"
                              : "Revoked controllers cannot be rotated"
                          }
                          onClick={() =>
                            setPending({
                              action: "rotate",
                              id: controller.id,
                              name: controller.name,
                            })
                          }
                        >
                          <RefreshCw
                            className="mr-1 h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          Rotate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!controller.isActive || busy}
                          onClick={() =>
                            setPending({
                              action: "revoke",
                              id: controller.id,
                              name: controller.name,
                            })
                          }
                        >
                          <XCircle
                            className="mr-1 h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          Revoke
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[#C73E1D]"
                          disabled={busy}
                          onClick={() =>
                            setPending({
                              action: "remove",
                              id: controller.id,
                              name: controller.name,
                            })
                          }
                        >
                          <Trash2
                            className="mr-1 h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add controller */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add FinaBill controller</DialogTitle>
            <DialogDescription>
              FinaBill signs requests with the controller ID and the{" "}
              <code>fic_</code> key you receive next.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={event => {
              event.preventDefault();
              if (!name.trim() || !controllerId.trim()) {
                toast.error("Name and controller ID are required");
                return;
              }
              if (scopes.length === 0) {
                toast.error("Select at least one scope");
                return;
              }
              create.mutate({
                name: name.trim(),
                controllerId: controllerId.trim(),
                scopes,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="controller-name">Name</Label>
              <Input
                id="controller-name"
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="FinaBill platform"
                maxLength={120}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="controller-id">Controller ID</Label>
              <Input
                id="controller-id"
                value={controllerId}
                onChange={event => setControllerId(event.target.value)}
                placeholder="FNB-PLATFORM or ACC-…"
                maxLength={100}
                required
              />
              <p className="text-xs text-muted-foreground">
                This is the FinaBill account ID. It must match the{" "}
                <code>X-Fina-Controller-Id</code> header FinaBill sends.
              </p>
            </div>
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Scopes</legend>
              {SCOPE_OPTIONS.map(option => (
                <Label
                  key={option.value}
                  htmlFor={`scope-${option.value}`}
                  className="flex items-start gap-3 rounded-lg border border-[#E8E0D8] p-3 font-normal"
                >
                  <Checkbox
                    id={`scope-${option.value}`}
                    checked={scopes.includes(option.value)}
                    onCheckedChange={() => toggleScope(option.value)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      {option.label}{" "}
                      <code className="text-xs text-[#8D8A87]">
                        {option.value}
                      </code>
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </Label>
              ))}
            </fieldset>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#C73E1D] hover:bg-[#A33317]"
                disabled={create.isPending}
              >
                Create controller
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* One-time key */}
      <Dialog
        open={issuedKey !== null}
        onOpenChange={open => {
          if (!open) {
            setIssuedKey(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Controller key for {issuedKey?.name}</DialogTitle>
            <DialogDescription>
              Copy this key into FinaBill now. It is shown once and cannot be
              retrieved later.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <code className="min-w-0 flex-1 break-all font-mono text-sm text-amber-900">
              {issuedKey?.key}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void copyKey()}
            >
              <Copy className="mr-1 h-4 w-4" aria-hidden="true" />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="flex items-start gap-2 text-sm text-amber-800">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            If you lose this key, rotate the controller to issue a new one. The
            previous key stops working immediately.
          </p>
          <DialogFooter>
            <Button
              className="bg-[#C73E1D] hover:bg-[#A33317]"
              onClick={() => {
                setIssuedKey(null);
                setCopied(false);
              }}
            >
              I have stored the key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm destructive action */}
      <Dialog
        open={pending !== null}
        onOpenChange={open => {
          if (!open) setPending(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.action === "rotate"
                ? "Rotate controller key?"
                : pending?.action === "revoke"
                  ? "Revoke controller?"
                  : "Delete controller?"}
            </DialogTitle>
            <DialogDescription>
              {pending?.action === "rotate"
                ? `${pending.name} will receive a new key. The current key stops working immediately.`
                : pending?.action === "revoke"
                  ? `${pending?.name} will stop authenticating against this instance. Its history stays in the audit log.`
                  : `${pending?.name} will be removed from the register. Its history stays in the audit log.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              className="bg-[#C73E1D] hover:bg-[#A33317]"
              disabled={busy}
              onClick={confirmPending}
            >
              {pending?.action === "rotate"
                ? "Rotate key"
                : pending?.action === "revoke"
                  ? "Revoke"
                  : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
