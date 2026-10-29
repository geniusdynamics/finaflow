# FinaFlow MCP server

The FinaFlow MCP server connects AI clients such as Claude Desktop, Cursor and OpenCode to your FinaFlow business over the v1 REST API. It exposes **32 tools** for reading books, analysing statements, tagging transactions and recording confirmed writes.

Everything runs locally: the MCP server is a small Node process that calls your FinaFlow instance. Your API key stays in the client configuration and is never sent anywhere except FinaFlow.

## 1. Create an API key

1. Sign in to FinaFlow.
2. Open **Settings → Integrations**.
3. Click **Create MCP key** in the MCP Server card, or **New Key → MCP server**.
4. Copy the key immediately. It starts with `fna_` and is shown once.

The MCP preset grants these scopes:

- `business:read`, `locations:read`
- `accounts:read`, `accounts:write`
- `suppliers:read`, `suppliers:write`
- `categories:read`, `categories:write`
- `bills:read`, `bills:write`
- `expenses:read`
- `sales:read`, `sales:write`
- `statements:read`, `statements:write`
- `subscriptions:read`

You can create a narrower custom key if you only need read tools. A key without `statements:read` cannot analyse statements, and one without `statements:write` cannot tag or link them.

## 2. Build the server

From the FinaFlow repository:

```bash
cd mcp
npm install
cp .env.example .env
# edit FINAFLOW_API_KEY in .env for local runs
npm run build
```

This produces `mcp/dist/index.js`. Use its absolute path in the client configuration.
The `.env` file is loaded automatically by `npm run dev` and `npm run start` from the
`mcp/` directory; clients that launch `node dist/index.js` directly must pass the
environment block themselves.

The server needs two environment variables:

| Variable | Required | Example | Purpose |
| --- | --- | --- | --- |
| `FINAFLOW_BASE_URL` | Yes | `https://finaflow.genius.africa` | FinaFlow instance, without `/api/v1` |
| `FINAFLOW_API_KEY` | Yes | `fna_...` | Key created in step 1 |
| `FINAFLOW_TIMEOUT_MS` | No | `60000` | Request timeout in milliseconds |

## 3. Configure your client

### Claude Desktop

Edit `claude_desktop_config.json`:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "finaflow": {
      "command": "node",
      "args": ["/absolute/path/to/finaflow/mcp/dist/index.js"],
      "env": {
        "FINAFLOW_BASE_URL": "https://finaflow.genius.africa",
        "FINAFLOW_API_KEY": "fna_your_key_here"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

### Cursor

Create `.cursor/mcp.json` in the project or `~/.cursor/mcp.json` globally:

```json
{
  "mcpServers": {
    "finaflow": {
      "command": "node",
      "args": ["/absolute/path/to/finaflow/mcp/dist/index.js"],
      "env": {
        "FINAFLOW_BASE_URL": "https://finaflow.genius.africa",
        "FINAFLOW_API_KEY": "fna_your_key_here"
      }
    }
  }
}
```

### OpenCode

Add the server to `opencode.jsonc`. Keep the key in your environment rather than in the file:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "finaflow": {
        "type": "local",
        "command": ["node", "/absolute/path/to/finaflow/mcp/dist/index.js"],
        "environment": {
          "FINAFLOW_BASE_URL": "https://finaflow.genius.africa",
          "FINAFLOW_API_KEY": "{env:FINAFLOW_API_KEY}"
        }
      }
    }
  }
}
```

Then set `FINAFLOW_API_KEY` in your shell and run `opencode mcp list` to confirm the server connects.

### Other MCP clients

Use the stdio transport with this command and environment:

```text
command: node /absolute/path/to/finaflow/mcp/dist/index.js
env:     FINAFLOW_BASE_URL=https://finaflow.genius.africa
         FINAFLOW_API_KEY=fna_...
```

## 4. Verify it works

Ask the client to run these tools in order:

1. `verify_connection` — confirms the key and shows the business id and scopes.
2. `get_business_profile` — returns the business profile and currency.
3. `list_locations` — returns the branches.
4. `list_statement_imports` — returns uploaded statements.

If `verify_connection` fails, the server is running but the key or URL is wrong. Check the error code:

- `401` — key missing, revoked, expired or not prefixed with `fna_`.
- `403` — key is valid but lacks the required scope.
- Network error — `FINAFLOW_BASE_URL` is wrong, unreachable, or includes a trailing `/api/v1`.

You can also inspect the tool catalog without a client:

```bash
cd mcp
FINAFLOW_BASE_URL=https://finaflow.genius.africa FINAFLOW_API_KEY=fna_... npm run dev
```

The process prints `[finaflow-mcp] Connected over stdio` when it starts. It waits for MCP messages on stdin; that is expected.

## 5. Useful tools

| Tool | What it does |
| --- | --- |
| `analyze_statements` | Parse one or more statement PDFs/CSVs in memory and return the consolidated analysis |
| `analyze_statement_import` | Rebuild the report for an already-imported statement using live categories |
| `list_statement_imports` | List stored imports |
| `get_statement_import` | Read an import and a page of its rows, including category and link state |
| `tag_statement_transactions` | Assign one category to up to 500 rows |
| `link_transaction_to_bill` | Match a row to a bill; optionally post the payment |
| `list_categories`, `list_accounts`, `list_suppliers` | Reference data for tagging and matching |
| `list_bills`, `get_bill`, `list_bill_payments` | Payables context |
| `record_bill_payment` | Post a confirmed bill payment |
| `ingest_daily_sales` | Push a daily sales batch |

Read tools are safe. Write tools require `confirm: true` and should be approved by a person before the client sends them.

## 6. Example prompts

- "Verify the FinaFlow connection and list my locations."
- "Analyse these two KCB statements and show monthly cash flow, all cash withdrawals and the top counterparties."
- "Tag all fuel transactions in the latest import to the Fuel category."
- "Find unpaid bills and link the matching bank payments. Do not post a payment unless I confirm."
- "Which statement transactions are still uncategorised? Suggest a category and confidence for each."

## 7. Safety

- Use a dedicated key named for the MCP client and revoke it when you stop using that client.
- Prefer the MCP preset over an admin or broad legacy key.
- `link_transaction_to_bill` records the match only unless `postPayment: true`; that flag posts a real payment and expense.
- The server does not store statement files. `analyze_statements` sends them to FinaFlow's stateless analysis endpoint and returns the result.
- Rotate the key immediately if it is pasted into a shared document or chat.

## 8. Troubleshooting

**The client cannot start the server.** Use an absolute path to `dist/index.js`, confirm `node --version` is 20 or newer, and run `npm run build` again after pulling changes.

**`Missing FINAFLOW_BASE_URL` or `Missing FINAFLOW_API_KEY`.** The client did not pass the environment block. Check the `env` or `environment` field.

**`401 Invalid API key`.** The key was copied with a trailing space, revoked, or belongs to another environment. Create a new key.

**`403 API key missing required scope`.** Edit the key's scopes or create an MCP key with the preset.

**Statement tools return an empty analysis.** Confirm the import has rows and the key has `statements:read`. For a fresh upload, use `analyze_statements`; for a stored import, use `analyze_statement_import`.

**Writes are rejected.** Write tools require the relevant `:write` scope and `confirm: true` in the tool arguments.
