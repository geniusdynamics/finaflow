// ABOUTME: Manual currency conversion dialog that shows live rates and converts amounts between currencies.
import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

interface CurrencyConverterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConvert: (convertedAmount: string, rate: string, fee?: string) => void;
  fromCurrency?: string;
  toCurrency?: string;
  initialAmount?: string;
}

const CURRENCY_OPTIONS = [
  { code: "KES", label: "KES - Kenyan Shilling" },
  { code: "USD", label: "USD - US Dollar" },
  { code: "UGX", label: "UGX - Ugandan Shilling" },
  { code: "TZS", label: "TZS - Tanzanian Shilling" },
  { code: "EUR", label: "EUR - Euro" },
  { code: "GBP", label: "GBP - British Pound" },
  { code: "MWK", label: "MWK - Malawian Kwacha" },
  { code: "ZMW", label: "ZMW - Zambian Kwacha" },
  { code: "RWF", label: "RWF - Rwandan Franc" },
  { code: "BWP", label: "BWP - Botswana Pula" },
  { code: "ZAR", label: "ZAR - South African Rand" },
  { code: "NGN", label: "NGN - Nigerian Naira" },
];

export function CurrencyConverterDialog({
  open,
  onOpenChange,
  onConvert,
  fromCurrency = "USD",
  toCurrency = "KES",
  initialAmount = "",
}: CurrencyConverterDialogProps) {
  const [amount, setAmount] = useState(initialAmount);
  const [from, setFrom] = useState(fromCurrency);
  const [to, setTo] = useState(toCurrency);

  const { data: rates, isLoading } = trpc.walletManagement.rates.latest.useQuery({});
  const convertMutation = trpc.walletManagement.rates.sync.useMutation({
    onSuccess: () => {},
  });

  const currentRate = rates?.find(
    (r: { fromCurrency: string; toCurrency: string }) => r.fromCurrency === from && r.toCurrency === to
  );

  const rate = currentRate?.rate ?? "0";
  const rateNum = parseFloat(rate) || 0;
  const amountNum = parseFloat(amount) || 0;
  const convertedAmount = (amountNum * rateNum).toFixed(2);

  const handleSwap = () => {
    setFrom(to);
    setTo(from);
  };

  const handleConvert = () => {
    onConvert(convertedAmount, rate);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Currency Converter</DialogTitle>
          <DialogDescription>
            Convert amounts between currencies using current exchange rates
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="font-mono"
            />
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-[#8D8A87]">From</Label>
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-lg border border-[#E8E0D8] bg-white px-3 py-2 text-sm"
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleSwap}
              className="mt-5 flex h-8 w-8 items-center justify-center rounded-full border border-[#E8E0D8] bg-[#F5EDE6] text-[#2D2A26] transition-colors hover:bg-[#E8E0D8]"
            >
              <ArrowRight className="h-4 w-4" />
            </button>

            <div className="space-y-1">
              <Label className="text-xs text-[#8D8A87]">To</Label>
              <select
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-lg border border-[#E8E0D8] bg-white px-3 py-2 text-sm"
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {from === to ? (
            <div className="flex items-center gap-2 rounded-lg bg-[#F5EDE6] p-3">
              <CheckCircle2 className="h-4 w-4 text-[#2E7D32]" />
              <p className="text-sm text-[#2D2A26]">Same currency — no conversion needed</p>
            </div>
          ) : (
            <div className="space-y-2">
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-[#8D8A87]">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading rates...
                </div>
              ) : currentRate ? (
                <>
                  <div className="flex items-center justify-between rounded-lg bg-[#F5EDE6] p-3">
                    <div>
                      <p className="text-xs text-[#8D8A87]">Exchange Rate</p>
                      <p className="font-mono text-sm font-semibold text-[#2D2A26]">
                        1 {from} = {rate} {to}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => convertMutation.mutate()}
                      disabled={convertMutation.isPending}
                      className="flex items-center gap-1 text-xs text-[#C73E1D] hover:underline"
                    >
                      <RefreshCw className={`h-3 w-3 ${convertMutation.isPending ? "animate-spin" : ""}`} />
                      Refresh
                    </button>
                  </div>
                  {amountNum > 0 && (
                    <div className="rounded-lg border border-[#E8E0D8] p-4 text-center">
                      <p className="text-xs text-[#8D8A87]">Converted Amount</p>
                      <p className="mt-1 font-mono text-2xl font-bold text-[#C73E1D]">
                        {formatCurrency(convertedAmount, to, { showCode: true })}
                      </p>
                      <p className="mt-1 text-xs text-[#8D8A87]">
                        {amount} {from} @ {rate} = {convertedAmount} {to}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-[#D4A854] bg-[#D4A854]/10 p-3 text-sm text-[#D4A854]">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  No exchange rate available for {from} → {to}. Contact admin to set a rate.
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConvert}
            disabled={!currentRate || from === to || amountNum <= 0}
            className="bg-[#C73E1D] text-white"
          >
            Apply Conversion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
