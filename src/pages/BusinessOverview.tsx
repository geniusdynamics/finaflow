// ABOUTME: Consolidated business overview page showing all profile details, documents, logo, and locations CRUD.
// ABOUTME: Acts as the central hub for viewing and managing a single business from the businesses list.
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatFileSize } from "@/features/business-profile/formatters";
import { isAllowedLogoType, optimizeLogoFile, validateLogoFileSizeBytes } from "@/features/business-profile/logo-utils";
import { toast } from "sonner";
import {
  Building2, Store, Globe, Shield, FileText, MapPin, Pencil, Trash2, Plus,
  X, Loader2, Upload, Building, ChevronLeft,
  Landmark, Wallet, Save,
} from "lucide-react";
const DOCUMENT_TYPES = [
  "Business Registration Certificate",
  "KRA PIN Certificate",
  "Tax Compliance Certificate",
  "Business Permit / License",
  "Partnership Deed",
  "Certificate of Incorporation",
  "Memorandum & Articles of Association",
  "Single Business Permit",
  "Food & Health License",
  "Other License / Permit",
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

export function BusinessOverview() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const businessId = id ? Number(id) : null;
  const { user } = useAuth();
  const canManage = hasPermission(user?.role ?? "viewer", PERMISSIONS.BUSINESS_MANAGE);

  const utils = trpc.useUtils();

  const { data: business, isLoading } = trpc.businesses.get.useQuery(
    { id: businessId! },
    { enabled: !!businessId }
  );
  const { data: locations } = trpc.locations.listByBusinessId.useQuery(
    { businessId: businessId! },
    { enabled: !!businessId }
  );
  const { data: documents, refetch: refetchDocs } = trpc.businesses.getDocuments.useQuery(
    { businessId: businessId! },
    { enabled: !!businessId }
  );
  const { data: activeLogo, refetch: refetchLogo, isLoading: logoLoading } = trpc.businesses.getActiveLogo.useQuery(
    { businessId: businessId! },
    { enabled: !!businessId }
  );
  const { data: accounts } = trpc.accounts.list.useQuery();

  const _downloadDocumentMutation = trpc.businesses.downloadDocument.useMutation();
  const uploadDocMutation = trpc.businesses.uploadDocument.useMutation();
  const deleteDocMutation = trpc.businesses.deleteDocument.useMutation();
  const uploadLogoMutation = trpc.businesses.uploadLogo.useMutation();
  const deleteLogoMutation = trpc.businesses.deleteLogo.useMutation();

  const createLoc = trpc.locations.create.useMutation({
    onSuccess: () => {
      setLocDialogOpen(false);
      setLocForm({ name: "", slug: "", address: "", phone: "", email: "" });
      utils.locations.listByBusinessId.invalidate({ businessId: businessId! });
      toast.success("Branch created");
    },
    onError: (err) => toast.error(err.message),
  });
  const updateLoc = trpc.locations.update.useMutation({
    onSuccess: () => {
      setEditLocId(null);
      utils.locations.listByBusinessId.invalidate({ businessId: businessId! });
      toast.success("Branch updated");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteLoc = trpc.locations.delete.useMutation({
    onSuccess: () => {
      utils.locations.listByBusinessId.invalidate({ businessId: businessId! });
      toast.success("Branch deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const [locDialogOpen, setLocDialogOpen] = useState(false);
  const [locForm, setLocForm] = useState({ name: "", slug: "", address: "", phone: "", email: "" });
  const [editLocId, setEditLocId] = useState<number | null>(null);
  const [editLocForm, setEditLocForm] = useState({ name: "", slug: "", address: "", phone: "", email: "", isActive: true, defaultMpesaAccountId: "", defaultCashAccountId: "" });

  const [uploading, setUploading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleCreateLocation = (e: React.FormEvent) => {
    e.preventDefault();
    createLoc.mutate({
      name: locForm.name,
      slug: locForm.slug,
      address: locForm.address || undefined,
      phone: locForm.phone || undefined,
      email: locForm.email || undefined,
    });
  };

  const handleUpdateLocation = (locId: number) => {
    updateLoc.mutate({
      id: locId,
      name: editLocForm.name,
      slug: editLocForm.slug,
      address: editLocForm.address || undefined,
      phone: editLocForm.phone || undefined,
      email: editLocForm.email || undefined,
      isActive: editLocForm.isActive,
      defaultMpesaAccountId: editLocForm.defaultMpesaAccountId ? +editLocForm.defaultMpesaAccountId : undefined,
      defaultCashAccountId: editLocForm.defaultCashAccountId ? +editLocForm.defaultCashAccountId : undefined,
    });
  };

  const startEditLocation = (loc: {
    id: number;
    name?: string;
    slug?: string;
    address?: string;
    phone?: string;
    email?: string;
    isActive: boolean;
    defaultMpesaAccountId?: number | null;
    defaultCashAccountId?: number | null;
  }) => {
    setEditLocId(loc.id);
    setEditLocForm({
      name: loc.name || "",
      slug: loc.slug || "",
      address: loc.address || "",
      phone: loc.phone || "",
      email: loc.email || "",
      isActive: loc.isActive,
      defaultMpesaAccountId: loc.defaultMpesaAccountId?.toString() ?? "",
      defaultCashAccountId: loc.defaultCashAccountId?.toString() ?? "",
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file || !businessId) return;
    setUploading(true);
    try {
      const fileData = await fileToBase64(file);
      await uploadDocMutation.mutateAsync({ businessId, documentType: docType, fileName: file.name, fileData, mimeType: file.type });
      await refetchDocs();
      toast.success(`${docType} uploaded successfully`);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteDoc = async (docId: number) => {
    try {
      await deleteDocMutation.mutateAsync({ id: docId });
      await refetchDocs();
      toast.success("Document deleted");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Delete failed"));
    }
  };

  const _triggerBase64Download = (fileName: string, mimeType: string, fileData: string) => {
    const byteChars = atob(fileData);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      bytes[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleLogoUpload = async (file: File) => {
    if (!businessId) return;
    if (!isAllowedLogoType(file.type)) {
      throw new Error("Unsupported logo format. Allowed: JPEG, PNG, SVG.");
    }
    if (!validateLogoFileSizeBytes(file.size)) {
      throw new Error("Logo exceeds 5MB maximum size.");
    }
    const optimized = await optimizeLogoFile(file);
    await uploadLogoMutation.mutateAsync({
      businessId,
      fileName: file.name,
      mimeType: optimized.mimeType,
      fileData: optimized.fileData,
      width: optimized.width,
      height: optimized.height,
      sizeBytes: optimized.sizeBytes,
    });
    await refetchLogo();
    toast.success("Logo uploaded successfully");
  };

  const handleLogoInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      await handleLogoUpload(file);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Logo upload failed"));
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  };

  const handleDeleteLogo = async () => {
    if (!businessId) return;
    try {
      await deleteLogoMutation.mutateAsync({ businessId });
      await refetchLogo();
      toast.success("Logo deleted");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to delete logo"));
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#C73E1D]" />
        </div>
      </Layout>
    );
  }

  if (!business) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <Building className="h-12 w-12 text-[#8D8A87]" />
          <p className="font-serif text-xl text-[#2D2A26]">Business not found</p>
          <Button onClick={() => navigate("/businesses")} className="bg-[#C73E1D]">Back to Businesses</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb / Back nav */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate("/businesses")}
              className="mb-1 flex items-center gap-1 text-xs text-[#8D8A87] hover:text-[#C73E1D]"
            >
              <ChevronLeft className="h-3 w-3" />
              Back to Businesses
            </button>
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">{business.name}</h1>
              <Badge className={`${business.isActive ? "bg-green-600" : "bg-red-600"} text-white`}>
                {business.isActive ? "Active" : "Inactive"}
              </Badge>
              <Badge variant="outline" className="border-[#C73E1D]/30 text-[#C73E1D] capitalize">
                {business.plan || "free"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-[#8D8A87]">
              {business.slug} &middot; {business.accountId}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <Button
                onClick={() => navigate(`/businesses/${businessId}/details`)}
                className="bg-[#C73E1D]"
              >
                <Pencil className="mr-1 h-4 w-4" />
                Edit Business Details
              </Button>
            )}
            <Button variant="outline" onClick={() => window.print()}>
              Print Profile
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card className="border-[#E8E0D8]">
            <CardContent className="flex items-center gap-3 p-4">
              <MapPin className="h-8 w-8 text-[#C73E1D]" />
              <div>
                <p className="text-2xl font-bold text-[#2D2A26]">{locations?.length ?? 0}</p>
                <p className="text-xs text-[#8D8A87]">Branches</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#E8E0D8]">
            <CardContent className="flex items-center gap-3 p-4">
              <FileText className="h-8 w-8 text-[#2E7D32]" />
              <div>
                <p className="text-2xl font-bold text-[#2D2A26]">{documents?.length ?? 0}</p>
                <p className="text-xs text-[#8D8A87]">Documents</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#E8E0D8]">
            <CardContent className="flex items-center gap-3 p-4">
              <Building2 className="h-8 w-8 text-[#D4A854]" />
              <div>
                <p className="text-2xl font-bold text-[#2D2A26]">{business.businessType || "—"}</p>
                <p className="text-xs text-[#8D8A87]">Business Type</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#E8E0D8]">
            <CardContent className="flex items-center gap-3 p-4">
              <Landmark className="h-8 w-8 text-[#2E7D32]" />
              <div>
                <p className="text-2xl font-bold text-[#2D2A26]">{business.plan ? business.plan.charAt(0).toUpperCase() + business.plan.slice(1) : "Free"}</p>
                <p className="text-xs text-[#8D8A87]">Current Plan</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Business Info */}
          <Card className="border-[#E8E0D8]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-serif text-lg">
                <Store className="h-5 w-5 text-[#C73E1D]" />
                Business Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-[#8D8A87]">Business Name</dt>
                  <dd className="font-medium text-[#2D2A26]">{business.name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#8D8A87]">Business Type</dt>
                  <dd className="font-medium text-[#2D2A26]">{business.businessType || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#8D8A87]">Registration Number</dt>
                  <dd className="font-medium text-[#2D2A26]">{business.businessRegNumber || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#8D8A87]">KRA PIN</dt>
                  <dd className="font-mono text-xs font-medium text-[#2D2A26]">{business.kraPin || "—"}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-[#8D8A87]">Nature of Business</dt>
                  <dd className="font-medium text-[#2D2A26]">{business.natureOfBusiness || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#8D8A87]">Phone</dt>
                  <dd className="font-medium text-[#2D2A26]">{business.phone || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#8D8A87]">Email</dt>
                  <dd className="font-medium text-[#2D2A26]">{business.email || "—"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Address Information */}
          <Card className="border-[#E8E0D8]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-serif text-lg">
                <Globe className="h-5 w-5 text-[#C73E1D]" />
                Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-[#8D8A87]">Country</dt>
                  <dd className="font-medium text-[#2D2A26]">{business.country || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#8D8A87]">County</dt>
                  <dd className="font-medium text-[#2D2A26]">{business.county || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#8D8A87]">Sub County</dt>
                  <dd className="font-medium text-[#2D2A26]">{business.subCounty || "—"}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-[#8D8A87]">Physical Address</dt>
                  <dd className="font-medium text-[#2D2A26]">{business.address || "—"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card className="border-[#E8E0D8]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-serif text-lg">
                <Shield className="h-5 w-5 text-[#C73E1D]" />
                Account
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-[#8D8A87]">Account ID</dt>
                  <dd className="font-mono text-xs font-medium text-[#2D2A26]">{business.accountId || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#8D8A87]">Plan</dt>
                  <dd className="flex items-center gap-1 font-medium text-[#2D2A26]">
                    <Landmark className="h-3 w-3 text-[#C73E1D]" />
                    <span className="capitalize">{business.plan || "free"}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[#8D8A87]">Status</dt>
                  <dd className="flex items-center gap-1 font-medium text-[#2D2A26]">
                    <div className={`h-2 w-2 rounded-full ${business.isActive ? "bg-green-600" : "bg-red-600"}`} />
                    {business.isActive ? "Active" : "Inactive"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[#8D8A87]">Referral Code</dt>
                  <dd className="font-mono text-xs font-medium text-[#2D2A26]">{business.referralCode || "—"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Logo & Documents */}
          <Card className="border-[#E8E0D8]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-serif text-lg">
                <FileText className="h-5 w-5 text-[#C73E1D]" />
                Logo & Branding
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {logoLoading ? (
                <p className="text-xs text-[#8D8A87]">Loading logo...</p>
              ) : activeLogo ? (
                <div className="space-y-2">
                  <img
                    src={`data:${activeLogo.mimeType};base64,${activeLogo.fileData}`}
                    alt="Business logo"
                    className="h-16 w-auto max-w-full object-contain"
                  />
                  <p className="text-xs text-[#8D8A87]">
                    {activeLogo.fileName} &middot; {formatFileSize(activeLogo.sizeBytes)}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[#8D8A87]">No logo uploaded.</p>
              )}
              <div className="flex items-center gap-2">
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" disabled={uploadLogoMutation.isPending || uploadingLogo} className="text-xs" asChild>
                    <span>
                      <Upload className="mr-1 h-3 w-3" />
                      {activeLogo ? "Replace logo" : "Upload logo"}
                    </span>
                  </Button>
                  <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.svg,image/jpeg,image/png,image/svg+xml" onChange={handleLogoInputChange} disabled={uploadLogoMutation.isPending || uploadingLogo} />
                </label>
                {activeLogo ? (
                  <Button variant="ghost" size="sm" onClick={handleDeleteLogo} disabled={deleteLogoMutation.isPending} className="text-red-600 hover:text-red-800">
                    <X className="mr-1 h-3 w-3" />
                    Delete
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Documents Section */}
        <Card className="border-[#E8E0D8]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <FileText className="h-5 w-5 text-[#C73E1D]" />
              Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {DOCUMENT_TYPES.map((dt) => {
                const existing = documents?.find((d) => d.documentType === dt);
                return (
                  <div key={dt} className="flex items-center justify-between rounded-lg border border-[#E8E0D8] bg-white px-4 py-3">
                    <div className="flex items-center gap-3">
                      <FileText className={`h-5 w-5 ${existing ? "text-green-600" : "text-[#8D8A87]"}`} />
                      <div>
                        <p className="text-sm font-medium text-[#2D2A26]">{dt}</p>
                        {existing ? (
                          <p className="text-xs text-green-600">
                            {existing.fileName} <span className="text-[#8D8A87]">&mdash; {new Date(existing.createdAt).toLocaleDateString()}</span>
                          </p>
                        ) : (
                          <p className="text-xs text-[#8D8A87]">Not uploaded yet</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {existing && (
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteDoc(existing.id)} className="text-red-600 hover:text-red-800">
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      <label className="cursor-pointer">
                        <Button variant="outline" size="sm" disabled={uploading} className="text-xs" asChild>
                          <span>
                            <Upload className="mr-1 h-3 w-3" />
                            {existing ? "Replace" : "Upload"}
                          </span>
                        </Button>
                        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => handleFileUpload(e, dt)} disabled={uploading} />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
            {documents && documents.length > 0 && (
              <div className="mt-3 rounded-lg bg-[#F5EDE6] p-3">
                <p className="text-xs font-medium text-[#2D2A26]">{documents.length} document(s) uploaded</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Locations Section */}
        <Card className="border-[#E8E0D8]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 font-serif text-lg">
                <MapPin className="h-5 w-5 text-[#C73E1D]" />
                Branches & Locations
              </CardTitle>
              {canManage && (
                <Dialog open={locDialogOpen} onOpenChange={setLocDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-[#C73E1D]" size="sm">
                      <Plus className="mr-1 h-4 w-4" />
                      Add Branch
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-white">
                    <DialogHeader><DialogTitle className="font-serif text-xl">Add New Branch</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateLocation} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2"><Label>Name *</Label><Input value={locForm.name} onChange={(e) => setLocForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Nyali Branch" required /></div>
                        <div className="space-y-2"><Label>Slug *</Label><Input value={locForm.slug} onChange={(e) => setLocForm((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))} placeholder="nyali" required /></div>
                      </div>
                      <div className="space-y-2"><Label>Address</Label><Input value={locForm.address} onChange={(e) => setLocForm((p) => ({ ...p, address: e.target.value }))} placeholder="Physical address" /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2"><Label>Phone</Label><Input value={locForm.phone} onChange={(e) => setLocForm((p) => ({ ...p, phone: e.target.value }))} placeholder="07xx xxx xxx" /></div>
                        <div className="space-y-2"><Label>Email</Label><Input type="email" value={locForm.email} onChange={(e) => setLocForm((p) => ({ ...p, email: e.target.value }))} /></div>
                      </div>
                      <Button type="submit" className="w-full bg-[#C73E1D]" disabled={createLoc.isPending}>
                        {createLoc.isPending ? "Creating..." : "Add Branch"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {locations?.map((loc) => {
                const isEditingLoc = editLocId === loc.id;
                return (
                  <Card key={loc.id} className="border-[#E8E0D8]">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 font-serif text-base">
                          <Building2 className="h-4 w-4 text-[#C73E1D]" />
                          {loc.name}
                        </CardTitle>
                        {canManage && (
                          <div className="flex gap-1">
                            {isEditingLoc ? (
                              <Button size="sm" variant="ghost" onClick={() => setEditLocId(null)}>
                                <X className="h-3 w-3" />
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => startEditLocation(loc)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Delete branch "${loc.name}"?`)) deleteLoc.mutate({ id: loc.id });
                              }}
                            >
                              <Trash2 className="h-3 w-3 text-[#D32F2F]" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {isEditingLoc ? (
                        <div className="space-y-2">
                          <Input value={editLocForm.name} onChange={(e) => setEditLocForm((p) => ({ ...p, name: e.target.value }))} placeholder="Name" className="text-sm" />
                          <Input value={editLocForm.slug} onChange={(e) => setEditLocForm((p) => ({ ...p, slug: e.target.value }))} placeholder="Slug" className="text-sm" />
                          <Input value={editLocForm.address} onChange={(e) => setEditLocForm((p) => ({ ...p, address: e.target.value }))} placeholder="Address" className="text-sm" />
                          <div className="grid grid-cols-2 gap-2">
                            <Input value={editLocForm.phone} onChange={(e) => setEditLocForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone" className="text-sm" />
                            <Input value={editLocForm.email} onChange={(e) => setEditLocForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email" className="text-sm" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-[#8D8A87]">Default Wallet</Label>
                            <select
                              value={editLocForm.defaultMpesaAccountId}
                              onChange={(e) => setEditLocForm((p) => ({ ...p, defaultMpesaAccountId: e.target.value }))}
                              className="w-full rounded border border-[#E8E0D8] bg-white px-3 py-2 text-sm text-[#2D2A26]"
                            >
                              <option value="">Select wallet</option>
                              {(accounts?.filter((a) => a.type === "wallet") ?? []).map((a) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-[#8D8A87]">Default Cash Account</Label>
                            <select
                              value={editLocForm.defaultCashAccountId}
                              onChange={(e) => setEditLocForm((p) => ({ ...p, defaultCashAccountId: e.target.value }))}
                              className="w-full rounded border border-[#E8E0D8] bg-white px-3 py-2 text-sm text-[#2D2A26]"
                            >
                              <option value="">Select cash account</option>
                              {(accounts?.filter((a) => a.type === "cash") ?? []).map((a) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editLocForm.isActive}
                              onChange={(e) => setEditLocForm((p) => ({ ...p, isActive: e.target.checked }))}
                              className="rounded"
                            />
                            <Label className="mb-0 text-sm">Active</Label>
                          </div>
                          <Button size="sm" className="w-full bg-[#2E7D32]" onClick={() => handleUpdateLocation(loc.id)} disabled={updateLoc.isPending}>
                            <Save className="mr-1 h-3 w-3" />
                            {updateLoc.isPending ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      ) : (
                        <>
                          {loc.address && <p className="text-sm text-[#8D8A87]"><MapPin className="mr-1 inline h-3 w-3" />{loc.address}</p>}
                          {loc.phone && <p className="text-sm text-[#8D8A87]">{loc.phone}</p>}
                          <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wider text-[#8D8A87]">Default Accounts</p>
                            <div className="flex gap-2">
                              {(() => {
                                const mpesaAcct = accounts?.find((a) => a.id === loc.defaultMpesaAccountId);
                                const cashAcct = accounts?.find((a) => a.id === loc.defaultCashAccountId);
                                return (
                                  <>
                                    {mpesaAcct ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-[#C73E1D]/10 px-2 py-1 text-xs text-[#C73E1D]">
                                        <Wallet className="h-3 w-3" />{mpesaAcct.name}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-[#F5EDE6] px-2 py-1 text-xs text-[#8D8A87]">
                                        <Wallet className="h-3 w-3" />No wallet
                                      </span>
                                    )}
                                    {cashAcct ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-[#2E7D32]/10 px-2 py-1 text-xs text-[#2E7D32]">
                                        <Wallet className="h-3 w-3" />{cashAcct.name}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-[#F5EDE6] px-2 py-1 text-xs text-[#8D8A87]">
                                        <Wallet className="h-3 w-3" />No cash account
                                      </span>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wider text-[#8D8A87]">Accounts ({accounts?.filter((a) => a.locationId === loc.id && !a.deletedAt).length ?? 0})</p>
                            <div className="flex flex-wrap gap-1">
                              {accounts
                                ?.filter((a) => a.locationId === loc.id && !a.deletedAt)
                                .map((a) => (
                                  <span
                                    key={a.id}
                                    className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                                      a.type === "wallet"
                                        ? "bg-[#C73E1D]/10 text-[#C73E1D]"
                                        : a.type === "cash"
                                          ? "bg-[#2E7D32]/10 text-[#2E7D32]"
                                          : "bg-[#D4A854]/10 text-[#D4A854]"
                                    }`}
                                  >
                                    {a.name} &middot; {a.currentBalance}
                                  </span>
                                ))}
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {(!locations || locations.length === 0) && (
                <div className="col-span-full rounded-xl border border-[#E8E0D8] bg-white p-12 text-center text-sm text-[#8D8A87]">
                  <Building2 className="mx-auto mb-3 h-12 w-12 opacity-20" />
                  <p>No branches yet. Add your first location.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default BusinessOverview;
