import { eq, and, isNull, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import {
  dailySales,
  dailySalePayments,
  accounts,
  ledgerEntries,
  locations,
  paymentMethods,
  locationPaymentMethods,
  externalChannelMappings,
} from "@db/schema";
import { d } from "./decimal";

export type DailySalesIngestionInput = {
  businessId: number;
  locationId: number;
  saleDate: string;
  sourceSystem: string;
  sourceBatchId: string;
  payments: Array<{ channel: string; amount: string; externalAccountCode?: string }>;
  discountAmount?: string;
  voidAmount?: string;
  unpaidAmount?: string;
  ticketCount?: number;
  orderCount?: number;
  notes?: string;
};

export type DailySalesIngestionResult = {
  success: true;
  dailySaleId: number;
  netSales: string;
  warnings: string[];
  created: boolean;
} | {
  success: false;
  error: string;
  warnings?: string[];
};

type ChannelMapping = {
  paymentMethodId: number;
  accountId: number | null;
  channelKey: string;
  channelLabel?: string | null;
};

async function resolveChannelMappings(
  businessId: number,
  sourceSystem: string,
  channels: string[]
): Promise<{ mappings: Map<string, ChannelMapping>; warnings: string[] }> {
  const db = getDb();
  const mappings = new Map<string, ChannelMapping>();
  const warnings: string[] = [];

  const explicitMappings = await db
    .select({
      channelKey: externalChannelMappings.channelKey,
      channelLabel: externalChannelMappings.channelLabel,
      paymentMethodId: externalChannelMappings.paymentMethodId,
      accountId: externalChannelMappings.accountId,
    })
    .from(externalChannelMappings)
    .where(
      and(
        eq(externalChannelMappings.businessId, businessId),
        eq(externalChannelMappings.sourceSystem, sourceSystem),
        eq(externalChannelMappings.isActive, true),
        isNull(externalChannelMappings.deletedAt)
      )
    );

  const explicitByChannel = new Map(
    explicitMappings.map((m) => [m.channelKey.toLowerCase(), m])
  );

  const paymentMethodRows = await db
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.businessId, businessId), eq(paymentMethods.isActive, true), isNull(paymentMethods.deletedAt)));

  const paymentMethodByCode = new Map(
    paymentMethodRows.map((pm) => [pm.code.toLowerCase(), pm])
  );

  for (const channel of channels) {
    const normalized = channel.toLowerCase();
    const explicit = explicitByChannel.get(normalized);

    if (explicit) {
      mappings.set(channel, {
        paymentMethodId: Number(explicit.paymentMethodId),
        accountId: explicit.accountId ? Number(explicit.accountId) : null,
        channelKey: channel,
        channelLabel: explicit.channelLabel,
      });
      continue;
    }

    const fallback = paymentMethodByCode.get(normalized);
    if (fallback) {
      mappings.set(channel, {
        paymentMethodId: fallback.id,
        accountId: null,
        channelKey: channel,
        channelLabel: fallback.name,
      });
      continue;
    }

    warnings.push(`Unmapped payment channel: ${channel}`);
  }

  return { mappings, warnings };
}

function logIntegration(
  input: Pick<DailySalesIngestionInput, "businessId" | "sourceSystem" | "sourceBatchId">,
  status: string,
  extras?: Record<string, unknown>
) {
  const payload: Record<string, unknown> = {
    businessId: input.businessId,
    sourceSystem: input.sourceSystem,
    sourceBatchId: input.sourceBatchId,
    operation: "daily_sales.ingest",
    status,
    ...extras,
  };
  const message = `[integration] ${JSON.stringify(payload)}`;
  if (status === "failed") {
    console.error(message);
  } else {
    console.log(message);
  }
}

