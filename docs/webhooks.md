# Webhooks

FinaFlow supports both **incoming** and **outgoing** webhooks for real-time integration.

## Incoming webhooks

FinaFlow receives webhooks from partner systems (FinaBill, mobile wallet providers) to sync master data and transactions.

### FinaBill webhooks

**Endpoint**: `POST /api/v1/webhooks/finabill`

The request must include an `X-Fina-Signature` header containing an HMAC-SHA256 signature of the raw JSON body, computed with the shared webhook secret:

```
X-Fina-Signature: sha256=<hex-digest>
```

**Supported events**:

| Event | Description | Data fields |
|---|---|---|
| `coa.updated` | Chart of accounts entry synced | `name`, `externalId`, `accountCode`, `accountType`, `accountSubType` |
| `supplier.updated` | Supplier record synced | `name`, `externalId`, `email`, `phone`, `taxId` |

**Payload format**:
```json
{
  "event": "supplier.updated",
  "businessId": 123,
  "data": {
    "name": "Acme Supplies",
    "externalId": "SUP-001",
    "email": "acme@example.com"
  }
}
```

### Mobile wallet webhooks

**Endpoint**: `POST /api/v1/wallet-webhooks/{provider}`

Where `{provider}` is one of: `mpesa`, `airtel_money`, `sasapay`.

These endpoints receive transaction callbacks from mobile money providers. The raw request body and headers are forwarded to the registered provider handler for processing.

## Outgoing webhooks

FinaFlow dispatches webhooks to subscriber URLs when business events occur. Configure webhooks under **Settings > Integrations > Webhooks**.

### Event catalog

| Event | Trigger | Payload `data` fields |
|---|---|---|
| `sale.recorded` | Daily sales batch created | `dailySaleId`, `saleDate`, `netSales` |
| `expense.created` | Expense recorded | `expenseId`, `amount`, `accountId` |
| `bill.paid` | Bill payment recorded | `billId`, `paymentId`, `amount` |
| `coa.updated` | Account synced from partner | `name`, `externalId`, `accountCode`, `accountType` |
| `supplier.updated` | Supplier synced from partner | `name`, `externalId`, `email`, `phone`, `taxId` |
| `journal.created` | Journal entry posted | `journalEntryId`, `entryDate`, `totalDebit`, `totalCredit` |

### Delivery format

Each delivery is a POST request with:

```json
{
  "event": "sale.recorded",
  "timestamp": "2026-07-17T14:30:00.000Z",
  "data": {
    "dailySaleId": 42,
    "saleDate": "2026-07-17",
    "netSales": "21250.00"
  }
}
```

### Signature verification

Each delivery includes an `X-Fina-Signature` header:

```
X-Fina-Signature: sha256=<hex-digest>
```

To verify, compute `HMAC-SHA256(rawBody, webhookSecret)` and compare with the provided signature using a timing-safe comparison.

### Retry policy

Failed deliveries (non-2xx response or timeout) are retried up to **3 times** with exponential backoff:

| Attempt | Delay |
|---|---|
| 1 | Immediate |
| 2 | 1 second |
| 3 | 2 seconds |

All attempts (success and failure) are recorded in the `webhookDeliveries` table and visible in the UI under **Settings > Integrations > Webhooks > Deliveries**.

### Responding to webhooks

Return HTTP 200 to acknowledge receipt. Any non-2xx status code triggers a retry. Your handler should be idempotent — the same event may be delivered multiple times if retries occur.
