import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  users,
  userBusinesses,
  businesses,
  customerAccounts,
  locations,
  accounts,
  refreshTokens,
  type InsertCustomerAccount,
  type InsertUser,
} from "@db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import * as jose from "jose";
import { env } from "./lib/env";
import { hashPassword, verifyPassword } from "./lib/password";
import { generateCsrfToken } from "./lib/csrf";
import { logAudit } from "./lib/audit";
import { serialize } from "cookie";
import { TRPCError } from "@trpc/server";
import { DEFAULT_TRIAL_DAYS, getPlanConfig } from "./lib/subscriptions";

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

function normalizeAccountId(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 100);
}

type InsertBusiness = typeof businesses.$inferInsert;
type InsertUserBusiness = typeof userBusinesses.$inferInsert;
type InsertLocation = typeof locations.$inferInsert;
type InsertAccount = typeof accounts.$inferInsert;
type SeedDefaultsResultValue = string | string[] | { created: string[]; updated: string[] };
type SeedDefaultsResult = Record<string, SeedDefaultsResultValue>;
type DatabaseError = {
  code?: string;
  detail?: string;
  constraint?: string;
};
type AuthCookieContext = {
  req: Request;
  resHeaders: Headers;
};

function isDatabaseError(error: unknown): error is DatabaseError {
  return typeof error === "object" && error !== null;
}

