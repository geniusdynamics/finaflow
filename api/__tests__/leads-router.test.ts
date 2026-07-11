// ABOUTME: Verifies the leads router CRUD, invitation, and scope behavior against the real test database.
// ABOUTME: Keeps partner lead management stable by covering create/list/update and invitation flows end to end.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../router";
import { getDb } from "../queries/connection";
import { businesses, customerAccounts, leads, users } from "@db/schema";
import { and, eq } from "drizzle-orm";

vi.mock("../lib/logged-email", () => ({
  sendLoggedEmail: vi.fn().mockResolvedValue(undefined),
}));

import { sendLoggedEmail } from "../lib/logged-email";

type SeededContext = {
  accountRefId: number;
  businessId: number;
  userId: number;
  accountId: string;
  businessName: string;
  email: string;
  phone: string | null;
  userType: "standard" | "partner";
};

async function cleanupAccount(accountId: string) {
  const db = getDb();
  const matchingUsers = await db.select({ id: users.id }).from(users).where(eq(users.accountId, accountId));

  for (const user of matchingUsers) {
    await db.delete(leads).where(eq(leads.creatorUserId, user.id));
    await db.delete(leads).where(eq(leads.matchedUserId, user.id));
  }

  await db.delete(businesses).where(eq(businesses.accountId, accountId));
  await db.delete(users).where(eq(users.accountId, accountId));
  await db.delete(customerAccounts).where(eq(customerAccounts.accountId, accountId));
}

async function seedUserContext(options: {
  accountId: string;
  businessName: string;
  email: string;
  phone?: string | null;
  userType?: "standard" | "partner";
  role?: "owner" | "admin";
  referralCode?: string | null;
}) {
  const db = getDb();
  const userType = options.userType ?? "partner";
  const role = options.role ?? "owner";

  const [{ id: accountRefId }] = await db.insert(customerAccounts).values({
    accountId: options.accountId,
    name: options.businessName,
    plan: userType === "partner" ? "partner" : "growth",
    maxBusinesses: 99,
    maxUsers: 99,
    maxTransactionsPerMonth: 999999,
    subscriptionStatus: "active",
    isActive: true,
  }).returning({ id: customerAccounts.id });

  const [{ id: userId }] = await db.insert(users).values({
    username: `${options.accountId.toLowerCase()}-user`,
    name: `${options.businessName} User`,
    email: options.email,
    phone: options.phone ?? null,
    role,
    userType,
    accountId: options.accountId,
    accountRefId,
    isActive: true,
  }).returning({ id: users.id });

  const [{ id: businessId }] = await db.insert(businesses).values({
    accountId: options.accountId,
    accountRefId,
    name: options.businessName,
    slug: options.accountId.toLowerCase(),
    plan: userType === "partner" ? "partner" : "growth",
    subscriptionStatus: "active",
    referralCode: options.referralCode ?? null,
    partnerId: userType === "partner" ? userId : null,
    isActive: true,
  }).returning({ id: businesses.id });

  return {
    accountRefId,
    businessId,
    userId,
    accountId: options.accountId,
    businessName: options.businessName,
    email: options.email,
    phone: options.phone ?? null,
    userType,
  } satisfies SeededContext;
}

function createCaller(ctx: SeededContext) {
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc", {
      headers: { origin: "http://localhost:3000" },
    }),
    resHeaders: new Headers(),
    user: {
      id: ctx.userId,
      role: "owner",
      name: `${ctx.businessName} User`,
      email: ctx.email,
      phone: ctx.phone,
      userType: ctx.userType,
      accountId: ctx.accountId,
      accountRefId: ctx.accountRefId,
      currentBusinessId: ctx.businessId,
      currentBusiness: {
        id: ctx.businessId,
        accountId: ctx.accountId,
        accountRefId: ctx.accountRefId,
        plan: ctx.userType === "partner" ? "partner" : "growth",
        features: null,
        maxBranches: 99,
        maxUsers: 99,
      },
      businessIds: [ctx.businessId],
      permissions: [],
      isSuperAdmin: false,
    },
  });
}

