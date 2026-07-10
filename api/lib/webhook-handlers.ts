// ABOUTME: Provider-specific incoming webhook handlers for FinaFlow.
// ABOUTME: Currently implements the FinaBill handler; unknown providers are rejected.
import { eq, and, isNull, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { accounts, suppliers } from "@db/schema";

export type FinabillWebhookPayload = {
  event: string;
  businessId: number;
  data: Record<string, unknown>;
};

async function refreshAccountFromWebhook(businessId: number, data: Record<string, unknown>) {
  const db = getDb();
  const name = typeof data.name === "string" ? data.name : null;
  if (!name) {
    return { updated: false, reason: "missing account name" };
  }

  const externalId = data.externalId ? String(data.externalId) : null;
  const accountCode = data.accountCode ? String(data.accountCode) : null;

  const existing = externalId
    ? await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.businessId, businessId),
            eq(accounts.externalId, externalId),
            isNull(accounts.deletedAt)
          )
        )
        .limit(1)
    : await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.businessId, businessId),
            eq(accounts.name, name),
            isNull(accounts.deletedAt)
          )
        )
        .limit(1);

  if (existing[0]) {
    await db
      .update(accounts)
      .set({
        accountCode: accountCode ?? existing[0].accountCode,
        accountType: (data.accountType as string) ?? existing[0].accountType,
        accountSubType: (data.accountSubType as string) ?? existing[0].accountSubType,
        externalSystem: externalId ? "finabill" : existing[0].externalSystem,
        externalId: externalId ?? existing[0].externalId,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, existing[0].id));
    return { updated: true, accountId: existing[0].id };
  }

  const [created] = (await db
    .insert(accounts)
    .values({
      businessId,
      name,
      type: (data.type as string) ?? "bank_account",
      accountCode,
      accountType: (data.accountType as string) ?? null,
      accountSubType: (data.accountSubType as string) ?? null,
      externalId: externalId ?? undefined,
      externalSystem: "finabill",
      lastSyncedAt: new Date(),
    } as any)
    .returning()) as any[];

  return { updated: true, created: true, accountId: created.id };
}

async function refreshSupplierFromWebhook(businessId: number, data: Record<string, unknown>) {
  const db = getDb();
  const name = typeof data.name === "string" ? data.name : null;
  if (!name) {
    return { updated: false, reason: "missing supplier name" };
  }

  const existing = await db
    .select()
    .from(suppliers)
    .where(
      and(
        eq(suppliers.businessId, businessId),
        sql`LOWER(${suppliers.name}) = LOWER(${name})`,
        isNull(suppliers.deletedAt)
      )
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(suppliers)
      .set({
        name,
        email: (data.email as string) ?? existing[0].email,
        phone: (data.phone as string) ?? existing[0].phone,
        kraPin: (data.taxId as string) ?? existing[0].kraPin,
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, existing[0].id));
    return { updated: true, supplierId: existing[0].id };
  }

  const [created] = (await db
    .insert(suppliers)
    .values({
      businessId,
      name,
      email: (data.email as string) ?? null,
      phone: (data.phone as string) ?? null,
      kraPin: (data.taxId as string) ?? null,
    } as any)
    .returning()) as any[];

  return { updated: true, created: true, supplierId: created.id };
}

export async function handleFinabillWebhook(
  payload: FinabillWebhookPayload
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { event, businessId, data } = payload;
  if (!businessId || !event) {
    return { status: 400, body: { error: "Missing businessId or event" } };
  }

  switch (event) {
    case "coa.updated": {
      const result = await refreshAccountFromWebhook(businessId, data);
      return { status: 200, body: { received: true, event, ...result } };
    }
    case "supplier.updated": {
      const result = await refreshSupplierFromWebhook(businessId, data);
      return { status: 200, body: { received: true, event, ...result } };
    }
    default:
      return { status: 200, body: { received: true, event, handled: false } };
  }
}

export async function handleProviderWebhook(
  provider: string,
  payload: Record<string, unknown>
): Promise<{ status: number; body: Record<string, unknown> }> {
  switch (provider) {
    case "finabill":
      return handleFinabillWebhook(payload as FinabillWebhookPayload);
    default:
      return {
        status: 501,
        body: { error: `Provider "${provider}" webhook handler not implemented` },
      };
  }
}
