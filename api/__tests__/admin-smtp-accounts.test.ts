// ABOUTME: Verifies the super-admin SMTP configuration, account drill-down, and password-reset
// ABOUTME: procedures against the real test database. Covers the EACCES fix (DB-backed SMTP
// ABOUTME: config that never throws on read-only .env), test-email error surfacing, account →
// ABOUTME: business → user detail shapes, and admin-initiated password reset links.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  appSettings,
  businesses,
  customerAccounts,
  passwordResetTokens,
  userBusinesses,
  users,
} from "@db/schema";

// Prevent real email sends and real .env file writes during tests.
vi.mock("../lib/logged-email", () => ({
  sendLoggedEmail: vi.fn().mockResolvedValue({ delivered: true, skipped: false, logId: 1, error: null }),
}));
vi.mock("../lib/update-env", () => ({
  updateEnvVarSafe: vi.fn().mockReturnValue({ ok: true, warning: null }),
  updateEnvVar: vi.fn(),
}));

// env.ts reads SUPER_ADMIN_ACCOUNT at module load and is pulled in by the
// appRouter import graph, so set it BEFORE that dynamic import executes.
const SUPER_ADMIN_ACCOUNT_ID = "SUPERADMIN-TEST-ACCOUNT";
process.env.SUPER_ADMIN_ACCOUNT = SUPER_ADMIN_ACCOUNT_ID;

const { appRouter } = await import("../router");
const { getDb } = await import("../queries/connection");
const { sendLoggedEmail } = await import("../lib/logged-email");
const { updateEnvVarSafe } = await import("../lib/update-env");
const { getSmtpPassword } = await import("../lib/smtp-config");

const SMTP_CONFIG_KEY = "smtp_config";
const ENV_SMTP_KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"] as const;

type SeededUser = { id: number; username: string; name: string; email: string | null };

