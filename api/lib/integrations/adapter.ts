export type CredentialField = {
  name: string;
  label: string;
  type: "url" | "text" | "password" | "textarea";
  required: boolean;
  placeholder?: string;
};

export type IntegrationFeature =
  | "daily_sales.ingest"
  | "supplier.push"
  | "journal.push"
  | "webhook.incoming";

export type IntegrationAdapterMetadata = {
  targetSystem: string;
  name: string;
  description: string;
  authMode: "api_key" | "oauth2" | "basic" | "custom";
  credentialFields: CredentialField[];
  scopes: { value: string; label: string; description?: string }[];
  features: IntegrationFeature[];
};

export type IntegrationConnection = {
  id: number;
  businessId: number;
  targetSystem: string;
  isActive: boolean;
  credentials: {
    url: string | null;
    apiKey: string | null;
    authMode: string;
    authData: Record<string, unknown>;
    webhookSecret: string | null;
  };
  scopes: string[];
};

export interface IntegrationAdapter extends IntegrationAdapterMetadata {
  testConnection(connection: IntegrationConnection): Promise<{ ok: boolean; error?: string }>;
}
