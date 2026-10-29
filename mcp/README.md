# FinaFlow MCP server

Minimal Model Context Protocol server over the FinaFlow v1 API.

Full setup, client configuration and troubleshooting: **`/docs/mcp`** in the app, or
[`docs/mcp.md`](../docs/mcp.md) in the repository.

## Setup

1. Create an **MCP key** in FinaFlow: Settings → Integrations → MCP Server → Create MCP key.
2. Build the server:

```bash
cd mcp
npm install
cp .env.example .env
# edit FINAFLOW_API_KEY
npm run build
```

Run over stdio:

```bash
FINAFLOW_API_KEY=fna_... FINAFLOW_BASE_URL=https://finaflow.genius.africa npm run start
```

For local development, `npm run dev` uses `tsx`.

## Tools

Read: `verify_connection`, `get_business_profile`, `list_locations`, `list_accounts`,
`get_account`, `list_categories`, `list_suppliers`, `list_bills`, `get_bill`,
`list_bill_payments`, `list_expenses`, `list_daily_sales`, `get_daily_sale`,
`analyze_statements`, `list_statement_imports`, `get_statement_import`,
`analyze_statement_import`, `get_account_transactions`, `list_subscriptions`.

Write (all require `confirm: true`): `upsert_account`, `update_account`,
`upsert_category`, `archive_category`, `upsert_supplier`, `upsert_bill`,
`record_bill_payment`, `ingest_daily_sales`, `delete_daily_sale`,
`import_statements`, `link_statement_account`, `tag_statement_transactions`,
`link_transaction_to_bill`.

See `../docs/mcp-server.md` for the full design, resources, prompts, security and
tax-agent roadmap.

## Safety

- The API key stays in the server process; it is never returned to the model.
- Statement files are sent as base64 to the stateless analysis endpoint and are not
  persisted by FinaFlow.
- Write tools are financial operations. A client should require human confirmation
  before invoking them.
