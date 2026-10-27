// ABOUTME: Statement import service: parse in memory, preview, persist wallet rows, list, get and undo.
// ABOUTME: Files and passwords are never stored; only parsed rows, metadata and an analysis snapshot.

import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "../../queries/connection";
import {
  accounts,
  expenseCategories,
  locations,
  mobileWalletProviders,
  mobileWalletTransactions,
  statementImports,
  walletCategoryRules,
} from "@db/schema";
import { extractPdfDocument } from "@shared/statements/extract/pdf-node";
import { buildDelimitedDocument } from "@shared/statements/table/delimited";
import { parseStatement } from "@shared/statements/parsers/registry";
import { StatementError } from "@shared/statements/errors";
import { buildStatementAnalysis } from "@shared/statements/analyze";
import type { StatementAnalysis } from "@shared/statements/analyze";
import { subtractAmounts, sumAmounts } from "@shared/statements/normalize/amount";
import type { ParsedStatement, ParsedStatementRow } from "@shared/statements/types";
import { loadCategoryContext, resolveRowCategory, type CategoryContext } from "./categories";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_BATCH = 12;
const PREVIEW_ROW_LIMIT = 200;
const INSERT_CHUNK = 250;
const ID_CHUNK = 2000;

export interface StatementFileInput {
  fileName: string;
  bytes: Uint8Array;
  password?: string;
  provider?: string;
  /** Optional bank account to link imported bank rows to. */
  accountId?: number;
  /** externalId -> categoryId, or null to force "no category". */
  overrides?: Record<string, number | null>;
  /** externalIds to leave out of this import. */
  exclude?: string[];
}

export interface PreviewRow {
  externalId: string;
  date: string;
  time: string | null;
  details: string;
  direction: "in" | "out";
  amount: string;
  balance: string;
  rail: string;
  txnType: string;
  counterpartyName: string | null;
  categoryKey: string | null;
  suggestedCategoryId: number | null;
  suggestedCategoryName: string | null;
  confidence: number;
  alreadyImported: boolean;
}

export interface StatementPreview {
  fileName: string;
  fileHash: string;
  fileSize: number;
  sourceType: "pdf" | "csv";
  provider: string;
  kind: string;
  parserId: string;
  parserVersion: string;
  currency: string;
  metadata: ParsedStatement["metadata"];
  totals: ParsedStatement["totals"];
  statementSummary: ParsedStatement["statementSummary"] | null;
  warnings: string[];
  rowsTotal: number;
  duplicateCount: number;
  byRail: Array<{ key: string; count: number; totalIn: string; totalOut: string }>;
  byCategory: Array<{ key: string; count: number }>;
  rows: PreviewRow[];
  analysis: StatementAnalysis;
}

export interface ImportFileResult {
  importId: number | null;
  fileName: string;
  status: "imported" | "failed";
  code?: string;
  error?: string;
  rowCount: number;
  imported: number;
  skipped: number;
  duplicates: number;
  excluded: number;
  warnings: string[];
  totals: ParsedStatement["totals"] | null;
}

export interface ImportBatchResult {
  batchRef: string | null;
  files: ImportFileResult[];
}

interface ParsedFile {
  parsed: ParsedStatement;
  fileName: string;
  fileHash: string;
  fileSize: number;
  passwordProtected: boolean;
  sourceType: "pdf" | "csv";
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function validateBankAccount(input: {
  businessId: number;
  locationId: number;
  accountId?: number;
}): Promise<void> {
  if (!input.accountId) return;
  const db = getDb();
  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.id, input.accountId),
        eq(accounts.businessId, input.businessId),
        eq(accounts.locationId, input.locationId),
        isNull(accounts.deletedAt),
      ),
    )
    .limit(1);
  if (!account) {
    throw new StatementError(
      "UNSUPPORTED_STATEMENT",
      "The selected bank account does not belong to this business and location.",
    );
  }
}

