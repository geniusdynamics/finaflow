# Instance-control API

The instance-control API is the machine-to-machine surface a **FinaBill**
deployment uses to administer this FinaFlow instance: list its accounts, put an
account on billing hold, resume it, change its plan, and enable or disable a
user. It is not the merchant API and it is not a browser surface. A controller
is a separate credential type, allowlisted by FinaBill account id, and a tenant
`fna_` key can never call it.

```text
FinaBill (controller)
  │  Authorization: Bearer fic_…
  │  X-Fina-Controller-Id: <FinaBill account id>
  ▼
FinaFlow  /api/v1/instance/*
  ├── instance_controllers   (the allowlist; SHA-256 key hashes only)
  └── customer_accounts      (the accounts being administered)
```

The route is mounted at `/api/v1/instance` and every response uses the standard
v1 envelope — `{ data, meta }` on success, `{ error: { code, message }, meta }`
on failure. See [Authentication](/docs/authentication) for the shared envelope,
rate limits and request ids.

## The controller allowlist

A controller is one row in `instance_controllers`:

| Column | Meaning |
| --- | --- |
| `name` | A label for the controller, for example "FinaBill production". |
| `controllerId` | The **FinaBill account id** this controller speaks for. Unique among live rows. |
| `keyHash` | SHA-256 of the raw `fic_…` key. Never returned by any endpoint. |
| `keyPrefix` | The first characters of the key, for recognition in a list. |
| `scopes` | `["instance:read"]` or `["instance:read","instance:manage"]`. |
| `isActive` | A revoked controller keeps its row but is rejected. |
| `lastUsedAt` | Stamped on every request that presents a valid key/id pair and the required scope. |
| `createdByUserId` | The super-admin who created it. |

Keys are prefixed `fic_` (32 base64url characters after the prefix), generated
once and stored as a SHA-256 hash. The raw key is shown **once** — in the
create and rotate responses — and cannot be recovered afterwards. Rotating a key
replaces the hash immediately, so the previous key stops working at once.

### The admin panel

An operator with the super-admin account opens **Admin ▸ FinaBill controllers**
and creates a controller with:

- a name;
- the FinaBill account id that will present itself in
  `X-Fina-Controller-Id`;
- the scopes it may hold — read only, or read and manage.

The panel lists the register with `keyPrefix`, scopes, active state and
`lastUsedAt`, and offers **Rotate**, **Revoke** and **Remove**. The raw `fic_…`
value appears only in the create and rotate result; the list, the audit trail and
the API never carry it. Revoking keeps the row and rejects the key; removing
soft-deletes the row. An active controller id cannot be created twice; remove a
controller row before reusing its id.

The same operations are the tRPC procedures `admin.controllers.list | create |
rotate | update | revoke | remove`, gated by the super-admin check, never by a
tenant role. The panel exposes create, rotate, revoke and remove; `update`
renames a controller or changes its scopes.

## Authentication

Every request carries both headers:

```http
Authorization: Bearer fic_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
X-Fina-Controller-Id: ACC-7F3K9Q
```

`X-Fina-Controller-Id` is compared with the `controllerId` stored beside the
key. Both must belong to the same row — presenting one controller's key with
another's id is rejected, so a leaked key cannot be replayed under a different
identity even if both are allowlisted.

### Scopes

| Scope | Grants |
| --- | --- |
| `instance:read` | `GET /health`, the account list and detail, the user list, the plan catalogue. |
| `instance:manage` | `POST` hold, resume, plan and user status. |

`instance:manage` does not imply `instance:read`; grant both when the controller
should read and change. A read-only controller can pass a connection test and
list accounts, then receives `403` on every mutation.

### Resolution order and failures

The middleware resolves a controller in this order; the first failure wins:

