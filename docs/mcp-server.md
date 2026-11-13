# Building a FinaFlow MCP server

This document is the implementation brief for a Model Context Protocol (MCP) server
that exposes FinaFlow to AI models and agents. It is deliberately API-first: the MCP
server is a thin, typed, auditable wrapper over `/api/v1`.

The user-facing setup guide is [`docs/mcp.md`](./mcp.md), published at `/docs/mcp`.

## 1. Purpose

The server should let an AI assistant answer questions such as:

- “How much did we spend with BAMBURI in Q3?”
- “Which customers paid us more than three times this month?”
- “Import this bank statement and explain the cash-flow change.”
- “Which bills are overdue, and which bank transactions look like their payments?”
- “Prepare VAT/WHT evidence for the tax agent.”

The MCP server must **not** calculate accounting balances independently. It calls the
FinaFlow API and returns structured results, with enough schema information for the
model to reason safely.

## 2. Transport and deployment

Two transports are supported by the MCP TypeScript SDK:

- **stdio** — local desktop/CLI use. The process starts with the user's API key in an
  environment variable. Best for Claude Desktop and local IDE agents.
- **Streamable HTTP** — hosted multi-tenant use. Authenticate each request with a
  FinaFlow API key, never a shared server key. The server must not keep business context
  between requests beyond the key resolution cache.

Recommended production shape:

```
AI client ──MCP──> finaflow-mcp (Node 20+) ──HTTPS──> https://finaflow.genius.africa/api/v1
                                   │
                                   └── no database, no statement files persisted
```

Environment:

```bash
FINAFLOW_API_KEY=fna_...            # stdio only; never log
FINAFLOW_BASE_URL=https://finaflow.genius.africa
MCP_TRANSPORT=stdio|http
PORT=8787
```

Use a dedicated API key per integration and rotate it independently of user sessions.

## 3. Authentication and scopes

Every request uses:

```http
Authorization: Bearer fna_...
```

The API key carries a business and a scope set. The MCP server should expose only tools
whose scopes are present on the key, and return a clear `forbidden` error otherwise.

| Scope | Tools |
|---|---|
| `business:read` | `get_business_profile` |
| `locations:read` | `list_locations` |
| `accounts:read` | `list_accounts`, `get_account_transactions` |
| `accounts:write` | `upsert_account`, `create_bank_account` |
| `categories:read` / `write` | `list_categories`, `upsert_category` |
| `suppliers:read` / `write` | `list_suppliers`, `upsert_supplier` |
| `bills:read` / `write` | `list_bills`, `get_bill`, `upsert_bill` |
| `expenses:read` | `list_expenses` |
| `sales:read` / `write` | `list_daily_sales`, `ingest_daily_sales` |
| `statements:read` | `analyze_statements`, `list_statement_imports`, `get_statement_import`, `export_statement` |
| `statements:write` | `import_statements` |
| `subscriptions:read` / `write` | `list_subscriptions`, `record_subscription_payment` |
| `webhooks` | `list_webhooks` / `manage_webhooks` (future) |

Never expose a write tool without a scope check. A read-only key must never be able to
call `upsert_*`, `import_*` or `ingest_*`.

## 4. HTTP conventions

- Base path: `/api/v1`.
- Success: `{ "data": ..., "meta": { "requestId": "..." } }`.
- Error: `{ "error": { "code": "VALIDATION_ERROR", "message": "..." }, "meta": { "requestId": "..." } }`.
- Money: decimal strings in analysis endpoints; numbers in report sheets.
- Dates: `YYYY-MM-DD`; timestamps: ISO 8601.
- Pagination: `offset` + `limit`; response `meta` includes page/limit/total.
- Idempotency: use `externalId` + `externalSystem` for upserts; use `sourceBatchId` for
  daily sales.
- Rate limit: the API applies integration limits; on `429`, honor `Retry-After` and back off.

Map API errors to MCP tool errors:

| HTTP | MCP error |
|---|---|
| 400 | `invalid_params` (include field-level message) |
| 401 | `unauthorized` |
| 403 | `forbidden` (say which scope is missing) |
| 404 | `not_found` |
| 409 | `conflict` |
| 429 | `rate_limited` |
| 5xx | `internal` (do not expose stack traces) |

## 5. Tools

The `mcp/` package in this repo currently implements the 32 tools listed in
`docs/mcp-tools.json`. The tables below describe the full planned surface; entries not in
that manifest (`create_bank_account`, `export_statement`, `record_subscription_payment`)
are specified here for the next iteration.

### 5.1 Connection and reference data

