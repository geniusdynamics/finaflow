import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "@db/schema";
import { authenticateRequest } from "./kimi/auth";
import { verifyLocalToken } from "./local-auth-router";
import { getDb } from "./queries/connection";
import { users, businesses, userBusinesses } from "@db/schema";
import { eq, and, isNull } from "drizzle-orm";
import * as cookie from "cookie";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User & { currentBusiness?: any; businessIds?: number[] };
};

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
          let currentBusiness = null;
          if (user.currentBusinessId) {
            const biz = await db.select().from(businesses)
              .where(and(eq(businesses.id, user.currentBusinessId), isNull(businesses.deletedAt))).limit(1);
            currentBusiness = biz[0] ?? null;
          } else if (bizIds.length > 0) {
            const biz = await db.select().from(businesses)
              .where(and(eq(businesses.id, bizIds[0]), isNull(businesses.deletedAt))).limit(1);
            currentBusiness = biz[0] ?? null;
          }
          ctx.user = { ...user, currentBusiness, businessIds: bizIds };
          return ctx;
        }
      }
    }
  } catch {
    // Cookie auth failed, try Bearer token fallback, then OAuth
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
          let currentBusiness = null;
          if (user.currentBusinessId) {
            const biz = await db.select().from(businesses)
              .where(and(eq(businesses.id, user.currentBusinessId), isNull(businesses.deletedAt))).limit(1);
            currentBusiness = biz[0] ?? null;
          } else if (bizIds.length > 0) {
            const biz = await db.select().from(businesses)
              .where(and(eq(businesses.id, bizIds[0]), isNull(businesses.deletedAt))).limit(1);
            currentBusiness = biz[0] ?? null;
          }
          ctx.user = { ...user, currentBusiness, businessIds: bizIds };
          return ctx;
        }
      }
    }
  } catch {
    // Bearer auth failed, try OAuth
  }

  // Try OAuth (Kimi)
  try {
    const oauthUser = await authenticateRequest(opts.req.headers);
    if (oauthUser) {
      const db = getDb();
      const junctions = await db.select().from(userBusinesses)
        .where(and(eq(userBusinesses.userId, oauthUser.id), eq(userBusinesses.isActive, true)));
      const bizIds = junctions.map(j => j.businessId);
      let currentBusiness = null;
      if (oauthUser.currentBusinessId) {
        const biz = await db.select().from(businesses)
          .where(and(eq(businesses.id, oauthUser.currentBusinessId), isNull(businesses.deletedAt))).limit(1);
        currentBusiness = biz[0] ?? null;
      }
      ctx.user = { ...oauthUser, currentBusiness, businessIds: bizIds };
    }
  } catch {
    // Authentication is optional
  }

  return ctx;
}
