// ABOUTME: Tests for the deep FinaBill sync surface — listAccountTransactions
// ABOUTME: pagination, upsertAccount/upsertSupplier matching chains, upsertBill/listBills.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../queries/connection";
import {
  businesses,
  locations,
  accounts,
  ledgerEntries,
  suppliers,
  bills,
  billItems,
  apiKeys,
} from "@db/schema";
import { appRouter } from "../router";
import {
  generateApiKey,
  hashApiKey,
  getKeyPrefix,
  resolveApiKey,
} from "../lib/api-key-auth";

let testBusinessId: number;
let testLocationId: number;
let moneyAccountId: number;
let revenueAccountId: number;
let otherBusinessId: number;
let otherMoneyAccountId: number;
let ledgerIds: number[] = [];

const ALL_SCOPES = [
  "accounts:read",
  "accounts:write",
  "bills:read",
  "bills:write",
  "suppliers:read",
  "suppliers:write",
  "expenses:read",
];

async function createTestApiKey(
  businessId: number,
  scopes: string[]
): Promise<string> {
  const db = getDb();
  const rawKey = generateApiKey();
  await db.insert(apiKeys).values({
    businessId,
    name: "Deep Sync Test Key",
    keyHash: await hashApiKey(rawKey, 4),
    keyPrefix: getKeyPrefix(rawKey),
    scopes,
  } as any);
  return rawKey;
}

async function makeCaller(businessId: number, scopes: string[] = ALL_SCOPES) {
  const rawKey = await createTestApiKey(businessId, scopes);
  const apiKey = await resolveApiKey(rawKey);
  expect(apiKey).not.toBeNull();
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc"),
    resHeaders: new Headers(),
    apiKey: apiKey!,
  });
}

beforeAll(async () => {
  const db = getDb();
  const stamp = Date.now();

  const [business] = await db
    .insert(businesses)
    .values({
      accountId: `DEEP-SYNC-${stamp}`,
      name: "Deep Sync Test",
      slug: `deep-sync-${stamp}`,
      plan: "pro",
      isActive: true,
    } as any)
    .returning();
  testBusinessId = business.id;

  const [location] = await db
    .insert(locations)
    .values({
      businessId: testBusinessId,
      name: "Deep Sync Branch",
      slug: `deep-sync-branch-${stamp}`,
      isActive: true,
    })
    .returning();
  testLocationId = location.id;

  // Operational money account (accountType NULL) with ledger history.
  const [money] = (await db
    .insert(accounts)
    .values({
      businessId: testBusinessId,
      locationId: testLocationId,
      name: "Deep Sync Cash",
      type: "cash",
      isActive: true,
    } as any)
    .returning()) as any[];
  moneyAccountId = money.id;

  // CoA account — must be rejected by listAccountTransactions.
  const [revenue] = (await db
    .insert(accounts)
    .values({
      businessId: testBusinessId,
      locationId: testLocationId,
      name: "Deep Sync Revenue",
      type: "cash",
      accountType: "revenue",
      accountSubType: "sales_revenue",
      isActive: true,
    } as any)
    .returning()) as any[];
  revenueAccountId = revenue.id;

  const entryRows = await db
    .insert(ledgerEntries)
    .values(
      [1, 2, 3, 4, 5].map((n) => ({
        accountId: moneyAccountId,
        transactionType: "sale" as const,
        transactionId: n,
        entryType: n % 2 === 0 ? ("credit" as const) : ("debit" as const),
        amount: `${n}00.00`,
        balanceAfter: `${n}000.00`,
        description: `Entry ${n}`,
        refNo: `DS-REF-${n}`,
        entryDate: "2026-02-0" + n,
      }))
    )
    .returning({ id: ledgerEntries.id });
  ledgerIds = entryRows.map((r) => r.id);

  // Second business with its own money account — cross-tenant guard.
  const [other] = await db
    .insert(businesses)
    .values({
      accountId: `DEEP-SYNC-OTHER-${stamp}`,
      name: "Deep Sync Other",
      slug: `deep-sync-other-${stamp}`,
      plan: "pro",
      isActive: true,
    } as any)
    .returning();
  otherBusinessId = other.id;

  const [otherLoc] = await db
    .insert(locations)
    .values({
      businessId: otherBusinessId,
      name: "Other Branch",
      slug: `deep-sync-other-branch-${stamp}`,
      isActive: true,
    })
    .returning();

  const [otherMoney] = (await db
    .insert(accounts)
    .values({
      businessId: otherBusinessId,
      locationId: otherLoc.id,
      name: "Other Cash",
      type: "cash",
      isActive: true,
    } as any)
    .returning()) as any[];
  otherMoneyAccountId = otherMoney.id;
}, 60_000);

