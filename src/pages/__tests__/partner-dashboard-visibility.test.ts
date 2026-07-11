// ABOUTME: Protects the new partner dashboard leads surface and allocation visibility rules from quiet regressions.
// ABOUTME: Uses source-level assertions so route wiring and gated tab structure stay intact without full app rendering.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("partner dashboard and visibility regressions", () => {
  it("keeps the Settings account tab wired to the account-level referred-by mutation", () => {
    const settingsPath = path.resolve(import.meta.dirname, "../Settings.tsx");
    const source = fs.readFileSync(settingsPath, "utf8");

    expect(source).toContain("trpc.accountSubscriptions.setReferredBy.useMutation");
    expect(source).toContain("Save Referral");
    expect(source).toContain("Commission Eligible");
    expect(source).toContain("Information Only");
  });

  it("keeps Businesses page owner allocation management available to business managers", () => {
    const businessesPath = path.resolve(import.meta.dirname, "../Businesses.tsx");
    const source = fs.readFileSync(businessesPath, "utf8");

    expect(source).toContain("const canManagePartnerAllocations = canManage || user?.role === \"admin\" || Boolean(user?.isSuperAdmin);");
    expect(source).toContain("{canManagePartnerAllocations && (");
    expect(source).toContain("{tab === \"allocations\" && canManagePartnerAllocations && <AllocationManagement />}");
  });

  it("wires the Partner Dashboard leads tab, partner-only portfolio data, and owner allocation management view", async () => {
    const partnerPath = path.resolve(import.meta.dirname, "../PartnerDashboard.tsx");
    const source = fs.readFileSync(partnerPath, "utf8");
    const module = await import("../PartnerDashboard");

    expect(typeof module.default).toBe("function");
    expect(source).toContain("const { data: ownerAllocations } = trpc.partner.listOwnerAllocations.useQuery(undefined, {");
    expect(source).toContain("const allocatedPartnersCount = useMemo(() => {");
    expect(source).toContain("allocation.ownerBusinessId === user.currentBusinessId && allocation.status === \"active\"");
    expect(source).toContain("{ label: \"Allocated Partners\", value: allocatedPartnersCount, icon: Key, color: \"text-[#C73E1D]\" }");
    expect(source).toContain("const { data: leadStats } = trpc.leads.stats.useQuery()");
    expect(source).toContain("<LeadsTab />");
    expect(source).toContain("<AllocationManagement />");
    expect(source).toContain("const canSeePartnerPortfolio = user?.userType === \"partner\" || user?.role === \"admin\" || Boolean(user?.isSuperAdmin);");
    expect(source).toContain("const canManagePartnerAllocations = user?.role === \"owner\" || user?.userType === \"partner\" || user?.role === \"admin\" || Boolean(user?.isSuperAdmin);");
    expect(source).toContain("{canSeePartnerPortfolio && (");
    expect(source).toContain("Client Businesses");
    expect(source).toContain("data-testid=\"partner-tab-leads\"");
    expect(source).toContain("data-testid=\"partner-tab-allocations\"");
  });
});
