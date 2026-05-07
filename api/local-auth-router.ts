import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users, userBusinesses, businesses, locations, accounts } from "@db/schema";
import { eq, and, isNull } from "drizzle-orm";
import * as jose from "jose";
import { env } from "./lib/env";

const JWT_ALG = "HS256";
const JWT_SECRET = new TextEncoder().encode(env.appSecret || "finaflow-local-auth-secret-key-2025");

async function signLocalToken(payload: { userId: number; username: string }): Promise<string> {
  return new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
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

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + env.appSecret);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
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

export const localAuthRouter = createRouter({
  // Step 1: Lookup account by accountId (returns business info + available users)
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

  // Step 2: Login with accountId + username + password
  login: publicQuery
    .input(z.object({
      accountId: z.string().min(1).max(100),
      username: z.string().min(1).max(100),
      password: z.string().min(1).max(100),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

      // Find business by accountId
      const bizRows = await db.select().from(businesses)
        .where(and(eq(businesses.accountId, input.accountId.toUpperCase()), isNull(businesses.deletedAt)))
        .limit(1);
      const biz = bizRows[0];
      if (!biz) throw new Error("Invalid account ID or credentials");

      // Find user within this business
      const userRows = await db.select().from(users)
        .innerJoin(userBusinesses, eq(userBusinesses.userId, users.id))
        .where(and(
          eq(users.username, input.username),
          eq(userBusinesses.businessId, biz.id),
          eq(userBusinesses.isActive, true),
          isNull(users.deletedAt),
          eq(users.isActive, true),
        )).limit(1);

      // Drizzle join returns { users: {...}, userBusinesses: {...} }
      const joined = userRows[0] as any;
      const user = joined?.users ?? joined;
      if (!user) throw new Error("Invalid username or password");
      if (!user.isActive) throw new Error("Account is disabled");

      const hashedInput = await hashPassword(input.password);
      if (user.passwordHash && user.passwordHash !== hashedInput) {
        throw new Error("Invalid username or password");
      }

      // Update last sign in
      await db.update(users).set({ lastSignInAt: new Date() }).where(eq(users.id, user.id));

      const token = await signLocalToken({ userId: user.id, username: user.username || "" });
      return {
        token,
        user: {
          id: user.id, name: user.name, username: user.username, role: user.role,
          email: user.email, userType: user.userType, currentBusinessId: biz.id,
          currentBusiness: biz, businessIds: [biz.id], accountId: biz.accountId,
        }
      };
    }),

  me: publicQuery.query(async ({ ctx }) => {
    const authHeader = ctx.req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);
    const claim = await verifyLocalToken(token);
    if (!claim) return null;

    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.id, claim.userId)).limit(1);
    const user = rows[0];
    if (!user || !user.isActive) return null;

    // All assigned businesses
    const junctions = await db.select().from(userBusinesses)
      .where(and(eq(userBusinesses.userId, user.id), eq(userBusinesses.isActive, true)));
    const bizIds = junctions.map(j => j.businessId);

    // Validate current business is still assigned
    let currentBusiness = null;
    let effectiveCurrentBusinessId = user.currentBusinessId;

    if (user.currentBusinessId) {
      const hasAccess = bizIds.includes(user.currentBusinessId);
      if (hasAccess) {
        const biz = await db.select().from(businesses)
          .where(and(eq(businesses.id, user.currentBusinessId), isNull(businesses.deletedAt))).limit(1);
        currentBusiness = biz[0] ?? null;
      } else {
        // Business was deleted or user lost access
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

  // Switch between assigned businesses
  switchBusiness: publicQuery
    .input(z.object({ businessId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const authHeader = ctx.req.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) throw new Error("Authentication required");
      const token = authHeader.slice(7);
      const claim = await verifyLocalToken(token);
      if (!claim) throw new Error("Invalid token");

      const db = getDb();
      const user = await db.select().from(users).where(eq(users.id, claim.userId)).limit(1);
      if (!user[0]) throw new Error("User not found");

      // Validate user has access to requested business
      const junction = await db.select().from(userBusinesses)
        .where(and(
          eq(userBusinesses.userId, user[0].id),
          eq(userBusinesses.businessId, input.businessId),
          eq(userBusinesses.isActive, true),
        )).limit(1);
      if (junction.length === 0) throw new Error("You do not have access to this business");

      const biz = await db.select().from(businesses)
        .where(and(eq(businesses.id, input.businessId), isNull(businesses.deletedAt))).limit(1);
      if (!biz[0]) throw new Error("Business not found");

      await db.update(users).set({ currentBusinessId: input.businessId }).where(eq(users.id, user[0].id));

      return {
        success: true,
        business: biz[0],
        accountId: biz[0].accountId,
      };
    }),

  // Register with accountId + referral code
  register: publicQuery
    .input(z.object({
      name: z.string().min(1).max(255),
      username: z.string().min(3).max(100),
      email: z.string().email().max(255),
      password: z.string().min(6).max(100),
      userType: z.enum(["standard", "partner"]).default("standard"),
      businessName: z.string().max(255).optional(),
      accountId: z.string().max(100).optional(),
      referralCode: z.string().max(50).optional(),
      createDemo: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

      // Check username uniqueness within the context of... actually for new registrations
      // we create a new business, so we just need to ensure the username doesn't collide
      // globally for now, OR we scope by business. Let's keep global unique for safety.
      const existing = await db.select().from(users).where(eq(users.username, input.username)).limit(1);
      if (existing.length > 0) throw new Error("Username already taken");

      // Check accountId uniqueness if provided
      let accountId = input.accountId?.toUpperCase().trim();
      if (accountId) {
        const existingAcct = await db.select().from(businesses).where(eq(businesses.accountId, accountId)).limit(1);
        if (existingAcct.length > 0) throw new Error("Account ID already taken. Choose another.");
      } else {
        accountId = generateAccountId(input.businessName || input.name);
        // Ensure uniqueness
        let attempts = 0;
        while (attempts < 5) {
          const check = await db.select().from(businesses).where(eq(businesses.accountId, accountId)).limit(1);
          if (check.length === 0) break;
          accountId = generateAccountId(input.businessName || input.name);
          attempts++;
        }
      }

      const passwordHash = await hashPassword(input.password);
      const [userResult] = await db.insert(users).values({
        name: input.name,
        username: input.username,
        email: input.email,
        passwordHash,
        role: "owner",
        userType: input.userType,
        isActive: true,
      } as any);
      const userId = Number(userResult.insertId);

      // Resolve referral
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

      // Create business
      let businessId: number | null = null;
      let businessName = input.businessName;
      let plan = "free";
      let revShare = "20.00";
      let maxBranches = 1;
      let maxUsers = 1;

      if (input.userType === "partner") {
        businessName = businessName || `${input.name}'s Consulting`;
        plan = "partner";
        maxBranches = 99;
        maxUsers = 99;
        revShare = "20.00";
      } else if (input.createDemo || !businessName) {
        businessName = businessName || "Demo Business";
        plan = "pro";
        maxBranches = 99;
        maxUsers = 99;
      }

      if (firstMonthDiscountApplied) {
        plan = "growth"; // 10% off first month: give them a growth plan temporarily
      }

      const referralCode = generateReferralCode();

      const [bizResult] = await db.insert(businesses).values({
        accountId,
        name: businessName,
        slug: `biz-${input.username}-${Date.now()}`,
        plan,
        maxBranches,
        maxUsers,
        isActive: true,
        isDemo: input.createDemo || false,
        partnerId: input.userType === "partner" ? userId : undefined,
        revSharePercent: revShare,
        referralCode,
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

        // Create default location for new business
        const [locResult] = await db.insert(locations).values({
          businessId,
          name: "Main Branch",
          slug: "main",
          isActive: true,
        } as any);
        const locationId = Number(locResult.insertId);

        // Create default accounts
        await db.insert(accounts).values([
          { name: "Cash Drawer", type: "cash", locationId, openingBalance: "0.00", currentBalance: "0.00", isActive: true } as any,
          { name: "M-PESA Till", type: "mpesa", locationId, openingBalance: "0.00", currentBalance: "0.00", isActive: true } as any,
          { name: "Bank Account", type: "bank_account", locationId, openingBalance: "0.00", currentBalance: "0.00", isActive: true } as any,
        ]);
      }

      const token = await signLocalToken({ userId, username: input.username });
      const biz = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
      return {
        token,
        user: {
          id: userId, name: input.name, username: input.username, role: "owner",
          email: input.email, userType: input.userType, currentBusinessId: businessId,
          currentBusiness: biz[0] ?? null, businessIds: businessId ? [businessId] : [],
          accountId, referralApplied: firstMonthDiscountApplied,
        }
      };
    }),

  // Create default users (seed endpoint - idempotent)
  seedDefaults: publicQuery.mutation(async () => {
    const db = getDb();
    const results: Record<string, any> = {};

    // 1. Create/ensure DEMO business exists
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
      // Ensure it's marked as demo and active
      await db.update(businesses).set({ isDemo: true, isActive: true, deletedAt: null }).where(eq(businesses.id, demoBizId));
      results.demoBusiness = "existing";
    }

    // 2. Create/ensure demo locations exist
    const demoLocations = [
      { name: "HQ / Main Branch", isMain: true },
      { name: "Malindi Branch", isMain: false },
    ];
    const existingLocs = await db.select().from(locations).where(and(eq(locations.businessId, demoBizId), isNull(locations.deletedAt)));
    const locMap: Record<string, number> = {};
    for (const loc of existingLocs) {
      locMap[loc.name] = loc.id;
    }
    for (const loc of demoLocations) {
      if (!locMap[loc.name]) {
        const [r] = await db.insert(locations).values({
          businessId: demoBizId,
          name: loc.name,
          isMain: loc.isMain,
          isActive: true,
        } as any);
        locMap[loc.name] = Number(r.insertId);
      }
    }
    results.locations = Object.keys(locMap);

    // 3. Create/ensure demo accounts exist
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
          name: acct.name,
          type: acct.type,
          locationId: acct.locationId,
          openingBalance: "50000.00",
          currentBalance: "50000.00",
          isActive: true,
        } as any);
      }
    }
    results.accounts = "ensured";

    // 4. Create/ensure default users
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
          username: u.username, passwordHash, name: u.name, role: u.role,
          isActive: true,
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

      // Link user to demo business
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

      // Set current business to demo
      await db.update(users).set({ currentBusinessId: demoBizId }).where(eq(users.id, userId));
    }

    results.users = { created: createdUsers, updated: updatedUsers };
    results.message = `Demo ready. Account ID: DEMO. Default passwords: finaflow2024`;
    return results;
  }),

  // Change password
  changePassword: publicQuery
    .input(z.object({
      userId: z.number().optional(),
      currentPassword: z.string().min(1).optional(),
      newPassword: z.string().min(4).max(100),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const authHeader = ctx.req.headers.get("authorization");
      let requestingUserId: number | null = null;
      let isAdmin = false;

      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
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
        const hashedCurrent = await hashPassword(input.currentPassword);
        if (targetUser[0].passwordHash && targetUser[0].passwordHash !== hashedCurrent) {
          throw new Error("Current password is incorrect");
        }
      }

      const newHash = await hashPassword(input.newPassword);
      await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, targetUserId));
      return { success: true, message: "Password changed successfully" };
    }),
});
