// ABOUTME: Multi-provider wallet payment selector component for choosing between configured wallet providers.
// ABOUTME: Shows all active providers with brand colors, disables unsupported currencies, indicates defaults.
import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";
import { Smartphone, Wallet, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface WalletProviderCard {
  code: string;
  name: string;
  displayName?: string;
  brandColor?: string;
  logoUrl?: string;
  supportedCurrencies?: string;
  isActive?: boolean;
  isDefault?: boolean;
}

interface WalletPaymentSelectorProps {
  value: string;
  onChange: (code: string) => void;
  currency?: string;
  amount?: string;
  locationId?: number;
  showFees?: boolean;
  className?: string;
  disabled?: boolean;
}

const DEFAULT_BRAND_COLORS: Record<string, string> = {
  mpesa: "#25B266",
  airtel_money: "#E30613",
  sasapay: "#00A651",
};

const PROVIDER_ICONS: Record<string, React.ReactNode> = {
  mpesa: <Smartphone className="h-5 w-5" />,
  airtel_money: <Smartphone className="h-5 w-5" />,
  sasapay: <Wallet className="h-5 w-5" />,
};

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  mpesa: "M-PESA",
  airtel_money: "Airtel Money",
  sasapay: "Sasapay",
};

function ProviderCard({
  provider,
  isSelected,
  isDisabled,
  currency,
  onSelect,
}: {
  provider: WalletProviderCard;
  isSelected: boolean;
  isDisabled: boolean;
  currency?: string;
  onSelect: () => void;
}) {
  const brandColor = provider.brandColor ?? DEFAULT_BRAND_COLORS[provider.code] ?? "#6B7280";
  const displayName = provider.displayName ?? PROVIDER_DISPLAY_NAMES[provider.code] ?? provider.name;
  const supportedCurrencies = provider.supportedCurrencies ?? "KES";
  const supportsCurrency = !currency || supportedCurrencies.includes(currency);

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isDisabled}
      className={cn(
        "relative flex flex-col items-start rounded-lg border-2 p-3 text-left transition-all",
        isSelected
          ? "border-[#C73E1D] bg-[#C73E1D]/5"
          : "border-[#E8E0D8] bg-white hover:border-[#C73E1D]/50 hover:bg-[#F5EDE6]/50",
        isDisabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {provider.isDefault && (
        <span className="absolute right-2 top-2 rounded bg-[#D4A854]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#D4A854]">
          DEFAULT
        </span>
      )}
      <div className="mb-2 flex items-center gap-2">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: brandColor }}
        >
          {PROVIDER_ICONS[provider.code] ?? <Wallet className="h-5 w-5" />}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#2D2A26]">{displayName}</p>
          <p className="text-xs text-[#8D8A87]">{supportedCurrencies}</p>
        </div>
      </div>
      {currency && !supportsCurrency && (
        <div className="mt-1 flex items-center gap-1 text-xs text-[#D32F2F]">
          <XCircle className="h-3 w-3" />
          <span>Does not support {currency}</span>
        </div>
      )}
      {isSelected && (
        <div className="mt-2 flex items-center gap-1 text-xs text-[#2E7D32]">
          <CheckCircle2 className="h-3 w-3" />
          <span>Selected</span>
        </div>
      )}
    </button>
  );
}

export function WalletPaymentSelector({
  value,
  onChange,
  currency = "KES",
  locationId,
  showFees = true,
  className,
  disabled,
}: WalletPaymentSelectorProps) {
  const { data: providers } = trpc.wallet.providers.list.useQuery();
  const { data: locationProviders } = trpc.wallet.providers.listForLocation.useQuery(
    locationId ? { locationId } : undefined,
    { enabled: !!locationId }
  );

  const available = locationProviders ?? providers ?? [];
  const activeProviders = available.filter((p: any) => p.isActive !== false);
  const hasMultiple = activeProviders.length > 1;
  const unsupportedCount = activeProviders.filter((p: any) => {
    const supported = p.supportedCurrencies ?? "KES";
    return currency && !supported.includes(currency);
  }).length;

  if (activeProviders.length === 0) {
    return (
      <Alert variant="default" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          No wallet providers configured. Go to Wallet settings to add a provider.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={className}>
      {unsupportedCount > 0 && (
        <Alert variant="default" className="mb-3 border-[#D4A854] bg-[#D4A854]/10">
          <AlertDescription className="text-xs text-[#8D8A87]">
            {unsupportedCount} provider{unsupportedCount > 1 ? "s" : ""} do{unsupportedCount === 1 ? "s" : ""} not support {currency}.
          </AlertDescription>
        </Alert>
      )}
      <div className={cn("grid gap-2", hasMultiple ? "grid-cols-2 md:grid-cols-3" : "grid-cols-1")}>
        {activeProviders.map((provider: any) => {
          const supported = provider.supportedCurrencies ?? "KES";
          const supportsCurrency = !currency || supported.includes(currency);
          const isDisabled = disabled || !supportsCurrency;
          return (
            <ProviderCard
              key={provider.code}
              provider={provider}
              isSelected={value === provider.code}
              isDisabled={isDisabled}
              currency={currency}
              onSelect={() => !isDisabled && onChange(provider.code)}
            />
          );
        })}
      </div>
      {showFees && value && (
        <p className="mt-2 text-xs text-[#8D8A87]">
          Processing fees vary by provider. Check provider settings for current rates.
        </p>
      )}
    </div>
  );
}
