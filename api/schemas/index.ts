// ABOUTME: Shared zod schemas for the external API request/response validation.
// ABOUTME: Single source of truth for integration, connect, and webhook payloads.
import { z } from "zod";

// ── Pagination ─────────────────────────────────────────────────────

export const paginationQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

// ── Integration: Accounts ───────────────────────────────────────────

export const listAccountsQuerySchema = z.object({
  accountType: z.string().optional(),
  ...paginationQuerySchema.shape,
});

export const listAccountTransactionsQuerySchema = z.object({
  sinceEntryId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const upsertAccountSchema = z.object({
  externalId: z.string().min(1),
  name: z.string().min(1).max(100),
  accountCode: z.string().max(20).optional().nullable(),
  accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
  accountSubType: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// ── Integration: Bills & Expenses ───────────────────────────────

export const updatedSinceQuerySchema = z.object({
  updatedSince: z.string().optional(),
  ...paginationQuerySchema.shape,
});

export const upsertBillSchema = z.object({
  externalId: z.string().min(1),
  billNumber: z.string().max(100).optional().nullable(),
  description: z.string().min(1),
  amount: z.string(),
  amountPaid: z.string().optional().nullable(),
  issueDate: z.string(),
  dueDate: z.string(),
  status: z.enum(["draft", "received", "partial", "paid", "void"]),
  locationId: z.number().int().positive().optional().nullable(),
  supplier: z
    .object({
      externalId: z.string().optional().nullable(),
      name: z.string().min(1),
      email: z.string().email().optional().nullable(),
      phone: z.string().optional().nullable(),
      taxId: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  items: z
    .array(
      z.object({
        itemName: z.string().min(1).max(255),
        quantity: z.string().optional().nullable(),
        unitPrice: z.string(),
        totalPrice: z.string(),
        notes: z.string().optional().nullable(),
      }),
    )
    .optional(),
});

// ── Integration: Suppliers ──────────────────────────────────────────

export const upsertSupplierSchema = z.object({
  externalId: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
});

// ── Integration: Categories ────────────────────────────────────────

export const upsertCategorySchema = z.object({
  externalId: z.string().optional(),
  name: z.string().min(1).max(100),
  categoryType: z.enum(["expense", "income"]).optional().default("expense"),
  defaultAccountId: z.number().int().positive().optional().nullable(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// ── Integration: Users ──────────────────────────────────────────────

export const upsertUserSchema = z.object({
  externalId: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  role: z.string().min(1),
  isActive: z.boolean().optional().default(true),
  locationIds: z.array(z.number()).optional().default([]),
});

// ── Integration: Daily Sales ────────────────────────────────────────

export const dailySalesPaymentSchema = z.object({
  channel: z.string(),
  amount: z.string(),
});

export const dailySalesIngestSchema = z.object({
  locationId: z.number(),
  saleDate: z.string().optional(),
  sourceSystem: z.string().optional().default("finabill"),
  sourceBatchId: z.string().min(1),
  payments: z.array(dailySalesPaymentSchema).optional().default([]),
  discountAmount: z.string().optional(),
  voidAmount: z.string().optional(),
  unpaidAmount: z.string().optional(),
  ticketCount: z.number().optional(),
  orderCount: z.number().optional(),
  notes: z.string().optional(),
});

// ── Webhook: Incoming payload ───────────────────────────────────────

export const finabillWebhookPayloadSchema = z.object({
  event: z.string(),
  businessId: z.number(),
  data: z.object({}).passthrough(),
});

// ── Webhook: Outgoing event payload schemas ─────────────────────────

export const saleRecordedPayloadSchema = z.object({
  dailySaleId: z.number(),
  saleDate: z.string(),
  netSales: z.string(),
});

export const expenseCreatedPayloadSchema = z.object({
  expenseId: z.number(),
  amount: z.string(),
  accountId: z.number().nullable(),
});

export const billPaidPayloadSchema = z.object({
  billId: z.number(),
  paymentId: z.number(),
  amount: z.string(),
});

export const coaUpdatedPayloadSchema = z.object({
  name: z.string(),
  externalId: z.string().optional(),
  accountCode: z.string().optional(),
  accountType: z.string().optional(),
  accountSubType: z.string().optional(),
});

export const supplierUpdatedPayloadSchema = z.object({
  name: z.string(),
  externalId: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  taxId: z.string().optional(),
});

export const journalCreatedPayloadSchema = z.object({
  journalEntryId: z.number(),
  entryDate: z.string(),
  totalDebit: z.string(),
  totalCredit: z.string(),
});

/** Map of event name → payload schema for outgoing webhooks. */
export const WEBHOOK_EVENT_SCHEMAS = {
  "sale.recorded": saleRecordedPayloadSchema,
  "expense.created": expenseCreatedPayloadSchema,
  "bill.paid": billPaidPayloadSchema,
  "coa.updated": coaUpdatedPayloadSchema,
  "supplier.updated": supplierUpdatedPayloadSchema,
  "journal.created": journalCreatedPayloadSchema,
} as const;

export type WebhookEvent = keyof typeof WEBHOOK_EVENT_SCHEMAS;
