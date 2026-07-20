// ABOUTME: Centralized registry of API key scopes for the external API.
// ABOUTME: Single source of truth — used by connect-service, middleware, and docs.

/**
 * Every scope available to external API keys.
 * The key is the scope string stored in the DB; the value is a human-readable description.
 * Naming convention: `resource:action` (aligned with RBAC permissions in middleware.ts).
 */
export const API_SCOPES = {
  "accounts:read": "Read accounts, chart of accounts",
  "suppliers:read": "Read suppliers",
  "suppliers:write": "Create and update suppliers",
  "categories:read": "Read expense categories",
  "business:read": "Read business profile",
  "locations:read": "Read locations/branches",
  "users:read": "Read users and role templates",
  "users:write": "Create and update users",
  "sales:write": "Ingest daily sales batches",
  "journal:write": "Create and post journal entries",
  "webhooks": "Manage webhook subscriptions",
} as const;

export type ApiScope = keyof typeof API_SCOPES;

/** Scopes granted by default during Fina Connect pairing. */
export const DEFAULT_CONNECT_SCOPES: ApiScope[] = [
  "accounts:read",
  "suppliers:read",
  "suppliers:write",
  "categories:read",
  "business:read",
  "locations:read",
  "users:read",
  "users:write",
  "sales:write",
  "journal:write",
  "webhooks",
];

/** Returns true if `scope` is a recognized API scope. */
export function isValidScope(scope: string): scope is ApiScope {
  return scope in API_SCOPES;
}

/**
 * Legacy scope aliases — maps old coarse scopes to the new granular ones.
 * Used during migration to avoid breaking existing API keys.
 */
export const SCOPE_ALIASES: Record<string, ApiScope[]> = {
  read: ["accounts:read", "suppliers:read", "categories:read", "business:read", "locations:read", "users:read"],
  write: ["suppliers:write"],
};

/** Resolves a scope (including legacy aliases) to the set of granular scopes it grants. */
export function resolveScopes(scopes: string[]): Set<string> {
  const resolved = new Set<string>();
  for (const scope of scopes) {
    if (scope in SCOPE_ALIASES) {
      for (const alias of SCOPE_ALIASES[scope]) resolved.add(alias);
    } else {
      resolved.add(scope);
    }
  }
  return resolved;
}

/** Checks whether the given scopes grant access to the required scope (including legacy aliases). */
export function hasScope(granted: string[], required: ApiScope): boolean {
  const resolved = resolveScopes(granted);
  return resolved.has(required) || granted.includes("admin");
}