describe("leads router", () => {
  beforeEach(async () => {
    await cleanupAccount("LEADSOWNERA");
    await cleanupAccount("LEADSOWNERB");
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await cleanupAccount("LEADSOWNERA");
    await cleanupAccount("LEADSOWNERB");
  });

  it("creates, filters, updates, and prepares sms invitations for the current user", async () => {
    const owner = await seedUserContext({
      accountId: "LEADSOWNERA",
      businessName: "Leads Owner A",
      email: "lead-owner-a@example.com",
      phone: "+254711111111",
    });
    const caller = createCaller(owner);

    const emailLead = await caller.leads.create({
      businessName: "Northwind Traders",
      contactName: "Nadia Northwind",
      email: "nadia@northwind.test",
      phone: "",
      status: "new",
    });

    const smsLead = await caller.leads.create({
      businessName: "Contoso Retail",
      contactName: "Chris Contoso",
      email: "",
      phone: "0712 000 111",
      status: "contacted",
    });

    const stats = await caller.leads.stats();
    expect(stats.total).toBe(2);
    expect(stats.joined).toBe(0);

    const contactedOnly = await caller.leads.list({ status: "contacted" });
    expect(contactedOnly).toHaveLength(1);
    expect(contactedOnly[0].id).toBe(smsLead.id);

    const updated = await caller.leads.update({
      id: emailLead.id,
      status: "declined",
      businessName: "Northwind Group",
    });
    expect(updated.status).toBe("declined");
    expect(updated.businessName).toBe("Northwind Group");

    const smsResult = await caller.leads.prepareSmsInvitation({ leadId: smsLead.id });
    expect(smsResult.success).toBe(true);
    expect(smsResult.message).toContain("Leads Owner A");
    expect(smsResult.message).toContain("http://localhost:3000/login?ref=FINA");

    const [referralBusiness] = await getDb()
      .select({ referralCode: businesses.referralCode })
      .from(businesses)
      .where(eq(businesses.id, owner.businessId));
    expect(referralBusiness.referralCode).toMatch(/^FINA[A-Z0-9]{8}$/);
  });

  it("scopes lead lists to the creator and sends invitation emails through the logged email helper", async () => {
    const ownerA = await seedUserContext({
      accountId: "LEADSOWNERA",
      businessName: "Leads Owner A",
      email: "lead-owner-a@example.com",
    });
    const ownerB = await seedUserContext({
      accountId: "LEADSOWNERB",
      businessName: "Leads Owner B",
      email: "lead-owner-b@example.com",
      referralCode: "FINAEXIST1",
    });

    const callerA = createCaller(ownerA);
    const callerB = createCaller(ownerB);

    const leadA = await callerA.leads.create({
      businessName: "Acme East",
      contactName: "Ava Acme",
      email: "ava@acme.test",
      phone: "",
      status: "new",
    });
    await callerB.leads.create({
      businessName: "Beta West",
      contactName: "Ben Beta",
      email: "ben@beta.test",
      phone: "",
      status: "new",
    });

    const listA = await callerA.leads.list();
    expect(listA).toHaveLength(1);
    expect(listA[0].contactName).toBe("Ava Acme");

    const response = await callerA.leads.sendInvitationEmail({ leadId: leadA.id });
    expect(response.success).toBe(true);
    expect(sendLoggedEmail).toHaveBeenCalledTimes(1);
    expect(sendLoggedEmail).toHaveBeenCalledWith(
      "lead_invitation",
      expect.objectContaining({
        to: "ava@acme.test",
        subject: expect.stringContaining("invited you to Finaflow"),
      }),
    );

    const [updatedLead] = await getDb()
      .select({ lastInvitationChannel: leads.lastInvitationChannel, emailInvitedAt: leads.emailInvitedAt })
      .from(leads)
      .where(and(eq(leads.id, leadA.id), eq(leads.creatorUserId, ownerA.userId)));
    expect(updatedLead.lastInvitationChannel).toBe("email");
    expect(updatedLead.emailInvitedAt).toBeTruthy();
  });
});
