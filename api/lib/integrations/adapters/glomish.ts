// ABOUTME: Glomish adapter — a salon/beauty-store platform that pushes daily
// sales into finaflow (aggregated by payment channel per day) when autosync is
// enabled, so the business can log expenses here while Glomish handles bookings.
import type { IntegrationAdapter, IntegrationConnection } from "../adapter.js";

export const GLOMISH_TARGET_SYSTEM = "glomish";

export const glomishAdapter: IntegrationAdapter = {
  targetSystem: GLOMISH_TARGET_SYSTEM,
  name: "Glomish",
  description:
    "Receive daily sales from Glomish (salon & beauty-store platform) with automatic sync.",
  authMode: "api_key",
  credentialFields: [
    {
      name: "targetUrl",
      label: "Glomish base URL",
      type: "url",
      required: false,
      placeholder: "https://api.glomish.example",
    },
    {
      name: "apiKey",
      label: "Glomish API key",
      type: "password",
      required: false,
      placeholder: "Optional: for testing Glomish outbound",
    },
  ],
  scopes: [
    { value: "read", label: "Read", description: "Pull reference data from Glomish" },
    { value: "write", label: "Write", description: "Post back to Glomish" },
    { value: "sales", label: "Sales", description: "Ingest daily sales from Glomish" },
    { value: "webhooks", label: "Webhooks", description: "Receive Glomish webhook events" },
  ],
  features: ["daily_sales.ingest", "fina_connect"],

  async testConnection(connection: IntegrationConnection) {
    const url = connection.credentials.url;
    const apiKey = connection.credentials.apiKey;
    if (!url) {
      return { ok: false, error: "Glomish base URL is required" };
    }

    try {
      // Glomish exposes machine verification at /api/v1/verify.
      const base = url.replace(/\/$/, "");
      const res = await fetch(`${base}/api/v1/verify`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });
      if (!res.ok) {
        return { ok: false, error: `Glomish returned ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { ok: false, error: message };
    }
  },
};