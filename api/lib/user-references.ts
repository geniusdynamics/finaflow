// ABOUTME: Centralizes user-linked record checks before account disablement or deletion.
// ABOUTME: Returns grouped blocking vs informational references and a user-facing summary message.
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  allocationInvites,
  auditLog,
  billPayments,
  businessDocuments,
  businessLogos,
  dailyMpesaLedger,
  dailySales,
  debts,
  employees,
  expenses,
  journalEntries,
  ledgerEntries,
  mpesaTransactions,
  notifications,
  payrollAdvances,
  purchaseOrders,
  pushSubscriptions,
  quickActionsLog,
  refreshTokens,
  userBusinesses,
  userLocations,
} from "@db/schema";
import { getDb } from "../queries/connection";

export type LinkedRecordSummary = {
  label: string;
  resource: string;
  count: number;
  blocking: boolean;
};

export type UserDeletionCheck = {
  userId: number;
  totalCount: number;
  blockingCount: number;
  blockingGroups: LinkedRecordSummary[];
  informationalGroups: LinkedRecordSummary[];
  hasBlockingRecords: boolean;
  hasAnyRecords: boolean;
};

type LinkedRecordGroupConfig = {
  label: string;
  resource: string;
  blocking: boolean;
  count: (userId: number) => Promise<number>;
};

async function countValue(query: Promise<Array<{ count: number | string }>>): Promise<number> {
  const rows = await query;
  const value = rows[0]?.count ?? 0;
  return Number(value);
}

const linkedRecordGroups: LinkedRecordGroupConfig[] = [
  {
    label: "Sales",
    resource: "daily_sales",
    blocking: true,
    count: (userId) =>
      countValue(
        getDb()
          .select({ count: sql<number>`count(*)` })
          .from(dailySales)
          .where(and(eq(dailySales.enteredBy, userId), isNull(dailySales.deletedAt))),
      ),
  },
  {
    label: "Expenses",
    resource: "expenses",
    blocking: true,
    count: (userId) =>
      countValue(
        getDb()
          .select({ count: sql<number>`count(*)` })
          .from(expenses)
          .where(and(eq(expenses.enteredBy, userId), isNull(expenses.deletedAt))),
      ),
  },
  {
    label: "Bill Payments",
    resource: "bill_payments",
    blocking: true,
    count: (userId) =>
      countValue(
        getDb()
          .select({ count: sql<number>`count(*)` })
          .from(billPayments)
          .where(and(eq(billPayments.enteredBy, userId), isNull(billPayments.deletedAt))),
      ),
  },
  {
    label: "Ledger Entries",
    resource: "ledger_entries",
    blocking: true,
    count: (userId) =>
      countValue(
        getDb()
          .select({ count: sql<number>`count(*)` })
          .from(ledgerEntries)
          .where(and(eq(ledgerEntries.createdBy, userId), isNull(ledgerEntries.deletedAt))),
      ),
  },
  {
    label: "Employee Records",
    resource: "employees",
    blocking: true,
    count: (userId) =>
      countValue(
        getDb()
          .select({ count: sql<number>`count(*)` })
          .from(employees)
          .where(and(eq(employees.userId, userId), isNull(employees.deletedAt))),
      ),
  },
  {
    label: "Payroll Approvals",
    resource: "payroll_advances",
    blocking: true,
    count: (userId) =>
      countValue(
        getDb()
          .select({ count: sql<number>`count(*)` })
          .from(payrollAdvances)
          .where(and(eq(payrollAdvances.approvedBy, userId), isNull(payrollAdvances.deletedAt))),
      ),
  },
  {
    label: "M-PESA Imports",
    resource: "mpesa_transactions",
    blocking: true,
    count: (userId) =>
      countValue(
        getDb()
          .select({ count: sql<number>`count(*)` })
          .from(mpesaTransactions)
          .where(and(eq(mpesaTransactions.importedBy, userId), isNull(mpesaTransactions.deletedAt))),
      ),
  },
  {
    label: "Daily M-PESA Ledgers",
    resource: "daily_mpesa_ledger",
    blocking: true,
    count: (userId) =>
      countValue(
        getDb()
          .select({ count: sql<number>`count(*)` })
          .from(dailyMpesaLedger)
          .where(and(eq(dailyMpesaLedger.enteredBy, userId), isNull(dailyMpesaLedger.deletedAt))),
      ),
  },
  {
    label: "Journal Entries",
    resource: "journal_entries",
    blocking: true,
    count: (userId) =>
      countValue(
        getDb()
          .select({ count: sql<number>`count(*)` })
          .from(journalEntries)
          .where(
            and(
              sql`(${journalEntries.createdBy} = ${userId} or ${journalEntries.postedBy} = ${userId} or ${journalEntries.reversedBy} = ${userId})`,
              isNull(journalEntries.deletedAt),
            ),
          ),
      ),
  },
  {
    label: "Audit Log",
    resource: "audit_log",
    blocking: true,
    count: (userId) =>
      countValue(
        getDb()
          .select({ count: sql<number>`count(*)` })
          .from(auditLog)
          .where(eq(auditLog.changedBy, userId)),
      ),
  },
  {
    label: "Business Documents",
    resource: "business_documents",
    blocking: true,
    count: (userId) =>
      countValue(
        getDb()
          .select({ count: sql<number>`count(*)` })
          .from(businessDocuments)
          .where(and(eq(businessDocuments.uploadedBy, userId), isNull(businessDocuments.deletedAt))),
      ),
  },
  {
    label: "Business Logos",
    resource: "business_logos",
    blocking: true,
    count: (userId) =>
      countValue(
        getDb()
          .select({ count: sql<number>`count(*)` })
          .from(businessLogos)
          .where(and(eq(businessLogos.uploadedBy, userId), isNull(businessLogos.deletedAt))),
      ),
  },
  {
    label: "Debts",
    resource: "debts",
    blocking: true,
    count: (userId) =>
      countValue(
        getDb()
          .select({ count: sql<number>`count(*)` })
          .from(debts)
          .where(and(eq(debts.createdBy, userId), isNull(debts.deletedAt))),
      ),
  },
  {
    label: "Purchase Orders",
    resource: "purchase_orders",
    blocking: true,
    count: (userId) =>
      countValue(
        getDb()
          .select({ count: sql<number>`count(*)` })
          .from(purchaseOrders)
          .where(and(eq(purchaseOrders.createdBy, userId), isNull(purchaseOrders.deletedAt))),
      ),
  },
  {
    label: "Business Memberships",
    resource: "user_businesses",
    blocking: false,
    count: (userId) =>
      countValue(
        getDb()
          .select({ count: sql<number>`count(*)` })
          .from(userBusinesses)
          .where(and(eq(userBusinesses.userId, userId), eq(userBusinesses.isActive, true))),
      ),
  },
  {
    label: "Location Assignments",
    resource: "user_locations",
    blocking: false,
    count: (userId) =>
      countValue(
        getDb()
          .select({ count: sql<number>`count(*)` })
          .from(userLocations)
          .where(and(eq(userLocations.userId, userId), eq(userLocations.isActive, true))),
      ),
  },
  {
    label: "Allocation Invites",
    resource: "allocation_invites",
    blocking: false,
    count: (userId) =>
      countValue(
        getDb()
          .select({ count: sql<number>`count(*)` })
          .from(allocationInvites)
          .where(
            and(
              sql`(${allocationInvites.createdBy} = ${userId} or ${allocationInvites.consumedByPartnerUserId} = ${userId})`,
              isNull(allocationInvites.deletedAt),
            ),
          ),
      ),
  },
  {
    label: "Notifications",
    resource: "notifications",
    blocking: false,
    count: (userId) =>
      countValue(
        getDb()
          .select({ count: sql<number>`count(*)` })
          .from(notifications)
          .where(and(eq(notifications.userId, userId), sql`${notifications.archivedAt} is null`)),
      ),
  },
  {
    label: "Quick Actions",
    resource: "quick_actions_log",
    blocking: false,
    count: (userId) =>
      countValue(
        getDb()
          .select({ count: sql<number>`count(*)` })
          .from(quickActionsLog)
          .where(eq(quickActionsLog.userId, userId)),
      ),
  },
  {
    label: "Push Subscriptions",
    resource: "push_subscriptions",
    blocking: false,
    count: (userId) =>
      countValue(
        getDb()
          .select({ count: sql<number>`count(*)` })
          .from(pushSubscriptions)
          .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.isActive, true))),
      ),
  },
  {
    label: "Refresh Tokens",
    resource: "refresh_tokens",
    blocking: false,
    count: (userId) =>
      countValue(
        getDb()
          .select({ count: sql<number>`count(*)` })
          .from(refreshTokens)
          .where(and(eq(refreshTokens.userId, userId), eq(refreshTokens.isRevoked, false))),
      ),
  },
];