afterAll(async () => {
  const db = getDb();
  for (const businessId of [testBusinessId, otherBusinessId]) {
    if (!businessId) continue;
    const billIds = db
      .select({ id: bills.id })
      .from(bills)
      .where(eq(bills.businessId, businessId));
    await db.delete(billItems).where(inArray(billItems.billId, billIds));
    await db.delete(bills).where(eq(bills.businessId, businessId));
    await db.delete(suppliers).where(eq(suppliers.businessId, businessId));
    const accountIds = db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.businessId, businessId));
    await db.delete(ledgerEntries).where(inArray(ledgerEntries.accountId, accountIds));
    await db.delete(accounts).where(eq(accounts.businessId, businessId));
    await db.delete(apiKeys).where(eq(apiKeys.businessId, businessId));
    await db.delete(locations).where(eq(locations.businessId, businessId));
    await db.delete(businesses).where(eq(businesses.id, businessId));
  }
});

describe("listAccountTransactions", () => {
  it("returns ledger entries oldest-first with limit and sinceEntryId cursor", async () => {
    const caller = await makeCaller(testBusinessId);

    const firstPage = await caller.integrationFinabill.listAccountTransactions({
      accountId: moneyAccountId,
      limit: 2,
    });
    expect(firstPage.data).toHaveLength(2);
    expect(firstPage.data.map((e) => e.id)).toEqual(ledgerIds.slice(0, 2));
    expect(firstPage.data[0].amount).toBe("100.00");
    expect(firstPage.data[0].entryType).toBe("debit");
    expect(firstPage.data[0].balanceAfter).toBe("1000.00");
    expect(firstPage.data[0].refNo).toBe("DS-REF-1");

    const secondPage = await caller.integrationFinabill.listAccountTransactions({
      accountId: moneyAccountId,
      sinceEntryId: ledgerIds[1],
      limit: 200,
    });
    expect(secondPage.data.map((e) => e.id)).toEqual(ledgerIds.slice(2));
  });

  it("rejects CoA accounts and accounts of other businesses", async () => {
    const caller = await makeCaller(testBusinessId);

    await expect(
      caller.integrationFinabill.listAccountTransactions({
        accountId: revenueAccountId,
      })
    ).rejects.toThrow(/Account not found for this business/);

    await expect(
      caller.integrationFinabill.listAccountTransactions({
        accountId: otherMoneyAccountId,
      })
    ).rejects.toThrow(/Account not found for this business/);
  });

  it("enforces the accounts:read scope", async () => {
    const caller = await makeCaller(testBusinessId, ["bills:read"]);
    await expect(
      caller.integrationFinabill.listAccountTransactions({
        accountId: moneyAccountId,
      })
    ).rejects.toThrow(/API key missing required scope: accounts:read/);
  });
});

