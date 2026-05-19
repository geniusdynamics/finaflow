// ABOUTME: Central registry for all mobile wallet providers. Allows dynamic registration, lookup, and validation.
// ABOUTME: Singleton pattern — use the exported `walletRegistry` instance.

import { BaseWalletProvider } from "./provider-interface";
import { getDb } from "../../queries/connection";
import { providerConfigs } from "@db/schema";
import { eq, and, isNull } from "drizzle-orm";

export interface ProviderConfigRecord {
  id: number;
  locationId: number;
  provider: string;
  accountId: number;
  isDefault: boolean;
  config: unknown;
  isActive: boolean;
}

export class WalletProviderRegistry {
  private providers = new Map<string, BaseWalletProvider>();

  register(provider: BaseWalletProvider): void {
    this.providers.set(provider.code, provider);
  }

  get(code: string): BaseWalletProvider {
    const provider = this.providers.get(code);
    if (!provider) {
      throw new Error(`Wallet provider "${code}" is not registered`);
    }
    return provider;
  }

  getAll(): BaseWalletProvider[] {
    return Array.from(this.providers.values());
  }

  getActive(): BaseWalletProvider[] {
    return this.getAll().filter((p) => p.features.smsImport || p.features.initiatePayment);
  }

  getByCurrency(currency: string): BaseWalletProvider[] {
    return this.getAll().filter((p) => p.supportedCurrencies.includes(currency));
  }

  async getProviderConfig(locationId: number, provider: string): Promise<ProviderConfigRecord | null> {
    const rows = await getDb()
      .select()
      .from(providerConfigs)
      .where(
        and(
          eq(providerConfigs.locationId, locationId),
          eq(providerConfigs.provider, provider),
          eq(providerConfigs.isActive, true),
          isNull(providerConfigs.deletedAt)
        )
      )
      .limit(1);

    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id,
      locationId: row.locationId,
      provider: row.provider,
      accountId: row.accountId,
      isDefault: row.isDefault,
      config: row.config,
      isActive: row.isActive,
    };
  }

  async getActiveProvidersForLocation(locationId: number): Promise<ProviderConfigRecord[]> {
    const rows = await getDb()
      .select()
      .from(providerConfigs)
      .where(
        and(
          eq(providerConfigs.locationId, locationId),
          eq(providerConfigs.isActive, true),
          isNull(providerConfigs.deletedAt)
        )
      );

    return rows.map((row) => ({
      id: row.id,
      locationId: row.locationId,
      provider: row.provider,
      accountId: row.accountId,
      isDefault: row.isDefault,
      config: row.config,
      isActive: row.isActive,
    }));
  }

  validateCurrencyConstraint(provider: string, currency: string): boolean {
    try {
      const instance = this.get(provider);
      return instance.supportedCurrencies.includes(currency);
    } catch {
      return false;
    }
  }
}

export const walletRegistry = new WalletProviderRegistry();
