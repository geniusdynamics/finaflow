// ABOUTME: The post-signup prompt that offers to link this new FinaFlow
// ABOUTME: business to the FinaBill account that referred it. Accepting uses
// ABOUTME: the stored Fina Connect session and completes the pairing without a
// ABOUTME: second browser tab. Only owners and account admins see it.

import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Link2 } from "lucide-react";
import {
  canLinkAccounts,
  clearConnectReferral,
  readConnectReferral,
  type StoredConnectReferral,
} from "@/lib/connect-referral";

export function ConnectReferralPrompt() {
  const { user } = useAuth();
  const [referral, setReferral] = useState<StoredConnectReferral | null>(null);
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const sibling = trpc.connect.siblingUrls.useQuery(undefined, {
    enabled: open,
    retry: false,
  });

  const approve = trpc.connect.approveAsPartner.useMutation({
    onSuccess(result) {
      clearConnectReferral();
      setOpen(false);
      setReferral(null);
      toast.success(
        result?.completed
          ? "FinaBill linked — both accounts are ready"
          : "FinaBill approved — finish the link in FinaBill"
      );
      void utils.invalidate();
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (!user) return;
    const role = user.businessRole ?? user.role;
    if (!canLinkAccounts(role)) {
      // A staff member who lands here cannot link; leave the referral for the
      // owner rather than deleting it.
      return;
    }
    const stored = readConnectReferral();
    if (!stored) return;
    setReferral(stored);
    setOpen(true);
  }, [user]);

  const decline = () => {
    clearConnectReferral();
    setReferral(null);
    setOpen(false);
    toast.message("Not now — you can link later from Integrations");
  };

  const accept = () => {
    if (!referral) return;
    const apiUrl = sibling.data?.partnerApiUrl;
    if (!apiUrl) {
      toast.error("The sibling app is not configured on this deployment");
      return;
    }
    approve.mutate({
      initiatorApiUrl: apiUrl,
      sessionPublicId: referral.connect,
      state: referral.state,
      initiatorSystem: referral.source,
      autoComplete: true,
    });
  };

  if (!referral) return null;

  const sourceLabel =
    referral.source === "finabill" ? "FinaBill" : referral.source;
  const accountLabel =
    referral.sourceName ?? referral.sourceAccount ?? "your account";

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) decline();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" /> Link {sourceLabel}?
          </DialogTitle>
          <DialogDescription>
            {accountLabel} is ready to connect to this FinaFlow business.
            Linking keeps invoices, bills, expenses and daily sales in sync
            between the two systems. You can disconnect at any time in
            Integrations.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={decline}
            disabled={approve.isPending}
          >
            Not now
          </Button>
          <Button
            type="button"
            onClick={accept}
            disabled={approve.isPending || !sibling.data?.partnerApiUrl}
          >
            {approve.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="mr-2 h-4 w-4" />
            )}
            Link accounts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