/** Bank imports use the generic `bank` provider; seed it on demand for existing databases. */
async function ensureStatementProvider(provider: string): Promise<void> {
  if (provider !== "bank") return;
  await getDb()
    .insert(mobileWalletProviders)
    .values({
      code: "bank",
      name: "Bank",
      displayName: "Bank statement",
      brandColor: "#1E3A5F",
      supportedCurrencies: "KES",
      isActive: true,
      requiresProvisioning: false,
    })
    .onConflictDoNothing({ target: mobileWalletProviders.code });
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function statementError(error: unknown): StatementError {
  if (error instanceof StatementError) return error;
  return new StatementError(
    "PARSE_FAILED",
    error instanceof Error ? error.message : "Could not read the statement.",
  );
}

async function parseStatementFile(file: StatementFileInput): Promise<ParsedFile> {
  if (file.bytes.length === 0) {
    throw new StatementError("INVALID_FILE", "The file is empty.");
  }
  if (file.bytes.length > MAX_FILE_BYTES) {
    throw new StatementError("FILE_TOO_LARGE", "Statements larger than 10 MB are not supported.");
  }
  const lower = file.fileName.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    throw new StatementError(
      "UNSUPPORTED_STATEMENT",
      "Excel statements are not supported yet. Export the statement as PDF or CSV.",
    );
  }
  const isCsv = lower.endsWith(".csv");

  const parsed = await (async () => {
    if (isCsv) {
      const text = new TextDecoder("utf-8").decode(file.bytes);
      const doc = buildDelimitedDocument(text);
      return parseStatement(doc, { fileName: file.fileName });
    }
    const doc = await extractPdfDocument(file.bytes, { password: file.password });
    return parseStatement(doc, { fileName: file.fileName });
  })();

  if (parsed.rows.length === 0) {
    throw new StatementError(
      "UNSUPPORTED_STATEMENT",
      isCsv
        ? "No transactions were found in this CSV. Use the M-PESA statement CSV column layout."
        : "No transactions were found. Check that this is an M-PESA statement PDF, not a scanned image.",
    );
  }
  return {
    parsed,
    fileName: file.fileName,
    fileHash: sha256(file.bytes),
    fileSize: file.bytes.length,
    passwordProtected: isCsv ? false : Boolean(file.password),
    sourceType: isCsv ? "csv" : "pdf",
  };
}

async function findExistingIds(provider: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const db = getDb();
  const found = new Set<string>();
  for (const batch of chunk([...new Set(ids)], ID_CHUNK)) {
    const rows = await db
      .select({ id: mobileWalletTransactions.providerTxnId })
      .from(mobileWalletTransactions)
      .where(
        and(
          eq(mobileWalletTransactions.provider, provider),
          inArray(mobileWalletTransactions.providerTxnId, batch),
          isNull(mobileWalletTransactions.deletedAt),
        ),
      );
    for (const row of rows) found.add(row.id);
  }
  return found;
}

function aggregate(
  rows: ParsedStatementRow[],
  keyOf: (row: ParsedStatementRow) => string,
): Array<{ key: string; count: number; in: string[]; out: string[] }> {
  const map = new Map<string, { count: number; in: string[]; out: string[] }>();
  for (const row of rows) {
    const key = keyOf(row);
    const entry = map.get(key) ?? { count: 0, in: [], out: [] };
    entry.count++;
    if (row.direction === "in") entry.in.push(row.paidIn);
    else entry.out.push(row.withdrawn);
    map.set(key, entry);
  }
  return [...map.entries()].map(([key, value]) => ({ key, ...value }));
}

async function assertLocation(businessId: number, locationId: number): Promise<void> {
  const db = getDb();
  const [location] = await db
    .select({ businessId: locations.businessId })
    .from(locations)
    .where(eq(locations.id, locationId))
    .limit(1);
  if (!location || location.businessId !== businessId) {
    throw new StatementError("INVALID_FILE", "The selected location does not belong to this business.");
  }
}

