import type { IntegrationAdapter, IntegrationConnection } from "../adapter.js";

export const FINABILL_TARGET_SYSTEM = "finabill";

export const finabillAdapter: IntegrationAdapter = {
  targetSystem: FINABILL_TARGET_SYSTEM,
  name: "FinaBill",
  description: "Receive daily sales, suppliers, and journal entries from FinaBill.",
  authMode: "api_key",
  credentialFields: [
    {
      name: "targetUrl",
      label: "FinaBill base URL",
      type: "url",
      required: false,
      placeholder: "https://api.finabill.example",
    },
    {
      name: "apiKey",
      label: "FinaBill API key",
      type: "password",
      required: false,
      placeholder: "Optional: for testing FinaBill outbound",
    },
  ],
  scopes: [
    { value: "read", label: "Read", description: "Pull reference data from FinaBill" },
    { value: "write", label: "Write", description: "Post back to FinaBill" },
    { value: "sales", label: "Sales", description: "Ingest daily sales from FinaBill" },
    { value: "webhooks", label: "Webhooks", description: "Receive FinaBill webhook events" },
  ],
  features: [
    "daily_sales.ingest",
    "supplier.push",
    "journal.push",
    "webhook.incoming",
  ],

  async testConnection(connection: IntegrationConnection) {
    const url = connection.credentials.url;
    const apiKey = connection.credentials.apiKey;
    if (!url) {
      return { ok: false, error: "FinaBill base URL is required" };
    }

    try {
      // FinaBill exposes health at /health (not /api/health).
      const base = url.replace(/\/$/, "");
      const res = await fetch(`${base}/health`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });
      if (!res.ok) {
        return { ok: false, error: `FinaBill returned ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { ok: false, error: message };
    }
  },
};
