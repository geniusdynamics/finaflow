# Authentication

FinaFlow's external API uses **API key authentication**. All requests to `/api/v1/*` endpoints must include a valid API key in the `Authorization` header.

## API Keys

API keys are prefixed with `fna_` and are generated from the FinaFlow UI under **Settings > Integrations > API Keys**, or programmatically via the Fina Connect pairing flow.

```
Authorization: Bearer fna_ABCdef123456789...
```

API keys are scoped to a single business. All operations performed with a key are attributed to that business.

## Scopes

Each API key is granted a set of **scopes** that control which endpoints it can access. Scopes follow the `resource:action` naming convention:

| Scope | Description |
|---|---|
| `accounts:read` | Read accounts, chart of accounts |
| `suppliers:read` | Read suppliers |
| `suppliers:write` | Create and update suppliers |
| `categories:read` | Read expense categories |
| `business:read` | Read business profile |
| `locations:read` | Read locations / branches |
| `users:read` | Read users and role templates |
| `users:write` | Create and update users |
| `sales:write` | Ingest daily sales batches |
| `journal:write` | Create and post journal entries |
| `webhooks` | Manage webhook subscriptions |

### Legacy scopes

Older API keys may use coarse scopes (`read`, `write`). These are automatically resolved to the granular equivalents:

- `read` → `accounts:read`, `suppliers:read`, `categories:read`, `business:read`, `locations:read`, `users:read`
- `write` → `suppliers:write`

This ensures backward compatibility without requiring key rotation.

## Cookie vs Bearer auth

FinaFlow uses two authentication mechanisms depending on the client type:

| Client | Auth method | Token format |
|---|---|---|
| **Web app (React)** | httpOnly cookie (`finaflow_token`) | JWT |
| **External integrator** | `Authorization: Bearer` header | API key (`fna_...`) |
| **tRPC internal** | Cookie or Bearer | JWT or API key |

The web app never sees API keys. External integrators never need cookies or CSRF tokens — all `/api/v1/*` and `/api/connect/*` routes are exempt from CSRF protection.

## Rate limits

| Endpoint group | Limit | Window |
|---|---|---|
| `/api/v1/*` (integration) | 100 requests | 1 minute |
| `/api/trpc/*` (app API) | 500 requests | 1 minute |
| `/api/connect/*` (pairing) | 30 requests | 1 minute |
| Login endpoints | 10 requests | 1 minute |

Rate limit headers are included on every response:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 97
X-RateLimit-Reset: 1720000000
```

When the limit is exceeded, the response includes `Retry-After` and returns HTTP 429.

## Error responses

All error responses use a consistent envelope:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid API key"
  },
  "meta": {
    "requestId": "req_abc123"
  }
}
```

Common error codes:

| Code | HTTP Status | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `FORBIDDEN` | 403 | API key lacks the required scope |
| `NOT_FOUND` | 404 | Route or resource not found |
| `VALIDATION_ERROR` | 400 | Request body failed validation |
| `INGESTION_FAILED` | 400 | Daily sales ingestion failed |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
