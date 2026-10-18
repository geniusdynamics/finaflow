# Statement Import API & Formats

FinaFlow parses statement files in memory and stores only the resulting ledger rows, import metadata and an
analysis snapshot. **The original file and its password are never stored.**

## Supported today

| Provider | Format | Notes |
| --- | --- | --- |
| M-PESA | PDF (personal) | Password-protected, 77-page / 2,371-row real statement validated |
| M-PESA | PDF (paybill owner) | Captures Transaction Type + Other Party; awaiting a real sample for sign-off |
| M-PESA | CSV | M-PESA statement CSV export (Receipt No, Completion Time, Details, Status, Paid In, Withdrawn, Balance) |
| M-PESA | XLSX | Planned; export the statement as PDF or CSV today |

Limits: 10 MB per file, 300 pages, 12 files per batch, 20 parse/import requests per minute per IP.

## Authentication

All endpoints use an API key:

```
Authorization: Bearer fna_...
```

Scopes:

| Scope | Allows |
| --- | --- |
| `statements:write` | parse, analyze, import |
| `statements:read` | list imports, read one, export |

Create keys with the required scopes in **Settings → API keys** (or the admin API). A key with only
`statements:read` cannot import.

## Endpoints

Base URL: `/api/v1`.

### POST `/statements/parse`

Parses and returns a preview without writing anything. Accepts a password-protected M-PESA PDF or an
M-PESA CSV export (multipart `file=@...` or JSON `contentBase64`).

```bash
curl -X POST https://your-host/api/v1/statements/parse \
  -H "Authorization: Bearer fna_..." \
  -F "file=@statement.pdf" \
  -F "password=244244" \
  -F "locationId=1"
```

JSON alternative:

```json
{
  "fileName": "statement.pdf",
  "contentBase64": "<base64>",
  "password": "244244",
  "locationId": 1
}
```

The response contains `metadata`, `totals`, `statementSummary`, `warnings`, up to 200 preview `rows`, and the
full `analysis` object (summary, balance continuity, categories, fees, contacts, recurring, monthly/weekly,
distribution, time of day, day of week, reversals, pay bills & tills, anomalies, reconciliation).

### POST `/statements/analyze`

Same input as `/parse`; returns only `{ provider, kind, period, totals, statementSummary, warnings, analysis }`.

### POST `/statements/import`

```json
{
  "locationId": 1,
  "batchLabel": "Client January–June",
  "files": [
    {
      "fileName": "jan.pdf",
      "contentBase64": "<base64>",
      "password": "244244"
    }
  ]
}
```

Each file is parsed again server-side and inserted in its own transaction. Rows whose receipt already exists
are skipped and reported as `duplicates`. The response is per file:

```json
{
  "batchRef": "…",
  "files": [
    {
      "importId": 12,
      "fileName": "jan.pdf",
      "status": "imported",
      "rowCount": 2371,
      "imported": 2371,
      "skipped": 0,
      "duplicates": 0,
      "excluded": 0,
      "warnings": [],
      "totals": { "rowCount": 2371, "totalIn": "786098.76", "totalOut": "782565.53", "totalFees": "5272.74" }
    }
  ]
}
```

Status is `202` when at least one file failed; inspect each file's `code`/`error`.

### GET `/statements/imports`

Query: `locationId`, `provider`, `batchRef`, `limit` (1–100), `offset`.

### GET `/statements/imports/{id}`

Returns the import record, its analysis snapshot and up to 500 rows (query `limit`/`offset`).

### GET `/statements/imports/{id}/export`

Query: `format=csv|xlsx|json`, plus CSV options `excludeCharges`, `sortOrder=asc|desc`,
`dateFormat=iso|dd-mmm-yyyy|dd/mm/yyyy`, `maskPii`.

Returns the file with `Content-Disposition: attachment`.

CSV contract:

- UTF-8 **with BOM**, RFC-4180 quoting, CRLF rows.
- Default columns: `Receipt No, Completion Time, Details, Transaction Status, Paid In, Withdrawn, Balance`.
- Paybill imports append `Transaction Type, Other Party`.
- Amounts are plain (`1234.50`), not currency-formatted.

JSON contract: `{ meta, totals, transactions, analysis }`.
XLSX: Main Transactions plus Summary, Money In/Out, Charges, Reversals, Daily Balance, Monthly & Weekly,
Distribution, Top Contacts, Recurring, Time of Day, Day of Week, Pay Bills & Tills, Categories, Anomalies.

## Errors

| Code | Meaning |
| --- | --- |
| `INVALID_FILE` | Not a PDF, empty file, or not a recognised statement |
| `PASSWORD_REQUIRED` | The PDF needs a password |
| `PASSWORD_INCORRECT` | Wrong password; retry |
| `NO_TEXT_LAYER` | Scanned image PDF; OCR is not supported |
| `TOO_MANY_PAGES` | Over 300 pages or too much text |
| `FILE_TOO_LARGE` | Over 10 MB decoded |
| `UNSUPPORTED_STATEMENT` | Format/layout not recognised (includes CSV/XLSX today) |
| `PARSE_FAILED` | Unexpected extraction failure |

## Analysis notes

- **Reconciliation** compares the parsed totals with Safaricom's own SUMMARY block. Grand totals match to
  the cent on the validated sample; per-rail differences are informational because Safaricom's buckets do not
  map 1:1.
- **Balance continuity** is a diagnostic. Charge/Fuliza legs and same-receipt rows explain most gaps; the UI
  shows “steps reconcile / bundle legs / to review”, never “corrupt statement”.
- **Categorisation** is best effort. Fees, withdrawals, airtime, loans, utilities, food, fuel and transport
  resolve to existing business categories; unmatched rows stay **uncategorised**. Learned merchant rules
  (`wallet_category_rules`) can be created from the app and apply to future imports.
- **Fees** are charge rows. They are excluded from operating outflows and reported separately; the wallet
  summary and daily ledger follow the same rule.