export async function buildStatementPreview(input: {
  businessId: number;
  locationId: number;
  file: StatementFileInput;
}): Promise<StatementPreview> {
  await assertLocation(input.businessId, input.locationId);
  await validateBankAccount({
    businessId: input.businessId,
    locationId: input.locationId,
    accountId: input.file.accountId,
  });
  const parsedFile = await parseStatementFile(input.file);
  const { parsed } = parsedFile;
  const context = await loadCategoryContext(input.businessId, input.locationId, parsed.provider);
  const resolved = parsed.rows.map((row) => resolveRowCategory(row, context));
  const existing = await findExistingIds(
    parsed.provider,
    parsed.rows.map((row) => row.externalId),
  );

  const previewRows: PreviewRow[] = parsed.rows.slice(0, PREVIEW_ROW_LIMIT).map((row, index) => {
    const category = resolved[index];
    return {
      externalId: row.externalId,
      date: row.date,
      time: row.time,
      details: row.details,
      direction: row.direction,
      amount: row.amount,
      balance: row.balance,
      rail: row.rail,
      txnType: row.txnType,
      counterpartyName: row.counterpartyName,
      categoryKey: row.categoryKey,
      suggestedCategoryId: category.categoryId,
      suggestedCategoryName:
        context.candidates.find((candidate) => candidate.id === category.categoryId)?.name ?? null,
      confidence: category.confidence,
      alreadyImported: existing.has(row.externalId),
    };
  });

  const byCategory = new Map<string, number>();
  resolved.forEach((category) => {
    const key = category.categoryId
      ? context.candidates.find((candidate) => candidate.id === category.categoryId)?.name ?? "Category"
      : "(none)";
    byCategory.set(key, (byCategory.get(key) ?? 0) + 1);
  });

  const resolvedById = new Map(parsed.rows.map((row, index) => [row.externalId, resolved[index]]));
  const analysis = buildStatementAnalysis(parsed, {
    categoryOf: (row) => {
      const category = resolvedById.get(row.externalId);
      return {
        id: category?.categoryId ?? null,
        name: category?.categoryId
          ? context.candidates.find((candidate) => candidate.id === category.categoryId)?.name ?? "No category"
          : "No category",
      };
    },
    duplicateCount: existing.size,
  });

  return {
    fileName: parsedFile.fileName,
    fileHash: parsedFile.fileHash,
    fileSize: parsedFile.fileSize,
    sourceType: parsedFile.sourceType,
    provider: parsed.provider,
    kind: parsed.kind,
    parserId: parsed.parserId,
    parserVersion: parsed.parserVersion,
    currency: parsed.currency,
    metadata: parsed.metadata,
    totals: parsed.totals,
    statementSummary: parsed.statementSummary ?? null,
    warnings: parsed.warnings,
    rowsTotal: parsed.rows.length,
    duplicateCount: existing.size,
    byRail: aggregate(parsed.rows, (row) => row.rail).map((entry) => ({
      key: entry.key,
      count: entry.count,
      totalIn: sumAmounts(entry.in),
      totalOut: sumAmounts(entry.out),
    })),
    byCategory: [...byCategory.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count),
    rows: previewRows,
    analysis,
  };
}

interface EffectiveCategory {
  id: number | null;
  name: string;
  source: "none" | "rule" | "learned" | "manual";
  confidence: number;
}

function categoryResolver(
  context: CategoryContext,
  file: StatementFileInput,
): (row: ParsedStatementRow) => EffectiveCategory {
  const nameOf = (id: number | null) =>
    context.candidates.find((candidate) => candidate.id === id)?.name ?? "No category";

  return (row) => {
    const hasOverride =
      file.overrides && Object.prototype.hasOwnProperty.call(file.overrides, row.externalId);
    if (hasOverride) {
      const id = file.overrides![row.externalId];
      return {
        id,
        name: nameOf(id),
        source: id === null ? "none" : "manual",
        confidence: id === null ? 0 : 1,
      };
    }
    const resolved = resolveRowCategory(row, context);
    return {
      id: resolved.categoryId,
      name: nameOf(resolved.categoryId),
      source: resolved.source,
      confidence: resolved.confidence,
    };
  };
}

