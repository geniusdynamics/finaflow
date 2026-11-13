// ABOUTME: FinaFlow MCP server entrypoint over stdio.
// ABOUTME: Requires FINAFLOW_API_KEY and FINAFLOW_BASE_URL; no database or statement files are stored.

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FinaFlowClient } from "./client.js";
import { registerTools } from "./tools.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[finaflow-mcp] Missing ${name}. Set it in the MCP server environment.`);
    process.exit(1);
  }
  return value;
}

const client = new FinaFlowClient({
  baseUrl: required("FINAFLOW_BASE_URL"),
  apiKey: required("FINAFLOW_API_KEY"),
  timeoutMs: Number(process.env.FINAFLOW_TIMEOUT_MS ?? 60_000),
});

const server = new McpServer({
  name: "finaflow",
  version: "0.1.0",
});

registerTools(server, client);

await server.connect(new StdioServerTransport());
console.error("[finaflow-mcp] Connected over stdio.");