| Tool | Endpoint | Scope | Writes |
|---|---|---|---|
| `verify_connection` | `GET /verify` | any valid key | No |
| `get_business_profile` | `GET /business/profile` | `business:read` | No |
| `list_locations` | `GET /locations` | `locations:read` | No |
| `list_accounts` | `GET /accounts` | `accounts:read` | No |
| `get_account` | `GET /accounts/{id}` | `accounts:read` | No |
| `update_account` | `PATCH /accounts/{id}` | `accounts:write` | Yes |
| `get_account_transactions` | `GET /accounts/{id}/transactions` | `accounts:read` | No |
| `upsert_account` | `POST /accounts` | `accounts:write` | Yes |
| `create_bank_account` | `POST /accounts` with `type=bank_account` | `accounts:write` | Yes |
| `list_categories` | `GET /categories` | `categories:read` | No |
| `upsert_category` | `POST /categories` | `categories:write` | Yes |
| `archive_category` | `DELETE /categories/{id}` | `categories:write` | Yes |
| `list_suppliers` | `GET /suppliers` | `suppliers:read` | No |
| `upsert_supplier` | `POST /suppliers` | `suppliers:write` | Yes |

### 5.2 Bills, expenses and sales

| Tool | Endpoint | Scope | Writes |
|---|---|---|---|
| `list_bills` | `GET /bills` | `bills:read` | No |
| `get_bill` | `GET /bills/{id}` | `bills:read` | No |
| `list_bill_payments` | `GET /bills/{id}/payments` | `bills:read` | No |
| `record_bill_payment` | `POST /bills/{id}/payments` | `bills:write` | Yes |
| `upsert_bill` | `POST /bills` | `bills:write` | Yes |
| `list_expenses` | `GET /expenses` | `expenses:read` | No |
| `list_daily_sales` | `GET /daily-sales` | `sales:read` | No |
| `get_daily_sale` | `GET /daily-sales/{id}` | `sales:read` | No |
| `delete_daily_sale` | `DELETE /daily-sales/{id}` | `sales:write` | Yes |
| `ingest_daily_sales` | `POST /daily-sales` | `sales:write` | Yes |

### 5.3 Statements and AI analysis

`analyze_statements` is the flagship tool.

**Endpoint:** `POST /statements/analyze/full`  
**Scope:** `statements:read`  
**Writes:** none. Files are parsed in memory and never persisted.

Input (JSON):

```json
{
  "files": [
    { "fileName": "kcb-jan.pdf", "contentBase64": "...", "password": "optional" }
  ],
  "includeTransactions": true
}
```

Multipart is also supported: repeat `files` and optionally send `password`
(one password for all files) and `includeTransactions=true`.

Output (abridged):

```json
{
  "schemaVersion": "2026-10-28",
  "fileCount": 2,
  "totalRowCount": 6620,
  "duplicateRows": 0,
  "periodStart": "2026-02-28",
  "periodEnd": "2026-10-23",
  "banks": ["KCB"],
  "analysis": {
    "summary": { "totalIn": "42932687.50", "totalOut": "48172057.00", "totalFees": "14300.50" },
    "categories": [],
    "moneyIn": { "bySource": [], "byChannel": [] },
    "moneyOut": { "byDestination": [] },
    "recurring": [],
    "anomalies": {}
  },
  "coverage": [],
  "sheets": [
    { "name": "Monthly", "columns": ["Month", "Transactions", "In", "Out", "Net"], "rows": [] },
    { "name": "Money In - Grouped", "columns": ["Party", "Variants", "Transactions", "Total", "Average"], "rows": [] }
  ],
  "transactions": [],
  "dataDictionary": {},
  "warnings": []
}
```

Tool guidance for the model:

- Read `analysis.summary` first for headline totals.
- Use `analysis.breakdown.monthly` for month questions.
- Use `analysis.moneyIn.bySource` / `moneyOut.byDestination` for party questions.
- Use `sheets` when the user wants the Excel report or a table.
- Use `transactions` only when row-level detail is required; it increases payload size.
- Never sum `analysis.balance` from a multi-file response; use `coverage[].balance` per file.
- Treat `counterpartyId` as a phone/account identifier when `counterpartyName` is null.

Other statement tools:

| Tool | Endpoint | Scope | Writes |
|---|---|---|---|
| `import_statements` | `POST /statements/import` | `statements:write` | Yes |
| `list_statement_imports` | `GET /statements/imports` | `statements:read` | No |
| `get_statement_import` | `GET /statements/imports/{id}` | `statements:read` | No |
| `analyze_statement_import` | `GET /statements/imports/{id}/analysis` | `statements:read` | No |
| `link_statement_account` | `POST /statements/imports/{id}/link-account` | `statements:write` | Yes |
| `tag_statement_transactions` | `POST /statements/transactions/tag` | `statements:write` | Yes |
| `link_transaction_to_bill` | `POST /statements/transactions/{id}/link-bill` | `statements:write` | Yes |
| `export_statement` | `GET /statements/imports/{id}/export?format=csv|xlsx|json` | `statements:read` | No |

Tagging and reconciliation workflow:

1. `get_statement_import` returns rows with their database `id`, `categoryId`, `isLinked` and `linkedBillId`.
2. `analyze_statement_import` rebuilds the report from live categories, so tags appear in the category sheet immediately.
3. `tag_statement_transactions` assigns one category to up to 500 rows; `categoryId: null` clears it.
4. `link_transaction_to_bill` records a match only by default. Pass `postPayment: true` only
   when the bill has not already been paid in FinaFlow, because that posts the payment and
   creates its expense.