| Check | Status | Code / message |
| --- | --- | --- |
| Missing or non-Bearer `Authorization` | `401` | `UNAUTHORIZED` — `Missing instance controller credentials` |
| Key does not start with `fic_` | `401` | `UNAUTHORIZED` — `Invalid instance controller key format` |
| Missing `X-Fina-Controller-Id` | `401` | `UNAUTHORIZED` — `Missing X-Fina-Controller-Id header` |
| No live row matches the key hash | `401` | `UNAUTHORIZED` — `Invalid or revoked instance controller key` |
| Header id differs from the row's `controllerId` | `401` | `UNAUTHORIZED` — `X-Fina-Controller-Id does not match the presented key` |
| Row lacks the required scope | `403` | `FORBIDDEN` — `Instance controller key missing required scope: instance:manage` |

A tenant key (`fna_…`) fails at the second check, not at the scope check: the
instance API never resolves a merchant key as a controller, even if its business
happens to own an account. A deleted (`deletedAt`) or inactive controller is
indistinguishable from an unknown key.

A request that passes these checks stamps `lastUsedAt` on the controller row. A
request rejected by any check does not.

### Transport and limits

- Use **HTTPS**. The key is a bearer credential; a plaintext hop exposes it.
- No session cookie and no CSRF token apply. The bearer key is the whole
  authentication.
- The v1 integration limiter applies: **100 requests per minute per IP**.
  `429` responses carry `Retry-After`.
- Send and receive JSON. Request bodies are validated strictly; unknown or
  mistyped fields are a `400 VALIDATION_ERROR`, not a silent default.

## Endpoints

| Method | Path | Scope | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/instance/health` | `instance:read` | Liveness, product and counts. |
| `GET` | `/api/v1/instance/accounts` | `instance:read` | Paginated account register. |
| `GET` | `/api/v1/instance/accounts/{accountId}` | `instance:read` | One account with its businesses and users. |
| `POST` | `/api/v1/instance/accounts/{accountId}/hold` | `instance:manage` | Put the account on billing hold. |
| `POST` | `/api/v1/instance/accounts/{accountId}/resume` | `instance:manage` | Clear the billing hold. |
| `POST` | `/api/v1/instance/accounts/{accountId}/plan` | `instance:manage` | Change the account's plan and expiry. |
| `GET` | `/api/v1/instance/users` | `instance:read` | Paginated user register, optionally per account. |
| `POST` | `/api/v1/instance/users/{userId}/status` | `instance:manage` | Enable or disable a user. |
| `GET` | `/api/v1/instance/plans` | `instance:read` | The plan catalogue with limits. |

`:accountId` is the FinaFlow account id (`customer_accounts.accountId`, for
example `ACC-7F3K9Q`), not the numeric row id. `:userId` is the numeric user id
from the user list.

### Health

```http
GET /api/v1/instance/health
Authorization: Bearer fic_…
X-Fina-Controller-Id: ACC-7F3K9Q
```

```json
{
  "data": {
    "product": "finaflow",
    "version": "1.4.0",
    "accountCount": 182,
    "userCount": 431,
    "serverTime": "2026-11-21T09:14:02.511Z"
  },
  "meta": { "requestId": "req_abc123" }
}
```

`version` is the FinaFlow release reported in `package.json`. `accountCount`
and `userCount` count non-deleted rows on this instance. A connection test only
proves this route and the read scope; it does not prove `instance:manage`.

### List accounts

```http
GET /api/v1/instance/accounts?limit=25&offset=0&access=held&plan=growth&search=alpha
```

| Query | Type | Default | Meaning |
| --- | --- | --- | --- |
| `search` | string | — | Case-insensitive match on account id or name. |
| `plan` | string | — | Exact plan key. |
| `access` | `all` \| `held` \| `active` | `all` | `held` = `billingHoldAt` set; `active` = no hold. |
| `limit` | integer 1–100 | 25 | Page size. |
| `offset` | integer ≥ 0 | 0 | Rows to skip. |

```json
{
  "data": [
    {
      "accountId": "ACC-7F3K9Q",
      "name": "Alpha Lodge",
      "plan": "growth",
      "subscriptionStatus": "active",
      "isActive": true,
      "billingHoldAt": null,
      "subscriptionExpiry": "2026-12-31",
      "createdAt": "2026-02-14T08:00:00.000Z",
      "businessCount": 2,
      "userCount": 7
    },
    {
      "accountId": "ACC-9K2M1P",
      "name": "Beta Duka",
      "plan": "starter",
      "subscriptionStatus": "active",
      "isActive": true,
      "billingHoldAt": "2026-11-01T09:00:00.000Z",
      "subscriptionExpiry": null,
      "createdAt": "2026-03-02T08:00:00.000Z",
      "businessCount": 1,
      "userCount": 2
    }
  ],
  "meta": {
    "pagination": { "page": 1, "limit": 25, "total": 2, "totalPages": 1 },
    "requestId": "req_abc123"
  }
}
```

`billingHoldAt` is the authoritative hold signal: a non-null timestamp means the
account is on hold even though `isActive` may be `true`. A controller that only
reads `isActive` will misreport a held account.

### Get one account

```http
GET /api/v1/instance/accounts/ACC-7F3K9Q
```

```json
{
  "data": {
    "account": {
      "accountId": "ACC-7F3K9Q",
      "name": "Alpha Lodge",
      "plan": "growth",
      "subscriptionStatus": "active",
      "isActive": true,
      "billingHoldAt": null,
      "subscriptionExpiry": "2026-12-31",
      "createdAt": "2026-02-14T08:00:00.000Z",
      "maxBusinesses": 3,
      "maxUsers": 5,
      "maxTransactionsPerMonth": 20000,
      "updatedAt": "2026-11-20T16:12:44.000Z"
    },
    "businesses": [
      {
        "id": 41,
        "name": "Alpha Lodge Nairobi",
        "slug": "alpha-lodge-nairobi",
        "plan": "growth",
        "subscriptionStatus": "active",
        "subscriptionExpiry": "2026-12-31",
        "isActive": true,
        "createdAt": "2026-02-14T08:05:00.000Z"
      }
    ],
    "users": [
      {
        "id": 308,
        "name": "Amina Yusuf",
        "username": "amina",
        "email": "amina@example.com",
        "role": "owner",
        "isActive": true,
        "createdAt": "2026-02-14T08:02:00.000Z"
      }
    ]
  },
  "meta": { "requestId": "req_abc123" }
}
```

Unknown or soft-deleted account ids are a flat `404 NOT_FOUND`. The account
object never contains a password hash, session, API key or billing secret; the
user objects expose identity and role, never credentials.

### Hold and resume

```http
POST /api/v1/instance/accounts/ACC-7F3K9Q/hold
Content-Type: application/json

