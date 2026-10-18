// ABOUTME: Integration tests for statement import persistence, dedupe, undo and tenant scoping.
// ABOUTME: Uses the synthetic M-PESA document so no real statement or PDF is required.

import { afterEach, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { appRouter } from "../router";
import {
  accounts,
  businesses,
  expenseCategories,
  locations,
  mobileWalletDailyLedger,
  mobileWalletProviders,
  mobileWalletTransactions,
  statementImports,
  users,
  userBusinesses,
  walletCategoryRules,
} from "@db/schema";
import { getTestDb } from "../test/db";
import ExcelJS from "exceljs";
import { parseMpesaStatement } from "@shared/statements/parsers/mpesa";
import { syntheticMpesaDocument } from "@shared/statements/__fixtures__/synthetic";
import { buildStatementCsv } from "@shared/statements/export/csv";
import { loadCategoryContext } from "../lib/statements/categories";
import {
  getStatementImport,
  listStatementImports,
  persistParsedFile,
  undoStatementImport,
} from "../lib/statements/service";

interface Seeded {
  accountId: string;
  businessId: number;
  userId: number;
  locationId: number;
  feesCategoryId: number;
  business: Record<string, unknown>;
  user: Record<string, unknown>;
}

async function seed(seedName: string): Promise<Seeded> {
  const db = getTestDb();
  const ts = Date.now();
  const accountId = `STMT-${ts}-${seedName}`;

  const [business] = await db.insert(businesses).values({
    accountId,
    name: `Statement Test ${seedName}`,
    slug: `statement-${ts}-${seedName.toLowerCase()}`,
    plan: "pro",
    maxBranches: 5,
    maxUsers: 10,
    isActive: true,
  } as never).returning();

  const [user] = await db.insert(users).values({
    username: `statement-owner-${ts}-${seedName.toLowerCase()}`,
    name: `Statement Owner ${seedName}`,
    role: "owner",
    isActive: true,
    currentBusinessId: business.id,
    accountId,
  } as never).returning();

  await db.insert(userBusinesses).values({
    userId: user.id,
    businessId: business.id,
    role: "owner",
    isActive: true,
  } as never);

  const [location] = await db.insert(locations).values({
    businessId: business.id,
    name: `Statement Branch ${seedName}`,
    slug: `statement-branch-${ts}-${seedName.toLowerCase()}`,
    isActive: true,
  } as never).returning();

  await db.insert(mobileWalletProviders).values({
    code: "mpesa",
    name: "M-PESA",
    displayName: "M-PESA",
    supportedCurrencies: "KES",
    isActive: true,
  } as never).onConflictDoNothing();

  const [fees] = await db.insert(expenseCategories).values({
    businessId: business.id,
    locationId: location.id,
    name: "Bank Charges & Fees",
    color: "#C73E1D",
    isActive: true,
  } as never).returning();

  await db.insert(expenseCategories).values({
    businessId: business.id,
    locationId: location.id,
    name: "Utilities",
    color: "#2D7D46",
    isActive: true,
  } as never);

  return {
    accountId,
    businessId: business.id,
    userId: user.id,
    locationId: location.id,
    feesCategoryId: fees.id,
    business,
    user,
  };
}

async function cleanup(seeded: Seeded[]) {
  const db = getTestDb();
  for (const item of seeded) {
    await db.delete(mobileWalletTransactions).where(eq(mobileWalletTransactions.locationId, item.locationId));
    await db.delete(mobileWalletDailyLedger).where(eq(mobileWalletDailyLedger.locationId, item.locationId));
    await db.delete(statementImports).where(eq(statementImports.businessId, item.businessId));
    await db.delete(walletCategoryRules).where(eq(walletCategoryRules.businessId, item.businessId));
    await db.delete(expenseCategories).where(eq(expenseCategories.businessId, item.businessId));
    await db.delete(accounts).where(eq(accounts.businessId, item.businessId));
    await db.delete(userBusinesses).where(eq(userBusinesses.businessId, item.businessId));
    await db.delete(users).where(eq(users.accountId, item.accountId));
    await db.delete(businesses).where(eq(businesses.accountId, item.accountId));
  }
}

function createCaller(seeded: Seeded) {
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc/wallet.statements.imports"),
    resHeaders: new Headers(),
    user: {
      id: seeded.userId,
      role: "owner",
      currentBusinessId: seeded.businessId,
      accountId: seeded.accountId,
      currentBusiness: seeded.business,
      businessIds: [seeded.businessId],
    },
  } as never);
}

