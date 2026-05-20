// ABOUTME: Seeds the mobile_wallet_providers table with default providers on first run.
// ABOUTME: Idempotent — skips already-seeded providers using ON CONFLICT DO NOTHING.

import { mobileWalletProviders } from "@db/schema";
import { getDb } from "../queries/connection";

const DEFAULT_PROVIDERS = [
  {
    code: "mpesa",
    name: "M-PESA",
    displayName: "M-PESA",
    brandColor: "#25B266",
    supportedCurrencies: "KES",
    isActive: true,
    requiresProvisioning: false,
  },
  {
    code: "airtel_money",
    name: "Airtel Money",
    displayName: "Airtel Money",
    brandColor: "#E30613",
    supportedCurrencies: "KES,UGX,TZS,MWK,ZMW,RWF",
    isActive: true,
    requiresProvisioning: false,
  },
  {
    code: "sasapay",
    name: "Sasapay",
    displayName: "Sasapay",
    brandColor: "#00A651",
    supportedCurrencies: "KES",
    isActive: true,
    requiresProvisioning: true,
  },
];

export async function seedWalletProviders(): Promise<void> {
  const db = getDb();
  for (const provider of DEFAULT_PROVIDERS) {
    await db
      .insert(mobileWalletProviders)
      .values(provider as any)
      .onConflictDoNothing({ target: mobileWalletProviders.code });
  }
  console.log(`[seed] Seeded ${DEFAULT_PROVIDERS.length} wallet providers`);
}
