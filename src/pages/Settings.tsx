import { useState } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, Camera, MessageSquare, Briefcase } from "lucide-react";
import { toast } from "sonner";

export function Settings() {
  const { user } = useAuth();
  const canManage = hasPermission(user?.role ?? "viewer", PERMISSIONS.SETTINGS_MANAGE);
  const utils = trpc.useUtils();

  const { data: settings } = trpc.settings.list.useQuery();
  const setSetting = trpc.settings.set.useMutation({
    onSuccess: () => { utils.settings.list.invalidate(); toast.success("Setting saved"); },
    onError: (err) => toast.error(err.message),
  });

  const toggle = (key: string) => {
    const current = settings?.[key] === "true";
    setSetting.mutate({ key, value: String(!current) });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Settings</h1>
          <p className="mt-1 text-sm text-[#8D8A87]">Configure Finaflow for your business needs</p>
        </div>

        <Card className="border-[#E8E0D8]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <Camera className="h-5 w-5 text-[#C73E1D]" />
              Photos & Attachments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[#8D8A87]">Enable or disable photo capture on entry screens to save storage.</p>
            <div className="flex items-center justify-between rounded-lg border border-[#E8E0D8] px-4 py-3">
              <div>
                <Label className="text-sm font-medium">Daily Sales Photos</Label>
                <p className="text-xs text-[#8D8A87]">Allow attaching sales tickets and snapshots</p>
              </div>
              <Switch checked={settings?.photosDailySales === "true"} onCheckedChange={() => toggle("photosDailySales")} disabled={!canManage} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[#E8E0D8] px-4 py-3">
              <div>
                <Label className="text-sm font-medium">Expense Photos</Label>
                <p className="text-xs text-[#8D8A87]">Allow attaching receipt photos to expenses</p>
              </div>
              <Switch checked={settings?.photosExpenses === "true"} onCheckedChange={() => toggle("photosExpenses")} disabled={!canManage} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[#E8E0D8] px-4 py-3">
              <div>
                <Label className="text-sm font-medium">Bill Photos</Label>
                <p className="text-xs text-[#8D8A87]">Allow attaching photos to bills</p>
              </div>
              <Switch checked={settings?.photosBills === "true"} onCheckedChange={() => toggle("photosBills")} disabled={!canManage} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E8E0D8]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <MessageSquare className="h-5 w-5 text-[#D4A854]" />
              Feedback & Support
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-[#E8E0D8] px-4 py-3">
              <div>
                <Label className="text-sm font-medium">Enable User Feedback</Label>
                <p className="text-xs text-[#8D8A87]">Allow collecting feedback via questionnaires</p>
              </div>
              <Switch checked={settings?.feedbackEnabled === "true"} onCheckedChange={() => toggle("feedbackEnabled")} disabled={!canManage} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E8E0D8]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <Briefcase className="h-5 w-5 text-[#2E7D32]" />
              Multi-Business
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-[#E8E0D8] px-4 py-3">
              <div>
                <Label className="text-sm font-medium">Enable Multi-Business Support</Label>
                <p className="text-xs text-[#8D8A87]">Allow creating and switching between multiple businesses</p>
              </div>
              <Switch checked={settings?.multiBusiness === "true"} onCheckedChange={() => toggle("multiBusiness")} disabled={!canManage} />
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