function toWalletRows(
  parsed: ParsedStatement,
  file: StatementFileInput,
  locationId: number,
  importId: number,
  userId: number | null,
  skip: Set<string>,
  categoryOf: (row: ParsedStatementRow) => EffectiveCategory,
): Array<typeof mobileWalletTransactions.$inferInsert> {
  const exclude = new Set(file.exclude ?? []);
  const values: Array<typeof mobileWalletTransactions.$inferInsert> = [];

  for (const row of parsed.rows) {
    if (skip.has(row.externalId) || exclude.has(row.externalId)) continue;

    const category = categoryOf(row);
    const categoryId = category.id;
    const source = category.source;
    const confidence = category.confidence;

    values.push({
      locationId,
      provider: parsed.provider,
      providerTxnId: row.externalId,
      providerRef: row.groupId,
      txnDate: row.date,
      txnTime: row.time,
      txnType: row.txnType,
      direction: row.direction,
      partyName: row.counterpartyName,
      partyIdentifier: row.counterpartyId,
      amount: row.amount,
      currency: row.currency,
      txnFee: "0.00",
      balance: row.balance,
      description: row.details,
      rawText: row.rawLines.join("\n"),
      rawPayload: {
        rail: row.rail,
        groupId: row.groupId,
        groupRole: row.groupRole,
        status: row.status,
        paidIn: row.paidIn,
        withdrawn: row.withdrawn,
        accountReference: row.accountReference,
        transactionType: row.transactionType ?? null,
        otherParty: row.otherParty ?? null,
        fulizaFunded: row.fulizaFunded,
        linkedTxnExternalId: row.linkedTxnExternalId,
        fulizaOf: row.fulizaOf,
        parserId: parsed.parserId,
        parserVersion: parsed.parserVersion,
      },
      categoryId,
      classificationSource: source,
      classificationConfidence: categoryId ? confidence.toFixed(3) : null,
      statementImportId: importId,
      status: row.status,
      isLinked: false,
      importedBy: userId ?? undefined,
      sourceAccountId: file.accountId ?? undefined,
      baseCurrency: row.currency,
      baseAmount: row.amount,
    });
  }
  return values;
}