{ "reason": "Invoice 4471 unpaid for 30 days" }
```

```json
{
  "data": {
    "accountId": "ACC-7F3K9Q",
    "name": "Alpha Lodge",
    "plan": "growth",
    "subscriptionStatus": "active",
    "isActive": true,
    "billingHoldAt": "2026-11-21T09:20:11.000Z",
    "subscriptionExpiry": "2026-12-31",
    "createdAt": "2026-02-14T08:00:00.000Z"
  },
  "meta": { "requestId": "req_abc123" }
}
```

`reason` is required, trimmed, 3–2000 characters, and is written to this
instance's audit trail (`audit_log.tableName = 'instance_control'`, operation
`billing_hold`, `changedBy` null). Resume is the mirror call:

```http
POST /api/v1/instance/accounts/ACC-7F3K9Q/resume
Content-Type: application/json

{ "reason": "Payment received, receipt 8891" }
```

A hold is a **billing hold**, not a deletion and not a plan change:

- Owners and admins are limited to the billing areas (`billing_only`).
- Every other user is blocked at authentication.
- Business API keys (`fna_…`) are refused by `assertBusinessOperational`, so a
  held account's integrations stop writing.
- Accounts, businesses, users, documents and data are retained.

Both actions are idempotent: holding an already-held account, or resuming one
that is not held, returns the current state without a second audit row. The
internal platform account (`SUPER_ADMIN_ACCOUNT`) is protected: hold, resume
and plan changes answer `403 FORBIDDEN` and change nothing.

### Change the plan

```http
POST /api/v1/instance/accounts/ACC-7F3K9Q/plan
Content-Type: application/json

