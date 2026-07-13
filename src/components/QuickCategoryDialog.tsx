import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type CategoryMode = "system" | "link";

type AccountingClass =
  | "cogs"
  | "operating_expense"
  | "admin_expense"
  | "marketing"
  | "depreciation"
  | "other";

interface QuickCategoryDialogProps {
  businessId: number;
  onCreated: (id: number) => void;
  disabled?: boolean;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function QuickCategoryDialog({
  businessId,
  onCreated,
  disabled: _disabled,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: QuickCategoryDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean) => {
    onOpenChange?.(value);
    setInternalOpen(value);
  };
  const [form, setForm] = useState({
    name: "",
    description: "",
    color: "#C73E1D",
    accountingClass: "operating_expense" as AccountingClass,
    mode: "system" as CategoryMode,
    defaultAccountId: "",
  });

  const utils = trpc.useUtils();
  const { data: coa } = trpc.chartOfAccounts.list.useQuery(
    { businessId },
    { enabled: open && businessId > 0 }
  );

  const createCategory = trpc.expenses.createCategory.useMutation({
    onSuccess: (result) => {
      toast.success("Category added");
      setOpen(false);
      setForm({
        name: "",
        description: "",
        color: "#C73E1D",
        accountingClass: "operating_expense",
        mode: "system",
        defaultAccountId: "",
      });
      utils.expenses.categories.invalidate();
      onCreated(result.id);
    },
    onError: (err) => toast.error(err.message || "Failed to add category"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    createCategory.mutate({
      name: form.name,
      description: form.description,
      color: form.color,
      accountingClass: form.accountingClass,
      defaultAccountId: form.mode === "link" && form.defaultAccountId ? +form.defaultAccountId : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-[#2D2A26]">New Expense Category</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Utilities"
              required
            />
          </div>
          <div>
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                  className="h-10 w-10 rounded border p-0.5"
                />
                <span className="text-xs text-[#8D8A87]">{form.color}</span>
              </div>
            </div>
            <div>
              <Label>Classification</Label>
              <select
                value={form.accountingClass}
                onChange={(e) => setForm((p) => ({ ...p, accountingClass: e.target.value as AccountingClass }))}
                className="w-full rounded border px-3 py-2 text-sm"
              >
                <option value="operating_expense">Operating Expense</option>
                <option value="admin_expense">Administrative Expense</option>
                <option value="cogs">Cost of Goods Sold</option>
                <option value="marketing">Marketing Expense</option>
                <option value="depreciation">Depreciation</option>
                <option value="other">Other Expense</option>
              </select>
            </div>
          </div>
          <div>
            <Label>Accounting Mode</Label>
            <select
              value={form.mode}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  mode: e.target.value as CategoryMode,
                  defaultAccountId: e.target.value === "link" ? p.defaultAccountId : "",
                }))
              }
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option value="system">Let the system manage the backing account</option>
              <option value="link">Link an existing chart account</option>
            </select>
            <p className="mt-1 text-xs text-[#8D8A87]">
              Simple mode creates or reuses the backing expense account automatically.
            </p>
          </div>
          {form.mode === "link" && (
            <div>
              <Label>Default Expense Account</Label>
              <select
                value={form.defaultAccountId}
                onChange={(e) => setForm((p) => ({ ...p, defaultAccountId: e.target.value }))}
                className="w-full rounded border px-3 py-2 text-sm"
                required={form.mode === "link"}
              >
                <option value="">Select expense account...</option>
                {coa?.grouped?.expense?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountCode} - {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Button
            type="submit"
            className="w-full bg-[#2E7D32]"
            disabled={createCategory.isPending}
          >
            {createCategory.isPending ? "Adding..." : "Add Category"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