export async function persistParsedFile(input: {
  businessId: number;
  locationId: number;
  userId: number | null;
  file: StatementFileInput;
  parsedFile: ParsedFile;
  context: CategoryContext;
  batchRef: string | null;
}): Promise<ImportFileResult> {
  const { parsed } = input.parsedFile;
  const db = getDb();

  await validateBankAccount({
    businessId: input.businessId,
    locationId: input.locationId,
    accountId: input.file.accountId,
  });
  await ensureStatementProvider(parsed.provider);

  const existing = await findExistingIds(parsed.provider, parsed.rows.map((row) => row.externalId));
  const exclude = new Set(input.file.exclude ?? []);
  const rowCount = parsed.rows.length;
  const excluded = parsed.rows.filter((row) => exclude.has(row.externalId)).length;
  const duplicates = parsed.rows.filter((row) => existing.has(row.externalId)).length;

  const closingBalance = parsed.metadata.closingBalance
    ?? (parsed.order === "asc" ? parsed.rows[parsed.rows.length - 1]?.balance : parsed.rows[0]?.balance)
    ?? null;
  const openingBalance = parsed.metadata.openingBalance
    ?? (closingBalance
      ? subtractAmounts(closingBalance, subtractAmounts(parsed.totals.totalIn, parsed.totals.totalOut))
      : null);

  const categoryOf = categoryResolver(input.context, input.file);
  const analysis = buildStatementAnalysis(parsed, {
    categoryOf: (row) => {
      const category = categoryOf(row);
      return { id: category.id, name: category.name };
    },
    duplicateCount: duplicates,
  });

  const [record] = await db.insert(statementImports).values({
    businessId: input.businessId,
    locationId: input.locationId,
    provider: parsed.provider,
    sourceType: input.parsedFile.sourceType,
    kind: parsed.kind,
    fileName: input.parsedFile.fileName,
    fileSize: input.parsedFile.fileSize,
    fileHash: input.parsedFile.fileHash,
    batchRef: input.batchRef,
    parserId: parsed.parserId,
    parserVersion: parsed.parserVersion,
    currency: parsed.currency,
    periodStart: parsed.metadata.periodStart ?? null,
    periodEnd: parsed.metadata.periodEnd ?? null,
    openingBalance,
    closingBalance,
    rowCount,
    duplicateCount: duplicates,
    status: "parsed",
    warnings: parsed.warnings,
    analysis,
    passwordProtected: input.parsedFile.passwordProtected,
    importedBy: input.userId ?? undefined,
  }).returning({ id: statementImports.id });

  const importId = record.id;

  try {
    const rows = toWalletRows(
      parsed,
      input.file,
      input.locationId,
      importId,
      input.userId,
      existing,
      categoryOf,
    );

    let imported = 0;
    await db.transaction(async (tx) => {
      for (const batch of chunk(rows, INSERT_CHUNK)) {
        if (batch.length === 0) continue;
        const inserted = await tx
          .insert(mobileWalletTransactions)
          .values(batch)
          .onConflictDoNothing()
          .returning({ id: mobileWalletTransactions.id });
        imported += inserted.length;
      }
      await tx
        .update(statementImports)
        .set({
          importedCount: imported,
          skippedCount: rowCount - imported,
          duplicateCount: duplicates,
          status: "imported",
        })
        .where(eq(statementImports.id, importId));
    });

    // Best-effort learned-rule usage counter.
    const ruleIds = new Set<number>();
    for (const row of parsed.rows) {
      const resolved = resolveRowCategory(row, input.context);
      if (resolved.ruleId) ruleIds.add(resolved.ruleId);
    }
    for (const ruleId of ruleIds) {
      await db
        .update(walletCategoryRules)
        .set({ hitCount: sql`${walletCategoryRules.hitCount} + 1` })
        .where(eq(walletCategoryRules.id, ruleId));
    }

    return {
      importId,
      fileName: input.parsedFile.fileName,
      status: "imported",
      rowCount,
      imported,
      skipped: rowCount - imported,
      duplicates,
      excluded,
      warnings: parsed.warnings,
      totals: parsed.totals,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(statementImports)
      .set({ status: "failed", errorMessage: message })
      .where(eq(statementImports.id, importId));
    return {
      importId,
      fileName: input.parsedFile.fileName,
      status: "failed",
      code: "IMPORT_FAILED",
      error: message,
      rowCount,
      imported: 0,
      skipped: rowCount,
      duplicates,
      excluded,
      warnings: parsed.warnings,
      totals: parsed.totals,
    };
  }
}

async function recordFailure(input: {
  businessId: number;
  locationId: number;
  userId: number | null;
  file: StatementFileInput;
  error: StatementError;
  batchRef: string | null;
}): Promise<number | null> {
  try {
    const db = getDb();
    const lower = input.file.fileName.toLowerCase();
    const sourceType = lower.endsWith(".csv")
      ? "csv"
      : lower.endsWith(".xlsx") || lower.endsWith(".xls")
        ? "xlsx"
        : "pdf";
    const [record] = await db.insert(statementImports).values({
      businessId: input.businessId,
      locationId: input.locationId,
      provider: input.file.provider ?? "mpesa",
      sourceType,
      kind: "unknown",
      fileName: input.file.fileName,
      fileSize: input.file.bytes.length,
      fileHash: input.file.bytes.length > 0 ? sha256(input.file.bytes) : null,
      batchRef: input.batchRef,
      status: "failed",
      errorMessage: input.error.message,
      warnings: [],
      passwordProtected: Boolean(input.file.password),
      importedBy: input.userId ?? undefined,
    }).returning({ id: statementImports.id });
    return record.id;
  } catch (error) {
    console.error("[statements] Failed to record import failure:", error);
    return null;
  }
}

export async function importStatements(input: {
  businessId: number;
  locationId: number;
  userId: number | null;
  files: StatementFileInput[];
  batchLabel?: string;
}): Promise<ImportBatchResult> {
  if (input.files.length === 0) {
    throw new StatementError("INVALID_FILE", "Select at least one statement file.");
  }
  if (input.files.length > MAX_FILES_PER_BATCH) {
    throw new StatementError(
      "INVALID_FILE",
      `Import at most ${MAX_FILES_PER_BATCH} files at a time.`,
    );
  }
  await assertLocation(input.businessId, input.locationId);
  const batchRef = input.files.length > 1 || input.batchLabel ? randomUUID() : null;
  const contextCache = new Map<string, CategoryContext>();
  const results: ImportFileResult[] = [];

  for (const file of input.files) {
    let parsedFile: ParsedFile;
    try {
      parsedFile = await parseStatementFile(file);
    } catch (error) {
      const statementErr = statementError(error);
      const importId = await recordFailure({
        businessId: input.businessId,
        locationId: input.locationId,
        userId: input.userId,
        file,
        error: statementErr,
        batchRef,
      });
      results.push({
        importId,
        fileName: file.fileName,
        status: "failed",
        code: statementErr.code,
        error: statementErr.message,
        rowCount: 0,
        imported: 0,
        skipped: 0,
        duplicates: 0,
        excluded: 0,
        warnings: [],
        totals: null,
      });
      continue;
    }

    try {
      let context = contextCache.get(parsedFile.parsed.provider);
      if (!context) {
        context = await loadCategoryContext(
          input.businessId,
          input.locationId,
          parsedFile.parsed.provider,
        );
        contextCache.set(parsedFile.parsed.provider, context);
      }
      results.push(
        await persistParsedFile({
          businessId: input.businessId,
          locationId: input.locationId,
          userId: input.userId,
          file,
          parsedFile,
          context,
          batchRef,
        }),
      );
    } catch (error) {
      const statementErr = statementError(error);
      results.push({
        importId: null,
        fileName: file.fileName,
        status: "failed",
        code: statementErr.code,
        error: statementErr.message,
        rowCount: parsedFile.parsed.rows.length,
        imported: 0,
        skipped: parsedFile.parsed.rows.length,
        duplicates: 0,
        excluded: 0,
        warnings: parsedFile.parsed.warnings,
        totals: parsedFile.parsed.totals,
      });
    }
  }

  return { batchRef, files: results };
}

export async function listStatementImports(input: {
  businessId: number;
  locationId?: number;
  provider?: string;
  batchRef?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: Array<typeof statementImports.$inferSelect>; total: number }> {
  const db = getDb();
  const conditions = [
    eq(statementImports.businessId, input.businessId),
    isNull(statementImports.deletedAt),
  ];
  if (input.locationId) conditions.push(eq(statementImports.locationId, input.locationId));
  if (input.provider) conditions.push(eq(statementImports.provider, input.provider));
  if (input.batchRef) conditions.push(eq(statementImports.batchRef, input.batchRef));

  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);

  const items = await db
    .select()
    .from(statementImports)
    .where(and(...conditions))
    .orderBy(desc(statementImports.createdAt))
    .limit(limit)
    .offset(offset);

  const [count] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(statementImports)
    .where(and(...conditions));

  return { items, total: Number(count?.total ?? 0) };
}

export async function getStatementImport(input: {
  businessId: number;
  importId: number;
  limit?: number;
  offset?: number;
}) {
  const db = getDb();
  const [record] = await db
    .select()
    .from(statementImports)
    .where(
      and(
        eq(statementImports.id, input.importId),
        eq(statementImports.businessId, input.businessId),
        isNull(statementImports.deletedAt),
      ),
    )
    .limit(1);

  if (!record) return null;

  const limit = Math.min(Math.max(input.limit ?? 200, 1), 1000);
  const offset = Math.max(input.offset ?? 0, 0);

  const rows = await db
    .select({
      id: mobileWalletTransactions.id,
      providerTxnId: mobileWalletTransactions.providerTxnId,
      providerRef: mobileWalletTransactions.providerRef,
      txnDate: mobileWalletTransactions.txnDate,
      txnTime: mobileWalletTransactions.txnTime,
      txnType: mobileWalletTransactions.txnType,
      direction: mobileWalletTransactions.direction,
      partyName: mobileWalletTransactions.partyName,
      description: mobileWalletTransactions.description,
      amount: mobileWalletTransactions.amount,
      balance: mobileWalletTransactions.balance,
      categoryId: mobileWalletTransactions.categoryId,
      categoryName: expenseCategories.name,
      classificationSource: mobileWalletTransactions.classificationSource,
      status: mobileWalletTransactions.status,
    })
    .from(mobileWalletTransactions)
    .leftJoin(expenseCategories, eq(mobileWalletTransactions.categoryId, expenseCategories.id))
    .where(
      and(
        eq(mobileWalletTransactions.statementImportId, input.importId),
        isNull(mobileWalletTransactions.deletedAt),
      ),
    )
    .orderBy(desc(mobileWalletTransactions.txnDate), desc(mobileWalletTransactions.txnTime))
    .limit(limit)
    .offset(offset);

  const [count] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(mobileWalletTransactions)
    .where(
      and(
        eq(mobileWalletTransactions.statementImportId, input.importId),
        isNull(mobileWalletTransactions.deletedAt),
      ),
    );

  return { import: record, rows, totalRows: Number(count?.total ?? 0) };
}

export async function undoStatementImport(input: {
  businessId: number;
  importId: number;
}): Promise<
  | { ok: true; deleted: number }
  | { ok: false; linkedCount: number; message: string }
  | null
> {
  const db = getDb();
  const [record] = await db
    .select({ id: statementImports.id })
    .from(statementImports)
    .where(
      and(
        eq(statementImports.id, input.importId),
        eq(statementImports.businessId, input.businessId),
        isNull(statementImports.deletedAt),
      ),
    )
    .limit(1);
  if (!record) return null;

  const rows = await db
    .select({ id: mobileWalletTransactions.id, isLinked: mobileWalletTransactions.isLinked })
    .from(mobileWalletTransactions)
    .where(
      and(
        eq(mobileWalletTransactions.statementImportId, input.importId),
        isNull(mobileWalletTransactions.deletedAt),
      ),
    );

  const linked = rows.filter((row) => row.isLinked);
  if (linked.length > 0) {
    return {
      ok: false,
      linkedCount: linked.length,
      message: `${linked.length} transaction${linked.length === 1 ? " is" : "s are"} linked to an expense or bill. Unlink them before undoing this import.`,
    };
  }

  await db.transaction(async (tx) => {
    const now = new Date();
    await tx
      .update(mobileWalletTransactions)
      .set({ deletedAt: now })
      .where(
        and(
          eq(mobileWalletTransactions.statementImportId, input.importId),
          isNull(mobileWalletTransactions.deletedAt),
        ),
      );
    await tx
      .update(statementImports)
      .set({ status: "rolled_back" })
      .where(eq(statementImports.id, input.importId));
  });

  return { ok: true, deleted: rows.length };
}