{
  "plan": "pro",
  "expiresOn": "2027-02-28",
  "reason": "Upgraded at renewal"
}
```

```json
{
  "data": {
    "accountId": "ACC-7F3K9Q",
    "name": "Alpha Lodge",
    "plan": "pro",
    "subscriptionStatus": "trial",
    "isActive": true,
    "billingHoldAt": null,
    "subscriptionExpiry": "2027-02-28",
    "createdAt": "2026-02-14T08:00:00.000Z"
  },
  "meta": { "requestId": "req_abc123" }
}
```

| Field | Rule |
| --- | --- |
| `plan` | Required. One of `free`, `starter`, `growth`, `pro`. `partner` is refused — partner entitlements have their own workflow. |
| `expiresOn` | Optional `YYYY-MM-DD`. Sets `subscriptionStatus = "trial"` and the expiry date; omitting it clears the expiry and sets `subscriptionStatus = "active"`. |
| `reason` | Required, 3–2000 characters; audited as operation `plan_change`. |

The change applies the plan's limits and features to the account **and to every
business under it**: `maxBusinesses`, `maxUsers`, `maxTransactionsPerMonth`,
`maxBranches` and the subscription fields move together. The call is refused
with `400` when the account already has more businesses, users or branches than
the target plan allows, and with `403` for the protected platform account or a
partner plan. Nothing is partially applied — the account and its businesses are
updated in one transaction, and the audit row is written there too.

### List users

```http
GET /api/v1/instance/users?accountId=ACC-7F3K9Q&search=amina&limit=50
```

| Query | Type | Default | Meaning |
| --- | --- | --- | --- |
| `accountId` | string | — | Restrict to one account. |
| `search` | string | — | Match name, username or email. |
| `limit` | integer 1–100 | 25 | Page size. |
| `offset` | integer ≥ 0 | 0 | Rows to skip. |

```json
{
  "data": [
    {
      "id": 308,
      "name": "Amina Yusuf",
      "username": "amina",
      "email": "amina@example.com",
      "role": "owner",
      "accountId": "ACC-7F3K9Q",
      "isActive": true,
      "createdAt": "2026-02-14T08:02:00.000Z"
    }
  ],
  "meta": {
    "pagination": { "page": 1, "limit": 50, "total": 1, "totalPages": 1 },
    "requestId": "req_abc123"
  }
}
```

### Enable or disable a user

```http
POST /api/v1/instance/users/308/status
Content-Type: application/json

