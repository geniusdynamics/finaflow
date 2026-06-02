// ABOUTME: Exposes partner APIs for commissions and owner-partner allocation invite lifecycle operations.
// ABOUTME: Keeps invite generation, claim, revoke, and allocation listings consistent with business access rows.
import { z } from "zod";
import { createRouter, authedQuery, ownerQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { allocationInvites, businesses, partnerAllocations, partnerCommissions, userBusinesses, users } from "@db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { logAudit } from "./lib/audit";
import { RIGHTS_PROFILES, generateAllocationCode } from "./lib/partner-allocations";

export const generateAllocationInviteInputSchema = z.object({
  businessId: z.number().int().positive(),
  rightsProfile: z.enum(RIGHTS_PROFILES),
});

export const claimAllocationInviteInputSchema = z.object({
  code: z.string().min(8).max(20).transform((value) => value.trim().toUpperCase()),
});

export const revokeAllocationInputSchema = z.object({
  allocationId: z.number().int().positive(),
});

export const partnerRouter = createRouter({
  generateInvite: ownerQuery
    .input(generateAllocationInviteInputSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const ownerAccountId = ctx.user?.accountRefId ?? ctx.user?.currentBusiness?.accountRefId;
      if (!ownerAccountId) {
        throw new Error("No owner account context available");
      }

      const [ownedBusiness] = await db.select({
        id: businesses.id,
        accountRefId: businesses.accountRefId,
      }).from(businesses).where(and(
        eq(businesses.id, input.businessId),
        eq(businesses.accountRefId, ownerAccountId),
        isNull(businesses.deletedAt),
      )).limit(1);

      if (!ownedBusiness) {
        throw new Error("Business not found in owner account scope");
      }

      const code = generateAllocationCode();
      await db.insert(allocationInvites).values({
        code,
        ownerAccountId,
        businessId: input.businessId,
        rightsProfile: input.rightsProfile,
        status: "active",
        createdBy: ctx.user!.id,
      });

      await logAudit({
        userId: ctx.user!.id,
        businessId: input.businessId,
        action: "CREATE",
        resource: "allocation_invites",
        details: {
          operation: "generate_invite",
          code,
          rightsProfile: input.rightsProfile,
        },
      });

      const origin = ctx.req.headers.get("origin") ?? "";
      return { code, link: `${origin}/partner?alloc=${code}` };
    }),

  claimInvite: authedQuery
    .input(claimAllocationInviteInputSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const partnerAccountId = ctx.user?.accountRefId ?? ctx.user?.currentBusiness?.accountRefId;
      if (!partnerAccountId) {
        throw new Error("No partner account context available");
      }

      const result = await db.transaction(async (tx) => {
        const [invite] = await tx.select().from(allocationInvites).where(and(
          eq(allocationInvites.code, input.code),
          eq(allocationInvites.status, "active"),
          isNull(allocationInvites.deletedAt),
        )).limit(1);

        if (!invite) {
          throw new Error("Allocation invite not found or inactive");
        }
        if (invite.ownerAccountId === partnerAccountId) {
          throw new Error("Cannot claim invite from same account");
        }
        if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) {
          throw new Error("Allocation invite has expired");
        }

        const now = new Date();
        await tx.update(allocationInvites).set({
          status: "consumed",
          consumedByPartnerAccountId: partnerAccountId,
          consumedByPartnerUserId: ctx.user!.id,
          consumedAt: now,
          updatedAt: now,
        }).where(eq(allocationInvites.id, invite.id));

        const [allocation] = await tx.insert(partnerAllocations).values({
          ownerAccountId: invite.ownerAccountId,
          ownerBusinessId: invite.businessId,
          partnerAccountId,
          partnerUserId: ctx.user!.id,
          rightsProfile: invite.rightsProfile,
          inviteId: invite.id,
          status: "active",
          createdBy: ctx.user!.id,
        }).returning();

        const [membership] = await tx.select().from(userBusinesses).where(and(
          eq(userBusinesses.userId, ctx.user!.id),
          eq(userBusinesses.businessId, invite.businessId),
        )).limit(1);

        if (membership) {
          await tx.update(userBusinesses).set({
            role: "viewer",
            isActive: true,
          }).where(eq(userBusinesses.id, membership.id));
        } else {
          await tx.insert(userBusinesses).values({
            userId: ctx.user!.id,
            businessId: invite.businessId,
            role: "viewer",
            isActive: true,
          });
        }

        return allocation;
      });

      await logAudit({
        userId: ctx.user!.id,
        businessId: result.ownerBusinessId,
        action: "CREATE",
        resource: "partner_allocations",
        resourceId: result.id,
        details: {
          operation: "claim_invite",
          inviteCode: input.code,
        },
      });

      return { success: true, allocationId: result.id };
    }),

  revoke: ownerQuery
    .input(revokeAllocationInputSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const ownerAccountId = ctx.user?.accountRefId ?? ctx.user?.currentBusiness?.accountRefId;
      if (!ownerAccountId) {
        throw new Error("No owner account context available");
      }

      const revoked = await db.transaction(async (tx) => {
        const [allocation] = await tx.select().from(partnerAllocations).where(and(
          eq(partnerAllocations.id, input.allocationId),
          eq(partnerAllocations.ownerAccountId, ownerAccountId),
          isNull(partnerAllocations.deletedAt),
        )).limit(1);

        if (!allocation) {
          throw new Error("Allocation not found");
        }
        if (allocation.status === "revoked") {
          return allocation;
        }

        const revokedAt = new Date();
        const [updated] = await tx.update(partnerAllocations).set({
          status: "revoked",
          revokedAt,
          updatedAt: revokedAt,
        }).where(eq(partnerAllocations.id, allocation.id)).returning();

        await tx.update(userBusinesses).set({ isActive: false }).where(and(
          eq(userBusinesses.userId, allocation.partnerUserId),
          eq(userBusinesses.businessId, allocation.ownerBusinessId),
        ));

        return updated;
      });

      await logAudit({
        userId: ctx.user!.id,
        businessId: revoked.ownerBusinessId,
        action: "UPDATE",
        resource: "partner_allocations",
        resourceId: revoked.id,
        details: {
          operation: "revoke_allocation",
          partnerUserId: revoked.partnerUserId,
        },
      });

      return { success: true };
    }),

  listOwnerAllocations: ownerQuery.query(async ({ ctx }) => {
    const db = getDb();
    const ownerAccountId = ctx.user?.accountRefId ?? ctx.user?.currentBusiness?.accountRefId;
    if (!ownerAccountId) {
      throw new Error("No owner account context available");
    }

    const allocations = await db.select({
      id: partnerAllocations.id,
      ownerAccountId: partnerAllocations.ownerAccountId,
      ownerBusinessId: partnerAllocations.ownerBusinessId,
      partnerAccountId: partnerAllocations.partnerAccountId,
      partnerUserId: partnerAllocations.partnerUserId,
      rightsProfile: partnerAllocations.rightsProfile,
      status: partnerAllocations.status,
      createdAt: partnerAllocations.createdAt,
      revokedAt: partnerAllocations.revokedAt,
      businessName: businesses.name,
      partnerUserName: users.name,
      partnerUserEmail: users.email,
    })
    .from(partnerAllocations)
    .leftJoin(businesses, eq(partnerAllocations.ownerBusinessId, businesses.id))
    .leftJoin(users, eq(partnerAllocations.partnerUserId, users.id))
    .where(and(
      eq(partnerAllocations.ownerAccountId, ownerAccountId),
      isNull(partnerAllocations.deletedAt),
    ))
    .orderBy(desc(partnerAllocations.createdAt));

    return allocations;
  }),

  listPartnerAllocations: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const partnerAccountId = ctx.user?.accountRefId ?? ctx.user?.currentBusiness?.accountRefId;
    if (!partnerAccountId) {
      return [];
    }

    const allocations = await db.select({
      id: partnerAllocations.id,
      ownerAccountId: partnerAllocations.ownerAccountId,
      ownerBusinessId: partnerAllocations.ownerBusinessId,
      partnerAccountId: partnerAllocations.partnerAccountId,
      partnerUserId: partnerAllocations.partnerUserId,
      rightsProfile: partnerAllocations.rightsProfile,
      status: partnerAllocations.status,
      createdAt: partnerAllocations.createdAt,
      revokedAt: partnerAllocations.revokedAt,
      businessName: businesses.name,
      businessAccountId: businesses.accountId,
    })
    .from(partnerAllocations)
    .leftJoin(businesses, eq(partnerAllocations.ownerBusinessId, businesses.id))
    .where(and(
      eq(partnerAllocations.partnerAccountId, partnerAccountId),
      eq(partnerAllocations.partnerUserId, ctx.user!.id),
      isNull(partnerAllocations.deletedAt),
    ))
    .orderBy(desc(partnerAllocations.createdAt));

    return allocations;
  }),

  // Partner dashboard: list all client businesses
  clients: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user!.id;
    // Find businesses where this user is marked as partner
    const clientBiz = await db.select().from(businesses).where(and(eq(businesses.partnerId, userId), isNull(businesses.deletedAt))).orderBy(sql`businesses.createdAt DESC`);
    return clientBiz;
  }),

  // Commission report for a period
  commissions: authedQuery
    .input(z.object({ year: z.number().optional(), month: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user!.id;
      const cond = [eq(partnerCommissions.partnerId, userId)];
      if (input.year) cond.push(eq(partnerCommissions.year, input.year));
      if (input.month) cond.push(eq(partnerCommissions.month, input.month));
      const rows = await db.select().from(partnerCommissions).where(and(...cond)).orderBy(desc(partnerCommissions.createdAt));
      // Enrich with business names
      const bizIds = [...new Set(rows.map(r => r.businessId))];
      const bizs = bizIds.length > 0
        ? await db.select().from(businesses).where(sql`${businesses.id} IN (${sql.join(bizIds.map(id => sql`${id}`), sql`, `)})`)
        : [];
      return rows.map(r => ({ ...r, businessName: bizs.find(b => b.id === r.businessId)?.name ?? "" }));
    }),

  // Calculate commissions for a period
  calculate: ownerQuery
    .input(z.object({ year: z.number(), month: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      // Find all partner-linked businesses
      const partnerBizs = await db.select().from(businesses).where(and(sql`${businesses.partnerId} IS NOT NULL`, isNull(businesses.deletedAt)));
      let created = 0;
      for (const biz of partnerBizs) {
        const revShare = parseFloat(biz.revSharePercent ?? "20");
        // Estimate subscription value based on plan tier
        const planPrices: Record<string, number> = { free: 0, starter: 2999, growth: 5999, pro: 7999 };
        const subAmount = planPrices[biz.plan ?? "free"] ?? 0;
        const commission = subAmount * (revShare / 100);

        // Upsert commission record
        const existing = await db.select().from(partnerCommissions).where(
          and(eq(partnerCommissions.partnerId, biz.partnerId!), eq(partnerCommissions.businessId, biz.id), eq(partnerCommissions.month, input.month), eq(partnerCommissions.year, input.year))
        ).limit(1);

        if (existing.length > 0) {
          await db.update(partnerCommissions).set({
            subscriptionAmount: subAmount.toFixed(2),
            commissionPercent: revShare.toFixed(2),
            commissionAmount: commission.toFixed(2),
          }).where(eq(partnerCommissions.id, existing[0].id));
        } else {
          await db.insert(partnerCommissions).values({
            partnerId: biz.partnerId!,
            businessId: biz.id,
            month: input.month,
            year: input.year,
            subscriptionAmount: subAmount.toFixed(2),
            commissionPercent: revShare.toFixed(2),
            commissionAmount: commission.toFixed(2),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any).returning();
          created++;
        }
      }
      return { created };
    }),
});
