// ABOUTME: Integration tests for the v1 statement REST API: API-key scopes, tenant isolation and exports.
// ABOUTME: Creates imports through the service so no real PDF is needed.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import {
  apiKeys,
  accounts,
  bills,
  businesses,
  expenseCategories,
  locations,
  mobileWalletProviders,
  mobileWalletTransactions,
  statementImports,
  userBusinesses,
  users,
  walletCategoryRules,
} from "@db/schema";
import { generateApiKey, getKeyPrefix, hashApiKey } from "../lib/api-key-auth";
import type { ApiKeyVariables } from "../lib/api-key-middleware";
import statementsV1 from "../routes/v1/statements";
import accountsV1 from "../routes/v1/accounts";
import { parseMpesaStatement } from "@shared/statements/parsers/mpesa";
import { syntheticMpesaDocument } from "@shared/statements/__fixtures__/synthetic";
import { buildStatementCsv } from "@shared/statements/export/csv";
import { loadCategoryContext } from "../lib/statements/categories";
import { persistParsedFile } from "../lib/statements/service";

async function createKey(businessId: number, name: string, scopes: string[]): Promise<string> {
  const db = getDb();
  const raw = generateApiKey();
  await db
    .insert(apiKeys)
    .values({
      businessId,
      name,
      keyHash: await hashApiKey(raw, 4),
      keyPrefix: getKeyPrefix(raw),
      scopes,
    } as never)
    .returning();
  return raw;
}