{
  "accountId": "ACC-7F3K9Q",
  "isActive": false,
  "reason": "Staff member left the company"
}
```

```json
{
  "data": { "id": 308, "isActive": false },
  "meta": { "requestId": "req_abc123" }
}
```

`accountId` is required because the user id alone is not scoped on this route;
the user must belong to that account, or the call is `404`. The last active
owner of an account cannot be disabled (`400`). A no-op (the user already has
that state) returns the current state without an audit row; a real change is
audited as operation `user_status`. Disabling a user does not delete them and
does not touch their data.

### Plans

```http
GET /api/v1/instance/plans
```

```json
{
  "data": [
    {
      "plan": "free",
      "name": "Free",
      "priceLabel": "KES 0/mo",
      "maxBusinesses": 1,
      "maxBranches": 1,
      "maxUsers": 1,
      "transactionQuota": 100,
      "payrollEnabled": false,
      "supportTier": "Community"
    },
    {
      "plan": "growth",
      "name": "Growth",
      "priceLabel": "KES 1,500/mo",
      "maxBusinesses": 3,
      "maxBranches": 5,
      "maxUsers": 5,
      "transactionQuota": 20000,
      "payrollEnabled": true,
      "supportTier": "Priority"
    }
  ],
  "meta": { "requestId": "req_abc123" }
}
```

The catalogue is the four sellable plans (`free`, `starter`, `growth`, `pro`).
`transactionQuota` is a monthly figure; `999999` means unlimited. Values come
from the same `PLAN_MATRIX` the application uses, so a controller never sees a
price or limit this instance would not enforce. **Plan import is not part of
this API** — the catalogue is read-only, and a controller creates its own plans
locally.

## Security

- **The controller id is an allowlist, not a hint.** A key is only accepted when
  `X-Fina-Controller-Id` equals the id stored on the same row. An unknown,
  revoked or deleted controller is a flat `401`.
- **A tenant key cannot call this API.** `fna_` keys are resolved by a different
  middleware and are rejected here at the prefix check. The instance API does
  not read `api_keys`.
- **Only hashes at rest.** Keys are stored as SHA-256 hex; the raw `fic_` value
  is returned once at create or rotate. `lastUsedAt` is the only usage signal;
  there is no plaintext key column and no recovery path.
- **No credentials in responses.** Accounts and users expose identity, plan and
  state. Password hashes, session rows, API keys and billing secrets are never
  selected or serialized.
- **Every mutation is audited.** Controller management writes
  `audit_log.tableName = 'instance_controller'` with the acting admin; hold,
  resume, plan and user status write `instance_control` with `changedBy` null
  and the supplied reason in `supportReason`. Audit rows are not deleted when a
  controller is removed.
- **Use HTTPS.** The API adds no second transport check of its own; deploy it
  behind TLS, and never paste a `fic_` key into a browser, a URL or a log.
- **A controller is powerful.** `instance:manage` can hold an entire account or
  disable its users. Grant `instance:read` alone where administration is not
  needed, rotate on any suspicion, and revoke rather than leave an unused row.
- **The internal platform account is protected.** Hold, resume and plan changes
  refuse it; the controller cannot lock the operator out of the instance.

## What is not built

- **Automatic pairing.** Creating a controller in FinaFlow and adding an
  instance in FinaBill are two manual steps. There is no enrolment handshake, no
  one-click connect and no discovery endpoint.
- **Key-expiry and rotation webhooks.** Keys do not expire on a timer, and
  FinaFlow does not notify FinaBill when a key is rotated or revoked. A rotation
  is a manual copy from the admin panel into FinaBill; until it is done, calls
  fail with `401`.
- **Plan import.** The plan catalogue is read-only. FinaFlow plans are not
  imported into FinaBill, mirrored or reconciled.
- **Usage metering.** `health` reports account and user counts; there is no
  transaction, storage or seat usage feed, and no billing reconciliation.
- **Tenant provisioning.** The API does not create accounts, businesses or
  users, does not delete them, and does not change a business's own plan
  independently of its account.
- **Feedback events.** FinaFlow does not push events back to FinaBill; a
  controller learns state by calling the API.

## Connecting from FinaBill

The controller id FinaBill presents is the FinaBill business's own **platform
account id** (`customer_accounts.account_id`, for example `ACC-7F3K9Q`) — not
the instance id, the feedback id or a business id.

1. In FinaBill, note the business's platform account id (**My Account**, or
   Platform accounts in `/platform`).
2. In FinaFlow, open **Admin ▸ FinaBill controllers** and create a controller:
   name it for the FinaBill deployment, enter that account id, and grant
   `instance:read` plus `instance:manage`.
3. Copy the `fic_…` key from the create result. It is shown once.
4. In FinaBill, open **Software ▸ Add software**, choose kind **FinaFlow**, enter
   the FinaFlow origin (`https://finaflow.example.com`) and paste the key.
5. **Test connection** — it calls `GET /api/v1/instance/health` with both
   headers. A `401` means the key/id pair is wrong or revoked; a `403` means the
   controller has no `instance:read`.
6. **Manage tenants** lists FinaFlow accounts and offers **Suspend** (hold) and
   **Resume**. A held account shows as suspended; the dialog reads the live
   state on every open, so a change made in FinaFlow's admin panel appears on the
   next open.

FinaBill refuses a FinaFlow instance when the business has no platform account
id, before reading or sending the key. See FinaBill's software-management guide
for the other fields and the feedback contract.

## Related reading

- [Authentication](/docs/authentication) — key prefixes, scopes, rate limits and
  the error envelope shared with the merchant API.
- [API reference](/docs/api) — the interactive v1 reference.
- [MCP server](/docs/mcp) — the separate agent surface, which never exposes
  instance control.
