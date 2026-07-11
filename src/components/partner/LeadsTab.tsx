// ABOUTME: Renders the lead management workspace for the Partner Dashboard, including filters and invite actions.
// ABOUTME: Keeps the dashboard responsive by pairing a desktop table with mobile cards and lightweight dialogs.
import { useMemo, useState } from "react";
import { Mail, MessageSquare, Pencil, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeadFormDialog, type LeadFormValues } from "@/components/partner/LeadFormDialog";
import { LeadStatusBadge } from "@/components/partner/LeadStatusBadge";

type LeadRecord = {
  id: number;
  businessName: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  status: "new" | "contacted" | "converted" | "declined";
  joinedAt: Date | null;
  joinedViaReferral: boolean;
  commissionEligible: boolean;
  matchedBusinessId: number | null;
  matchedAccountRefId: number | null;
  lastInvitationChannel: string | null;
};

type LeadFilters = {
  status: "all" | "new" | "contacted" | "converted" | "declined";
  joined: "all" | "yes" | "no";
  referralUsed: "all" | "yes" | "no";
  commissionEligible: "all" | "yes" | "no";
};

const defaultFilters: LeadFilters = {
  status: "all",
  joined: "all",
  referralUsed: "all",
  commissionEligible: "all",
};

export function LeadsTab() {
  const [filters, setFilters] = useState<LeadFilters>(defaultFilters);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadRecord | null>(null);
  const utils = trpc.useUtils();

  const { data: leads = [], isLoading, refetch } = trpc.leads.list.useQuery(filters);

  const createLead = trpc.leads.create.useMutation({
    onSuccess: async () => {
      toast.success("Lead saved");
      setCreateOpen(false);
      await utils.leads.list.invalidate();
      await utils.leads.stats.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateLead = trpc.leads.update.useMutation({
    onSuccess: async () => {
      toast.success("Lead updated");
      setEditingLead(null);
      await utils.leads.list.invalidate();
      await utils.leads.stats.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const sendInvitationEmail = trpc.leads.sendInvitationEmail.useMutation({
    onSuccess: async () => {
      toast.success("Invitation email sent");
      await utils.leads.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const prepareSmsInvitation = trpc.leads.prepareSmsInvitation.useMutation({
    onSuccess: async ({ message }) => {
      await navigator.clipboard.writeText(message);
      toast.success("SMS invitation copied to clipboard");
      await utils.leads.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const leadsRows = useMemo(() => leads as LeadRecord[], [leads]);

  const saveNewLead = (values: LeadFormValues) => {
    createLead.mutate(values);
  };

  const saveEditedLead = (values: LeadFormValues) => {
    if (!editingLead) return;
    updateLead.mutate({ id: editingLead.id, ...values });
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    refetch();
  };

  return (
    <div className="space-y-6">
      <Card className="border-[#E8E0D8] bg-white">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="font-serif text-lg">Leads</CardTitle>
              <p className="mt-1 text-sm text-[#8D8A87]">
                Track invited businesses, watch for joined accounts, and see whether referrals became commission eligible.
              </p>
            </div>
            <Button
              type="button"
              className="bg-[#C73E1D] hover:bg-[#A33317]"
              onClick={() => setCreateOpen(true)}
              data-testid="partner-leads-create"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Lead
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1 text-xs text-[#8D8A87]">
              Status
              <select
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as LeadFilters["status"] }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-[#2D2A26]"
              >
                <option value="all">All statuses</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="converted">Converted</option>
                <option value="declined">Declined</option>
              </select>
            </label>

            <label className="space-y-1 text-xs text-[#8D8A87]">
              Joined
              <select
                value={filters.joined}
                onChange={(event) => setFilters((current) => ({ ...current, joined: event.target.value as LeadFilters["joined"] }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-[#2D2A26]"
              >
                <option value="all">All</option>
                <option value="yes">Joined</option>
                <option value="no">Not joined</option>
              </select>
            </label>

            <label className="space-y-1 text-xs text-[#8D8A87]">
              Referral Used
              <select
                value={filters.referralUsed}
                onChange={(event) => setFilters((current) => ({ ...current, referralUsed: event.target.value as LeadFilters["referralUsed"] }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-[#2D2A26]"
              >
                <option value="all">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>

            <label className="space-y-1 text-xs text-[#8D8A87]">
              Commission
              <select
                value={filters.commissionEligible}
                onChange={(event) => setFilters((current) => ({ ...current, commissionEligible: event.target.value as LeadFilters["commissionEligible"] }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-[#2D2A26]"
              >
                <option value="all">All</option>
                <option value="yes">Eligible</option>
                <option value="no">Information only</option>
              </select>
            </label>

            <div className="flex items-end">
              <Button type="button" variant="outline" className="w-full" onClick={resetFilters}>
                <RefreshCw className="mr-1 h-4 w-4" />
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#E8E0D8]">
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="py-10 text-center text-sm text-[#8D8A87]">Loading leads...</div>
          ) : leadsRows.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#8D8A87]">No leads match the current filters.</div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E8E0D8]">
                      <th className="pb-3 text-left text-xs uppercase text-[#8D8A87]">Lead</th>
                      <th className="pb-3 text-left text-xs uppercase text-[#8D8A87]">Contact</th>
                      <th className="pb-3 text-left text-xs uppercase text-[#8D8A87]">Status</th>
                      <th className="pb-3 text-left text-xs uppercase text-[#8D8A87]">Match</th>
                      <th className="pb-3 text-right text-xs uppercase text-[#8D8A87]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E0D8]">
                    {leadsRows.map((lead) => (
                      <tr key={lead.id} className="align-top hover:bg-[#F5EDE6]/40">
                        <td className="py-4 pr-4">
                          <p className="text-sm font-medium text-[#2D2A26]">{lead.businessName}</p>
                          <p className="text-xs text-[#8D8A87]">{lead.contactName}</p>
                        </td>
                        <td className="py-4 pr-4 text-xs text-[#8D8A87]">
                          <div>{lead.email || "-"}</div>
                          <div>{lead.phone || "-"}</div>
                        </td>
                        <td className="py-4 pr-4">
                          <LeadStatusBadge
                            status={lead.status}
                            joinedAt={lead.joinedAt}
                            joinedViaReferral={lead.joinedViaReferral}
                            commissionEligible={lead.commissionEligible}
                          />
                        </td>
                        <td className="py-4 pr-4 text-xs text-[#8D8A87]">
                          <div>{lead.matchedBusinessId ? `Business #${lead.matchedBusinessId}` : "Not matched yet"}</div>
                          <div>{lead.matchedAccountRefId ? `Account Ref #${lead.matchedAccountRefId}` : lead.lastInvitationChannel ? `Last invite: ${lead.lastInvitationChannel}` : "-"}</div>
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => setEditingLead(lead)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => sendInvitationEmail.mutate({ leadId: lead.id })}
                              disabled={!lead.email || sendInvitationEmail.isPending}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => prepareSmsInvitation.mutate({ leadId: lead.id })}
                              disabled={!lead.phone || prepareSmsInvitation.isPending}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 lg:hidden">
                {leadsRows.map((lead) => (
                  <div key={lead.id} className="rounded-lg border border-[#E8E0D8] bg-[#F5EDE6]/30 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#2D2A26]">{lead.businessName}</p>
                        <p className="text-xs text-[#8D8A87]">{lead.contactName}</p>
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditingLead(lead)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-2 text-xs text-[#8D8A87]">
                      <p>{lead.email || "No email added"}</p>
                      <p>{lead.phone || "No phone added"}</p>
                      <p>{lead.matchedBusinessId ? `Matched business #${lead.matchedBusinessId}` : "No matched business yet"}</p>
                    </div>

                    <div className="mt-3">
                      <LeadStatusBadge
                        status={lead.status}
                        joinedAt={lead.joinedAt}
                        joinedViaReferral={lead.joinedViaReferral}
                        commissionEligible={lead.commissionEligible}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => sendInvitationEmail.mutate({ leadId: lead.id })}
                        disabled={!lead.email || sendInvitationEmail.isPending}
                      >
                        <Mail className="mr-1 h-4 w-4" />
                        Email
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => prepareSmsInvitation.mutate({ leadId: lead.id })}
                        disabled={!lead.phone || prepareSmsInvitation.isPending}
                      >
                        <MessageSquare className="mr-1 h-4 w-4" />
                        SMS
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <LeadFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Add Lead"
        submitLabel="Save Lead"
        isPending={createLead.isPending}
        onSubmit={saveNewLead}
      />

      <LeadFormDialog
        open={Boolean(editingLead)}
        onOpenChange={(open) => {
          if (!open) setEditingLead(null);
        }}
        title="Edit Lead"
        submitLabel="Update Lead"
        isPending={updateLead.isPending}
        onSubmit={saveEditedLead}
        initialValues={editingLead ? {
          businessName: editingLead.businessName,
          contactName: editingLead.contactName,
          email: editingLead.email ?? "",
          phone: editingLead.phone ?? "",
          status: editingLead.status,
        } : undefined}
      />
    </div>
  );
}
