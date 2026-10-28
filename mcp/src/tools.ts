// ABOUTME: Registers FinaFlow v1 operations as MCP tools with validation and safe write confirmations.
// ABOUTME: Read tools mirror the API; write tools require an explicit confirm literal.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FinaFlowApiError, type FinaFlowClient } from "./client.js";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

function ok(data: unknown, text: string): ToolResult {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return {
      content: [{ type: "text", text }],
      structuredContent: data as Record<string, unknown>,
    };
  }
  return {
    content: [{ type: "text", text }],
    structuredContent: { data },
  };
}

function fail(error: unknown): ToolResult {
  if (error instanceof FinaFlowApiError) {
    return {
      isError: true,
      content: [{
        type: "text",
        text: `${error.code}: ${error.message}${error.requestId ? ` (request ${error.requestId})` : ""}`,
      }],
    };
  }
  return {
    isError: true,
    content: [{ type: "text", text: error instanceof Error ? error.message : "FinaFlow request failed." }],
  };
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

const confirm = z.literal(true).describe("Must be true. Confirms this write action.");

export function registerTools(server: McpServer, client: FinaFlowClient): void {
  server.registerTool("verify_connection", {
    title: "Verify FinaFlow connection",
    description: "Return the business identity and scopes for the configured API key.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, async () => {
    try {
      const data = await client.get<Record<string, unknown>>("/verify");
      return ok(data, "FinaFlow API key is valid.");
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("get_business_profile", {
    title: "Get business profile",
    description: "Read the business profile, currency and fiscal settings.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, async () => {
    try {
      const data = await client.get<Record<string, unknown>>("/business/profile");
      return ok(data, "Business profile loaded.");
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("list_locations", {
    title: "List locations",
    description: "List branches/locations for the business.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, async () => {
    try {
      const data = await client.get<unknown[]>("/locations");
      return ok(data, `${Array.isArray(data) ? data.length : 0} location(s).`);
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("list_accounts", {
    title: "List accounts and banks",
    description: "List accounts, including cash, wallet and bank accounts. Use type=bank_account for banks.",
    inputSchema: {
      accountType: z.string().optional().describe("Optional account type filter"),
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).optional(),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => {
    try {
      const data = await client.get<unknown[]>(`/accounts${query(args)}`);
      return ok(data, `${Array.isArray(data) ? data.length : 0} account(s).`);
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("get_account", {
    title: "Get account",
    description: "Read one account, including a bank account.",
    inputSchema: { id: z.number().int().positive() },
    annotations: { readOnlyHint: true },
  }, async ({ id }) => {
    try {
      const data = await client.get<Record<string, unknown>>(`/accounts/${id}`);
      return ok(data, `Account ${id} loaded.`);
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("list_categories", {
    title: "List categories",
    description: "List expense categories.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, async () => {
    try {
      const data = await client.get<unknown[]>("/categories");
      return ok(data, `${Array.isArray(data) ? data.length : 0} category(ies).`);
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("list_suppliers", {
    title: "List suppliers",
    description: "List suppliers.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, async () => {
    try {
      const data = await client.get<unknown[]>("/suppliers");
      return ok(data, `${Array.isArray(data) ? data.length : 0} supplier(s).`);
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("list_bills", {
    title: "List bills",
    description: "List bills with line items. Supports updatedSince and pagination.",
    inputSchema: {
      updatedSince: z.string().optional().describe("ISO timestamp cursor"),
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).optional(),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => {
    try {
      const data = await client.get<unknown[]>(`/bills${query(args)}`);
      return ok(data, `${Array.isArray(data) ? data.length : 0} bill(s).`);
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("get_bill", {
    title: "Get bill",
    description: "Read one bill with its line items, supplier and balance.",
    inputSchema: { id: z.number().int().positive() },
    annotations: { readOnlyHint: true },
  }, async ({ id }) => {
    try {
      const data = await client.get<Record<string, unknown>>(`/bills/${id}`);
      return ok(data, `Bill ${id} loaded.`);
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("list_bill_payments", {
    title: "List bill payments",
    description: "List recorded payments for a bill.",
    inputSchema: { billId: z.number().int().positive() },
    annotations: { readOnlyHint: true },
  }, async ({ billId }) => {
    try {
      const data = await client.get<unknown[]>(`/bills/${billId}/payments`);
      return ok(data, `${Array.isArray(data) ? data.length : 0} payment(s).`);
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("list_expenses", {
    title: "List expenses",
    description: "List expenses with category and bill linkage.",
    inputSchema: {
      updatedSince: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).optional(),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => {
    try {
      const data = await client.get<unknown[]>(`/expenses${query(args)}`);
      return ok(data, `${Array.isArray(data) ? data.length : 0} expense(s).`);
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("list_daily_sales", {
    title: "List daily sales",
    description: "List daily sales with payment channels. Filter by location, date range or source batch.",
    inputSchema: {
      locationId: z.number().int().positive().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      sourceBatchId: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).optional(),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => {
    try {
      const data = await client.get<unknown[]>(`/daily-sales${query(args)}`);
      return ok(data, `${Array.isArray(data) ? data.length : 0} daily sale(s).`);
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("get_daily_sale", {
    title: "Get daily sale",
    description: "Read one daily sales batch with payment channels.",
    inputSchema: { id: z.number().int().positive() },
    annotations: { readOnlyHint: true },
  }, async ({ id }) => {
    try {
      const data = await client.get<Record<string, unknown>>(`/daily-sales/${id}`);
      return ok(data, `Daily sale ${id} loaded.`);
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("analyze_statements", {
    title: "Analyze statements",
    description: "Parse one or more bank/M-PESA PDF or CSV statements in memory and return a consolidated, AI-ready analysis, report sheets and optional transactions.",
    inputSchema: {
      files: z.array(z.object({
        fileName: z.string(),
        contentBase64: z.string(),
        password: z.string().optional(),
      })).min(1).max(12),
      includeTransactions: z.boolean().optional(),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => {
    try {
      const data = await client.analyzeStatements(args);
      return ok(data, `Analysed ${String(data.fileCount ?? args.files.length)} statement(s), ${String(data.totalRowCount ?? "?")} rows.`);
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("list_statement_imports", {
    title: "List statement imports",
    description: "List stored statement imports for the business.",
    inputSchema: {
      provider: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).optional(),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => {
    try {
      const data = await client.get<{ items?: unknown[] }>(`/statements/imports${query(args)}`);
      return ok(data, `${data.items?.length ?? 0} import(s).`);
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("get_statement_import", {
    title: "Get statement import",
    description: "Read one stored statement import and a page of its transaction rows, including category and link state.",
    inputSchema: {
      id: z.number().int().positive(),
      limit: z.number().int().min(1).max(1000).optional(),
      offset: z.number().int().min(0).optional(),
    },
    annotations: { readOnlyHint: true },
  }, async ({ id, limit, offset }) => {
    try {
      const data = await client.get<Record<string, unknown>>(`/statements/imports/${id}${query({ limit, offset })}`);
      return ok(data, `Statement import ${id} loaded.`);
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("analyze_statement_import", {
    title: "Analyze a stored statement",
    description: "Rebuild the consolidated analysis, report sheets and coverage for an imported statement using its live categories and tags.",
    inputSchema: { importId: z.number().int().positive() },
    annotations: { readOnlyHint: true },
  }, async ({ importId }) => {
    try {
      const data = await client.get<Record<string, unknown>>(`/statements/imports/${importId}/analysis`);
      return ok(data, `Analysis for import ${importId} loaded.`);
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("tag_statement_transactions", {
    title: "Tag statement transactions",
    description: "Assign one expense category to up to 500 imported transactions. Set categoryId to null to clear the tag. Requires statements:write.",
    inputSchema: {
      transactionIds: z.array(z.number().int().positive()).min(1).max(500),
      categoryId: z.number().int().positive().nullable(),
      rememberMerchant: z.boolean().optional().describe("Learn a category rule from each merchant"),
      confirm,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async (args) => {
    try {
      const { confirm: _confirm, ...body } = args;
      const data = await client.post<Record<string, unknown>>("/statements/transactions/tag", body);
      return ok(data, "Transactions tagged.");
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("link_transaction_to_bill", {
    title: "Link transaction to bill",
    description: "Match an imported transaction to a bill. By default it records the link only; set postPayment=true to also post the payment through the accounting path.",
    inputSchema: {
      transactionId: z.number().int().positive(),
      billId: z.number().int().positive(),
      postPayment: z.boolean().optional(),
      categoryId: z.number().int().positive().optional(),
      confirm,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async (args) => {
    try {
      const { transactionId, confirm: _confirm, ...body } = args;
      const data = await client.post<Record<string, unknown>>(`/statements/transactions/${transactionId}/link-bill`, body);
      return ok(data, "Transaction linked to bill.");
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("get_account_transactions", {
    title: "Get account transactions",
    description: "List ledger entries for one money/bank account.",
    inputSchema: {
      accountId: z.number().int().positive(),
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).optional(),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => {
    try {
      const data = await client.get<unknown[]>(`/accounts/${args.accountId}/transactions${query({ limit: args.limit, offset: args.offset })}`);
      return ok(data, `${Array.isArray(data) ? data.length : 0} ledger entr(ies).`);
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("update_account", {
    title: "Update account",
    description: "Update an account name, number, status or payment-method flag. Requires accounts:write.",
    inputSchema: {
      id: z.number().int().positive(),
      name: z.string().optional(),
      accountCode: z.string().optional(),
      accountNumber: z.string().optional(),
      isActive: z.boolean().optional(),
      isPaymentMethod: z.boolean().optional(),
      confirm,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async (args) => {
    try {
      const { id, confirm: _confirm, ...body } = args;
      const data = await client.patch<Record<string, unknown>>(`/accounts/${id}`, body);
      return ok(data, "Account updated.");
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("archive_category", {
    title: "Archive category",
    description: "Archive an expense category. Requires categories:write.",
    inputSchema: { id: z.number().int().positive(), confirm },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async (args) => {
    try {
      const data = await client.delete<Record<string, unknown>>(`/categories/${args.id}`);
      return ok(data, "Category archived.");
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("delete_daily_sale", {
    title: "Delete daily sale",
    description: "Soft-delete a daily sales batch. Requires sales:write.",
    inputSchema: { id: z.number().int().positive(), confirm },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async (args) => {
    try {
      const data = await client.delete<Record<string, unknown>>(`/daily-sales/${args.id}`);
      return ok(data, "Daily sale deleted.");
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("link_statement_account", {
    title: "Link statement to bank account",
    description: "Link every imported row in a statement import to a bank account. Requires statements:write.",
    inputSchema: {
      importId: z.number().int().positive(),
      accountId: z.number().int().positive(),
      confirm,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async (args) => {
    try {
      const data = await client.post<Record<string, unknown>>(`/statements/imports/${args.importId}/link-account`, {
        accountId: args.accountId,
      });
      return ok(data, "Statement rows linked.");
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("import_statements", {
    title: "Import statements",
    description: "Parse and import one or more statement files into the wallet. Requires statements:write.",
    inputSchema: {
      locationId: z.number().int().positive(),
      batchLabel: z.string().optional(),
      files: z.array(z.object({
        fileName: z.string(),
        contentBase64: z.string(),
        password: z.string().optional(),
      })).min(1).max(12),
      confirm,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async (args) => {
    try {
      const { confirm: _confirm, ...body } = args;
      const data = await client.post<Record<string, unknown>>("/statements/import", body);
      return ok(data, "Statement import completed.");
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("upsert_bill", {
    title: "Create or update bill",
    description: "Create or update a purchase bill by externalId. Requires bills:write.",
    inputSchema: {
      externalId: z.string(),
      description: z.string(),
      amount: z.string(),
      issueDate: z.string(),
      dueDate: z.string(),
      status: z.enum(["draft", "received", "partial", "paid", "void"]),
      billNumber: z.string().optional(),
      amountPaid: z.string().optional(),
      locationId: z.number().int().positive().optional(),
      confirm,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async (args) => {
    try {
      const { confirm: _confirm, ...body } = args;
      const data = await client.post<Record<string, unknown>>("/bills", body);
      return ok(data, "Bill saved.");
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("list_subscriptions", {
    title: "List subscriptions",
    description: "List subscriptions.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, async () => {
    try {
      const data = await client.get<unknown[]>("/subscriptions");
      return ok(data, `${Array.isArray(data) ? data.length : 0} subscription(s).`);
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("upsert_account", {
    title: "Create or update account",
    description: "Create or update a chart-of-accounts entry. Requires accounts:write.",
    inputSchema: {
      externalId: z.string(),
      name: z.string(),
      accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
      accountSubType: z.string().optional(),
      accountCode: z.string().optional(),
      description: z.string().optional(),
      confirm,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async (args) => {
    try {
      const { confirm: _confirm, ...body } = args;
      const data = await client.post<Record<string, unknown>>("/accounts", body);
      return ok(data, "Account saved.");
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("upsert_category", {
    title: "Create or update category",
    description: "Create or update an expense category. Requires categories:write.",
    inputSchema: {
      name: z.string(),
      externalId: z.string().optional(),
      description: z.string().optional(),
      color: z.string().optional(),
      accountingClass: z.enum(["cogs", "operating_expense", "admin_expense", "marketing", "depreciation", "other"]).optional(),
      confirm,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async (args) => {
    try {
      const { confirm: _confirm, ...body } = args;
      const data = await client.post<Record<string, unknown>>("/categories", body);
      return ok(data, "Category saved.");
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("upsert_supplier", {
    title: "Create or update supplier",
    description: "Create or update a supplier. Requires suppliers:write.",
    inputSchema: {
      name: z.string(),
      externalId: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      confirm,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async (args) => {
    try {
      const { confirm: _confirm, ...body } = args;
      const data = await client.post<Record<string, unknown>>("/suppliers", body);
      return ok(data, "Supplier saved.");
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("record_bill_payment", {
    title: "Record bill payment",
    description: "Record a bill payment. Requires bills:write. This is a financial write.",
    inputSchema: {
      billId: z.number().int().positive(),
      paymentMethod: z.enum(["cash", "wallet", "bank_transfer", "card"]),
      amount: z.string(),
      paymentDate: z.string(),
      reference: z.string().optional(),
      notes: z.string().optional(),
      accountId: z.number().int().positive().optional(),
      categoryId: z.number().int().positive().optional().describe("Expense category for bills that have none"),
      confirm,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async (args) => {
    try {
      const { billId, confirm: _confirm, ...body } = args;
      const data = await client.post<Record<string, unknown>>(`/bills/${billId}/payments`, body);
      return ok(data, "Bill payment recorded.");
    } catch (error) {
      return fail(error);
    }
  });

  server.registerTool("ingest_daily_sales", {
    title: "Ingest daily sales",
    description: "Create an idempotent daily sales batch. Requires sales:write.",
    inputSchema: {
      locationId: z.number().int().positive(),
      saleDate: z.string(),
      sourceSystem: z.string(),
      sourceBatchId: z.string(),
      payments: z.array(z.object({ channel: z.string(), amount: z.string() })),
      confirm,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async (args) => {
    try {
      const { confirm: _confirm, ...body } = args;
      const data = await client.post<Record<string, unknown>>("/daily-sales", body);
      return ok(data, "Daily sales ingested.");
    } catch (error) {
      return fail(error);
    }
  });
}