async function seedTargetAccount(): Promise<{
  accountId: string;
  accountRefId: number;
  businessIds: number[];
  userWithEmail: SeededUser;
  userWithoutEmail: SeededUser;
}> {
  const db = getDb();
  const accountId = `TGT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const [{ id: accountRefId }] = await db.insert(customerAccounts).values({
    accountId,
    name: "Target Support Account",
    plan: "growth",
    maxBusinesses: 10,
    maxUsers: 10,
    maxTransactionsPerMonth: 999999,
    subscriptionStatus: "active",
    isActive: true,
  }).returning({ id: customerAccounts.id });

  const [{ id: b1 }] = await db.insert(businesses).values({
    accountId,
    accountRefId,
    name: "Target Business A",
    slug: `tgt-a-${accountRefId}`,
    plan: "growth",
    subscriptionStatus: "active",
    isActive: true,
  }).returning({ id: businesses.id });

  const [{ id: b2 }] = await db.insert(businesses).values({
    accountId,
    accountRefId,
    name: "Target Business B",
    slug: `tgt-b-${accountRefId}`,
    plan: "free",
    subscriptionStatus: "active",
    isActive: true,
  }).returning({ id: businesses.id });

  const [{ id: u1 }] = await db.insert(users).values({
    username: `tgtuser-${accountRefId}`,
    name: "Target User With Email",
    email: `support-${accountRefId}@example.com`,
    role: "owner",
    userType: "standard",
    accountId,
    accountRefId,
    isActive: true,
  }).returning({ id: users.id });

  const [{ id: u2 }] = await db.insert(users).values({
    username: `tgtuser-noemail-${accountRefId}`,
    name: "Target User No Email",
    email: null,
    role: "admin",
    userType: "standard",
    accountId,
    accountRefId,
    isActive: true,
  }).returning({ id: users.id });

  // u1 belongs to both businesses; u2 only to b1.
  await db.insert(userBusinesses).values([
    { userId: u1, businessId: b1, role: "owner", isActive: true },
    { userId: u1, businessId: b2, role: "admin", isActive: true },
    { userId: u2, businessId: b1, role: "admin", isActive: true },
  ]);

  return {
    accountId,
    accountRefId,
    businessIds: [b1, b2],
    userWithEmail: { id: u1, username: `tgtuser-${accountRefId}`, name: "Target User With Email", email: `support-${accountRefId}@example.com` },
    userWithoutEmail: { id: u2, username: `tgtuser-noemail-${accountRefId}`, name: "Target User No Email", email: null },
  };
}

function createSuperAdminCaller(userId: number) {
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc", {
      headers: { origin: "http://localhost:3000" },
    }),
    resHeaders: new Headers(),
    user: {
      id: userId,
      role: "owner",
      name: "Super Admin",
      email: "admin@finaflow.test",
      phone: null,
      userType: "standard",
      accountId: SUPER_ADMIN_ACCOUNT_ID,
      accountRefId: 1,
      currentBusinessId: null,
      currentBusiness: null,
      isSuperAdmin: true,
    },
  });
}

async function clearSmtpState(): Promise<void> {
  const db = getDb();
  await db.delete(appSettings).where(and(eq(appSettings.key, SMTP_CONFIG_KEY), isNull(appSettings.businessId)));
  for (const key of ENV_SMTP_KEYS) {
    delete process.env[key];
  }
}

async function cleanupAccount(accountId: string): Promise<void> {
  const db = getDb();
  const accountUsers = await db.select({ id: users.id }).from(users).where(eq(users.accountId, accountId));
  const userIds = accountUsers.map((u) => u.id);
  if (userIds.length > 0) {
    await db.delete(passwordResetTokens).where(inArray(passwordResetTokens.userId, userIds));
    await db.delete(userBusinesses).where(inArray(userBusinesses.userId, userIds));
  }
  await db.delete(businesses).where(eq(businesses.accountId, accountId));
  await db.delete(users).where(eq(users.accountId, accountId));
  await db.delete(customerAccounts).where(eq(customerAccounts.accountId, accountId));
}

const seededAccountIds: string[] = [];
let caller: ReturnType<typeof createSuperAdminCaller>;
let target: Awaited<ReturnType<typeof seedTargetAccount>> | null = null;

beforeAll(async () => {
  caller = createSuperAdminCaller(999999);
});

beforeEach(async () => {
  await clearSmtpState();
  vi.mocked(sendLoggedEmail).mockReset();
  vi.mocked(sendLoggedEmail).mockResolvedValue({ delivered: true, skipped: false, logId: 1, error: null });
  vi.mocked(updateEnvVarSafe).mockReset();
  vi.mocked(updateEnvVarSafe).mockReturnValue({ ok: true, warning: null });
});

afterEach(async () => {
  await clearSmtpState();
  if (target) {
    await cleanupAccount(target.accountId);
    target = null;
  }
  for (const id of seededAccountIds.splice(0)) {
    await cleanupAccount(id);
  }
});

describe("admin.getSmtpConfig / admin.updateSmtpConfig", () => {
  it("denies non-super-admin users with NOT_FOUND", async () => {
    const nonAdmin = appRouter.createCaller({
      req: new Request("http://localhost/api/trpc", { headers: { origin: "http://localhost:3000" } }),
      resHeaders: new Headers(),
      user: {
        id: 1,
        role: "owner",
        name: "Regular Owner",
        email: "owner@example.com",
        phone: null,
        userType: "standard",
        accountId: "SOME-OTHER-ACCOUNT",
        accountRefId: 1,
        currentBusinessId: null,
        currentBusiness: null,
      },
    });
    await expect(nonAdmin.admin.getSmtpConfig()).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns environment fallback when nothing is configured", async () => {
    const config = await caller.admin.getSmtpConfig();
    expect(config).toEqual({
      host: "",
      port: "",
      user: "",
      from: "",
      hasPassword: false,
      isConfigured: false,
      source: "env",
    });
  });

  it("persists SMTP config to the database and reports database source", async () => {
    const result = await caller.admin.updateSmtpConfig({
      host: "smtp.example.com",
      port: "587",
      user: "no-reply@example.com",
      pass: "smtp-secret",
      from: "no-reply@example.com",
    });
    expect(result.success).toBe(true);
    expect(result.source).toBe("database");
    expect(result.warnings).toEqual([]);

    const config = await caller.admin.getSmtpConfig();
    expect(config.host).toBe("smtp.example.com");
    expect(config.port).toBe("587");
    expect(config.user).toBe("no-reply@example.com");
    expect(config.hasPassword).toBe(true);
    expect(config.isConfigured).toBe(true);
    expect(config.source).toBe("database");
    // Password must never be echoed back by the admin API.
    expect(Object.keys(config)).not.toContain("pass");
  });

  it("returns warnings instead of throwing when .env is not writable (EACCES fix)", async () => {
    vi.mocked(updateEnvVarSafe).mockReturnValue({
      ok: false,
      warning: "Could not write .env file (EACCES) — configuration persisted to the database instead",
    });

    const result = await caller.admin.updateSmtpConfig({
      host: "smtp.docker.example.com",
      port: "465",
      user: "app@example.com",
      pass: "docker-secret",
      from: "app@example.com",
    });

    expect(result.success).toBe(true);
    expect(result.source).toBe("database");
    expect(result.warnings.length).toBeGreaterThan(0);
    for (const warning of result.warnings) {
      expect(warning).toContain("Could not write .env file");
    }

    // Config still persisted to the database despite the unwritable .env.
    const config = await caller.admin.getSmtpConfig();
    expect(config.source).toBe("database");
    expect(config.host).toBe("smtp.docker.example.com");
  });

  it("keeps the existing password when an update omits pass", async () => {
    await caller.admin.updateSmtpConfig({
      host: "smtp.keep.example.com",
      port: "587",
      user: "keep@example.com",
      pass: "original-pass",
      from: "keep@example.com",
    });

    await caller.admin.updateSmtpConfig({ host: "smtp.changed.example.com" });

    const config = await caller.admin.getSmtpConfig();
    expect(config.host).toBe("smtp.changed.example.com");
    expect(config.hasPassword).toBe(true);
    expect(await getSmtpPassword()).toBe("original-pass");
  });
});

describe("admin.sendTestEmail", () => {
  it("returns a clear error detail when SMTP is not configured", async () => {
    const result = await caller.admin.sendTestEmail({ to: "admin@example.com" });
    expect(result).toEqual({
      delivered: false,
      skipped: true,
      error: "SMTP is not configured",
      logId: null,
    });
  });

  it("returns delivered with a logId when SMTP is configured and delivery succeeds", async () => {
    await caller.admin.updateSmtpConfig({
      host: "smtp.example.com",
      port: "587",
      user: "no-reply@example.com",
      pass: "smtp-secret",
      from: "no-reply@example.com",
    });
    vi.mocked(sendLoggedEmail).mockResolvedValue({ delivered: true, skipped: false, logId: 4242, error: null });

    const result = await caller.admin.sendTestEmail({ to: "admin@example.com" });

    expect(result).toEqual({ delivered: true, skipped: false, error: null, logId: 4242 });
    expect(sendLoggedEmail).toHaveBeenCalledWith("smtp_test", expect.objectContaining({ to: "admin@example.com" }));
  });

  it("surfaces the underlying SMTP failure message", async () => {
    await caller.admin.updateSmtpConfig({
      host: "smtp.example.com",
      port: "587",
      user: "no-reply@example.com",
      pass: "smtp-secret",
      from: "no-reply@example.com",
    });
    vi.mocked(sendLoggedEmail).mockResolvedValue({
      delivered: false,
      skipped: false,
      logId: 4243,
      error: "Connection refused to smtp.example.com:587",
    });

    const result = await caller.admin.sendTestEmail({ to: "admin@example.com" });

    expect(result.delivered).toBe(false);
    expect(result.error).toContain("Connection refused");
    expect(result.logId).toBe(4243);
  });
});

describe("admin.getAccountDetail", () => {
  it("returns account, businesses with user counts, and users with memberships", async () => {
    target = await seedTargetAccount();

    const detail = await caller.admin.getAccountDetail({ accountId: target.accountId });

    expect(detail.account).not.toBeNull();
    expect(detail.account!.accountId).toBe(target.accountId);
    expect(detail.account!.userCount).toBe(2);
    expect(detail.account!.businessCount).toBe(2);

    expect(detail.businesses).toHaveLength(2);
    const b1 = detail.businesses.find((b) => b.userCount === 2);
    const b2 = detail.businesses.find((b) => b.userCount === 1);
    expect(b1).toBeDefined();
    expect(b2).toBeDefined();
    expect(detail.businesses.map((b) => b.name).sort()).toEqual(["Target Business A", "Target Business B"]);

    expect(detail.users).toHaveLength(2);
    const withEmail = detail.users.find((u) => u.id === target!.userWithEmail.id);
    const withoutEmail = detail.users.find((u) => u.id === target!.userWithoutEmail.id);
    expect(withEmail?.username).toBe(target!.userWithEmail.username);
    expect(withEmail?.email).toBe(target!.userWithEmail.email);
    expect(withEmail?.businessIds.sort()).toEqual(target!.businessIds.slice().sort());
    expect(withEmail?.businesses.map((b) => b.name).sort()).toEqual(["Target Business A", "Target Business B"]);
    expect(withoutEmail?.email).toBeNull();
    expect(withoutEmail?.businesses).toHaveLength(1);
    expect(withoutEmail?.businesses[0].name).toBe("Target Business A");
  });

  it("returns empty detail for an unknown account", async () => {
    const detail = await caller.admin.getAccountDetail({ accountId: "DOES-NOT-EXIST-ACCOUNT" });
    expect(detail).toEqual({ account: null, businesses: [], users: [] });
  });
});

describe("admin.sendPasswordReset", () => {
  it("throws NOT_FOUND for an unknown user", async () => {
    await expect(caller.admin.sendPasswordReset({ userId: 99999999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns an error when the user has no email address on file", async () => {
    target = await seedTargetAccount();

    const result = await caller.admin.sendPasswordReset({ userId: target.userWithoutEmail.id });

    expect(result.success).toBe(false);
    expect(result.delivered).toBe(false);
    expect(result.error).toBe("User has no email address on file");
    expect(result.resetUrl).toBeNull();
    expect(sendLoggedEmail).not.toHaveBeenCalled();
  });

  it("creates a token and returns a copyable reset URL when SMTP is not configured", async () => {
    target = await seedTargetAccount();

    const result = await caller.admin.sendPasswordReset({ userId: target.userWithEmail.id });

    expect(result.success).toBe(true);
    expect(result.delivered).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.error).toContain("SMTP is not configured");
    expect(result.resetUrl).toMatch(/\/reset-password\?token=[0-9a-f]{64}$/);
    expect(result.expiresInMinutes).toBe(60);

    const token = result.resetUrl!.split("token=")[1];
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const db = getDb();
    const rows = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.userId, target.userWithEmail.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(tokenHash);
    expect(rows[0].usedAt).toBeNull();
    expect(rows[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(sendLoggedEmail).not.toHaveBeenCalled();
  });

  it("delivers the reset email when SMTP is configured", async () => {
    target = await seedTargetAccount();
    await caller.admin.updateSmtpConfig({
      host: "smtp.example.com",
      port: "587",
      user: "no-reply@example.com",
      pass: "smtp-secret",
      from: "no-reply@example.com",
    });
    vi.mocked(sendLoggedEmail).mockResolvedValue({ delivered: true, skipped: false, logId: 777, error: null });

    const result = await caller.admin.sendPasswordReset({ userId: target.userWithEmail.id });

    expect(result.success).toBe(true);
    expect(result.delivered).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.error).toBeNull();
    expect(result.resetUrl).toMatch(/\/reset-password\?token=[0-9a-f]{64}$/);

    expect(sendLoggedEmail).toHaveBeenCalledWith(
      "password_reset",
      expect.objectContaining({ to: target!.userWithEmail.email }),
    );
    // Token row still created alongside the delivery.
    const db = getDb();
    const rows = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.userId, target.userWithEmail.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
