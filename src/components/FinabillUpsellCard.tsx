// ABOUTME: Owner-only upsell from FinaFlow's daily sales page to a FinaBill
// ABOUTME: account. The CTA starts a 60-minute Fina Connect signup session, so
// ABOUTME: the new FinaBill business can link back automatically.

import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Sparkles, ArrowRight, X } from "lucide-react";
import { canLinkAccounts } from "@/lib/connect-referral";

export function FinabillUpsellCard() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const start = trpc.connect.signupLink.useMutation({
    onSuccess({ url }) {
      window.location.href = url;
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  const role = user?.businessRole ?? user?.role;
  if (dismissed || !canLinkAccounts(role)) return null;

  return (
    <Card className="border-[#D4A854]/50 bg-[#D4A854]/10">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#C73E1D] text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="font-medium text-[#2D2A26]">
              Turn these sales into invoices
            </p>
            <p className="text-sm text-[#8D8A87]">
              FinaBill handles invoicing, payments, credit notes and customer
              statements for the same business. Create a FinaBill account and
              link the two in one step.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Dismiss FinaBill suggestion"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            className="bg-[#C73E1D] hover:bg-[#C73E1D]/90"
            onClick={() => start.mutate({ targetSystem: "finabill" })}
            disabled={start.isPending}
          >
            {start.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            Get FinaBill
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
