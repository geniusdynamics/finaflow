import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface QuickSupplierDialogProps {
  onCreated: (id: number) => void;
  disabled?: boolean;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function QuickSupplierDialog({
  onCreated,
  disabled: _disabled,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: QuickSupplierDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean) => {
    onOpenChange?.(value);
    setInternalOpen(value);
  };
  const [form, setForm] = useState({
    name: "",
    phone: "",
    contactPerson: "",
    notes: "",
  });

  const utils = trpc.useUtils();

  const createSupplier = trpc.suppliers.create.useMutation({
    onSuccess: (result) => {
      toast.success("Supplier added");
      setOpen(false);
      setForm({ name: "", phone: "", contactPerson: "", notes: "" });
      utils.suppliers.list.invalidate();
      onCreated(result.id);
    },
    onError: (err) => toast.error(err.message || "Failed to add supplier"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    createSupplier.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-[#2D2A26]">New Supplier</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Fresh Produce Ltd"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+254..."
              />
            </div>
            <div>
              <Label>Contact Person</Label>
              <Input
                value={form.contactPerson}
                onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-[#C73E1D]"
            disabled={createSupplier.isPending}
          >
            {createSupplier.isPending ? "Adding..." : "Add Supplier"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
