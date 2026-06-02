import { getDb } from "../queries/connection";
import { auditLog } from "@db/schema";

export async function logAudit(params: {
  userId: string | number;
  businessId?: string | number;
  action: "CREATE" | "UPDATE" | "DELETE" | "RESTORE" | "LOGIN" | "LOGOUT";
  resource: string;
  resourceId?: string | number;
  details?: Record<string, unknown>;
  ip?: string;
}) {
  try {
    const db = getDb();
    await db.insert(auditLog).values({
      tableName: params.resource,
      recordId: Number(params.resourceId || 0),
      action: params.action,
      oldValues: null,
      newValues: params.details ? JSON.stringify(params.details) : null,
      changedBy: Number(params.userId),
      ipAddress: params.ip,
    } satisfies typeof auditLog.$inferInsert);
  } catch (e) {
    console.error("[audit] Failed to log:", e);
  }
}

/** Log a cross-account / cross-business unauthorized access attempt for security monitoring */
export async function logCrossAccountAccess(params: {
  userId: number;
  userAccountId: string;
  targetResourceType: string;
  targetId?: string | number;
  targetAccountId?: string;
  action: string;
  reason: string;
  ip?: string;
}) {
  await logAudit({
    userId: params.userId,
    action: "DELETE",
    resource: params.targetResourceType,
    resourceId: params.targetId,
    details: {
      userAccountId: params.userAccountId,
      targetAccountId: params.targetAccountId,
      action: params.action,
      reason: params.reason,
      blocked: true,
    },
    ip: params.ip,
  });
}
