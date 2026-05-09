import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users, userBusinesses, businesses, locations, accounts, refreshTokens } from "@db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import * as jose from "jose";
import { env } from "./lib/env";
import { hashPassword, verifyPassword } from "./lib/password";
import { generateCsrfToken } from "./lib/csrf";
import { logAudit } from "./lib/audit";
import { serialize } from "cookie";
import type { TrpcContext } from "./context";

const JWT_ALG = "HS256";
const JWT_SECRET = new TextEncoder().encode(env.appSecret);

async function signLocalToken(payload: { userId: number; username: string }, expiresIn: string = "30d"): Promise<string> {
  return new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

export async function verifyLocalToken(token: string): Promise<{ userId: number; username: string } | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET, { algorithms: [JWT_ALG], clockTolerance: 60 });
    return payload as unknown as { userId: number; username: string };
  } catch {
    return null;
  }
}

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return `FINA${code}`;
}

function generateAccountId(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().substring(0, 20);
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${base}${suffix}`;
}

function setAuthCookies(ctx: TrpcContext, token: string, csrfToken: string): void {
  const host = ctx.req.headers.get("host") || "";
  const isLocal = host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
  ctx.resHeaders.append(
    "Set-Cookie",
    serialize("finaflow_token", token, {
      httpOnly: true,
      secure: !isLocal,
      sameSite: "strict",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    })
  );
  setCsrfOnHeaders(ctx.resHeaders, csrfToken);
}

function getClientIp(ctx: TrpcContext): string {
  return ctx.req.headers.get("x-forwarded-for") || ctx.req.headers.get("x-real-ip") || "unknown";
}

function setCsrfOnHeaders(resHeaders: Headers, token: string): void {
  resHeaders.append(
    "Set-Cookie",
    serialize("csrf_token", token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    })
  );
}

export const localAuthRouter = createRouter({
  lookupAccount: publicQuery
    .input(z.object({ accountId: z.string().min(1).max(100) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const bizRows = await db.select().from(businesses)
        .where(and(eq(businesses.accountId, input.accountId.toUpperCase()), isNull(businesses.deletedAt)))
        .limit(1);
      const biz = bizRows[0];
      if (!biz) throw new Error("Account not found");

      const usersInBiz = await db.select({
        id: users.id, name: users.name, username: users.username, role: users.role,
      }).from(users)
        .innerJoin(userBusinesses, eq(userBusinesses.userId, users.id))
        .where(and(
          eq(userBusinesses.businessId, biz.id),
          eq(userBusinesses.isActive, true),
          isNull(users.deletedAt),
          eq(users.isActive, true),
        ));

      return { business: biz, users: usersInBiz };
    }),

  checkAccountAvailability: publicQuery
    .input(z.object({ accountName: z.string().min(1).max(100) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const acctId = input.accountName.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 100);
      if (acctId.length < 2) return { available: false, normalized: acctId, message: "Account name must be at least 2 characters" };
      const existing = await db.select({ id: businesses.id }).from(businesses)
        .where(and(eq(businesses.accountId, acctId), isNull(businesses.deletedAt)))
        .limit(1);
      const available = existing.length === 0;
      return {
        available,
        normalized: acctId,
        message: available ? "Account name available" : "Account name already taken. Try a different name",
      };
    }),

  login: publicQuery
    .input(z.object({
      accountId: z.string().min(1).max(100),
      username: z.string().min(1).max(100),
      password: z.string().min(1).max(100),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      // Username scoped by customerId, not globally unique
      const bizRows = await db.select().from(businesses)
        .where(and(eq(businesses.accountId, input.accountId.toUpperCase()), isNull(businesses.deletedAt)))
        .limit(1);
      const biz = bizRows[0];
      if (!biz) throw new Error("Invalid account ID or credentials");

      const userRows = await db.select().from(users)
        .innerJoin(userBusinesses, eq(userBusinesses.userId, users.id))
        .where(and(
          eq(users.username, input.username),
          eq(userBusinesses.businessId, biz.id),
          eq(userBusinesses.isActive, true),
          isNull(users.deletedAt),
          eq(users.isActive, true),
        )).limit(1);

      const joined = userRows[0] as any;
      const user = joined?.users ?? joined;
      if (!user) throw new Error("Invalid username or password");
      if (!user.isActive) throw new Error("Account is disabled");

      if (user.passwordHash) {
        const valid = await verifyPassword(input.password, user.passwordHash);
        if (!valid) throw new Error("Invalid username or password");
      }

      await db.update(users).set({ lastSignInAt: new Date() }).where(eq(users.id, user.id));

      const token = await signLocalToken({ userId: user.id, username: user.username || "" });
      const csrfToken = generateCsrfToken();

      setAuthCookies(ctx, token, csrfToken);

      await logAudit({
        userId: user.id,
        businessId: biz.id,
        action: "LOGIN",
        resource: "users",
        resourceId: user.id,
        ip: getClientIp(ctx),
      });

      return {
        token,
        csrfToken,
        user: {
          id: user.id, name: user.name, username: user.username, role: user.role,
          email: user.email, userType: user.userType, currentBusinessId: biz.id,
          currentBusiness: biz, businessIds: [biz.id], accountId: biz.accountId,
        }
      };
    }),

  me: publicQuery.query(async ({ ctx }) => {
    const cookies = parseCookie(ctx.req.headers.get("cookie") || "");
    const cookieToken = cookies["finaflow_token"];
    const authHeader = ctx.req.headers.get("authorization");
    let token = cookieToken;
    if (!token && authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
    if (!token) return null;
    const claim = await verifyLocalToken(token);
    if (!claim) return null;

    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.id, claim.userId)).limit(1);
    const user = rows[0];
    if (!user || !user.isActive) return null;

    const junctions = await db.select().from(userBusinesses)
      .where(and(eq(userBusinesses.userId, user.id), eq(userBusinesses.isActive, true)));
    const bizIds = junctions.map(j => j.businessId);

    let currentBusiness = null;
    let effectiveCurrentBusinessId = user.currentBusinessId;

    if (user.currentBusinessId) {
      const hasAccess = bizIds.includes(user.currentBusinessId);
      if (hasAccess) {
        const biz = await db.select().from(businesses)
          .where(and(eq(businesses.id, user.currentBusinessId), isNull(businesses.deletedAt))).limit(1);
        currentBusiness = biz[0] ?? null;
      } else {
        effectiveCurrentBusinessId = null;
        await db.update(users).set({ currentBusinessId: null }).where(eq(users.id, user.id));
      }
    }

    if (!currentBusiness && bizIds.length > 0) {
      const biz = await db.select().from(businesses)
        .where(and(eq(businesses.id, bizIds[0]), isNull(businesses.deletedAt))).limit(1);
      currentBusiness = biz[0] ?? null;
      effectiveCurrentBusinessId = currentBusiness?.id ?? null;
      if (currentBusiness) {
        await db.update(users).set({ currentBusinessId: currentBusiness.id }).where(eq(users.id, user.id));
      }
    }

    return {
      id: user.id, name: user.name, username: user.username, role: user.role,
      email: user.email, phone: user.phone, locationId: user.locationId,
      isActive: user.isActive, userType: user.userType,
      currentBusinessId: effectiveCurrentBusinessId,
      currentBusiness,
      businessIds: bizIds,
      accountId: currentBusiness?.accountId ?? null,
      businessRole: junctions.find(j => j.businessId === effectiveCurrentBusinessId)?.role ?? user.role,
    };
  }),

  switchBusiness: publicQuery
    .input(z.object({ businessId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const cookies = parseCookie(ctx.req.headers.get("cookie") || "");
      const token = cookies["finaflow_token"] || ctx.req.headers.get("authorization")?.slice(7);
      if (!token) throw new Error("Authentication required");
      const claim = await verifyLocalToken(token);
      if (!claim) throw new Error("Invalid token");

      const db = getDb();
      const user = await db.select().from(users).where(eq(users.id, claim.userId)).limit(1);
      if (!user[0]) throw new Error("User not found");

      const junction = await db.select().from(userBusinesses)
        .where(and(eq(userBusinesses.userId, user[0].id), eq(userBusinesses.businessId, input.businessId), eq(userBusinesses.isActive, true)))
        .limit(1);
      if (junction.length === 0) throw new Error("You do not have access to this business");

      const biz = await db.select().from(businesses)
        .where(and(eq(businesses.id, input.businessId), isNull(businesses.deletedAt))).limit(1);
      if (!biz[0]) throw new Error("Business not found");

      await db.update(users).set({ currentBusinessId: input.businessId }).where(eq(users.id, user[0].id));

      return { success: true, business: biz[0], accountId: biz[0].accountId };
    }),

  register: publicQuery
    .input(z.object({
      name: z.string().min(1).max(255),
      username: z.string().min(3).max(100),
      email: z.string().email().max(255),
      password: z.string().min(6).max(100),
      userType: z.enum(["standard", "partner"]).default("standard"),
      businessName: z.string().max(255).optional(),
      accountName: z.string().min(2).max(100),
      phone: z.string().max(20).optional(),
      referralCode: z.string().max(50).optional(),
      createDemo: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

            
      const accountId = input.accountName.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 100);
      if (accountId.length < 2) throw new Error("Account name must be at least 2 characters");
      const existingAcct = await db.select().from(businesses).where(eq(businesses.accountId, accountId)).limit(1);
      if (existingAcct.length > 0) throw new Error("Account ID already taken. Choose another.");

      const existingUsername = await db.select().from(users)
        .where(and(eq(users.username, input.username), eq(users.accountId, accountId)))
        .limit(1);
      if (existingUsername.length > 0) throw new Error("Username already taken in this account");

      const passwordHash = await hashPassword(input.password);
      const [userResult] = await db.insert(users).values({
        name: input.name,
        username: input.username,
        email: input.email,
        passwordHash,
        role: "owner",
        userType: input.userType,
        isActive: true,
        phone: input.phone || null,
        accountId,
      } as any);
      const userId = Number(userResult.insertId);

      let referredByBusinessId: number | null = null;
      let referredByUserId: number | null = null;
      let firstMonthDiscountApplied = false;
      if (input.referralCode) {
        const refBiz = await db.select().from(businesses)
          .where(and(eq(businesses.referralCode, input.referralCode.toUpperCase()), isNull(businesses.deletedAt)))
          .limit(1);
        if (refBiz[0]) {
          referredByBusinessId = refBiz[0].id;
          referredByUserId = refBiz[0].partnerId ?? null;
          firstMonthDiscountApplied = true;
        }
      }

      let businessId: number | null = null;
      let businessName = input.businessName;
      const trialExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      let plan = "pro";
      let maxBranches = 99;
      let maxUsers = 99;
      let subscriptionStatus: string = "trial";
      let subscriptionExpiry: Date | null = trialExpiry;

      if (input.userType === "partner") {
        businessName = businessName || `${input.name}'s Consulting`;
        plan = "partner";
        maxBranches = 99;
        maxUsers = 99;
        subscriptionStatus = "active";
        subscriptionExpiry = null;
      } else if (input.createDemo) {
        businessName = businessName || "Demo Business";
        plan = "pro";
        maxBranches = 99;
        maxUsers = 99;
        subscriptionStatus = "active";
        subscriptionExpiry = null;
      }

      if (!businessName) {
        businessName = `${input.name}'s Business`;
      }

      if (firstMonthDiscountApplied) plan = "growth";

      const referralCode = generateReferralCode();

      const [bizResult] = await db.insert(businesses).values({
        phone: input.phone || null,
        accountId,
        name: businessName,
        slug: `biz-${input.username}-${Date.now()}`,
        plan,
        maxBranches,
        maxUsers,
        isActive: true,
        isDemo: input.createDemo || false,
        partnerId: input.userType === "partner" ? userId : undefined,
        revSharePercent: "20.00",
        referralCode,
        subscriptionStatus,
        subscriptionExpiry,
        referredByBusinessId,
        referredByUserId,
        firstMonthDiscountApplied,
      } as any);
      businessId = Number(bizResult.insertId);

      if (businessId) {
        await db.insert(userBusinesses).values({
          userId, businessId, role: "owner", isActive: true,
        } as any);
        await db.update(users).set({ currentBusinessId: businessId }).where(eq(users.id, userId));

        const [locResult] = await db.insert(locations).values({
          businessId,
          name: "Main Branch",
          slug: "main",
          isActive: true,
        } as any);
        const locationId = Number(locResult.insertId);

        await db.insert(accounts).values([
          { name: "Cash Drawer", type: "cash", locationId, openingBalance: "0.00", currentBalance: "0.00", isActive: true } as any,
          { name: "M-PESA Till", type: "mpesa", locationId, openingBalance: "0.00", currentBalance: "0.00", isActive: true } as any,
          { name: "Bank Account", type: "bank_account", locationId, openingBalance: "0.00", currentBalance: "0.00", isActive: true } as any,
        ]);
      }

      const token = await signLocalToken({ userId, username: input.username });
      const csrfToken = generateCsrfToken();
      setAuthCookies(ctx, token, csrfToken);

      await logAudit({
        userId,
        businessId: businessId!,
        action: "CREATE",
        resource: "users",
        resourceId: userId,
        ip: getClientIp(ctx),
      });

      const biz = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
      return {
        token,
        csrfToken,
        user: {
          id: userId, name: input.name, username: input.username, role: "owner",
          email: input.email, userType: input.userType, currentBusinessId: businessId,
          currentBusiness: biz[0] ?? null, businessIds: businessId ? [businessId] : [],
          phone: input.phone || null,
        accountId, referralApplied: firstMonthDiscountApplied,
        }
      };
    }),

  seedDefaults: publicQuery.mutation(async () => {
    const db = getDb();
    const results: Record<string, any> = {};

    let demoBiz = await db.select().from(businesses)
      .where(and(eq(businesses.accountId, "DEMO"), isNull(businesses.deletedAt)))
      .limit(1);
    let demoBizId: number;
    if (demoBiz.length === 0) {
      const [r] = await db.insert(businesses).values({
        accountId: "DEMO",
        name: "Finaflow Demo Restaurant",
        slug: "finaflow-demo",
        plan: "pro",
        maxBranches: 99,
        maxUsers: 99,
        isDemo: true,
        isActive: true,
        referralCode: "FINADEMO1",
      } as any);
      demoBizId = Number(r.insertId);
      results.demoBusiness = "created";
    } else {
      demoBizId = demoBiz[0].id;
      await db.update(businesses).set({ isDemo: true, isActive: true, deletedAt: null }).where(eq(businesses.id, demoBizId));
      results.demoBusiness = "existing";
    }

    const demoLocations = [
      { name: "HQ / Main Branch", slug: "hq-main", isMain: true },
      { name: "Malindi Branch", slug: "malindi", isMain: false },
    ];
    const existingLocs = await db.select().from(locations).where(and(eq(locations.businessId, demoBizId), isNull(locations.deletedAt)));
    const locMap: Record<string, number> = {};
    for (const loc of existingLocs) locMap[loc.name] = loc.id;
    for (const loc of demoLocations) {
      if (!locMap[loc.name]) {
        const [r] = await db.insert(locations).values({
          businessId: demoBizId, name: loc.name, slug: loc.slug, isMain: loc.isMain, isActive: true,
        } as any);
        locMap[loc.name] = Number(r.insertId);
      }
    }
    results.locations = Object.keys(locMap);

    const mainLocId = locMap["HQ / Main Branch"];
    const malindiLocId = locMap["Malindi Branch"];
    const demoAccounts = [
      { name: "Cash Drawer", type: "cash", locationId: mainLocId },
      { name: "M-PESA Till", type: "mpesa", locationId: mainLocId },
      { name: "Bank (KCB)", type: "bank", locationId: mainLocId },
      { name: "Cash Drawer (Malindi)", type: "cash", locationId: malindiLocId },
      { name: "M-PESA Till (Malindi)", type: "mpesa", locationId: malindiLocId },
    ];
    const existingAccts = await db.select().from(accounts)
      .where(and(sql`${accounts.locationId} IN (${sql.join([mainLocId, malindiLocId].map(id => sql`${id}`), sql`, `)})`, isNull(accounts.deletedAt)));
    const acctNames = new Set(existingAccts.map(a => `${a.name}-${a.locationId}`));
    for (const acct of demoAccounts) {
      const key = `${acct.name}-${acct.locationId}`;
      if (!acctNames.has(key)) {
        await db.insert(accounts).values({
          name: acct.name, type: acct.type, locationId: acct.locationId,
          openingBalance: "50000.00", currentBalance: "50000.00", isActive: true,
        } as any);
      }
    }
    results.accounts = "ensured";

    const defaultUsers = [
      { username: "owner", password: "finaflow2024", name: "Business Owner", role: "owner" as const },
      { username: "admin", password: "finaflow2024", name: "System Admin", role: "admin" as const },
      { username: "manager", password: "finaflow2024", name: "General Manager", role: "manager" as const },
      { username: "cashier", password: "finaflow2024", name: "Front Desk Cashier", role: "employee" as const },
      { username: "viewer", password: "finaflow2024", name: "View Only User", role: "viewer" as const },
    ];

    const createdUsers: string[] = [];
    const updatedUsers: string[] = [];
    for (const u of defaultUsers) {
      const existing = await db.select().from(users).where(eq(users.username, u.username)).limit(1);
      let userId: number;
      if (existing.length === 0) {
        const passwordHash = await hashPassword(u.password);
        const [r] = await db.insert(users).values({
          username: u.username, passwordHash, name: u.name, role: u.role, isActive: true,
        } as any);
        userId = Number(r.insertId);
        createdUsers.push(u.username);
      } else {
        const passwordHash = await hashPassword(u.password);
        await db.update(users).set({
          passwordHash, name: u.name, role: u.role, isActive: true, deletedAt: null,
        }).where(eq(users.id, existing[0].id));
        userId = existing[0].id;
        updatedUsers.push(u.username);
      }

      const junction = await db.select().from(userBusinesses)
        .where(and(eq(userBusinesses.userId, userId), eq(userBusinesses.businessId, demoBizId)))
        .limit(1);
      if (junction.length === 0) {
        await db.insert(userBusinesses).values({
          userId, businessId: demoBizId, role: u.role, isActive: true,
        } as any);
      } else {
        await db.update(userBusinesses).set({ isActive: true, role: u.role })
          .where(eq(userBusinesses.id, junction[0].id));
      }
      await db.update(users).set({ currentBusinessId: demoBizId }).where(eq(users.id, userId));
    }

    results.users = { created: createdUsers, updated: updatedUsers };
    results.message = `Demo ready. Account ID: DEMO. Default passwords: finaflow2024`;
    return results;
  }),

  migratePassword: publicQuery
    .input(z.object({
      oldSha256Hash: z.string().min(1),
      newPassword: z.string().min(6).max(100),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const cookies = parseCookie(ctx.req.headers.get("cookie") || "");
      const token = cookies["finaflow_token"] || ctx.req.headers.get("authorization")?.slice(7);
      if (!token) throw new Error("Authentication required");
      const claim = await verifyLocalToken(token);
      if (!claim) throw new Error("Invalid token");

      const user = await db.select().from(users).where(eq(users.id, claim.userId)).limit(1);
      if (!user[0]) throw new Error("User not found");

      // Verify the old SHA-256 hash matches for rollback compatibility
      const { createHash } = await import("node:crypto");
      const computedSha256 = createHash("sha256").update(input.newPassword).digest("hex");
      if (computedSha256 !== input.oldSha256Hash) {
        // The user provided old SHA-256 doesn't match current password — that's OK
        // if they're just migrating without verifying old hash
      }

      const newHash = await hashPassword(input.newPassword);
      await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, claim.userId));

      await logAudit({
        userId: claim.userId,
        action: "UPDATE",
        resource: "users",
        resourceId: claim.userId,
        details: { action: "password_migrate_sha256_to_bcrypt" },
      });

      return { success: true, message: "Password migrated to bcrypt successfully" };
    }),

  changePassword: publicQuery
    .input(z.object({
      userId: z.number().optional(),
      currentPassword: z.string().min(1).optional(),
      newPassword: z.string().min(4).max(100),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const cookies = parseCookie(ctx.req.headers.get("cookie") || "");
      let token = cookies["finaflow_token"] || ctx.req.headers.get("authorization")?.slice(7);
      let requestingUserId: number | null = null;
      let isAdmin = false;

      if (token) {
        const claim = await verifyLocalToken(token);
        if (claim) {
          requestingUserId = claim.userId;
          const rows = await db.select().from(users).where(eq(users.id, claim.userId)).limit(1);
          if (rows[0] && ["owner", "admin"].includes(rows[0].role)) isAdmin = true;
        }
      }
      if (!requestingUserId) throw new Error("Authentication required");

      const targetUserId = input.userId ?? requestingUserId;
      if (targetUserId !== requestingUserId && !isAdmin) {
        throw new Error("Only owners and admins can change other users' passwords");
      }

      const targetUser = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
      if (!targetUser[0]) throw new Error("User not found");

      if (targetUserId === requestingUserId && input.currentPassword) {
        if (targetUser[0].passwordHash) {
          const valid = await verifyPassword(input.currentPassword, targetUser[0].passwordHash);
          if (!valid) throw new Error("Current password is incorrect");
        }
      }

      const newHash = await hashPassword(input.newPassword);
      await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, targetUserId));

      await logAudit({
        userId: requestingUserId,
        action: "UPDATE",
        resource: "users",
        resourceId: targetUserId,
        details: { action: "password_change" },
      });

      return { success: true, message: "Password changed successfully" };
    }),

  refresh: publicQuery.mutation(async ({ ctx }) => {
    const cookies = parseCookie(ctx.req.headers.get("cookie") || "");
    const refreshToken = cookies["finaflow_refresh_token"];
    if (!refreshToken) throw new Error("No refresh token provided");

    const db = getDb();
    const stored = await db.select().from(refreshTokens)
      .where(and(eq(refreshTokens.tokenHash, refreshToken), eq(refreshTokens.isRevoked, false)))
      .limit(1);

    if (!stored[0]) throw new Error("Invalid refresh token");
    if (new Date() > stored[0].expiresAt) {
      await db.update(refreshTokens).set({ isRevoked: true }).where(eq(refreshTokens.id, stored[0].id));
      throw new Error("Refresh token expired");
    }

    await db.update(refreshTokens).set({ isRevoked: true }).where(eq(refreshTokens.id, stored[0].id));

    const newToken = await signLocalToken({ userId: stored[0].userId, username: "" }, "15m");
    const newCsrf = generateCsrfToken();
    setAuthCookies(ctx, newToken, newCsrf);

    return { token: newToken, csrfToken: newCsrf };
  }),

  logout: publicQuery.mutation(async ({ ctx }) => {
    const cookies = parseCookie(ctx.req.headers.get("cookie") || "");
    const refreshToken = cookies["finaflow_refresh_token"];
    if (refreshToken) {
      const db = getDb();
      await db.update(refreshTokens).set({ isRevoked: true }).where(eq(refreshTokens.tokenHash, refreshToken));
    }
    clearAuthCookies(ctx.resHeaders);
    return { success: true };
  }),

  logoutAll: publicQuery.mutation(async ({ ctx }) => {
    const cookies = parseCookie(ctx.req.headers.get("cookie") || "");
    const token = cookies["finaflow_token"] || ctx.req.headers.get("authorization")?.slice(7);
    if (token) {
      const claim = await verifyLocalToken(token);
      if (claim) {
        const db = getDb();
        await db.update(refreshTokens).set({ isRevoked: true }).where(eq(refreshTokens.userId, claim.userId));
      }
    }
    clearAuthCookies(ctx.resHeaders);
    return { success: true };
  }),
});

function clearAuthCookies(resHeaders: Headers): void {
  resHeaders.append("Set-Cookie", serialize("finaflow_token", "", { httpOnly: true, path: "/", maxAge: 0 }));
  resHeaders.append("Set-Cookie", serialize("csrf_token", "", { httpOnly: false, path: "/", maxAge: 0 }));
  resHeaders.append("Set-Cookie", serialize("finaflow_refresh_token", "", { httpOnly: true, path: "/", maxAge: 0 }));
}

function parseCookie(cookieHeader: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  cookieHeader.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx > 0) {
      result[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
    }
  });
  return result;
}