### 5.4 Subscriptions

| Tool | Endpoint | Scope | Writes |
|---|---|---|---|
| `list_subscriptions` | `GET /subscriptions` | `subscriptions:read` | No |
| `record_subscription_payment` | `POST /subscriptions/payments` | `subscriptions:write` | Yes |

## 6. MCP resources

Expose resources for stable context that should not be re-fetched on every turn:

| URI | Content |
|---|---|
| `finaflow://business/profile` | Business identity, currency, fiscal settings |
| `finaflow://business/locations` | Branch list |
| `finaflow://business/accounts` | Cash, wallet and bank accounts with balances |
| `finaflow://business/categories` | Category list |
| `finaflow://business/suppliers` | Supplier list |
| `finaflow://statements/{importId}/analysis` | Frozen analysis snapshot |
| `finaflow://statements/{importId}/rows` | Imported statement rows |
| `finaflow://daily-sales/{id}` | One sales batch with channels |

Resources are read-only. Every resource read must resolve the API key's business and
reject cross-business URIs.

## 7. Prompts

Ship a small set of prompts rather than one giant system prompt:

- `monthly_cashflow_review` — period + optional account/location.
- `supplier_spend_review` — supplier or party name + period.
- `statement_investigation` — statement analysis JSON or import id.
- `overdue_bills` — as-of date.
- `tax_evidence_pack` — period + tax type; gathers sales, expenses, bills and bank rows.

Prompts should instruct the model to cite the exact fields and never invent missing
transactions. They should refuse to provide tax advice beyond the supplied records.

## 8. Secure implementation rules

- Never log `Authorization`, API keys, statement passwords or raw PDF bytes.
- Validate every tool input with Zod and reject unknown fields.
- Cap statement uploads at 12 files × 10 MB and 40 MB total.
- For write tools, require an explicit `confirm: true` argument or a separate
  confirmation prompt; do not let a model silently create bills or payments.
- Treat statement and party names as untrusted text. Do not interpolate them into
  shell commands, SQL or HTML.
- Return only the calling key's business. A 404 is safer than a 403 for cross-tenant IDs.
- Use `structuredContent` for JSON and a short `content` text summary.
- Set request timeouts and cancel in-flight calls when the MCP request is cancelled.

## 9. Suggested TypeScript skeleton

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "finaflow", version: "1.0.0" });
const baseUrl = process.env.FINAFLOW_BASE_URL!;
const apiKey = process.env.FINAFLOW_API_KEY!;

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? response.statusText);
  return body.data;
}

server.tool(
  "analyze_statements",
  "Parse one or more bank/M-PESA statement PDFs and return a consolidated analysis.",
  {
    files: z.array(z.object({
      fileName: z.string(),
      contentBase64: z.string(),
      password: z.string().optional(),
    })).min(1).max(12),
    includeTransactions: z.boolean().optional(),
  },
  async (args) => {
    const data = await api("/statements/analyze/full", {
      method: "POST",
      body: JSON.stringify(args),
    });
    return {
      content: [{ type: "text", text: `Analysed ${data.fileCount} statement(s), ${data.totalRowCount} rows.` }],
      structuredContent: data,
    };
  },
);

await server.connect(new StdioServerTransport());
```

For HTTP transport, resolve the API key from the request header, create a per-request
server/context, and never reuse another caller's business context.

## 10. Test plan

- **Contract tests**: validate every tool's input/output against Zod schemas.
- **Scope tests**: read-only key cannot call write tools; missing scope returns `forbidden`.
- **Tenant tests**: a key from business B cannot read business A by ID.
- **Statement tests**: single and multi-file, password-protected PDF, CSV, duplicate
  statements, oversized file, malformed file.
- **Idempotency**: repeat `ingest_daily_sales` and `upsert_bill`; expect the same record.
- **Rate limits**: 429 behavior and retry/backoff.
- **Prompt injection**: statement descriptions containing instructions must stay data.
- **Payload size**: `includeTransactions=true` on a 6,000-row statement; verify limits and
  client timeouts.

## 11. Tax-agent workflow (next phase)

Once tax records exist, add:

- `list_tax_records(period, taxType, status)`
- `get_tax_summary(period, taxType)`
- `link_tax_record(recordId, statementRowId | billId | expenseId)`
- `find_unlinked_tax_candidates(period)`
- `explain_tax_variance(period)`

The agent should be able to trace every number to a source row and should return
“not found” rather than estimating. Reuse the statement analysis `dataDictionary` and
coverage metadata so the model can distinguish bank movement from accounting records.

## 12. Open items

- Expense-write API.
- Tax-record model and endpoints.
- Outbound webhook subscription management.
- Attachment upload for receipts.
- Linking a statement row to an existing expense (bill linking is implemented).
- A hosted Streamable HTTP deployment and per-request key resolution.

The initial `mcp/` package implements 32 tools: the read catalog above plus confirmed
writes for accounts, categories, suppliers, bills, bill payments, daily sales,
statement import/linking/tagging and statement analysis.
