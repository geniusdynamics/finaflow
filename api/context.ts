// ABOUTME: Creates the tRPC context by authenticating requests via cookie JWT, Bearer token, or API key.
// ABOUTME: Resolves user identity, business assignments, partner allocation rights, and machine-to-machine key scopes.
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "@db/schema";
import { verifyLocalToken } from "./local-auth-router";
import { getDb } from "./queries/connection";
import { users, businesses, userBusinesses, userLocations, appSettings, partnerAllocations } from "@db/schema";
import { eq, and, isNull } from "drizzle-orm";
import * as cookie from "cookie";
import type { RightsProfile } from "./lib/partner-allocations";
import { resolveApiKey, type ResolvedApiKey } from "./lib/api-key-auth";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User & {
    currentBusiness?: typeof businesses.$inferSelect | null;
    businessIds?: number[];
    assignedLocationIds?: number[];
    enforceUserLocation?: boolean;
    allocationRightsProfile?: RightsProfile | null;
    accessSource?: "owned" | "allocated";
  };
  apiKey?: ResolvedApiKey;
  // Machine-to-machine identity extracted from a resolved API key.
  businessId?: number | null;
  apiKeyId?: number;
  apiKeyScopes?: string[];
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

async function loadAssignedLocationIds(userId: number): Promise<number[]> {
  try {
    const db = getDb();
    const rows = await db.select({ locationId: userLocations.locationId }).from(userLocations)
      .where(and(eq(userLocations.userId, userId), eq(userLocations.isActive, true)));
    return rows.map((row) => row.locationId);
  } catch (e) {
    console.warn("[context] loadAssignedLocationIds failed:", (e as Error).message);
    return []; // Gracefully degrade — table or column may not exist
  }
}

async function loadEnforceUserLocation(businessId: number | null | undefined): Promise<boolean> {
  if (!businessId) return false;
  try {
    const db = getDb();
    const rows = await db.select({ value: appSettings.value }).from(appSettings)
      .where(and(eq(appSettings.businessId, businessId), eq(appSettings.key, "enforceLocationAssignment")))
      .limit(1);
    const raw = rows[0]?.value;
    return raw === "true" || raw === "1" || raw === "yes";
  } catch (e) {
    console.warn("[context] loadEnforceUserLocation failed:", (e as Error).message);
    return false; // Gracefully degrade
  }
}

async function resolveUserContext(req: Request): Promise<TrpcContext["user"] | undefined> {
  const cookies = cookie.parse(req.headers.get("cookie") || "");
  const token = cookies["finaflow_token"];
  if (!token) {
    // Try Bearer token fallback for JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return undefined;
    const bearerToken = authHeader.slice(7);
    if (bearerToken.startsWith("fna_")) return undefined; // API keys handled separately

    const claim = await verifyLocalToken(bearerToken);
    if (!claim) return undefined;

    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.id, claim.userId)).limit(1);
    const user = rows[0];
    if (!user || !user.isActive) return undefined;

    return buildUserContext(user);
  }

  const claim = await verifyLocalToken(token);
  if (!claim) return undefined;

  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, claim.userId)).limit(1);
  const user = rows[0];
  if (!user || !user.isActive) return undefined;

  return buildUserContext(user);
}

async function buildUserContext(user: User): Promise<TrpcContext["user"]> {
  const db = getDb();
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
  const assignedLocationIds = await loadAssignedLocationIds(user.id);
  const enforceUserLocation = await loadEnforceUserLocation(currentBusiness?.id ?? null);
  return {
    ...user,
    currentBusiness,
    businessIds: bizIds,
    assignedLocationIds,
    enforceUserLocation,
    ...allocationAccess,
  };
}

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };

  try {
    ctx.user = await resolveUserContext(opts.req);
    if (ctx.user?.currentBusiness) {
      ctx.businessId = ctx.user.currentBusiness.id;
    }
  } catch {
    // ignore user auth errors
  }

  // API-key auth is attempted even if user auth succeeded; callers decide which
  // identity to enforce. This allows integration endpoints to be called by either
  // a logged-in user or a machine-to-machine key.
  try {
    const authHeader = opts.req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const rawKey = authHeader.slice(7).trim();
      if (rawKey.startsWith("fna_")) {
        const resolved = await resolveApiKey(rawKey);
        if (resolved) {
          ctx.apiKey = resolved;
          ctx.businessId = resolved.businessId;
          ctx.apiKeyId = resolved.id;
          ctx.apiKeyScopes = resolved.scopes;
        }
      }
    }
  } catch {
    // ignore api key auth errors
  }

  return ctx;
}
