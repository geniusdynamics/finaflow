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
