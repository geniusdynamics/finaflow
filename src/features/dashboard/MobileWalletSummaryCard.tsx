// ABOUTME: Mobile Wallet Summary card for the main dashboard.
// ABOUTME: Mirrors the existing M-PESA Summary block but reads from summary.wallet.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatKES } from "@/lib/utils";
import { Smartphone } from "lucide-react";

type WalletSummary = {
  totalIn: string;
  totalOut: string;
  totalFees: string;
};

type MobileWalletSummaryCardProps = {
  wallet: WalletSummary | undefined;
};

function hasActivity(wallet: WalletSummary | undefined): boolean {
  if (!wallet) return false;
  const totalIn = parseFloat(wallet.totalIn) || 0;
  const totalOut = parseFloat(wallet.totalOut) || 0;
  const totalFees = parseFloat(wallet.totalFees) || 0;
  return totalIn > 0 || totalOut > 0 || totalFees > 0;
}

export function MobileWalletSummaryCard({ wallet }: MobileWalletSummaryCardProps) {
  if (!hasActivity(wallet)) {
    return (
      <Card
        data-testid="mobile-wallet-summary-card"
        className="border-[#E8E0D8] border-dashed bg-[#F5EDE6]/40"
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#8D8A87]">
            <Smartphone className="h-5 w-5" />
            Mobile Wallet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[#8D8A87]">
            No mobile wallet activity in the selected period. Import an Airtel or M-Pesa statement to see activity here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      data-testid="mobile-wallet-summary-card"
      className="border-[#E8E0D8] bg-white"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#2D2A26]">
          <Smartphone className="h-5 w-5 text-[#C73E1D]" />
          Mobile Wallet Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-gradient-to-br from-[#2E7D32]/5 to-[#2E7D32]/10 p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#8D8A87] sm:text-xs">Inflows</p>
            <p className="mt-1 font-mono text-base font-semibold text-[#2E7D32] sm:text-lg">
              {formatKES(wallet?.totalIn ?? "0")}
            </p>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-[#D32F2F]/5 to-[#D32F2F]/10 p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#8D8A87] sm:text-xs">Outflows</p>
            <p className="mt-1 font-mono text-base font-semibold text-[#D32F2F] sm:text-lg">
              {formatKES(wallet?.totalOut ?? "0")}
            </p>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-[#D4A854]/5 to-[#D4A854]/10 p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#8D8A87] sm:text-xs">Transaction Fees</p>
            <p className="mt-1 font-mono text-base font-semibold text-[#D4A854] sm:text-lg">
              {formatKES(wallet?.totalFees ?? "0")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