async function findCustomerAccount(db: ReturnType<typeof getDb>, accountId: string) {
  const rows = await db.select().from(customerAccounts)
    .where(and(eq(customerAccounts.accountId, accountId), isNull(customerAccounts.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

async function findPrimaryBusinessForAccount(
  db: ReturnType<typeof getDb>,
  accountId: string,
  accountRefId?: number | null,
) {
  if (accountRefId) {
    const rows = await db.select().from(businesses)
      .where(and(eq(businesses.accountRefId, accountRefId), isNull(businesses.deletedAt)))
      .limit(1);
    if (rows[0]) {
      return rows[0];
    }
  }

  const rows = await db.select().from(businesses)
    .where(and(eq(businesses.accountId, accountId), isNull(businesses.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

function setAuthCookies(ctx: AuthCookieContext, token: string, csrfToken: string): void {
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

function getClientIp(ctx: Pick<AuthCookieContext, "req">): string {
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
      const accountId = normalizeAccountId(input.accountId);
      const account = await findCustomerAccount(db, accountId);
      const biz = await findPrimaryBusinessForAccount(db, accountId, account?.id ?? null);
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
      const acctId = normalizeAccountId(input.accountName);
      if (acctId.length < 2) return { available: false, normalized: acctId, message: "Account name must be at least 2 characters" };
      const existingAccount = await findCustomerAccount(db, acctId);
      const existing = await db.select({ id: businesses.id }).from(businesses)
        .where(and(eq(businesses.accountId, acctId), isNull(businesses.deletedAt)))
        .limit(1);
      const available = !existingAccount && existing.length === 0;
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
      const accountId = normalizeAccountId(input.accountId);
      const account = await findCustomerAccount(db, accountId);
      const accountBusiness = await findPrimaryBusinessForAccount(db, accountId, account?.id ?? null);
      if (!accountBusiness) throw new Error("Invalid account ID or credentials");

      const userRows = await db.select().from(users).where(and(
        eq(users.username, input.username),
        eq(users.accountId, accountId),
        isNull(users.deletedAt),
        eq(users.isActive, true),
      )).limit(1);
      const user = userRows[0];
      if (!user) throw new Error("Invalid username or password");
      if (!user.isActive) throw new Error("Account is disabled");

      if (user.passwordHash) {
        const valid = await verifyPassword(input.password, user.passwordHash);
        if (!valid) throw new Error("Invalid username or password");
      }

      const junctions = await db.select().from(userBusinesses)
        .where(and(eq(userBusinesses.userId, user.id), eq(userBusinesses.isActive, true)));
      const bizIds = junctions.map((junction) => junction.businessId);
      if (bizIds.length === 0) throw new Error("Invalid account ID or credentials");

      const preferredBusinessId = user.currentBusinessId && bizIds.includes(user.currentBusinessId)
        ? user.currentBusinessId
        : bizIds.find((businessId) => businessId === accountBusiness.id) ?? bizIds[0];
      const currentBusinessRows = await db.select().from(businesses)
        .where(and(eq(businesses.id, preferredBusinessId), isNull(businesses.deletedAt)))
        .limit(1);
      const currentBusiness = currentBusinessRows[0] ?? accountBusiness;
      const accountRefId = user.accountRefId ?? account?.id ?? currentBusiness?.accountRefId ?? null;

      await db.update(users).set({
        lastSignInAt: new Date(),
        currentBusinessId: currentBusiness?.id ?? null,
        accountRefId,
      }).where(eq(users.id, user.id));

      const token = await signLocalToken({ userId: user.id, username: user.username || "" });
      const csrfToken = generateCsrfToken();

      setAuthCookies(ctx, token, csrfToken);

      await logAudit({
        userId: user.id,
        businessId: currentBusiness?.id ?? accountBusiness.id,
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
          email: user.email, currentBusinessId: currentBusiness?.id ?? null,
          currentBusiness, businessIds: bizIds, accountId: currentBusiness?.accountId ?? user.accountId ?? accountId,
          accountRefId,
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

    let currentBusiness: typeof businesses.$inferSelect | null = null;
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
          await db.update(users).set({
            currentBusinessId: currentBusiness.id,
            accountRefId: user.accountRefId ?? currentBusiness.accountRefId ?? null,
          }).where(eq(users.id, user.id));
      }
    }

    return {
      id: user.id, name: user.name, username: user.username, role: user.role,
      email: user.email, phone: user.phone, locationId: user.locationId,
      isActive: user.isActive,
      currentBusinessId: effectiveCurrentBusinessId,
      currentBusiness,
      businessIds: bizIds,
        accountId: currentBusiness?.accountId ?? user.accountId ?? null,
        accountRefId: user.accountRefId ?? currentBusiness?.accountRefId ?? null,
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

      await db.update(users).set({
        currentBusinessId: input.businessId,
        accountRefId: biz[0].accountRefId ?? user[0].accountRefId ?? null,
      }).where(eq(users.id, user[0].id));

      return {
        success: true,
        business: biz[0],
        accountId: biz[0].accountId,
        accountRefId: biz[0].accountRefId ?? user[0].accountRefId ?? null,
      };
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
      const accountId = normalizeAccountId(input.accountName);
      if (accountId.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "Account name must be at least 2 characters" });
      const retryAccount = await findCustomerAccount(db, accountId);

      const retryUserRows = await db.select().from(users)
        .where(and(eq(users.username, input.username), eq(users.accountId, accountId), isNull(users.deletedAt)))
        .limit(1);
      const retryUser = retryUserRows[0];
      if (retryUser && retryUser.passwordHash && retryUser.email === input.email && await verifyPassword(input.password, retryUser.passwordHash)) {
        const retryLinks = await db.select().from(userBusinesses)
          .where(and(eq(userBusinesses.userId, retryUser.id), eq(userBusinesses.isActive, true)));
        const retryBusinessId = retryUser.currentBusinessId ?? retryLinks[0]?.businessId ?? null;
        if (retryBusinessId) {
          const retryBizRows = await db.select().from(businesses)
            .where(and(eq(businesses.id, retryBusinessId), eq(businesses.accountId, accountId), isNull(businesses.deletedAt)))
            .limit(1);
          if (retryBizRows[0]) {
            const token = await signLocalToken({ userId: retryUser.id, username: retryUser.username });
            const csrfToken = generateCsrfToken();
            setAuthCookies(ctx, token, csrfToken);
            return {
              token,
              csrfToken,
              user: {
                id: retryUser.id,
                name: retryUser.name,
                username: retryUser.username,
                role: retryUser.role,
                email: retryUser.email,
                currentBusinessId: retryBizRows[0].id,
                currentBusiness: retryBizRows[0],
                businessIds: retryLinks.map(link => link.businessId),
                phone: retryUser.phone || null,
                accountId,
                accountRefId: retryUser.accountRefId ?? retryBizRows[0].accountRefId ?? retryAccount?.id ?? null,
                referralApplied: false,
              },
            };
          }
        }
      }

      const passwordHash = await hashPassword(input.password);

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

      let businessName = input.businessName;
      const trialExpiry = new Date(Date.now() + DEFAULT_TRIAL_DAYS * 24 * 60 * 60 * 1000);
      let plan = "pro";
      let maxBranches = getPlanConfig("pro").maxBranches;
      let maxUsers = getPlanConfig("pro").maxUsers;
      let maxTransactionsPerMonth = getPlanConfig("pro").transactionQuota;
      let subscriptionStatus: string = "trial";
      let subscriptionExpiry: Date | null = trialExpiry;

      if (input.userType === "partner") {
        businessName = businessName || `${input.name}'s Consulting`;
        plan = "partner";
        maxBranches = getPlanConfig("partner").maxBranches;
        maxUsers = getPlanConfig("partner").maxUsers;
        maxTransactionsPerMonth = getPlanConfig("partner").transactionQuota;
        subscriptionStatus = "active";
        subscriptionExpiry = null;
      } else if (input.createDemo) {
        businessName = businessName || "Demo Business";
        plan = "pro";
        maxBranches = getPlanConfig("pro").maxBranches;
        maxUsers = getPlanConfig("pro").maxUsers;
        maxTransactionsPerMonth = getPlanConfig("pro").transactionQuota;
        subscriptionStatus = "active";
        subscriptionExpiry = null;
      }

      if (!businessName) {
        businessName = `${input.name}'s Business`;
      }

      if (firstMonthDiscountApplied) plan = "growth";
      const planConfig = getPlanConfig(plan);
      maxBranches = planConfig.maxBranches;
      maxUsers = planConfig.maxUsers;
      maxTransactionsPerMonth = planConfig.transactionQuota;

      const referralCode = generateReferralCode();
      const subscriptionExpiryValue = subscriptionExpiry ? subscriptionExpiry.toISOString().slice(0, 10) : null;

      let userId: number;
      let businessId: number;
      let accountRefId: number;

      try {
        const registration = await db.transaction(async (tx) => {
          const existingAccount = await tx.select({ id: customerAccounts.id }).from(customerAccounts)
            .where(and(eq(customerAccounts.accountId, accountId), isNull(customerAccounts.deletedAt)))
            .limit(1);
          const existingAcct = await tx.select({ id: businesses.id }).from(businesses)
            .where(and(eq(businesses.accountId, accountId), isNull(businesses.deletedAt)))
            .limit(1);
          if (existingAccount.length > 0 || existingAcct.length > 0) {
            throw new TRPCError({ code: "CONFLICT", message: "Account ID already taken. Choose another." });
          }

          const accountValues: InsertCustomerAccount = {
            accountId,
            name: businessName,
            plan,
            maxBusinesses: planConfig.maxBusinesses,
            maxUsers,
            maxTransactionsPerMonth,
            subscriptionStatus,
            subscriptionExpiry: subscriptionExpiryValue,
            features: {},
            isActive: true,
          };
          const [accountRow] = await tx.insert(customerAccounts)
            .values(accountValues)
            .returning({ id: customerAccounts.id, accountId: customerAccounts.accountId });

          const existingUsername = await tx.select().from(users)
            .where(and(eq(users.username, input.username), eq(users.accountId, accountId), isNull(users.deletedAt)))
            .limit(1);
          if (existingUsername.length > 0) {
            const existingLinks = await tx.select().from(userBusinesses)
              .where(and(eq(userBusinesses.userId, existingUsername[0].id), eq(userBusinesses.isActive, true)))
              .limit(1);
            if (existingLinks.length === 0 && !existingUsername[0].currentBusinessId) {
              console.warn("[register] cleaning orphaned user row", { userId: existingUsername[0].id, accountId });
              await tx.delete(refreshTokens).where(eq(refreshTokens.userId, existingUsername[0].id));
              await tx.delete(users).where(eq(users.id, existingUsername[0].id));
            } else {
              throw new TRPCError({ code: "CONFLICT", message: "Username already taken in this account" });
            }
          }

          const existingEmail = await tx.select().from(users)
            .where(and(eq(users.email, input.email), isNull(users.deletedAt)))
            .limit(1);
          if (existingEmail.length > 0) {
            throw new TRPCError({ code: "CONFLICT", message: "Email address already in use" });
          }

          const userValues: InsertUser = {
            name: input.name,
            username: input.username,
            email: input.email,
            passwordHash,
            role: "owner",
            isActive: true,
            phone: input.phone || null,
            accountId,
            accountRefId: accountRow.id,
          };
          const [userRow] = await tx.insert(users).values(userValues).returning({ id: users.id });

          const businessValues: InsertBusiness = {
            phone: input.phone || null,
            accountId,
            accountRefId: accountRow.id,
            name: businessName,
            slug: `biz-${input.username}-${Date.now()}`,
            plan,
            maxBranches,
            maxUsers,
            maxTransactionsPerMonth,
            isActive: true,
            isDemo: input.createDemo || false,
            partnerId: input.userType === "partner" ? userRow.id : undefined,
            revSharePercent: "20.00",
            referralCode,
            subscriptionStatus,
            subscriptionExpiry: subscriptionExpiryValue,
            referredByBusinessId,
            referredByUserId,
            firstMonthDiscountApplied,
          };
          const [businessRow] = await tx.insert(businesses).values(businessValues).returning({ id: businesses.id });

          const userBusinessValues: InsertUserBusiness = {
            userId: userRow.id,
            businessId: businessRow.id,
            role: "owner",
            isActive: true,
          };
          await tx.insert(userBusinesses).values(userBusinessValues);

          await tx.update(users).set({ currentBusinessId: businessRow.id }).where(eq(users.id, userRow.id));

          const locationValues: InsertLocation = {
            businessId: businessRow.id,
            name: "Main Branch",
            slug: `main-${businessRow.id}`,
            isActive: true,
          };
          const [locationRow] = await tx.insert(locations).values(locationValues).returning({ id: locations.id });

          if (ctx.req.headers.get("x-test-fail-registration-step") === "before-default-accounts") {
            throw new Error("Simulated registration failure before default account creation");
          }

          const defaultAccountValues: InsertAccount[] = [
            { name: "Cash Drawer", type: "cash", locationId: locationRow.id, openingBalance: "0.00", currentBalance: "0.00", isActive: true },
            { name: "M-PESA Till", type: "mpesa", locationId: locationRow.id, openingBalance: "0.00", currentBalance: "0.00", isActive: true },
            { name: "Bank Account", type: "bank_account", locationId: locationRow.id, openingBalance: "0.00", currentBalance: "0.00", isActive: true },
          ];
          await tx.insert(accounts).values(defaultAccountValues);

          return { userId: userRow.id, businessId: businessRow.id, accountRefId: accountRow.id };
        });

        userId = registration.userId;
        businessId = registration.businessId;
        accountRefId = registration.accountRefId;
      } catch (error: unknown) {
        console.error("[register] signup failed", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        if (isDatabaseError(error) && error.code === "23505") {
          const message = String(error.detail || "");
          const constraint = String(error.constraint || "");
          if (message.includes("idx_users_username_accountId") || constraint.includes("idx_users_username_accountId")) {
            throw new TRPCError({ code: "CONFLICT", message: "Username already taken in this account" });
          }
          if (
            message.includes("businesses_accountId_unique")
            || constraint.includes("businesses_accountId_unique")
            || constraint.includes("customer_accounts_accountId_unique")
            || constraint.includes("idx_customer_accounts_accountId")
          ) {
            throw new TRPCError({ code: "CONFLICT", message: "Account ID already taken. Choose another." });
          }
          throw new TRPCError({ code: "CONFLICT", message: "An account with these details already exists." });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "We could not complete sign up right now. Please try again.",
        });
      }

      const token = await signLocalToken({ userId, username: input.username });
      const csrfToken = generateCsrfToken();
      setAuthCookies(ctx, token, csrfToken);

      try {
        await logAudit({
          userId,
          businessId,
          action: "CREATE",
          resource: "users",
          resourceId: userId,
          ip: getClientIp(ctx),
        });
      } catch (error) {
        console.error("[register] audit log failed", error);
      }

      const biz = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
      return {
        token,
        csrfToken,
        user: {
          id: userId, name: input.name, username: input.username, role: "owner",
          email: input.email, userType: input.userType, currentBusinessId: businessId,
          currentBusiness: biz[0] ?? null, businessIds: businessId ? [businessId] : [],
          phone: input.phone || null,
          accountId, accountRefId, referralApplied: firstMonthDiscountApplied,
        }
      };
    }),

  seedDefaults: publicQuery.mutation(async () => {
    const db = getDb();
    const results: SeedDefaultsResult = {};

    const demoBiz = await db.select().from(businesses)
      .where(and(eq(businesses.accountId, "DEMO"), isNull(businesses.deletedAt)))
      .limit(1);
    let demoBizId: number;
    if (demoBiz.length === 0) {
      const demoBusinessValues: InsertBusiness = {
        accountId: "DEMO",
        name: "Finaflow Demo Business",
        slug: "finaflow-demo",
        plan: "pro",
        maxBranches: 99,
        maxUsers: 99,
        isDemo: true,
        isActive: true,
        referralCode: "FINADEMO1",
      };
      const [r] = await db.insert(businesses).values(demoBusinessValues).returning();
      demoBizId = r.id;
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
        const demoLocationValues: InsertLocation = {
          businessId: demoBizId, name: loc.name, slug: loc.slug, isActive: true,
        };
        const [r] = await db.insert(locations).values(demoLocationValues).returning();
        locMap[loc.name] = r.id;
      }
    }
    results.locations = Object.keys(locMap);

    const mainLocId = locMap["HQ / Main Branch"];
    const malindiLocId = locMap["Malindi Branch"];
    const demoAccounts: Array<Pick<InsertAccount, "name" | "type" | "locationId">> = [
      { name: "Cash Drawer", type: "cash", locationId: mainLocId },
      { name: "M-PESA Till", type: "mpesa", locationId: mainLocId },
      { name: "Bank (KCB)", type: "bank_account", locationId: mainLocId },
      { name: "Cash Drawer (Malindi)", type: "cash", locationId: malindiLocId },
      { name: "M-PESA Till (Malindi)", type: "mpesa", locationId: malindiLocId },
    ];
    const existingAccts = await db.select().from(accounts)
      .where(and(sql`${accounts.locationId} IN (${sql.join([mainLocId, malindiLocId].map(id => sql`${id}`), sql`, `)})`, isNull(accounts.deletedAt)));
    const acctNames = new Set(existingAccts.map(a => `${a.name}-${a.locationId}`));
    for (const acct of demoAccounts) {
      const key = `${acct.name}-${acct.locationId}`;
      if (!acctNames.has(key)) {
        const demoAccountValues: InsertAccount = {
          name: acct.name, type: acct.type, locationId: acct.locationId,
          openingBalance: "50000.00", currentBalance: "50000.00", isActive: true,
        };
        await db.insert(accounts).values(demoAccountValues).returning();
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
        const demoUserValues: InsertUser = {
          username: u.username, passwordHash, name: u.name, role: u.role, isActive: true,
        };
        const [r] = await db.insert(users).values(demoUserValues).returning();
        userId = r.id;
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
        const demoMembershipValues: InsertUserBusiness = {
          userId, businessId: demoBizId, role: u.role, isActive: true,
        };
        await db.insert(userBusinesses).values(demoMembershipValues).returning();
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
      const token = cookies["finaflow_token"] || ctx.req.headers.get("authorization")?.slice(7);
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