function auth(key: string) {
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

describe("v1 statements REST API", () => {
  const db = getDb();
  let bizA: typeof businesses.$inferSelect;
  let bizB: typeof businesses.$inferSelect;
  let locA: typeof locations.$inferSelect;
  let locB: typeof locations.$inferSelect;
  let readKeyA = "";
  let writeKeyA = "";
  let readKeyB = "";
  let accountsKeyA = "";
  let bankAccountId = 0;
  let importId = 0;
  let feeCategoryId = 0;
  let taggedTxnId = 0;
  let billId = 0;
  let app: Hono<{ Variables: ApiKeyVariables }>;

  beforeAll(async () => {
    for (const prefix of ["STMTV1_A", "STMTV1_B"]) {
      const existing = await db.select({ id: businesses.id }).from(businesses).where(sql`${businesses.slug} LIKE ${prefix + "%"}`);
      for (const row of existing) {
        const bizLocations = await db.select({ id: locations.id }).from(locations).where(eq(locations.businessId, row.id));
        for (const location of bizLocations) {
          await db.delete(mobileWalletTransactions).where(eq(mobileWalletTransactions.locationId, location.id));
        }
        await db.delete(statementImports).where(eq(statementImports.businessId, row.id));
        await db.delete(walletCategoryRules).where(eq(walletCategoryRules.businessId, row.id));
        await db.delete(expenseCategories).where(eq(expenseCategories.businessId, row.id));
        await db.delete(apiKeys).where(eq(apiKeys.businessId, row.id));
        await db.delete(userBusinesses).where(eq(userBusinesses.businessId, row.id));
        await db.delete(locations).where(eq(locations.businessId, row.id));
        await db.delete(businesses).where(eq(businesses.id, row.id));
      }
    }

    [bizA] = await db.insert(businesses).values({ accountId: "STMTV1_A", name: "Statement V1 A", slug: "STMTV1_A_main", plan: "pro", isActive: true } as never).returning();
    [bizB] = await db.insert(businesses).values({ accountId: "STMTV1_B", name: "Statement V1 B", slug: "STMTV1_B_main", plan: "pro", isActive: true } as never).returning();
    [locA] = await db.insert(locations).values({ businessId: bizA.id, name: "V1 Statement A", slug: "stmtv1-a", isActive: true } as never).returning();
    [locB] = await db.insert(locations).values({ businessId: bizB.id, name: "V1 Statement B", slug: "stmtv1-b", isActive: true } as never).returning();
    const [bankAccount] = (await db.insert(accounts).values({
      businessId: bizA.id,
      locationId: locA.id,
      name: "V1 Bank Account",
      type: "bank_account",
      accountNumber: "0011223344",
      currentBalance: "0.00",
      isActive: true,
    }).returning()) as Array<typeof accounts.$inferSelect>;
    bankAccountId = bankAccount.id;

    const [owner] = await db.insert(users).values({ username: "stmt-v1-owner", name: "V1 Owner", role: "owner", isActive: true, currentBusinessId: bizA.id } as never).returning();
    await db.insert(userBusinesses).values({ userId: owner.id, businessId: bizA.id, role: "owner", isActive: true } as never);

    await db.insert(mobileWalletProviders).values({ code: "mpesa", name: "M-PESA", displayName: "M-PESA", supportedCurrencies: "KES", isActive: true } as never).onConflictDoNothing();
    const [fees] = await db.insert(expenseCategories).values({ businessId: bizA.id, locationId: locA.id, name: "Bank Charges & Fees", isActive: true } as never).returning();

    readKeyA = await createKey(bizA.id, "Statement read A", ["statements:read"]);
    writeKeyA = await createKey(bizA.id, "Statement write A", ["statements:write"]);
    readKeyB = await createKey(bizB.id, "Statement read B", ["statements:read"]);
    accountsKeyA = await createKey(bizA.id, "Accounts A", ["accounts:read", "accounts:write"]);

    const parsed = parseMpesaStatement(syntheticMpesaDocument());
    const context = await loadCategoryContext(bizA.id, locA.id, "mpesa");
    const created = await persistParsedFile({
      businessId: bizA.id,
      locationId: locA.id,
      userId: owner.id,
      file: { fileName: "v1-statement.pdf", bytes: new Uint8Array() },
      parsedFile: {
        parsed,
        fileName: "v1-statement.pdf",
        fileHash: "v1-hash",
        fileSize: 1024,
        passwordProtected: false,
        sourceType: "pdf",
      },
      context,
      batchRef: null,
    });
    importId = created.importId!;
    expect(importId).toBeGreaterThan(0);
    expect(fees.id).toBeGreaterThan(0);
    feeCategoryId = fees.id;

    app = new Hono<{ Variables: ApiKeyVariables }>();
    app.route("/statements", statementsV1);
    app.route("/accounts", accountsV1);
  });

  afterAll(async () => {
    await db.delete(mobileWalletTransactions).where(eq(mobileWalletTransactions.locationId, locA.id));
    await db.delete(mobileWalletTransactions).where(eq(mobileWalletTransactions.locationId, locB.id));
    await db.delete(statementImports).where(eq(statementImports.businessId, bizA.id));
    await db.delete(walletCategoryRules).where(eq(walletCategoryRules.businessId, bizA.id));
    await db.delete(bills).where(eq(bills.businessId, bizA.id));
    await db.delete(expenseCategories).where(eq(expenseCategories.businessId, bizA.id));
    await db.delete(apiKeys).where(eq(apiKeys.businessId, bizA.id));
    await db.delete(apiKeys).where(eq(apiKeys.businessId, bizB.id));
    await db.delete(accounts).where(eq(accounts.businessId, bizA.id));
    await db.delete(userBusinesses).where(eq(userBusinesses.businessId, bizA.id));
    await db.delete(locations).where(eq(locations.businessId, bizA.id));
    await db.delete(locations).where(eq(locations.businessId, bizB.id));
    await db.delete(users).where(sql`${users.username} = 'stmt-v1-owner'`);
    await db.delete(businesses).where(eq(businesses.id, bizA.id));
    await db.delete(businesses).where(eq(businesses.id, bizB.id));
  });

  it("lists and reads imports with the read scope", async () => {
    const list = await app.request("/statements/imports", { headers: auth(readKeyA) });
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as { data: { items: Array<{ id: number }>; total: number } };
    expect(listBody.data.items.some((item) => item.id === importId)).toBe(true);

    const detail = await app.request(`/statements/imports/${importId}`, { headers: auth(readKeyA) });
    expect(detail.status).toBe(200);
    const detailBody = (await detail.json()) as { data: { totalRows: number; import: { analysis: unknown } } };
    expect(detailBody.data.totalRows).toBe(5);
    expect(detailBody.data.import.analysis).toBeTruthy();
  });

  it("exports CSV with a UTF-8 BOM", async () => {
    const response = await app.request(`/statements/imports/${importId}/export?format=csv`, {
      headers: auth(readKeyA),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toContain("UG12KA80PR");
  });

  it("requires the matching scope", async () => {
    const list = await app.request("/statements/imports", { headers: auth(writeKeyA) });
    expect(list.status).toBe(403);
  });

  it("isolates tenants", async () => {
    const list = await app.request("/statements/imports", { headers: auth(readKeyB) });
    expect(list.status).toBe(200);
    const body = (await list.json()) as { data: { items: unknown[]; total: number } };
    expect(body.data.items).toHaveLength(0);

    const detail = await app.request(`/statements/imports/${importId}`, { headers: auth(readKeyB) });
    expect(detail.status).toBe(404);
  });

  it("parses an M-PESA CSV export", async () => {
    const parsed = parseMpesaStatement(syntheticMpesaDocument());
    const csv = buildStatementCsv(
      parsed.rows.map((row) => ({
        receiptNo: row.groupId,
        date: row.date,
        time: row.time,
        details: row.details,
        status: row.status,
        paidIn: row.paidIn,
        withdrawn: row.withdrawn,
        balance: row.balance,
        direction: row.direction,
        txnType: row.txnType,
        rail: row.rail,
        groupId: row.groupId,
        counterpartyName: row.counterpartyName,
      })),
      { sortOrder: "asc" },
    );

    const response = await app.request("/statements/parse", {
      method: "POST",
      headers: auth(writeKeyA),
      body: JSON.stringify({
        fileName: "statement.csv",
        contentBase64: Buffer.from(`\uFEFF${csv}`, "utf8").toString("base64"),
        locationId: locA.id,
      }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { sourceType: string; rowsTotal: number; totals: { totalIn: string; totalOut: string } };
    };
    expect(body.data.sourceType).toBe("csv");
    expect(body.data.rowsTotal).toBe(5);
    expect(body.data.totals).toMatchObject({ totalIn: "1751.37", totalOut: "657.00" });
  });

  it("returns a consolidated AI-ready analysis with report sheets", async () => {
    const parsed = parseMpesaStatement(syntheticMpesaDocument());
    const csv = buildStatementCsv(
      parsed.rows.map((row) => ({
        receiptNo: row.groupId,
        date: row.date,
        time: row.time,
        details: row.details,
        status: row.status,
        paidIn: row.paidIn,
        withdrawn: row.withdrawn,
        balance: row.balance,
        direction: row.direction,
        txnType: row.txnType,
        rail: row.rail,
        groupId: row.groupId,
        counterpartyName: row.counterpartyName,
      })),
      { sortOrder: "asc" },
    );
    const contentBase64 = Buffer.from(`\uFEFF${csv}`, "utf8").toString("base64");

    const response = await app.request("/statements/analyze/full", {
      method: "POST",
      headers: auth(readKeyA),
      body: JSON.stringify({
        files: [
          { fileName: "first.csv", contentBase64 },
          { fileName: "duplicate.csv", contentBase64 },
        ],
        includeTransactions: true,
      }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: {
        schemaVersion: string;
        analysis: { summary: { totalIn: string; totalOut: string }; balance?: unknown };
        coverage: Array<{ fileName: string }>;
        sheets: Array<{ name: string; columns: string[]; rows: unknown[][] }>;
        transactions: Array<{ externalId: string }>;
        duplicateRows: number;
      };
    };
    expect(body.data.schemaVersion).toBe("2026-10-28");
    expect(body.data.analysis.summary.totalIn).toBe("1751.37");
    expect(body.data.analysis.summary.totalOut).toBe("657.00");
    expect(body.data.analysis.balance).toBeUndefined();
    expect(body.data.coverage).toHaveLength(2);
    expect(body.data.duplicateRows).toBe(5);
    expect(body.data.transactions).toHaveLength(5);
    expect(body.data.sheets.some((sheet) => sheet.name === "Money In - Exact")).toBe(true);
    expect(body.data.sheets.some((sheet) => sheet.name === "Monthly")).toBe(true);

    const forbidden = await app.request("/statements/analyze/full", {
      method: "POST",
      headers: auth(writeKeyA),
      body: JSON.stringify({ files: [{ fileName: "first.csv", contentBase64 }] }),
    });
    expect(forbidden.status).toBe(403);
  });

  it("accepts multipart statement uploads for the public analysis endpoint", async () => {
    const parsed = parseMpesaStatement(syntheticMpesaDocument());
    const csv = buildStatementCsv(
      parsed.rows.map((row) => ({
        receiptNo: row.groupId,
        date: row.date,
        time: row.time,
        details: row.details,
        status: row.status,
        paidIn: row.paidIn,
        withdrawn: row.withdrawn,
        balance: row.balance,
        direction: row.direction,
        txnType: row.txnType,
        rail: row.rail,
        groupId: row.groupId,
        counterpartyName: row.counterpartyName,
      })),
      { sortOrder: "asc" },
    );
    const form = new FormData();
    form.set("files", new File([`\uFEFF${csv}`], "statement.csv", { type: "text/csv" }));
    form.set("includeTransactions", "true");

    const response = await app.request("/statements/analyze/full", {
      method: "POST",
      headers: { Authorization: `Bearer ${readKeyA}` },
      body: form,
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { files: Array<{ fileName: string }>; transactions: unknown[] } };
    expect(body.data.files[0].fileName).toBe("statement.csv");
    expect(body.data.transactions).toHaveLength(5);
  });

  it("links statement rows to a bank account and exposes account detail/update", async () => {
    const link = await app.request(`/statements/imports/${importId}/link-account`, {
      method: "POST",
      headers: auth(writeKeyA),
      body: JSON.stringify({ accountId: bankAccountId }),
    });
    expect(link.status).toBe(200);
    const linkBody = (await link.json()) as { data: { linked: number } };
    expect(linkBody.data.linked).toBe(5);

    const rows = await db
      .select({ sourceAccountId: mobileWalletTransactions.sourceAccountId })
      .from(mobileWalletTransactions)
      .where(eq(mobileWalletTransactions.statementImportId, importId));
    expect(rows.every((row) => row.sourceAccountId === bankAccountId)).toBe(true);

    const detail = await app.request(`/accounts/${bankAccountId}`, { headers: auth(accountsKeyA) });
    expect(detail.status).toBe(200);
    const detailBody = (await detail.json()) as { data: { name: string; type: string } };
    expect(detailBody.data).toMatchObject({ name: "V1 Bank Account", type: "bank_account" });

    const update = await app.request(`/accounts/${bankAccountId}`, {
      method: "PATCH",
      headers: auth(accountsKeyA),
      body: JSON.stringify({ name: "V1 Bank Account Updated" }),
    });
    expect(update.status).toBe(200);
    const updateBody = (await update.json()) as { data: { name: string } };
    expect(updateBody.data.name).toBe("V1 Bank Account Updated");
  });

  it("tags transactions and rebuilds the stored analysis from live categories", async () => {
    const [txn] = await db
      .select({ id: mobileWalletTransactions.id })
      .from(mobileWalletTransactions)
      .where(eq(mobileWalletTransactions.statementImportId, importId))
      .limit(1);
    taggedTxnId = txn.id;

    const tag = await app.request("/statements/transactions/tag", {
      method: "POST",
      headers: auth(writeKeyA),
      body: JSON.stringify({ transactionIds: [taggedTxnId], categoryId: feeCategoryId }),
    });
    expect(tag.status).toBe(200);
    const tagBody = (await tag.json()) as { data: { updated: number; missing: number[] } };
    expect(tagBody.data).toMatchObject({ updated: 1, missing: [] });

    const analysis = await app.request(`/statements/imports/${importId}/analysis`, { headers: auth(readKeyA) });
    expect(analysis.status).toBe(200);
    const analysisBody = (await analysis.json()) as {
      data: {
        analysis: { summary: { rowCount: number }; categories: Array<{ categoryId: number | null; count: number }> };
        sheets: Array<{ name: string }>;
        files: Array<{ fileName: string; totalIn: string }>;
      };
    };
    expect(analysisBody.data.analysis.summary.rowCount).toBe(5);
    expect(analysisBody.data.sheets.length).toBeGreaterThan(0);
    expect(analysisBody.data.files[0].fileName).toBe("v1-statement.pdf");
    expect(
      analysisBody.data.analysis.categories.some((category) => category.categoryId === feeCategoryId && category.count > 0),
    ).toBe(true);

    const clear = await app.request(`/statements/transactions/${taggedTxnId}/category`, {
      method: "PATCH",
      headers: auth(writeKeyA),
      body: JSON.stringify({ categoryId: null }),
    });
    expect(clear.status).toBe(200);
    const cleared = await db
      .select({ categoryId: mobileWalletTransactions.categoryId, source: mobileWalletTransactions.classificationSource })
      .from(mobileWalletTransactions)
      .where(eq(mobileWalletTransactions.id, taggedTxnId));
    expect(cleared[0]).toMatchObject({ categoryId: null, source: "none" });
  });

  it("links a statement transaction to a bill without posting a second payment", async () => {
    const [bill] = (await db
      .insert(bills)
      .values({
        businessId: bizA.id,
        locationId: locA.id,
        description: "Stationery",
        amount: "100.00",
        amountPaid: "0.00",
        balanceDue: "100.00",
        issueDate: "2026-10-01",
        dueDate: "2026-10-31",
        status: "pending",
        categoryId: feeCategoryId,
      } as never)
      .returning()) as Array<typeof bills.$inferSelect>;
    billId = bill.id;

    const link = await app.request(`/statements/transactions/${taggedTxnId}/link-bill`, {
      method: "POST",
      headers: auth(writeKeyA),
      body: JSON.stringify({ billId }),
    });
    expect(link.status).toBe(200);
    const linkBody = (await link.json()) as {
      data: { transaction: { isLinked: boolean; linkedBillId: number }; payment: null };
    };
    expect(linkBody.data.transaction).toMatchObject({ isLinked: true, linkedBillId: billId });
    expect(linkBody.data.payment).toBeNull();

    const [stored] = await db
      .select({ isLinked: mobileWalletTransactions.isLinked, linkedBillId: mobileWalletTransactions.linkedBillId })
      .from(mobileWalletTransactions)
      .where(eq(mobileWalletTransactions.id, taggedTxnId));
    expect(stored).toMatchObject({ isLinked: true, linkedBillId: billId });
  });

  it("rejects invalid parse and import payloads", async () => {
    const parse = await app.request("/statements/parse", {
      method: "POST",
      headers: auth(writeKeyA),
      body: JSON.stringify({ fileName: "nope.pdf", contentBase64: "bm90LWEtcGRm" }),
    });
    expect(parse.status).toBe(400);

    const importResponse = await app.request("/statements/import", {
      method: "POST",
      headers: auth(writeKeyA),
      body: JSON.stringify({ locationId: locA.id, files: [] }),
    });
    expect(importResponse.status).toBe(400);
  });
});