describe("upsertAccount", () => {
  it("creates a CoA row stamped with externalSystem=finabill", async () => {
    const caller = await makeCaller(testBusinessId);
    const result = await caller.integrationFinabill.upsertAccount({
      externalId: "fb-coa-100",
      name: "Consulting Income",
      accountCode: "4200",
      accountType: "revenue",
      accountSubType: "service_revenue",
    });
    expect(result.created).toBe(true);

    const db = getDb();
    const [row] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, result.id))
      .limit(1);
    expect(row).toBeDefined();
    expect(row!.externalId).toBe("fb-coa-100");
    expect(row!.externalSystem).toBe("finabill");
    expect(row!.accountType).toBe("revenue");
    expect(row!.businessId).toBe(testBusinessId);
  });

  it("matches by externalId on subsequent pushes and updates in place", async () => {
    const caller = await makeCaller(testBusinessId);
    const first = await caller.integrationFinabill.upsertAccount({
      externalId: "fb-coa-101",
      name: "Delivery Fees",
      accountType: "revenue",
    });
    const second = await caller.integrationFinabill.upsertAccount({
      externalId: "fb-coa-101",
      name: "Delivery Fee Income",
      accountType: "revenue",
    });
    expect(second.created).toBe(false);
    expect(second.id).toBe(first.id);
    expect(second.name).toBe("Delivery Fee Income");
  });

  it("falls back to accountType+code matching and stamps the externalId", async () => {
    const db = getDb();
    const [preexisting] = (await db
      .insert(accounts)
      .values({
        businessId: testBusinessId,
        locationId: testLocationId,
        name: "Rent",
        type: "bank_account",
        accountType: "expense",
        accountCode: "5100",
        isActive: true,
      } as any)
      .returning()) as any[];

    const caller = await makeCaller(testBusinessId);
    const result = await caller.integrationFinabill.upsertAccount({
      externalId: "fb-coa-102",
      name: "Rent Expense",
      accountCode: "5100",
      accountType: "expense",
    });
    expect(result.created).toBe(false);
    expect(result.id).toBe(preexisting.id);

    const [row] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, preexisting.id))
      .limit(1);
    expect(row!.externalId).toBe("fb-coa-102");
    expect(row!.externalSystem).toBe("finabill");
  });

  it("falls back to accountType+name matching (case-insensitive)", async () => {
    const db = getDb();
    const [preexisting] = (await db
      .insert(accounts)
      .values({
        businessId: testBusinessId,
        locationId: testLocationId,
        name: "Office Supplies",
        type: "bank_account",
        accountType: "expense",
        isActive: true,
      } as any)
      .returning()) as any[];

    const caller = await makeCaller(testBusinessId);
    const result = await caller.integrationFinabill.upsertAccount({
      externalId: "fb-coa-103",
      name: "office supplies",
      accountType: "expense",
    });
    expect(result.created).toBe(false);
    expect(result.id).toBe(preexisting.id);
  });

  it("enforces the accounts:write scope", async () => {
    const caller = await makeCaller(testBusinessId, ["accounts:read"]);
    await expect(
      caller.integrationFinabill.upsertAccount({
        externalId: "fb-coa-999",
        name: "Nope",
        accountType: "revenue",
      })
    ).rejects.toThrow(/API key missing required scope: accounts:write/);
  });
});