export async function ingestDailySales(
  input: DailySalesIngestionInput,
  enteredBy = 0
): Promise<DailySalesIngestionResult> {
  const db = getDb();
  logIntegration(input, "started", {
    channelCount: input.payments.length,
    locationId: input.locationId,
  });

  if (!input.sourceBatchId?.trim()) {
    const error = "sourceBatchId is required";
    logIntegration(input, "failed", { error });
    return { success: false, error };
  }

  if (!input.locationId) {
    const error = "locationId is required";
    logIntegration(input, "failed", { error });
    return { success: false, error };
  }

  const [location] = await db
    .select()
    .from(locations)
    .where(
      and(
        eq(locations.id, input.locationId),
        eq(locations.businessId, input.businessId),
        eq(locations.isActive, true),
        isNull(locations.deletedAt)
      )
    )
    .limit(1);

  if (!location) {
    const error = "Location not found for business or inactive";
    logIntegration(input, "failed", { error });
    return { success: false, error };
  }

  const locationId = location.id;
  const saleDateStr = new Date(input.saleDate).toISOString().split("T")[0];

  // Idempotency check by sourceBatchId
  if (input.sourceBatchId) {
    const existing = await db
      .select({ id: dailySales.id })
      .from(dailySales)
      .where(
        and(
          eq(dailySales.locationId, locationId),
          eq(dailySales.sourceBatchId, input.sourceBatchId),
          isNull(dailySales.deletedAt)
        )
      )
      .limit(1);

    if (existing[0]) {
      const row = await db
        .select()
        .from(dailySales)
        .where(eq(dailySales.id, existing[0].id))
        .limit(1);
      logIntegration(input, "idempotent", {
        dailySaleId: existing[0].id,
        netSales: row[0]?.netSales ?? "0.00",
      });
      return {
        success: true,
        dailySaleId: existing[0].id,
        netSales: row[0]?.netSales ?? "0.00",
        warnings: [],
        created: false,
      };
    }
  }

  // Also guard against duplicate date entry without sourceBatchId
  const existingByDate = await db
    .select({ id: dailySales.id })
    .from(dailySales)
    .where(
      and(
        eq(dailySales.locationId, locationId),
        sql`${dailySales.saleDate} = ${saleDateStr}`,
        isNull(dailySales.deletedAt)
      )
    )
    .limit(1);

  if (existingByDate[0]) {
    const error = "Daily sales entry already exists for this date";
    logIntegration(input, "failed", { error });
    return {
      success: false,
      error,
    };
  }

  const channels = input.payments.map((p) => p.channel);
  const { mappings, warnings } = await resolveChannelMappings(
    input.businessId,
    input.sourceSystem,
    channels
  );

  const mappedPayments = input.payments
    .map((p) => {
      const mapping = mappings.get(p.channel);
      if (!mapping) return null;
      return {
        ...p,
        paymentMethodId: mapping.paymentMethodId,
        accountId: mapping.accountId,
      };
    })
    .filter(Boolean) as Array<{
      channel: string;
      amount: string;
      externalAccountCode?: string;
      paymentMethodId: number;
      accountId: number | null;
    }>;

  if (mappedPayments.length === 0) {
    const error = "No mapped payment channels; cannot create daily sales entry";
    logIntegration(input, "failed", { error, warnings });
    return {
      success: false,
      error,
      warnings,
    };
  }

  const grossSales = mappedPayments.reduce((sum, p) => sum.plus(d(p.amount)), d(0));
  const discountAmount = input.discountAmount ?? "0.00";
  const voidAmount = input.voidAmount ?? "0.00";
  const unpaidAmount = input.unpaidAmount ?? "0.00";
  const netSales = grossSales.plus(d(unpaidAmount)).minus(d(discountAmount)).minus(d(voidAmount));

  let saleId = 0;
  await db.transaction(async (tx) => {
    const [result] = await tx
      .insert(dailySales)
      .values({
        locationId,
        sourceBatchId: input.sourceBatchId,
        saleDate: new Date(input.saleDate),
        netSales: netSales.toFixed(2),
        discountAmount,
        voidAmount,
        unpaidAmount,
        ticketCount: input.ticketCount ?? 0,
        orderCount: input.orderCount ?? 0,
        notes: input.notes,
        enteredBy,
      } as any)
      .returning();
    saleId = result.id;

    const revenueSubtype = "sales_revenue";
    const revenueAcct = await tx
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.businessId, input.businessId),
          eq(accounts.accountSubType, revenueSubtype as any),
          isNull(accounts.deletedAt)
        )
      )
      .limit(1);
    const revenueAccountId = revenueAcct[0]?.id;

    for (const payment of mappedPayments) {
      if (d(payment.amount).lte(0)) continue;

      await tx
        .insert(dailySalePayments)
        .values({
          dailySaleId: saleId,
          paymentMethodId: payment.paymentMethodId,
          amount: payment.amount,
        } as any)
        .returning();

      let accountId = payment.accountId;
      if (!accountId) {
        const junction = await tx
          .select()
          .from(locationPaymentMethods)
          .where(
            and(
              eq(locationPaymentMethods.locationId, locationId),
              eq(locationPaymentMethods.paymentMethodId, payment.paymentMethodId),
              eq(locationPaymentMethods.isActive, true)
            )
          )
          .limit(1);
        accountId = junction[0]?.linkedAccountId
          ? Number(junction[0].linkedAccountId)
          : null;
      }

      if (accountId) {
        const cashAcct = await tx
          .select()
          .from(accounts)
          .where(eq(accounts.id, accountId))
          .limit(1);
        if (cashAcct[0]) {
          const cashNewBal = d(cashAcct[0].currentBalance || "0").plus(d(payment.amount));
          await tx
            .insert(ledgerEntries)
            .values({
              accountId: cashAcct[0].id,
              transactionType: "sale",
              transactionId: saleId,
              entryType: "debit",
              amount: payment.amount,
              balanceAfter: cashNewBal.toFixed(2),
              entryDate: saleDateStr,
              createdBy: enteredBy,
            } as any)
            .returning();
          await tx
            .update(accounts)
            .set({ currentBalance: cashNewBal.toFixed(2) })
            .where(eq(accounts.id, cashAcct[0].id));
        }
      }
    }

    if (revenueAccountId && netSales.gt(0)) {
      const revenueAcct = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, revenueAccountId))
        .limit(1);
      if (revenueAcct[0]) {
        const revenueNewBal = d(revenueAcct[0].currentBalance || "0").plus(netSales);
        await tx
          .insert(ledgerEntries)
          .values({
            accountId: revenueAccountId,
            transactionType: "sale" as any,
            transactionId: saleId,
            entryType: "credit",
            amount: netSales.toFixed(2),
            balanceAfter: revenueNewBal.toFixed(2),
            entryDate: saleDateStr,
            createdBy: enteredBy,
            description: "Daily Sales - external ingestion",
          } as any)
          .returning();
        await tx
          .update(accounts)
          .set({ currentBalance: revenueNewBal.toFixed(2) })
          .where(eq(accounts.id, revenueAccountId));
      }
    }

    if (d(unpaidAmount).gt(0)) {
      const arAcct = await tx.query.accounts.findFirst({
        where: and(
          eq(accounts.accountCode, "1300"),
          eq(accounts.businessId, input.businessId),
          isNull(accounts.deletedAt)
        ),
      });
      if (arAcct) {
        const arNewBal = d(arAcct.currentBalance || "0").plus(d(unpaidAmount));
        await tx
          .insert(ledgerEntries)
          .values({
            accountId: arAcct.id,
            transactionType: "sale" as any,
            transactionId: saleId,
            entryType: "debit",
            amount: unpaidAmount,
            balanceAfter: arNewBal.toFixed(2),
            entryDate: saleDateStr,
            createdBy: enteredBy,
            description: "Credit Sale - external ingestion",
          } as any)
          .returning();
        await tx
          .update(accounts)
          .set({ currentBalance: arNewBal.toFixed(2) })
          .where(eq(accounts.id, arAcct.id));
      }
    }
  });

  logIntegration(input, "success", {
    dailySaleId: saleId,
    netSales: netSales.toFixed(2),
    warningCount: warnings.length,
  });

  return {
    success: true,
    dailySaleId: saleId,
    netSales: netSales.toFixed(2),
    warnings,
    created: true,
  };
}
