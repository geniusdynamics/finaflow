// ABOUTME: Creates the tRPC context by authenticating requests via cookie JWT (finaflow_token) or Bearer token fallback.
// ABOUTME: Resolves user identity, business assignments, and partner allocation rights for authorisation downstream.
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "@db/schema";
import { verifyLocalToken } from "./local-auth-router";
import { getDb } from "./queries/connection";
import { users, businesses, userBusinesses, partnerAllocations } from "@db/schema";
import { eq, and, isNull } from "drizzle-orm";
import * as cookie from "cookie";
import type { RightsProfile } from "./lib/partner-allocations";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User & {
    currentBusiness?: typeof businesses.$inferSelect | null;
    businessIds?: number[];
    allocationRightsProfile?: RightsProfile | null;
    accessSource?: "owned" | "allocated";
  };
};

async function resolveAllocationAccess(
  userId: number,
  businessId: number | null | undefined,
): Promise<{ allocationRightsProfile: RightsProfile | null; accessSource: "owned" | "allocated" }> {
  if (!businessId) {
    return { allocationRightsProfile: null, accessSource: "owned" };
  }
  const db = getDb();
  const allocationRows = await db.select({ rightsProfile: partnerAllocations.rightsProfile })
    .from(partnerAllocations)
    .where(and(
      eq(partnerAllocations.partnerUserId, userId),
      eq(partnerAllocations.ownerBusinessId, businessId),
      eq(partnerAllocations.status, "active"),
      isNull(partnerAllocations.deletedAt),
    ))
    .limit(1);

  const allocation = allocationRows[0];
  if (!allocation) {
    return { allocationRightsProfile: null, accessSource: "owned" };
  }

  return {
    allocationRightsProfile: allocation.rightsProfile,
    accessSource: "allocated",
  };
}

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };

  // Try cookie-based JWT first
  try {
    const cookies = cookie.parse(opts.req.headers.get("cookie") || "");
    const token = cookies["finaflow_token"];
    if (token) {
      const claim = await verifyLocalToken(token);
      if (claim) {
        const db = getDb();
        const rows = await db.select().from(users).where(eq(users.id, claim.userId)).limit(1);
        const user = rows[0];
        if (user && user.isActive) {
          const junctions = await db.select().from(userBusinesses)
            .where(and(eq(userBusinesses.userId, user.id), eq(userBusinesses.isActive, true)));
          const bizIds = junctions.map(j => j.businessId);
          let currentBusiness: typeof businesses.$inferSelect | null = null;
          if (user.currentBusinessId) {
            const biz = await db.select().from(businesses)
              .where(and(eq(businesses.id, user.currentBusinessId), isNull(businesses.deletedAt))).limit(1);
            currentBusiness = biz[0] ?? null;
          } else if (bizIds.length > 0) {
            const biz = await db.select().from(businesses)
              .where(and(eq(businesses.id, bizIds[0]), isNull(businesses.deletedAt))).limit(1);
            currentBusiness = biz[0] ?? null;
          }
          const allocationAccess = await resolveAllocationAccess(user.id, currentBusiness?.id ?? null);
          ctx.user = { ...user, currentBusiness, businessIds: bizIds, ...allocationAccess };
          return ctx;
        }
      }
    }
  } catch {
    // Cookie auth failed, try Bearer token fallback
  }

  // Try Bearer token fallback
  try {
    const authHeader = opts.req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const claim = await verifyLocalToken(token);
      if (claim) {
        const db = getDb();
        const rows = await db.select().from(users).where(eq(users.id, claim.userId)).limit(1);
        const user = rows[0];
        if (user && user.isActive) {
          const junctions = await db.select().from(userBusinesses)
            .where(and(eq(userBusinesses.userId, user.id), eq(userBusinesses.isActive, true)));
          const bizIds = junctions.map(j => j.businessId);
          let currentBusiness: typeof businesses.$inferSelect | null = null;
          if (user.currentBusinessId) {
            const biz = await db.select().from(businesses)
              .where(and(eq(businesses.id, user.currentBusinessId), isNull(businesses.deletedAt))).limit(1);
            currentBusiness = biz[0] ?? null;
          } else if (bizIds.length > 0) {
            const biz = await db.select().from(businesses)
              .where(and(eq(businesses.id, bizIds[0]), isNull(businesses.deletedAt))).limit(1);
            currentBusiness = biz[0] ?? null;
          }
          const allocationAccess = await resolveAllocationAccess(user.id, currentBusiness?.id ?? null);
          ctx.user = { ...user, currentBusiness, businessIds: bizIds, ...allocationAccess };
          return ctx;
        }
      }
    }
  } catch {
    // Bearer auth failed
  }

  return ctx;
}