describe("upsertBill + listBills", () => {
  it("creates a bill with items, resolves the supplier, and maps received→pending", async () => {
    const caller = await makeCaller(testBusinessId);
    const result = await caller.integrationFinabill.upsertBill({
      externalId: "fb-bill-1",
      billNumber: "BILL-000001",
      description: "Stock purchase",
      amount: "250.00",
      issueDate: "2026-03-01",
      dueDate: "2026-03-31",
      status: "received",
      supplier: { externalId: "77", name: "Deep Vendor" },
      items: [
        { itemName: "Flour", quantity: "2.000", unitPrice: "50.00", totalPrice: "100.00" },
        { itemName: "Sugar", quantity: "3.000", unitPrice: "50.00", totalPrice: "150.00" },
      ],
    });
    expect(result.created).toBe(true);
    expect(result.status).toBe("pending");

    const db = getDb();
    const [bill] = await db
      .select()
      .from(bills)
      .where(eq(bills.id, result.id))
      .limit(1);
    expect(bill).toBeDefined();
    expect(bill!.businessId).toBe(testBusinessId);
    expect(bill!.locationId).toBe(testLocationId);
    expect(bill!.externalId).toBe("fb-bill-1");
    expect(bill!.externalSystem).toBe("finabill");
    expect(bill!.balanceDue).toBe("250.00");

    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, bill!.supplierId!))
      .limit(1);
    expect(supplier!.name).toBe("Deep Vendor");
    expect(supplier!.externalId).toBe("77");
    expect(supplier!.externalSystem).toBe("finabill");

    const items = await db
      .select()
      .from(billItems)
      .where(eq(billItems.billId, result.id));
    expect(items.filter((i) => !i.deletedAt)).toHaveLength(2);
  });

  it("updates by externalId, replaces items wholesale, and maps paid→paid", async () => {
    const caller = await makeCaller(testBusinessId);
    const created = await caller.integrationFinabill.upsertBill({
      externalId: "fb-bill-1",
      billNumber: "BILL-000001",
      description: "Stock purchase",
      amount: "250.00",
      amountPaid: "250.00",
      issueDate: "2026-03-01",
      dueDate: "2026-03-31",
      status: "paid",
      items: [{ itemName: "Flour", quantity: "5.000", unitPrice: "50.00", totalPrice: "250.00" }],
    });
    expect(created.created).toBe(false);
    expect(created.status).toBe("paid");

    const db = getDb();
    const [bill] = await db
      .select()
      .from(bills)
      .where(
        and(eq(bills.businessId, testBusinessId), eq(bills.externalId, "fb-bill-1"))
      )
      .limit(1);
    expect(bill!.status).toBe("paid");
    expect(bill!.balanceDue).toBe("0.00");

    const activeItems = (
      await db.select().from(billItems).where(eq(billItems.billId, bill!.id))
    ).filter((i) => !i.deletedAt);
    expect(activeItems).toHaveLength(1);
    expect(activeItems[0].itemName).toBe("Flour");
  });

  it("maps void→cancelled", async () => {
    const caller = await makeCaller(testBusinessId);
    const result = await caller.integrationFinabill.upsertBill({
      externalId: "fb-bill-2",
      description: "Voided order",
      amount: "80.00",
      issueDate: "2026-03-05",
      dueDate: "2026-03-20",
      status: "void",
    });
    expect(result.status).toBe("cancelled");
  });

  it("listBills returns items plus external linkage and honors updatedSince", async () => {
    const caller = await makeCaller(testBusinessId);
    const all = await caller.integrationFinabill.listBills();
    const bill = all.data.find((b) => b.externalId === "fb-bill-1");
    expect(bill).toBeDefined();
    expect(bill!.externalSystem).toBe("finabill");
    expect(bill!.supplierName).toBe("Deep Vendor");
    expect(bill!.items).toHaveLength(1);
    expect(bill!.items[0].itemName).toBe("Flour");

    const none = await caller.integrationFinabill.listBills({
      updatedSince: "2099-01-01T00:00:00.000Z",
    });
    expect(none.data).toHaveLength(0);
  });
});

describe("upsertSupplier externalId matching", () => {
  it("matches by externalId before name, so renames follow the external row", async () => {
    const caller = await makeCaller(testBusinessId);
    const created = await caller.integrationFinabill.upsertSupplier({
      externalId: "fb-vnd-1",
      name: "Acme Traders",
    });
    expect(created.created).toBe(true);

    const renamed = await caller.integrationFinabill.upsertSupplier({
      externalId: "fb-vnd-1",
      name: "Acme Traders Ltd",
    });
    expect(renamed.created).toBe(false);
    expect(renamed.id).toBe(created.id);

    const db = getDb();
    const [row] = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, created.id))
      .limit(1);
    expect(row!.name).toBe("Acme Traders Ltd");
    expect(row!.externalSystem).toBe("finabill");
  });

  it("falls back to name matching and stamps the externalId onto the local row", async () => {
    const db = getDb();
    const [local] = await db
      .insert(suppliers)
      .values({
        businessId: testBusinessId,
        name: "Local Only Vendor",
      })
      .returning();

    const caller = await makeCaller(testBusinessId);
    const result = await caller.integrationFinabill.upsertSupplier({
      externalId: "fb-vnd-2",
      name: "local only vendor",
    });
    expect(result.created).toBe(false);
    expect(result.id).toBe(local.id);

    const [row] = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, local.id))
      .limit(1);
    expect(row!.externalId).toBe("fb-vnd-2");
    expect(row!.externalSystem).toBe("finabill");
  });
});
