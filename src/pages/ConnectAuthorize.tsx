// ABOUTME: Authorize / complete first-party Fina Connect pairing from either initiator or partner side.
// ABOUTME: Handles redirect callback exchange and partner approve UI for FinaBill.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Plug, XCircle } from "lucide-react";

export default function ConnectAuthorize() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage =
    hasPermission(user?.role ?? "viewer", "integrations:manage") ||
    hasPermission(user?.role ?? "viewer", "settings:manage");

  const session = searchParams.get("session") ?? "";
  const state = searchParams.get("state") ?? "";
  const initiatorApi = searchParams.get("initiator_api") ?? "";
  const initiatorSystem = searchParams.get("initiator_system") ?? "finabill";
  const code = searchParams.get("code") ?? "";
  const isCallback = Boolean(code && session);

  const [done, setDone] = useState(false);
  const [pairingCode, setPairingCode] = useState("");

  const utils = trpc.useUtils();

  const exchange = trpc.connect.exchange.useMutation({
    onSuccess: () => {
      toast.success("Connected to FinaBill");
      setDone(true);
      utils.integrations.status.invalidate({ targetSystem: "finabill" });
    },
    onError: (err) => toast.error(err.message),
  });

  const approve = trpc.connect.approveAsPartner.useMutation({
    onSuccess: (res) => {
      toast.success("Approved — completing connection…");
      if (res.redirectUri) {
        const url = new URL(res.redirectUri);
        url.searchParams.set("code", res.authorizationCode);
        url.searchParams.set("state", res.state);
        url.searchParams.set("session", res.sessionPublicId);
        window.location.href = url.toString();
        return;
      }
      setDone(true);
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: siblingUrls } = trpc.connect.siblingUrls.useQuery();
  const [resolveBusy, setResolveBusy] = useState(false);

  // Auto-exchange on callback exactly once (avoid retry storms on failure).
  useEffect(() => {
    if (!isCallback || !canManage || done) return;
    if (exchange.isPending || exchange.isSuccess || exchange.isError) return;
    const codeVerifier = sessionStorage.getItem(`fina_connect_verifier_${session}`) ?? undefined;
    exchange.mutate({
      sessionPublicId: session,
      authorizationCode: code,
      codeVerifier,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCallback, canManage, session, code, done]);

  const title = useMemo(() => {
    if (isCallback) return "Completing connection";
    if (session && initiatorApi) return `Connect ${initiatorSystem === "finabill" ? "FinaBill" : initiatorSystem}`;
    return "Enter pairing code";
  }, [isCallback, session, initiatorApi, initiatorSystem]);

  if (!canManage) {
    return (
      <Layout>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            You need Integrations manage permission to connect apps.
          </CardContent>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="font-serif text-3xl font-bold flex items-center gap-2">
            <Plug className="h-7 w-7 text-[#C73E1D]" /> {title}
          </h1>
          <p className="text-[#8D8A87]">
            First-party Fina Connect securely links FinaFlow and FinaBill without copying API keys.
          </p>
        </div>

        <Card className="border-[#E8E0D8]">
          <CardHeader>
            <CardTitle>Authorization</CardTitle>
            <CardDescription>
              {isCallback
                ? "Finishing the handshake and storing mutual credentials…"
                : session
                  ? "Approve access for the partner app to your current business."
                  : "Paste a pairing code generated from the other app."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(exchange.isPending || approve.isPending) && (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Working…
              </div>
            )}

            {(done || exchange.isSuccess) && (
              <div className="space-y-3">
                <Badge className="gap-1 bg-[#2E7D32]/10 text-[#2E7D32]">
                  <CheckCircle2 className="h-3 w-3" /> Connected
                </Badge>
                <Button className="bg-[#C73E1D]" onClick={() => navigate("/settings?tab=integrations")}>
                  Back to Integrations
                </Button>
              </div>
            )}

            {exchange.isError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4" /> {exchange.error.message}
              </div>
            )}

            {!isCallback && session && initiatorApi && !done && (
              <div className="space-y-3">
                <p className="text-sm">
                  Business: <strong>{user?.currentBusiness?.name ?? user?.currentBusinessId}</strong>
                </p>
                <p className="text-sm text-[#8D8A87]">
                  Scopes: read, write, sales, journals, CoA, suppliers, webhooks
                </p>
                <div className="flex gap-2">
                  <Button
                    className="bg-[#C73E1D]"
                    disabled={approve.isPending}
                    onClick={() =>
                      approve.mutate({
                        initiatorApiUrl: initiatorApi,
                        sessionPublicId: session,
                        state,
                      })
                    }
                  >
                    {approve.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Approve & Connect
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/settings?tab=integrations")}>
                    Deny
                  </Button>
                </div>
              </div>
            )}

            {!isCallback && !session && !done && (
              <div className="space-y-3">
                <input
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="FINA-XXXX-XXXX"
                  value={pairingCode}
                  onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
                />
                <Button
                  className="bg-[#C73E1D]"
                  disabled={pairingCode.length < 8 || resolveBusy}
                  onClick={async () => {
                    const partnerApi = siblingUrls?.partnerApiUrl;
                    if (!partnerApi) {
                      toast.error("Partner API URL not configured");
                      return;
                    }
                    setResolveBusy(true);
                    try {
                      let data: {
                        sessionPublicId: string;
                        state: string;
                        initiatorApiUrl?: string | null;
                        initiatorSystem: string;
                      } | null = null;
                      try {
                        data = await utils.connect.resolvePairingCode.fetch({
                          pairingCode: pairingCode.trim().toUpperCase(),
                        });
                      } catch {
                        data = null;
                      }
                      if (!data) {
                        const res = await fetch(`${partnerApi.replace(/\/$/, "")}/api/connect/resolve-pairing`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ pairingCode: pairingCode.trim().toUpperCase() }),
                        });
                        if (res.ok) data = await res.json();
                      }
                      if (!data?.sessionPublicId) {
                        toast.error("Invalid or expired code");
                        return;
                      }
                      if (!data.initiatorApiUrl) {
                        toast.error("Initiator API URL missing from session");
                        return;
                      }
                      navigate(
                        `/integrations/connect?session=${encodeURIComponent(data.sessionPublicId)}` +
                          `&state=${encodeURIComponent(data.state)}` +
                          `&initiator_api=${encodeURIComponent(data.initiatorApiUrl)}` +
                          `&initiator_system=${encodeURIComponent(data.initiatorSystem)}`
                      );
                    } finally {
                      setResolveBusy(false);
                    }
                  }}
                >
                  Continue
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
