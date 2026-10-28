# FinaFlow v1 API gap audit — October 2026

This audit compares the existing `/api/v1` surface with the workflows an external
bookkeeping, tax or AI integration needs. It records what was added in this pass and
what remains intentionally deferred.

## Existing coverage

| Area | Read | Write | Notes |
|---|---|---|---|
| API key verification | `GET /verify` | — | Business identity and scopes |
| Business / locations | `GET /business/profile`, `GET /locations` | — | Location creation happens in the app |
| Accounts / banks | `GET /accounts`, `GET /accounts/{id}/transactions` | `POST /accounts` | `type: bank_account` creates a bank account; no separate `/banks` resource |
| Categories | `GET /categories` | `POST /categories` | Upsert is create-or-update; no delete |
| Suppliers | `GET /suppliers` | `POST /suppliers` | Upsert by external id |
| Bills | `GET /bills`, `GET /bills/{id}` *(new)* | `POST /bills` | Detail now includes line items; no payment endpoint |
| Expenses | `GET /expenses` | — | Pull-only by design today |
| Daily sales | `GET /daily-sales` *(new)* | `POST /daily-sales` | Read includes payment-channel rows |
| Subscriptions | `GET /subscriptions`, payment history | `POST /subscriptions/payments` | — |
| Statements | imports, detail, exports, `POST /statements/analyze`, `POST /statements/analyze/full` *(new)* | `POST /statements/import` | Full analysis is stateless and AI-ready |
| Webhooks | Incoming receivers | — | No subscription-management API |

## Added in this pass

1. **`POST /statements/analyze/full`** (`statements:read`)
   - Stateless, multi-file PDF/CSV analysis.
   - Returns consolidated analysis, per-file coverage, all report sheets as JSON,
     optional deduplicated transactions and a data dictionary.
   - No location or database write is required.

2. **`GET /daily-sales`** (`sales:read`)
   - Filters: `locationId`, `dateFrom`, `dateTo`, `updatedSince`, `sourceBatchId`.
   - Pagination via `offset` / `limit`.
   - Each sale includes its payment-channel rows and location name.

3. **`GET /bills/{id}`** (`bills:read`)
   - Returns one bill with its line items, supplier, paid amount and balance.

`statements:read` now covers both stored imports and stateless analysis. `sales:read`
is a new scope; legacy `read` keys resolve to it, and new Fina Connect keys include it.

## Important remaining gaps

Prioritised for bookkeeping, tax and AI use:

| Priority | Gap | Recommended API | Reason |
|---|---|---|---|
| P1 | Bill payments | `POST /bills/{id}/payments`, `GET /bills/{id}/payments` | Needed for payables ageing and bank reconciliation |
| P1 | Expense creation | `POST /expenses` | Pull-only means external tools cannot post expenses |
| P1 | Bank account detail/update | `GET /accounts/{id}`, `PATCH /accounts/{id}` | Bank statements need an account identity for reconciliation |
| P1 | Statement-to-account link | `POST /statements/{importId}/link-account` | Current imports can link rows on import, but history cannot be relinked |
| P2 | Category archive | `DELETE /categories/{id}` | Upsert covers edits; safe deactivation is missing |
| P2 | Daily sales detail/delete | `GET /daily-sales/{id}`, `DELETE /daily-sales/{id}` | Read list exists; correcting a batch is app-only |
| P2 | Tax records | `GET/POST /tax/records`, `GET /tax/summary` | Required for the planned tax-analysis agent |
| P2 | Reconciliation matches | `GET/POST /reconciliations` | Link statement rows to bills/expenses explicitly |
| P3 | Attachments | `POST /attachments`, `GET /attachments/{id}` | Receipts and supporting documents for tax |
| P3 | Webhook subscriptions | `GET/POST/DELETE /webhooks` | Incoming receivers exist; outbound subscriptions are app-only |
| P3 | Reports | `GET /reports/income-statement`, `GET /reports/cashflow` | Agents need accountant-ready outputs |

## Tax-analysis readiness

The data needed for a tax agent already has anchors:

- **Revenue**: daily sales and paid bills.
- **Expenses**: expense records, bill line items and supplier identities.
- **Bank movement**: statement imports and the stateless analysis endpoint.
- **Tax-sensitive categories**: fees, utilities, salaries, loans, supplies.
- **Party identity**: counterparty name, phone, account reference, channel and code.

Recommended next step is a `tax_records` model with `taxType` (VAT/WHT/PAYE/etc.),
`period`, `amount`, `status`, `evidence` and optional links to a statement row,
expense or bill. The MCP server can then expose `search_tax_records` and
`link_tax_record_to_transaction` without inventing accounting semantics.

## Design rules for future v1 resources

- Use `{ data, meta: { requestId } }` for success and `{ error: { code, message } }` for failure.
- Require an explicit scope; never rely on a UI permission.
- Use decimal strings for money in API responses, not floats.
- Include `locationId`, `externalId` and `updatedSince` where sync is expected.
- Make writes idempotent by external id where possible.
- Never return another business's records; validate resource ownership explicitly.
- Document every new endpoint in `docs/api-reference/openapi.yaml`.
