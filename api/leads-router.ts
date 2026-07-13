// ABOUTME: CRUD and invitation endpoints for the partner/business leads engine.
// ABOUTME: Scopes every lead to the creating user while reusing shared referral and attribution helpers.
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { authedQuery, createRouter } from "./middleware";
import { businesses, leads } from "@db/schema";
import { getDb } from "./queries/connection";
import { sendLoggedEmail } from "./lib/logged-email";
import {
  getCurrentUserLeadContact,
  normalizeLeadEmail,
  normalizeLeadPhone,
} from "./lib/leads";
import { leadInvitationEmailHtml, leadInvitationEmailText, leadInvitationSmsText } from "./lib/email-templates";

const leadFilterSchema = z.object({
  status: z.enum(["all", "new", "contacted", "converted", "declined"]).default("all").optional(),
  joined: z.enum(["all", "yes", "no"]).default("all").optional(),
  referralUsed: z.enum(["all", "yes", "no"]).default("all").optional(),
  commissionEligible: z.enum(["all", "yes", "no"]).default("all").optional(),
});

const leadMutationSchema = z.object({
  businessName: z.string().min(1).max(255),
  contactName: z.string().min(1).max(255),
  email: z.string().email().max(320).optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  status: z.enum(["new", "contacted", "converted", "declined"]).default("new").optional(),
}).refine((value) => Boolean(value.email?.trim() || value.phone?.trim()), {
  message: "Provide an email address or phone number",
  path: ["email"],
});

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i += 1) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return `FINA${code}`;
}

async function getCurrentBusinessWithReferral(db: ReturnType<typeof getDb>, businessId: number | null | undefined) {
  if (!businessId) return null;
  const [business] = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      accountId: businesses.accountId,
      referralCode: businesses.referralCode,
    })
    .from(businesses)
    .where(and(eq(businesses.id, businessId), isNull(businesses.deletedAt)))
    .limit(1);
  return business ?? null;
}

