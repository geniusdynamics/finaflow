import type { IntegrationAdapter } from "./adapter.js";

const adapters = new Map<string, IntegrationAdapter>();

export function registerAdapter(adapter: IntegrationAdapter): void {
  if (adapters.has(adapter.targetSystem)) {
    throw new Error(`Adapter already registered for target system: ${adapter.targetSystem}`);
  }
  adapters.set(adapter.targetSystem, adapter);
}

export function getAdapter(targetSystem: string): IntegrationAdapter | undefined {
  return adapters.get(targetSystem);
}

export function listAdapters(): IntegrationAdapter[] {
  return Array.from(adapters.values());
}

export function clearAdapters(): void {
  adapters.clear();
}
