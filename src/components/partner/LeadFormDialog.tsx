// ABOUTME: Provides the create/edit dialog for partner leads with the minimal fields the workflow requires.
// ABOUTME: Reuses the shared dialog primitives so lead capture feels native to the existing admin surfaces.
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LeadStatus = "new" | "contacted" | "converted" | "declined";

export type LeadFormValues = {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  status: LeadStatus;
};

type LeadFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: LeadFormValues) => void;
  isPending: boolean;
  title: string;
  submitLabel: string;
  initialValues?: Partial<LeadFormValues>;
};

function buildValues(initialValues?: Partial<LeadFormValues>): LeadFormValues {
  return {
    businessName: initialValues?.businessName ?? "",
    contactName: initialValues?.contactName ?? "",
    email: initialValues?.email ?? "",
    phone: initialValues?.phone ?? "",
    status: initialValues?.status ?? "new",
  };
}

export function LeadFormDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  title,
  submitLabel,
  initialValues,
}: LeadFormDialogProps) {
  const [values, setValues] = useState<LeadFormValues>(() => buildValues(initialValues));

  useEffect(() => {
    if (open) {
      setValues(buildValues(initialValues));
    }
  }, [initialValues, open]);

  const canSubmit = useMemo(() => {
    return Boolean(
      values.businessName.trim() &&
      values.contactName.trim() &&
      (values.email.trim() || values.phone.trim()),
    );
  }, [values]);

  function updateField<K extends keyof LeadFormValues>(field: K, value: LeadFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="lead-business-name">Business Name</Label>
            <Input
              id="lead-business-name"
              value={values.businessName}
              onChange={(event) => updateField("businessName", event.target.value)}
              placeholder="Acme Traders"
            />
          </div>

          <div>
            <Label htmlFor="lead-contact-name">Contact Person</Label>
            <Input
              id="lead-contact-name"
              value={values.contactName}
              onChange={(event) => updateField("contactName", event.target.value)}
              placeholder="Jane Doe"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="lead-email">Email</Label>
              <Input
                id="lead-email"
                type="email"
                value={values.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="jane@example.com"
              />
            </div>
            <div>
              <Label htmlFor="lead-phone">Phone</Label>
              <Input
                id="lead-phone"
                value={values.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                placeholder="+2547..."
              />
            </div>
          </div>

          <div>
            <Label htmlFor="lead-status">Lead Status</Label>
            <select
              id="lead-status"
              value={values.status}
              onChange={(event) => updateField("status", event.target.value as LeadStatus)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="converted">Converted</option>
              <option value="declined">Declined</option>
            </select>
          </div>

          <p className="text-xs text-[#8D8A87]">At least one contact method is required so signup matching can work.</p>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#C73E1D] hover:bg-[#A33317]"
              onClick={() => onSubmit(values)}
              disabled={!canSubmit || isPending}
            >
              {isPending ? "Saving..." : submitLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