export async function findLinkedRecordsForUser(userId: number): Promise<UserDeletionCheck> {
  const groups = (
    await Promise.all(
      linkedRecordGroups.map(async (group) => {
        const count = await group.count(userId);
        if (count <= 0) {
          return null;
        }

        return {
          label: group.label,
          resource: group.resource,
          count,
          blocking: group.blocking,
        } satisfies LinkedRecordSummary;
      }),
    )
  ).filter((group): group is LinkedRecordSummary => group !== null);

  const blockingGroups = groups.filter((group) => group.blocking);
  const informationalGroups = groups.filter((group) => !group.blocking);
  const totalCount = groups.reduce((sum, group) => sum + group.count, 0);
  const blockingCount = blockingGroups.reduce((sum, group) => sum + group.count, 0);

  return {
    userId,
    totalCount,
    blockingCount,
    blockingGroups,
    informationalGroups,
    hasBlockingRecords: blockingGroups.length > 0,
    hasAnyRecords: groups.length > 0,
  };
}

function formatGroupLines(groups: LinkedRecordSummary[]): string[] {
  return groups.map((group) => `- ${group.label} (${group.count})`);
}

export function formatLinkedRecordsMessage(check: UserDeletionCheck): string {
  if (!check.hasAnyRecords) {
    return "This user has no linked records and can be deleted safely.";
  }

  const sections: string[] = [];

  if (check.hasBlockingRecords) {
    sections.push("This user cannot be deleted because historical records still reference the account.");
    sections.push("");
    sections.push("Blocking records:");
    sections.push(...formatGroupLines(check.blockingGroups));

    if (check.informationalGroups.length > 0) {
      sections.push("");
      sections.push("Informational records:");
      sections.push(...formatGroupLines(check.informationalGroups));
    }

    sections.push("");
    sections.push("Disable the account instead if you need to stop access without losing history.");
    return sections.join("\n");
  }

  sections.push("This user has no blocking historical records.");
  sections.push("");
  sections.push("Informational records:");
  sections.push(...formatGroupLines(check.informationalGroups));
  sections.push("");
  sections.push("The account can be deleted, but disabling is safer if you want to preserve access history.");
  return sections.join("\n");
}
