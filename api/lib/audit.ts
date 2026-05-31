import { getDb } from "../queries/connection";
import { auditLog } from "@db/schema";

export async function logAudit(params: {
  userId: string | number;
  businessId?: string | number;
  action: string;
  resource: string;
  resourceId?: string | number;
  details?: Record<string, any>;
  ip?: string;
}) {
  try {
    const db = getDb();
    const { createId } = await import("@paralleldrive/cuid2");
    await db.insert(auditLog).values({
      tableName: params.resource,
      recordId: Number(params.resourceId || 0),
      action: params.action as any,
      oldValues: null,
      newValues: params.details ? JSON.stringify(params.details) : null,
      changedBy: Number(params.userId),
      ipAddress: params.ip,
    } as any);
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
    action: "CROSS_ACCOUNT_ACCESS_BLOCKED",
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
