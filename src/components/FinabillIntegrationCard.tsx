import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getFinabillWebhookUrl } from "@/lib/webhook-url";
import { generateRandomSecret } from "@/lib/random-secret";
import {
  Plug,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  RefreshCw,
  Copy,
  KeyRound,
  Building2,
  ExternalLink,
  Unplug,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const DEFAULT_TARGET_SYSTEM = "finabill";

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "Never";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString();
}

export function FinabillIntegrationCard({
  canManage,
  targetSystem = DEFAULT_TARGET_SYSTEM,
}: {
  canManage: boolean;
  /** Which peer the card manages ("finabill" default, "glomish" supported). */
  targetSystem?: string;
}) {
  const utils = trpc.useUtils();
  const webhookUrl = useMemo(() => getFinabillWebhookUrl(), []);

  const { data: adapters } = trpc.integrations.listAdapters.useQuery();
  const { data: status, isLoading: statusLoading } =
    trpc.integrations.status.useQuery({ targetSystem });
  const { data: connection, isLoading: connectionLoading } =
    trpc.integrations.getConnection.useQuery(
      { targetSystem },
      { retry: false }
    );

  const [targetUrl, setTargetUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null);
  const { data: businessStates } = trpc.connect.listBusinessConnectionStates.useQuery(
    { targetSystem },
    { enabled: canManage }
  );
  const currentState = businessStates?.states.find(
    (s) => s.businessId === businessStates?.currentBusinessId
  );

  const createSession = trpc.connect.createSession.useMutation({
    onSuccess: (res) => {
      sessionStorage.setItem(`fina_connect_verifier_${res.sessionPublicId}`, res.codeVerifier);
      setPairingCode(res.pairingCode);
      setAuthorizeUrl(res.authorizeUrl);
      toast.success("Pairing ready. Copy the code or continue to the partner app.");
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (connection) {
      setTargetUrl(connection.targetUrl ?? "");
      setApiKey("");
      setWebhookSecret("");
    }
  }, [connection]);

  const save = trpc.integrations.saveConnection.useMutation({
    onSuccess: () => {
      toast.success(`${displayName} connection saved`);
      utils.integrations.status.invalidate({ targetSystem });
      utils.integrations.getConnection.invalidate({ targetSystem });
      setApiKey("");
      setWebhookSecret("");
    },
    onError: (err) => toast.error(err.message),
  });

  const test = trpc.integrations.testConnection.useMutation({
    onSuccess: (res) => toast.success(res.message),
    onError: (err) => toast.error(err.message),
  });

  const toggle = trpc.integrations.toggleConnection.useMutation({
    onSuccess: (res) => {
      toast.success(`${displayName} sync ${res.isActive ? "enabled" : "disabled"}`);
      utils.integrations.status.invalidate({ targetSystem });
      utils.integrations.getConnection.invalidate({ targetSystem });
    },
    onError: (err) => toast.error(err.message),
  });

  const disconnect = trpc.integrations.disconnect.useMutation({
    onSuccess: (res) => {
      toast.success(res.message);
      utils.integrations.getConnection.reset({ targetSystem });
      utils.integrations.status.invalidate({ targetSystem });
      utils.connect.listBusinessConnectionStates.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const switchBusiness = trpc.localAuth.switchBusiness.useMutation({
    onSuccess: () => {
      toast.success("Switched business");
      window.location.reload();
    },
    onError: (err) => toast.error(err.message),
  });

  const adapter = adapters?.find((a) => a.targetSystem === targetSystem);
  const displayName = adapter?.name ?? (targetSystem === "finabill" ? "FinaBill" : "Glomish");
  const isLoading = statusLoading || connectionLoading;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate({
      targetSystem,
      targetUrl: targetUrl.trim() || undefined,
      apiKey: apiKey.trim() || undefined,
      webhookSecret: webhookSecret.trim() || undefined,
    });
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("Webhook URL copied");
  };

  const regenerateSecret = () => {
    setWebhookSecret(generateRandomSecret(32));
    toast.info("Secret generated — save to apply");
  };

  return (
    <Card className="border-[#E8E0D8]">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="font-serif text-lg flex items-center gap-2">
          <Plug className="h-5 w-5 text-[#C73E1D]" /> {displayName}
        </CardTitle>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : status?.connected ? (
          <Badge className="gap-1 bg-[#2E7D32]/10 text-[#2E7D32] hover:bg-[#2E7D32]/10">
            <CheckCircle2 className="h-3 w-3" /> Connected
          </Badge>
        ) : status?.configured ? (
          <Badge variant="outline" className="gap-1">
            <XCircle className="h-3 w-3" /> Inactive
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <XCircle className="h-3 w-3" /> Not configured
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-[#8D8A87]">
          {adapter?.description ?? `Connect with ${displayName} (daily sales, suppliers, journal).`}
        </p>

          {canManage && (
            <div className="rounded-lg border border-[#E8E0D8] bg-[#F5EDE6]/40 p-4 space-y-3">
              <div>
                <p className="font-medium text-sm flex items-center gap-2">
                  <Plug className="h-4 w-4 text-[#C73E1D]" /> Fina Connect
                </p>
                <p className="text-xs text-[#8D8A87]">
                  Connect {displayName} without pasting API keys. Approve in the other app, then both apps store credentials automatically.
                </p>
              </div>

              {connection?.isActive ? (
                <div className="space-y-3">
                  <div className="rounded-md border border-green-200 bg-green-50/80 p-3 text-sm text-green-900">
                    <span className="flex items-center gap-1 font-medium">
                      <CheckCircle2 className="h-4 w-4" /> This business is connected to {displayName}
                      {currentState?.targetBusinessName
                        ? ` (${currentState.targetBusinessName})`
                        : currentState?.targetBusinessId
                        ? ` (${currentState.targetBusinessId})`
                        : ""}
                    </span>
                    <p className="mt-1 text-green-700">
                      Disconnect to connect a different {displayName} business or revoke access.
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={disconnect.isPending}
                      >
                        {disconnect.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                        <Unplug className="mr-2 h-3 w-3" /> Disconnect
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect {displayName}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will revoke all API keys and remove the connection on both sides.
                          You can re-connect at any time via Fina Connect.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => disconnect.mutate({ targetSystem })}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Disconnect
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="bg-[#C73E1D]"
                      disabled={createSession.isPending}
                      onClick={() => createSession.mutate({ mode: "pairing", targetSystem })}
                    >
                      {createSession.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Plug className="mr-2 h-4 w-4" /> Connect {displayName}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        window.location.href = "/integrations/connect";
                      }}
                    >
                      Enter pairing code
                    </Button>
                  </div>

                  {pairingCode && authorizeUrl && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
                      <p className="text-sm font-medium text-amber-900">Pairing code</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 rounded bg-white px-3 py-2 text-lg font-mono tracking-wider text-amber-900">
                          {pairingCode}
                        </code>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(pairingCode);
                            toast.success("Pairing code copied");
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-amber-700">
                        Copy this code or continue to {displayName} to approve the connection.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-[#C73E1D]"
                        onClick={() => {
                          if (authorizeUrl) window.location.href = authorizeUrl;
                        }}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" /> Continue to {displayName}
                      </Button>
                    </div>
                  )}
                </>
              )}

              {businessStates && businessStates.states.length > 1 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[#2D2A26] flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Connection status across businesses
                  </p>
                  <div className="grid gap-2">
                    {businessStates.states
                      .filter((s) => s.businessId !== businessStates.currentBusinessId)
                      .map((s) => (
                        <div
                          key={s.businessId}
                          className="flex items-center justify-between rounded-md border border-[#E8E0D8] px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-[#2D2A26]">{s.businessName}</span>
                          <div className="flex items-center gap-2">
                            {s.isConnected ? (
                              <Badge className="gap-1 bg-[#2E7D32]/10 text-[#2E7D32]">
                                <CheckCircle2 className="h-3 w-3" /> Connected
                                {s.targetBusinessName ? ` to ${displayName} — ${s.targetBusinessName}` : ` to ${displayName}`}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1">
                                <XCircle className="h-3 w-3" /> Not connected
                              </Badge>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={switchBusiness.isPending}
                              onClick={() => switchBusiness.mutate({ businessId: s.businessId })}
                            >
                              {switchBusiness.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                              Switch
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdvanced((v) => !v)}>
                {showAdvanced ? "Hide" : "Show"} advanced / manual setup
              </Button>
            </div>
          )}

        {showAdvanced && (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="bg-[#F5EDE6]" />
              <Button type="button" variant="outline" size="icon" onClick={copyWebhookUrl}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-[#8D8A87]">
              Paste this URL into {displayName}&apos;s integration settings.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="finabill-target-url">{displayName} base URL</Label>
            <Input
              id="finabill-target-url"
              type="url"
              placeholder="https://api.finabill.example"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              disabled={!canManage}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="finabill-api-key">
              <span className="flex items-center gap-1">
                <KeyRound className="h-3 w-3" /> {displayName} API key
              </span>
            </Label>
            <Input
              id="finabill-api-key"
              type="password"
              placeholder={connection ? "Leave unchanged" : `Paste ${displayName} API key`}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={!canManage}
            />
            <p className="text-xs text-[#8D8A87]">
              Optional. Create an API key in {displayName} and paste it here to test the outbound connection.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="finabill-webhook-secret">Shared webhook secret</Label>
            <div className="flex gap-2">
              <Input
                id="finabill-webhook-secret"
                type={showSecret ? "text" : "password"}
                placeholder={connection ? "Leave unchanged" : "Generate a secret"}
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                disabled={!canManage}
              />
              {canManage && (
                <Button type="button" variant="outline" onClick={regenerateSecret}>
                  Generate
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="finabill-show-secret"
                checked={showSecret}
                onCheckedChange={setShowSecret}
              />
              <Label htmlFor="finabill-show-secret" className="text-xs font-normal">
                Show secret
              </Label>
            </div>
            <p className="text-xs text-[#8D8A87]">
              Copy this secret into {displayName} so it can sign inbound webhooks.
            </p>
          </div>

          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={save.isPending} className="bg-[#C73E1D]">
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" /> Save connection
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={test.isPending || !connection}
                onClick={() => test.mutate({ targetSystem })}
              >
                {test.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <RefreshCw className="mr-2 h-4 w-4" /> Test connection
              </Button>
            </div>
          )}
        </form>
        )}

        {connection?.isActive && canManage && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={test.isPending}
              onClick={() => test.mutate({ targetSystem })}
            >
              {test.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              <RefreshCw className="mr-2 h-3 w-3" /> Test connection
            </Button>
          </div>
        )}

        {connection && (
          <div className="flex items-center justify-between rounded-lg border border-[#E8E0D8] px-4 py-3">
            <div>
              <Label className="text-sm font-medium">Connection status</Label>
              <p className="text-xs text-[#8D8A87]">
                Last updated: {formatDate(connection.updatedAt)}
              </p>
            </div>
            {canManage && (
              <div className="flex items-center gap-2">
                <Switch
                  id="finabill-toggle"
                  checked={connection.isActive}
                  disabled={toggle.isPending}
                  onCheckedChange={() => toggle.mutate({ targetSystem })}
                />
                <Label htmlFor="finabill-toggle" className="text-sm">
                  {connection.isActive ? "Sync enabled" : "Sync disabled"}
                </Label>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