const FIXTURE_RECEIPTS = ["UG12KA80PR", "UG12KA6JPI", "UG12KA6YJA"];

async function clearFixtureRows() {
  const db = getTestDb();
  const ids = FIXTURE_RECEIPTS.flatMap((receipt) => [receipt, `${receipt}#2`, `${receipt}#3`]);
  await db
    .delete(mobileWalletTransactions)
    .where(
      and(
        eq(mobileWalletTransactions.provider, "mpesa"),
        inArray(mobileWalletTransactions.providerTxnId, ids),
      ),
    );
}

describe("Statement import service", () => {
  const seeded: Seeded[] = [];

  afterEach(async () => {
    await cleanup(seeded);
    seeded.length = 0;
    await clearFixtureRows();
  });

  it("imports parsed rows with categories, then dedupes a second import", async () => {
    const ctx = await seed("import");
    seeded.push(ctx);
    await clearFixtureRows();

    const parsed = parseMpesaStatement(syntheticMpesaDocument());
    const context = await loadCategoryContext(ctx.businessId, ctx.locationId, "mpesa");
    const parsedFile = {
      parsed,
      fileName: "sample.pdf",
      fileHash: "hash-1",
      fileSize: 1024,
      passwordProtected: false,
        sourceType: "pdf" as const,
    };
    const file = { fileName: "sample.pdf", bytes: new Uint8Array() };

    const first = await persistParsedFile({
      businessId: ctx.businessId,
      locationId: ctx.locationId,
      userId: ctx.userId,
      file,
      parsedFile,
      context,
      batchRef: null,
    });

    expect(first.status).toBe("imported");
    expect(first.imported).toBe(5);
    expect(first.duplicates).toBe(0);

    const db = getTestDb();
    const rows = await db
      .select()
      .from(mobileWalletTransactions)
      .where(eq(mobileWalletTransactions.statementImportId, first.importId!));
    expect(rows).toHaveLength(5);

    const charge = rows.find((row) => row.providerTxnId === "UG12KA80PR#2");
    expect(charge?.categoryId).toBe(ctx.feesCategoryId);
    expect(charge?.classificationSource).toBe("rule");

    const received = rows.find((row) => row.providerTxnId === "UG12KA6YJA");
    expect(received?.categoryId).toBeNull();
    expect(received?.classificationSource).toBe("none");
    expect(received?.direction).toBe("in");
    expect(received?.txnType).toBe("topup");

    const [record] = await db
      .select()
      .from(statementImports)
      .where(eq(statementImports.id, first.importId!));
    expect(record.status).toBe("imported");
    expect(record.rowCount).toBe(5);
    expect(record.importedCount).toBe(5);

    const caller = createCaller(ctx);
    const stats = await caller.wallet.transactions.stats({
      locationId: ctx.locationId,
      provider: "mpesa",
    });
    expect(stats.summary.totalIn).toBe("1751.37");
    // The 7.00 charge is a fee, not general spending.
    expect(stats.summary.totalOut).toBe("650.00");
    expect(stats.summary.totalFees).toBe("7.00");

    // Exports: CSV (BOM), JSON and XLSX are generated from the snapshot.
    const csvFile = await caller.wallet.statements.export({
      importId: first.importId!,
      format: "csv",
      sortOrder: "asc",
    });
    expect(csvFile.fileName).toMatch(/\.csv$/);
    const csvBytes = Buffer.from(csvFile.base64, "base64");
    expect(Array.from(csvBytes.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const csv = csvBytes.toString("utf8");
    expect(csv).toContain("Receipt No,Completion Time,Details,Transaction Status,Paid In,Withdrawn,Balance");
    expect(csv).toContain("UG12KA80PR");

    const jsonFile = await caller.wallet.statements.export({
      importId: first.importId!,
      format: "json",
    });
    const json = JSON.parse(Buffer.from(jsonFile.base64, "base64").toString("utf8")) as {
      totals: { totalIn: string; totalOut: string; totalFees: string };
      transactions: unknown[];
      analysis: unknown;
    };
    expect(json.totals).toMatchObject({ totalIn: "1751.37", totalOut: "657.00", totalFees: "7.00" });
    expect(json.transactions).toHaveLength(5);
    expect(json.analysis).toBeDefined();

    const xlsxFile = await caller.wallet.statements.export({
      importId: first.importId!,
      format: "xlsx",
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      Buffer.from(xlsxFile.base64, "base64") as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
    expect(workbook.getWorksheet("Main Transactions")).toBeTruthy();
    expect(workbook.getWorksheet("Financial Summary")).toBeTruthy();
    expect(workbook.getWorksheet("Charges & Fees")).toBeTruthy();

    // Manual category + learned merchant rule.
    await caller.wallet.statements.setCategory({
      walletTxnId: rows.find((row) => row.providerTxnId === "UG12KA80PR")!.id,
      categoryId: ctx.feesCategoryId,
      rememberMerchant: true,
    });
    const [updated] = await db
      .select()
      .from(mobileWalletTransactions)
      .where(eq(mobileWalletTransactions.providerTxnId, "UG12KA80PR"));
    expect(updated.categoryId).toBe(ctx.feesCategoryId);
    expect(updated.classificationSource).toBe("manual");

    const rules = await caller.wallet.statements.categoryRules.list();
    const rule = rules.find((item) => item.pattern.toLowerCase().includes("salim"));
    expect(rule).toBeDefined();
    await caller.wallet.statements.categoryRules.delete({ ruleId: rule!.id });
    const afterDelete = await caller.wallet.statements.categoryRules.list();
    expect(afterDelete.some((item) => item.id === rule!.id)).toBe(false);

    const second = await persistParsedFile({
      businessId: ctx.businessId,
      locationId: ctx.locationId,
      userId: ctx.userId,
      file,
      parsedFile,
      context,
      batchRef: null,
    });
    expect(second.imported).toBe(0);
    expect(second.duplicates).toBe(5);
    expect(second.skipped).toBe(5);

    const afterSecond = await db
      .select()
      .from(mobileWalletTransactions)
      .where(eq(mobileWalletTransactions.locationId, ctx.locationId));
    expect(afterSecond).toHaveLength(5);
  });

  it("undoes an import and refuses when a row is linked", async () => {
    const ctx = await seed("undo");
    seeded.push(ctx);
    await clearFixtureRows();

    const parsed = parseMpesaStatement(syntheticMpesaDocument());
    const context = await loadCategoryContext(ctx.businessId, ctx.locationId, "mpesa");
    const parsedFile = {
      parsed,
      fileName: "sample.pdf",
      fileHash: "hash-2",
      fileSize: 1024,
      passwordProtected: false,
        sourceType: "pdf" as const,
    };
    const file = { fileName: "sample.pdf", bytes: new Uint8Array() };

    const first = await persistParsedFile({
      businessId: ctx.businessId,
      locationId: ctx.locationId,
      userId: ctx.userId,
      file,
      parsedFile,
      context,
      batchRef: null,
    });
    const undone = await undoStatementImport({
      businessId: ctx.businessId,
      importId: first.importId!,
    });
    expect(undone).toMatchObject({ ok: true, deleted: 5 });

    const db = getTestDb();
    const live = await db
      .select()
      .from(mobileWalletTransactions)
      .where(eq(mobileWalletTransactions.statementImportId, first.importId!));
    // Soft-deleted rows remain but are excluded from live queries.
    expect(live).toHaveLength(5);

    const second = await persistParsedFile({
      businessId: ctx.businessId,
      locationId: ctx.locationId,
      userId: ctx.userId,
      file,
      parsedFile,
      context,
      batchRef: null,
    });
    await db
      .update(mobileWalletTransactions)
      .set({ isLinked: true })
      .where(eq(mobileWalletTransactions.statementImportId, second.importId!));

    const refused = await undoStatementImport({
      businessId: ctx.businessId,
      importId: second.importId!,
    });
    expect(refused).toMatchObject({ ok: false, linkedCount: 5 });
  });

  it("scopes history and detail to the importing business", async () => {
    const ctx = await seed("scope");
    seeded.push(ctx);
    await clearFixtureRows();

    const parsed = parseMpesaStatement(syntheticMpesaDocument());
    const context = await loadCategoryContext(ctx.businessId, ctx.locationId, "mpesa");
    const result = await persistParsedFile({
      businessId: ctx.businessId,
      locationId: ctx.locationId,
      userId: ctx.userId,
      file: { fileName: "sample.pdf", bytes: new Uint8Array() },
      parsedFile: {
        parsed,
        fileName: "sample.pdf",
        fileHash: "hash-3",
        fileSize: 1024,
        passwordProtected: false,
        sourceType: "pdf" as const,
      },
      context,
      batchRef: "batch-1",
    });

    const list = await listStatementImports({ businessId: ctx.businessId });
    expect(list.items.some((item) => item.id === result.importId)).toBe(true);
    expect(list.total).toBeGreaterThan(0);

    const other = await getStatementImport({
      businessId: ctx.businessId + 999_999,
      importId: result.importId!,
    });
    expect(other).toBeNull();

    const detail = await getStatementImport({
      businessId: ctx.businessId,
      importId: result.importId!,
    });
    expect(detail?.totalRows).toBe(5);
    expect(detail?.rows).toHaveLength(5);

    const caller = createCaller(ctx);
    const routerList = await caller.wallet.statements.imports({ locationId: ctx.locationId });
    expect(routerList.items.some((item) => item.id === result.importId)).toBe(true);
    const routerDetail = await caller.wallet.statements.get({ importId: result.importId! });
    expect(routerDetail.totalRows).toBe(5);
  });

  it("daily ledger separates inflows and outflows by direction", async () => {
    const ctx = await seed("ledger");
    seeded.push(ctx);
    const db = getTestDb();
    const date = "2027-03-15";

    const [account] = await db.insert(accounts).values({
      businessId: ctx.businessId,
      locationId: ctx.locationId,
      name: "M-PESA Wallet",
      type: "wallet",
      currentBalance: "0.00",
      openingBalance: "0.00",
      isActive: true,
    } as never).returning();

    await db.delete(mobileWalletDailyLedger).where(
      and(
        eq(mobileWalletDailyLedger.locationId, ctx.locationId),
        eq(mobileWalletDailyLedger.ledgerDate, date),
      ),
    );

    const base = {
      locationId: ctx.locationId,
      provider: "mpesa",
      txnDate: date,
      txnTime: "10:00:00",
      txnType: "transfer",
      currency: "KES",
      balance: "0.00",
      status: "completed",
      isLinked: false,
      baseCurrency: "KES",
      baseAmount: "0.00",
    };

    await db.insert(mobileWalletTransactions).values([
      { ...base, providerTxnId: `LEDGER-IN-${ctx.locationId}`, direction: "in", amount: "1000.00", txnFee: "0.00", baseAmount: "1000.00" },
      { ...base, providerTxnId: `LEDGER-OUT-${ctx.locationId}`, direction: "out", amount: "300.00", txnFee: "10.00", baseAmount: "300.00" },
      { ...base, providerTxnId: `LEDGER-FEE-${ctx.locationId}`, direction: "out", amount: "5.00", txnType: "charge", txnFee: "0.00", baseAmount: "5.00" },
    ] as never);

    const caller = createCaller(ctx);
    const ledger = await caller.wallet.dailyLedger.create({
      locationId: ctx.locationId,
      provider: "mpesa",
      accountId: account.id,
      ledgerDate: date,
      openingBalance: "0.00",
    });

    expect(ledger.totalInflow).toBe("1000.00");
    expect(ledger.totalOutflow).toBe("300.00");
    expect(ledger.totalFees).toBe("15.00");
    expect(ledger.closingBalance).toBe("685.00");
    expect(ledger.transactionCount).toBe(3);
  });

  it("imports an M-PESA CSV export through the same pipeline", async () => {
    const ctx = await seed("csv");
    seeded.push(ctx);
    await clearFixtureRows();

    const parsed = parseMpesaStatement(syntheticMpesaDocument());
    const rows = parsed.rows.map((row) => ({
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
    }));
    const csv = buildStatementCsv(rows, { sortOrder: "asc" });

    const caller = createCaller(ctx);
    const result = await caller.wallet.statements.import({
      locationId: ctx.locationId,
      files: [
        {
          fileName: "statement.csv",
          fileBase64: Buffer.from(`\uFEFF${csv}`, "utf8").toString("base64"),
        },
      ],
    });

    expect(result.files[0].status).toBe("imported");
    expect(result.files[0].imported).toBe(5);
    expect(result.files[0].totals).toMatchObject({ totalIn: "1751.37", totalOut: "657.00" });

    const db = getTestDb();
    const [record] = await db
      .select()
      .from(statementImports)
      .where(eq(statementImports.id, result.files[0].importId!));
    expect(record.sourceType).toBe("csv");
    expect(record.rowCount).toBe(5);
  });

  it("applies learned merchant rules and import overrides/exclude", async () => {
    const ctx = await seed("rules");
    seeded.push(ctx);
    await clearFixtureRows();
    const db = getTestDb();

    await db.insert(walletCategoryRules).values({
      businessId: ctx.businessId,
      provider: "mpesa",
      matchType: "contains",
      pattern: "salim mwazumi",
      categoryId: ctx.feesCategoryId,
      source: "user",
      priority: 1000,
    } as never);

    const parsed = parseMpesaStatement(syntheticMpesaDocument());
    const context = await loadCategoryContext(ctx.businessId, ctx.locationId, "mpesa");
    const result = await persistParsedFile({
      businessId: ctx.businessId,
      locationId: ctx.locationId,
      userId: ctx.userId,
      file: {
        fileName: "sample.pdf",
        bytes: new Uint8Array(),
        overrides: { UG12KA6JPI: ctx.feesCategoryId },
        exclude: ["UG12KA6YJA"],
      },
      parsedFile: {
        parsed,
        fileName: "sample.pdf",
        fileHash: "hash-rules",
        fileSize: 1024,
        passwordProtected: false,
        sourceType: "pdf",
      },
      context,
      batchRef: null,
    });

    expect(result.imported).toBe(4);
    expect(result.excluded).toBe(1);

    const rows = await db
      .select()
      .from(mobileWalletTransactions)
      .where(eq(mobileWalletTransactions.statementImportId, result.importId!));
    expect(rows).toHaveLength(4);
    expect(rows.some((row) => row.providerTxnId === "UG12KA6YJA")).toBe(false);

    const learned = rows.find((row) => row.providerTxnId === "UG12KA80PR");
    expect(learned?.categoryId).toBe(ctx.feesCategoryId);
    expect(learned?.classificationSource).toBe("learned");

    const overridden = rows.find((row) => row.providerTxnId === "UG12KA6JPI");
    expect(overridden?.categoryId).toBe(ctx.feesCategoryId);
    expect(overridden?.classificationSource).toBe("manual");
  });
});

