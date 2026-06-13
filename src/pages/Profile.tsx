// ABOUTME: User profile page for viewing and editing own account details, username, and password.
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserCircle, Mail, Phone, Key, Lock, Calendar, Clock, Shield, Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export function Profile() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const userIdParam = searchParams.get("id");
  const isOwnProfile = !userIdParam || String(currentUser?.id) === userIdParam;

  // If viewing another user, fetch their data
  const { data: viewedUser } = trpc.users.get.useQuery(
    { id: Number(userIdParam) },
    { enabled: !!userIdParam && !isOwnProfile },
  );

  const profileUser = isOwnProfile ? currentUser : viewedUser;

  const [editForm, setEditForm] = useState({ username: "", name: "", email: "", phone: "" });
  const [pwForm, setPwForm] = useState({ userId: 0, newPassword: "", confirmPassword: "" });
  const [pwOpen, setPwOpen] = useState(false);
  const [formDirty, setFormDirty] = useState(false);

  const utils = trpc.useUtils();
  const updateProfile = trpc.users.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated");
      setFormDirty(false);
      utils.localAuth.me.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const changePassword = trpc.users.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password changed");
      setPwOpen(false);
      setPwForm({ userId: 0, newPassword: "", confirmPassword: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const openPwDialog = () => {
    setPwForm({ userId: profileUser?.id ?? 0, newPassword: "", confirmPassword: "" });
    setPwOpen(true);
  };

  return (
    <Layout>
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          {!isOwnProfile && (
            <Button variant="ghost" size="sm" onClick={() => navigate("/users")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">
              {isOwnProfile ? "Your Profile" : "User Profile"}
            </h1>
            <p className="text-sm text-[#8D8A87]">
              {isOwnProfile ? "Manage your account details" : `Viewing ${profileUser?.name ?? "user"}'s profile`}
            </p>
          </div>
        </div>

        {/* Profile Info Card */}
        <Card className="border-[#E8E0D8]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <UserCircle className="h-5 w-5 text-[#D4A854]" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-[#E8E0D8]">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#D4A854]/20">
                <UserCircle className="h-8 w-8 text-[#D4A854]" />
              </div>
              <div>
                <p className="text-lg font-medium text-[#2D2A26]">{profileUser?.name ?? "—"}</p>
                <p className="flex items-center gap-1 text-sm capitalize text-[#8D8A87]">
                  <Shield className="h-3 w-3" />
                  {profileUser?.role ?? "—"}
                </p>
              </div>
            </div>

            {isOwnProfile ? (
              <>
                {/* Editable form for own profile */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="pf-username" className="text-xs text-[#8D8A87]">Username</Label>
                    <Input
                      id="pf-username"
                      placeholder="username"
                      defaultValue={currentUser?.username ?? ""}
                      onChange={(e) => { setEditForm(p => ({ ...p, username: e.target.value })); setFormDirty(true); }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pf-name" className="text-xs text-[#8D8A87]">Full Name</Label>
                    <Input
                      id="pf-name"
                      placeholder="Full name"
                      defaultValue={currentUser?.name ?? ""}
                      onChange={(e) => { setEditForm(p => ({ ...p, name: e.target.value })); setFormDirty(true); }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pf-email" className="text-xs text-[#8D8A87]">Email</Label>
                    <Input
                      id="pf-email"
                      type="email"
                      placeholder="email@example.com"
                      defaultValue={currentUser?.email ?? ""}
                      onChange={(e) => { setEditForm(p => ({ ...p, email: e.target.value })); setFormDirty(true); }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pf-phone" className="text-xs text-[#8D8A87]">Phone</Label>
                    <Input
                      id="pf-phone"
                      placeholder="+254..."
                      defaultValue={currentUser?.phone ?? ""}
                      onChange={(e) => { setEditForm(p => ({ ...p, phone: e.target.value })); setFormDirty(true); }}
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      const payload: Record<string, string> = {};
                      if (editForm.username) payload.username = editForm.username;
                      if (editForm.name) payload.name = editForm.name;
                      if (editForm.email !== undefined) payload.email = editForm.email;
                      if (editForm.phone !== undefined) payload.phone = editForm.phone;
                      if (Object.keys(payload).length > 0) {
                        updateProfile.mutate(payload as any);
                      }
                    }}
                    disabled={!formDirty || updateProfile.isPending}
                    className="bg-[#C73E1D] hover:bg-[#A83214]"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {updateProfile.isPending ? "Saving..." : "Save Changes"}
                  </Button>

                  <Dialog open={pwOpen} onOpenChange={setPwOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" onClick={openPwDialog}>
                        <Key className="mr-2 h-4 w-4" />
                        Change Password
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="font-serif text-lg">Change Password</DialogTitle>
                      </DialogHeader>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (pwForm.newPassword !== pwForm.confirmPassword) {
                            toast.error("Passwords do not match");
                            return;
                          }
                          if (pwForm.newPassword.length < 4) {
                            toast.error("Password must be at least 4 characters");
                            return;
                          }
                          changePassword.mutate({ userId: pwForm.userId, newPassword: pwForm.newPassword });
                        }}
                        className="space-y-4"
                      >
                        <div className="space-y-1.5">
                          <Label htmlFor="pw-new">New Password</Label>
                          <Input
                            id="pw-new"
                            type="password"
                            placeholder="New password"
                            value={pwForm.newPassword}
                            onChange={(e) => setPwForm(p => ({ ...p, newPassword: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="pw-confirm">Confirm Password</Label>
                          <Input
                            id="pw-confirm"
                            type="password"
                            placeholder="Confirm new password"
                            value={pwForm.confirmPassword}
                            onChange={(e) => setPwForm(p => ({ ...p, confirmPassword: e.target.value }))}
                            required
                          />
                        </div>
                        <Button type="submit" className="w-full bg-[#C73E1D]" disabled={changePassword.isPending}>
                          <Lock className="mr-2 h-4 w-4" />
                          {changePassword.isPending ? "Changing..." : "Update Password"}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </>
            ) : (
              <>
                {/* Read-only view for another user */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-[#8D8A87]">Username</Label>
                    <p className="text-sm text-[#2D2A26]">{viewedUser?.username ?? "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-[#8D8A87]">Name</Label>
                    <p className="text-sm text-[#2D2A26]">{viewedUser?.name ?? "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-[#8D8A87]"><Mail className="mr-1 inline h-3 w-3" />Email</Label>
                    <p className="text-sm text-[#2D2A26]">{viewedUser?.email ?? "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-[#8D8A87]"><Phone className="mr-1 inline h-3 w-3" />Phone</Label>
                    <p className="text-sm text-[#2D2A26]">{viewedUser?.phone ?? "—"}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Account Details Card (always visible, read-only metadata) */}
        <Card className="border-[#E8E0D8]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <Calendar className="h-5 w-5 text-[#D4A854]" />
              Account Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-[#8D8A87]" />
                <span className="text-[#8D8A87]">Role:</span>
                <span className="font-medium capitalize text-[#2D2A26]">{profileUser?.role ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-[#8D8A87]" />
                <span className="text-[#8D8A87]">Last Sign In:</span>
                <span className="text-[#2D2A26]">{/* lastSignInAt not in AuthUser; shown on Users page */}—</span>
              </div>
              {!isOwnProfile && (
                <div className="flex items-center gap-2 text-sm">
                  <UserCircle className="h-4 w-4 text-[#8D8A87]" />
                  <span className="text-[#8D8A87]">Status:</span>
                  <span className={`font-medium ${profileUser?.isActive ? "text-[#2E7D32]" : "text-[#D32F2F]"}`}>
                    {profileUser?.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
