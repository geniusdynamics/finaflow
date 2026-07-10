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
} from "lucide-react";

const TARGET_SYSTEM = "finabill";

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "Never";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString();
}

export function FinabillIntegrationCard({ canManage }: { canManage: boolean }) {
  const utils = trpc.useUtils();
  const webhookUrl = useMemo(() => getFinabillWebhookUrl(), []);

  const { data: adapters } = trpc.integrations.listAdapters.useQuery();
  const { data: status, isLoading: statusLoading } =
    trpc.integrations.status.useQuery({ targetSystem: TARGET_SYSTEM });
  const { data: connection, isLoading: connectionLoading } =
    trpc.integrations.getConnection.useQuery(
      { targetSystem: TARGET_SYSTEM },
      { retry: false }
    );

  const [targetUrl, setTargetUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    if (connection) {
      setTargetUrl(connection.targetUrl ?? "");
      setApiKey("");
      setWebhookSecret("");
    }
  }, [connection]);

  const save = trpc.integrations.saveConnection.useMutation({
    onSuccess: () => {
      toast.success("FinaBill connection saved");
      utils.integrations.status.invalidate({ targetSystem: TARGET_SYSTEM });
      utils.integrations.getConnection.invalidate({ targetSystem: TARGET_SYSTEM });
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
      toast.success(`FinaBill sync ${res.isActive ? "enabled" : "disabled"}`);
      utils.integrations.status.invalidate({ targetSystem: TARGET_SYSTEM });
      utils.integrations.getConnection.invalidate({ targetSystem: TARGET_SYSTEM });
    },
    onError: (err) => toast.error(err.message),
  });

  const adapter = adapters?.find((a) => a.targetSystem === TARGET_SYSTEM);
  const isLoading = statusLoading || connectionLoading;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate({
      targetSystem: TARGET_SYSTEM,
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
          <Plug className="h-5 w-5 text-[#C73E1D]" /> FinaBill
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
          {adapter?.description ?? "Receive daily sales, suppliers, and journal entries from FinaBill."}
        </p>

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
              Paste this URL into FinaBill&apos;s FinaFlow integration settings.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="finabill-target-url">FinaBill base URL</Label>
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
                <KeyRound className="h-3 w-3" /> FinaBill API key
              </span>
            </Label>
            <Input
              id="finabill-api-key"
              type="password"
              placeholder={connection ? "Leave unchanged" : "Paste FinaBill API key"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={!canManage}
            />
            <p className="text-xs text-[#8D8A87]">
              Optional. Create an API key in FinaBill and paste it here to test the outbound connection.
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
              Copy this secret into FinaBill so it can sign inbound webhooks.
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
                onClick={() => test.mutate({ targetSystem: TARGET_SYSTEM })}
              >
                {test.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <RefreshCw className="mr-2 h-4 w-4" /> Test connection
              </Button>
            </div>
          )}
        </form>

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
                  onCheckedChange={() => toggle.mutate({ targetSystem: TARGET_SYSTEM })}
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
