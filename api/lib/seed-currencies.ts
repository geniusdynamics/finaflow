// ABOUTME: Seeds the supported_currencies table with common African and global currencies on first run.
// ABOUTME: Idempotent — skips already-seeded currencies using ON CONFLICT DO NOTHING.

import { supportedCurrencies } from "@db/schema";
import { getDb } from "../queries/connection";

const DEFAULT_CURRENCIES = [
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", decimalPlaces: 2, isDefault: true },
  { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2, isDefault: false },
  { code: "UGX", name: "Ugandan Shilling", symbol: "USh", decimalPlaces: 0, isDefault: false },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh", decimalPlaces: 2, isDefault: false },
  { code: "EUR", name: "Euro", symbol: "EUR", decimalPlaces: 2, isDefault: false },
  { code: "GBP", name: "British Pound", symbol: "GBP", decimalPlaces: 2, isDefault: false },
  { code: "JPY", name: "Japanese Yen", symbol: "JPY", decimalPlaces: 0, isDefault: false },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "KWD", decimalPlaces: 3, isDefault: false },
  { code: "MWK", name: "Malawian Kwacha", symbol: "MK", decimalPlaces: 2, isDefault: false },
  { code: "ZMW", name: "Zambian Kwacha", symbol: "ZK", decimalPlaces: 2, isDefault: false },
  { code: "RWF", name: "Rwandan Franc", symbol: "FRw", decimalPlaces: 0, isDefault: false },
  { code: "BWP", name: "Botswana Pula", symbol: "P", decimalPlaces: 2, isDefault: false },
  { code: "ZAR", name: "South African Rand", symbol: "R", decimalPlaces: 2, isDefault: false },
  { code: "NGN", name: "Nigerian Naira", symbol: "NGN", decimalPlaces: 2, isDefault: false },
  { code: "ETB", name: "Ethiopian Birr", symbol: "Br", decimalPlaces: 2, isDefault: false },
  { code: "MZN", name: "Mozambican Metical", symbol: "MT", decimalPlaces: 2, isDefault: false },
  { code: "AOA", name: "Angolan Kwanza", symbol: "Kz", decimalPlaces: 2, isDefault: false },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "GH", decimalPlaces: 2, isDefault: false },
  { code: "XAF", name: "CFA Franc BEAC", symbol: "FCFA", decimalPlaces: 0, isDefault: false },
  { code: "XOF", name: "CFA Franc BCEAO", symbol: "CFA", decimalPlaces: 0, isDefault: false },
];

export async function seedSupportedCurrencies(): Promise<void> {
  const db = getDb();
  for (const currency of DEFAULT_CURRENCIES) {
    await db
      .insert(supportedCurrencies)
      .values(currency)
      .onConflictDoNothing({ target: supportedCurrencies.code });
  }
  console.log(`[seed] Seeded ${DEFAULT_CURRENCIES.length} supported currencies`);
}