export const leadsRouter = createRouter({
  list: authedQuery
    .input(leadFilterSchema.optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(leads)
        .where(and(eq(leads.creatorUserId, ctx.user!.id), isNull(leads.deletedAt)))
        .orderBy(desc(leads.createdAt), desc(leads.id));

      return rows.filter((lead) => {
        if (input?.status && input.status !== "all" && lead.status !== input.status) return false;
        if (input?.joined === "yes" && !lead.joinedAt) return false;
        if (input?.joined === "no" && lead.joinedAt) return false;
        if (input?.referralUsed === "yes" && !lead.joinedViaReferral) return false;
        if (input?.referralUsed === "no" && lead.joinedViaReferral) return false;
        if (input?.commissionEligible === "yes" && !lead.commissionEligible) return false;
        if (input?.commissionEligible === "no" && lead.commissionEligible) return false;
        return true;
      });
    }),

  stats: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select({
        joinedAt: leads.joinedAt,
        joinedViaReferral: leads.joinedViaReferral,
        commissionEligible: leads.commissionEligible,
      })
      .from(leads)
      .where(and(eq(leads.creatorUserId, ctx.user!.id), isNull(leads.deletedAt)));

    return {
      total: rows.length,
      joined: rows.filter((lead) => Boolean(lead.joinedAt)).length,
      referralUsed: rows.filter((lead) => lead.joinedViaReferral).length,
      commissionEligible: rows.filter((lead) => lead.commissionEligible).length,
    };
  }),

  create: authedQuery
    .input(leadMutationSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const currentBusinessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId ?? null;
      const [lead] = await db
        .insert(leads)
        .values({
          creatorUserId: ctx.user!.id,
          creatorAccountRefId: ctx.user?.accountRefId ?? null,
          creatorBusinessId: currentBusinessId,
          businessName: input.businessName.trim(),
          contactName: input.contactName.trim(),
          email: input.email?.trim() || null,
          normalizedEmail: normalizeLeadEmail(input.email),
          phone: input.phone?.trim() || null,
          normalizedPhone: normalizeLeadPhone(input.phone),
          status: input.status ?? "new",
        })
        .returning();

      return lead;
    }),

  update: authedQuery
    .input(z.object({
      id: z.number().int().positive(),
      businessName: z.string().min(1).max(255).optional(),
      contactName: z.string().min(1).max(255).optional(),
      email: z.string().email().max(320).optional().or(z.literal("")),
      phone: z.string().max(20).optional().or(z.literal("")),
      status: z.enum(["new", "contacted", "converted", "declined"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [existing] = await db
        .select()
        .from(leads)
        .where(and(eq(leads.id, input.id), eq(leads.creatorUserId, ctx.user!.id), isNull(leads.deletedAt)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
      }

      const email = input.email !== undefined ? (input.email.trim() || null) : existing.email;
      const phone = input.phone !== undefined ? (input.phone.trim() || null) : existing.phone;
      if (!email && !phone) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Provide an email address or phone number" });
      }

      const [updated] = await db
        .update(leads)
        .set({
          businessName: input.businessName?.trim() ?? existing.businessName,
          contactName: input.contactName?.trim() ?? existing.contactName,
          email,
          normalizedEmail: normalizeLeadEmail(email),
          phone,
          normalizedPhone: normalizeLeadPhone(phone),
          status: input.status ?? existing.status,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, existing.id))
        .returning();

      return updated;
    }),

  sendInvitationEmail: authedQuery
    .input(z.object({ leadId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [lead] = await db
        .select()
        .from(leads)
        .where(and(eq(leads.id, input.leadId), eq(leads.creatorUserId, ctx.user!.id), isNull(leads.deletedAt)))
        .limit(1);

      if (!lead) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
      }
      if (!lead.email) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Lead does not have an email address" });
      }

      const currentBusiness = await getCurrentBusinessWithReferral(
        db,
        ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId,
      );
      if (!currentBusiness) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Active business is required to send invitations" });
      }

      let referralCode = currentBusiness.referralCode;
      if (!referralCode) {
        referralCode = generateReferralCode();
        await db
          .update(businesses)
          .set({ referralCode })
          .where(eq(businesses.id, currentBusiness.id));
      }

      const referralLink = `${ctx.req.headers.get("origin") ?? "http://localhost"}/login?ref=${referralCode}`;
      await sendLoggedEmail("lead_invitation", {
        to: lead.email,
        subject: `${ctx.user?.name ?? "A Finaflow partner"} invited you to Finaflow`,
        text: leadInvitationEmailText({
          contactName: lead.contactName,
          referrerName: ctx.user?.name ?? "Finaflow partner",
          businessName: currentBusiness.name,
          referralCode,
          referralLink,
        }),
        html: leadInvitationEmailHtml({
          contactName: lead.contactName,
          referrerName: ctx.user?.name ?? "Finaflow partner",
          businessName: currentBusiness.name,
          referralCode,
          referralLink,
        }),
      });

      await db
        .update(leads)
        .set({
          emailInvitedAt: new Date(),
          lastInvitationChannel: "email",
          updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.id));

      return { success: true };
    }),

  prepareSmsInvitation: authedQuery
    .input(z.object({ leadId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [lead] = await db
        .select()
        .from(leads)
        .where(and(eq(leads.id, input.leadId), eq(leads.creatorUserId, ctx.user!.id), isNull(leads.deletedAt)))
        .limit(1);

      if (!lead) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
      }
      if (!lead.phone) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Lead does not have a phone number" });
      }

      const currentBusiness = await getCurrentBusinessWithReferral(
        db,
        ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId,
      );
      if (!currentBusiness) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Active business is required to prepare invitations" });
      }

      let referralCode = currentBusiness.referralCode;
      if (!referralCode) {
        referralCode = generateReferralCode();
        await db
          .update(businesses)
          .set({ referralCode })
          .where(eq(businesses.id, currentBusiness.id));
      }

      const referralLink = `${ctx.req.headers.get("origin") ?? "http://localhost"}/login?ref=${referralCode}`;
      const message = leadInvitationSmsText({
        referrerName: ctx.user?.name ?? currentBusiness.name,
        businessName: currentBusiness.name,
        referralCode,
        referralLink,
      });

      await db
        .update(leads)
        .set({
          smsPreparedAt: new Date(),
          lastInvitationChannel: "sms",
          updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.id));

      return { success: true, message };
    }),

  myContact: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return getCurrentUserLeadContact(db, ctx.user!.id);
  }),
});
