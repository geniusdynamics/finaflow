// ABOUTME: Renders editable business details plus profile summary and document metadata actions.
// ABOUTME: Handles secure document upload/delete/download interactions through businesses tRPC procedures.
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { BusinessLetterhead } from "@/features/business-profile/BusinessLetterhead";
import { buildPrintGeneratedLabel, formatFileSize } from "@/features/business-profile/formatters";
import { isAllowedLogoType, optimizeLogoFile, validateLogoFileSizeBytes } from "@/features/business-profile/logo-utils";
import { toast } from "sonner";
import { Building, Check, ChevronLeft, ChevronRight, FileText, Globe, Landmark, Loader2, Save, Shield, Store, Upload, X } from "lucide-react";

const BUSINESS_TYPES = [
  "Sole Proprietorship", "Partnership", "Limited Liability Company (LLC)",
  "Private Limited Company", "Public Limited Company", "Non-Governmental Organization (NGO)",
  "Cooperative Society", "Social Enterprise", "Faith-Based Organization",
  "Government Agency", "Parastatal / State Corporation",
];

const COUNTIES = [
  "Mombasa", "Kwale", "Kilifi", "Tana River", "Lamu", "Taita Taveta",
  "Garissa", "Wajir", "Mandera", "Marsabit", "Isiolo", "Meru",
  "Tharaka Nithi", "Embu", "Kitui", "Machakos", "Makueni", "Nyandarua",
  "Nyeri", "Kirinyaga", "Muranga", "Kiambu", "Turkana", "West Pokot",
  "Samburu", "Trans Nzoia", "Uasin Gishu", "Elgeyo Marakwet", "Nandi",
  "Baringo", "Laikipia", "Nakuru", "Narok", "Kajiado", "Kericho",
  "Bomet", "Kakamega", "Vihiga", "Bungoma", "Busia", "Siaya",
  "Kisumu", "Homa Bay", "Migori", "Kisii", "Nyamira", "Nairobi City",
];

const SUB_COUNTIES_BY_COUNTY: Record<string, string[]> = {
  "Nairobi City": ["Westlands", "Dagoretti North", "Dagoretti South", "Langata", "Kibra", "Roysambu", "Kasarani", "Ruaraka", "Embakasi South", "Embakasi North", "Embakasi Central", "Embakasi East", "Embakasi West", "Makadara", "Kamukunji", "Starehe", "Mathare", "Njiru"],
  "Mombasa": ["Changamwe", "Jomvu", "Kisauni", "Nyali", "Likoni", "Mvita"],
  "Kisumu": ["Kisumu Central", "Kisumu East", "Kisumu West", "Seme", "Nyando", "Muhoroni", "Nyakach"],
  "Kiambu": ["Kiambu Town", "Thika Town", "Ruiru", "Limuru", "Kikuyu", "Githunguri", "Lari", "Gatundu North", "Gatundu South", "Juja", "Kiambaa", "Kabete"],
  "Nakuru": ["Nakuru Town West", "Nakuru Town East", "Naivasha", "Gilgil", "Molo", "Njoro", "Subukia", "Rongai", "Kuresoi North", "Kuresoi South", "Bahati"],
  "Machakos": ["Machakos Town", "Mavoko", "Masinga", "Yatta", "Matungulu", "Kangundo", "Mwala", "Kathiani"],
  "Uasin Gishu": ["Eldoret Town", "Kapseret", "Kesses", "Turbo", "Soy", "Ainabkoi", "Moiben"],
  "Kajiado": ["Kajiado Central", "Kajiado North", "Kajiado East", "Kajiado West", "Loitokitok", "Mashuuru", "Isinya"],
};

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

type Step = "business-info" | "address" | "account" | "documents" | "confirmation";

const steps: { id: Step; label: string; icon: typeof Building }[] = [
  { id: "business-info", label: "Business Info", icon: Store },
  { id: "address", label: "Address", icon: Globe },
  { id: "account", label: "Account", icon: Shield },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "confirmation", label: "Confirm", icon: Check },
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

export function BusinessDetails() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const businessId = id ? Number(id) : null;
  const [step, setStep] = useState<Step>("business-info");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const utils = trpc.useUtils();
  const { data: business, isLoading } = trpc.businesses.get.useQuery(
    { id: businessId! },
    { enabled: !!businessId }
  );
  const { data: documents, refetch: refetchDocs } = trpc.businesses.getDocuments.useQuery(
    { businessId: businessId! },
    { enabled: !!businessId }
  );
  const { data: documentsDetailed, isLoading: docsLoading } = trpc.businesses.getDocumentsDetailed.useQuery(
    { businessId: businessId! },
    { enabled: !!businessId }
  );
  const { data: activeLogo, refetch: refetchLogo, isLoading: logoLoading } = trpc.businesses.getActiveLogo.useQuery(
    { businessId: businessId! },
    { enabled: !!businessId }
  );
  const updateMutation = trpc.businesses.update.useMutation();
  const uploadDocMutation = trpc.businesses.uploadDocument.useMutation();
  const deleteDocMutation = trpc.businesses.deleteDocument.useMutation();
  const downloadDocumentMutation = trpc.businesses.downloadDocument.useMutation();
  const uploadLogoMutation = trpc.businesses.uploadLogo.useMutation();
  const deleteLogoMutation = trpc.businesses.deleteLogo.useMutation();

  const [form, setForm] = useState({
    name: "",
    businessType: "",
    country: "Kenya",
    county: "",
    subCounty: "",
    address: "",
    businessRegNumber: "",
    phone: "",
    natureOfBusiness: "",
    kraPin: "",
    email: "",
  });

  useEffect(() => {
    if (business) {
      setForm({
        name: business.name || "",
        businessType: business.businessType || "",
        country: business.country || "Kenya",
        county: business.county || "",
        subCounty: business.subCounty || "",
        address: business.address || "",
        businessRegNumber: business.businessRegNumber || "",
        phone: business.phone || "",
        natureOfBusiness: business.natureOfBusiness || "",
        kraPin: business.kraPin || "",
        email: business.email || "",
      });
    }
  }, [business]);

  const stepIndex = steps.findIndex(s => s.id === step);
  const isLastStep = stepIndex === steps.length - 1;
  const isFirstStep = stepIndex === 0;

  const canProceed = useCallback(() => {
    if (step === "business-info") {
      return form.name.length >= 1;
    }
    return true;
  }, [step, form.name]);

  const handleSave = async () => {
    if (!businessId) return;
    setSaving(true);
    try {
      await updateMutation.mutateAsync({ id: businessId, ...form });
      utils.businesses.get.invalidate({ id: businessId });
      toast.success("Business details saved successfully");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file || !businessId) return;
    setUploading(true);
    try {
      const fileData = await fileToBase64(file);
      await uploadDocMutation.mutateAsync({
        businessId,
        documentType: docType,
        fileName: file.name,
        fileData,
        mimeType: file.type,
      });
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

  const triggerBase64Download = (fileName: string, mimeType: string, fileData: string) => {
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

  const handleDownloadDocument = async (documentId: number) => {
    try {
      const payload = await downloadDocumentMutation.mutateAsync({ documentId });
      triggerBase64Download(payload.fileName, payload.mimeType, payload.fileData);
      toast.success("Document download started");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to download document"));
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (!businessId) {
      return;
    }
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
    if (!file) {
      return;
    }

    try {
      await handleLogoUpload(file);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Logo upload failed"));
    } finally {
      e.target.value = "";
    }
  };

  const handleDeleteLogo = async () => {
    if (!businessId) {
      return;
    }

    try {
      await deleteLogoMutation.mutateAsync({ businessId });
      await refetchLogo();
      toast.success("Logo deleted");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to delete logo"));
    }
  };

  const handleNext = async () => {
    if (step === "confirmation") {
      await handleSave();
      navigate("/businesses");
      return;
    }
    if (step === "business-info" || step === "address") {
      await handleSave();
    }
    const nextIdx = Math.min(stepIndex + 1, steps.length - 1);
    setStep(steps[nextIdx].id);
  };

  const handleBack = () => {
    if (isFirstStep) { navigate("/businesses"); return; }
    setStep(steps[stepIndex - 1].id);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5EDE6]">
        <Loader2 className="h-8 w-8 animate-spin text-[#C73E1D]" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F5EDE6]">
        <Building className="h-12 w-12 text-[#8D8A87]" />
        <p className="font-serif text-xl text-[#2D2A26]">Business not found</p>
        <Button onClick={() => navigate("/businesses")} className="bg-[#C73E1D]">Back to Businesses</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5EDE6]">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-6 flex items-center gap-3">
          <Building className="h-6 w-6 text-[#C73E1D]" />
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Business Details</h1>
            <p className="text-sm text-[#8D8A87]">{business.name} — {business.accountId}</p>
          </div>
        </div>
        <div className="mb-4 flex items-center justify-end gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            Print Profile
          </Button>
        </div>
        <div className="hidden print:block">
          <BusinessLetterhead
            business={{
              name: form.name || business.name || "—",
              accountId: business.accountId || "N/A",
              phone: form.phone || business.phone,
              email: form.email || business.email,
              address: form.address || business.address,
              county: form.county || business.county,
              subCounty: form.subCounty || business.subCounty,
            }}
            logo={activeLogo ?? null}
            generatedAt={new Date()}
          />
        </div>
        <p className="hidden text-xs text-[#8D8A87] print:block">
          {buildPrintGeneratedLabel(business.accountId || "N/A", new Date())}
        </p>

        {/* Step indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((s, i) => (
              <div key={s.id} className="flex flex-col items-center">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                  i <= stepIndex ? "border-[#C73E1D] bg-[#C73E1D] text-white" : "border-[#E8E0D8] bg-white text-[#8D8A87]"
                }`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <span className={`mt-1 text-xs font-medium ${
                  i <= stepIndex ? "text-[#C73E1D]" : "text-[#8D8A87]"
                }`}>{s.label}</span>
              </div>
            ))}
          </div>
          <div className="relative mt-2">
            <div className="absolute left-0 top-1/2 h-0.5 w-full bg-[#E8E0D8]" />
            <div className="absolute left-0 top-1/2 h-0.5 bg-[#C73E1D] transition-all" style={{ width: `${(stepIndex / (steps.length - 1)) * 100}%` }} />
          </div>
        </div>

        <Card className="border-[#E8E0D8]">
          <CardContent className="p-6">
            {/* Step 1: Business Information */}
            {step === "business-info" && (
              <div className="space-y-5">
                <div><h2 className="font-serif text-lg font-semibold text-[#2D2A26]">Business Information</h2><p className="text-xs text-[#8D8A87]">Details about your business registration and operations</p></div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label className="text-xs text-[#8D8A87]">Business Name *</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Karafuu Business" required />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-[#8D8A87]">Choose Your Business Type</Label>
                  <select value={form.businessType} onChange={e => setForm(p => ({ ...p, businessType: e.target.value }))} className="w-full rounded border border-[#E8E0D8] bg-white px-3 py-2 text-sm text-[#2D2A26]">
                    <option value="">Select business type...</option>
                    {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-xs text-[#8D8A87]">Business Registration Number</Label>
                    <Input value={form.businessRegNumber} onChange={e => setForm(p => ({ ...p, businessRegNumber: e.target.value }))} placeholder="e.g. BRN-2024-12345" />
                  </div>
                  <div>
                    <Label className="text-xs text-[#8D8A87]">KRA PIN Number</Label>
                    <Input value={form.kraPin} onChange={e => setForm(p => ({ ...p, kraPin: e.target.value.toUpperCase() }))} placeholder="e.g. P051234567Z" className="font-mono uppercase" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-[#8D8A87]">Nature of Business</Label>
                  <Input value={form.natureOfBusiness} onChange={e => setForm(p => ({ ...p, natureOfBusiness: e.target.value }))} placeholder="e.g. restaurant, retail and SME businesses" />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-xs text-[#8D8A87]">Business Mobile Number</Label>
                    <Input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+254 7XX XXX XXX" />
                  </div>
                  <div>
                    <Label className="text-xs text-[#8D8A87]">Business Email Address</Label>
                    <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="info@business.com" />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Address */}
            {step === "address" && (
              <div className="space-y-5">
                <div><h2 className="font-serif text-lg font-semibold text-[#2D2A26]">Address Information</h2><p className="text-xs text-[#8D8A87]">Business physical location details</p></div>
                <div>
                  <Label className="text-xs text-[#8D8A87]">Country</Label>
                  <Input value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} placeholder="Kenya" />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-xs text-[#8D8A87]">County *</Label>
                    <select value={form.county} onChange={e => setForm(p => ({ ...p, county: e.target.value, subCounty: "" }))} className="w-full rounded border border-[#E8E0D8] bg-white px-3 py-2 text-sm text-[#2D2A26]">
                      <option value="">Select county...</option>
                      {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-[#8D8A87]">Sub County *</Label>
                    <select value={form.subCounty} onChange={e => setForm(p => ({ ...p, subCounty: e.target.value }))} className="w-full rounded border border-[#E8E0D8] bg-white px-3 py-2 text-sm text-[#2D2A26]" disabled={!form.county}>
                      <option value="">Select sub county...</option>
                      {(SUB_COUNTIES_BY_COUNTY[form.county] || []).map(sc => <option key={sc} value={sc}>{sc}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-[#8D8A87]">Physical Address</Label>
                  <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="e.g. Kenyatta Avenue, 2nd Floor, Suite 7" />
                </div>
              </div>
            )}

            {/* Step 3: Account Information */}
            {step === "account" && (
              <div className="space-y-5">
                <div><h2 className="font-serif text-lg font-semibold text-[#2D2A26]">Account Information</h2><p className="text-xs text-[#8D8A87]">Your Finaflow account details</p></div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-xs text-[#8D8A87]">Account ID</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8D8A87]" />
                      <Input value={business.accountId || ""} disabled className="font-mono uppercase pl-9 bg-[#F5EDE6]" />
                    </div>
                    <p className="mt-1 text-xs text-[#8D8A87]">Used for login: <span className="text-[#C73E1D]"><strong>{business.accountId?.toLowerCase()}.finaflow.app</strong></span></p>
                  </div>
                  <div>
                    <Label className="text-xs text-[#8D8A87]">Current Plan</Label>
                    <div className="flex h-10 items-center gap-2 rounded border border-[#E8E0D8] bg-[#F5EDE6] px-3 text-sm text-[#2D2A26]">
                      <Landmark className="h-4 w-4 text-[#C73E1D]" />
                      <span className="font-medium capitalize">{business.plan || "free"}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-xs text-[#8D8A87]">Status</Label>
                    <div className="flex h-10 items-center gap-2 rounded border border-[#E8E0D8] bg-[#F5EDE6] px-3 text-sm">
                      <div className={`h-2 w-2 rounded-full ${business.isActive ? "bg-green-600" : "bg-red-600"}`} />
                      <span className="text-[#2D2A26]">{business.isActive ? "Active" : "Inactive"}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Documents */}
            {step === "documents" && (
              <div className="space-y-5">
                <div><h2 className="font-serif text-lg font-semibold text-[#2D2A26]">Documents</h2><p className="text-xs text-[#8D8A87]">Upload business registration, permits, and licenses</p></div>
                <div className="space-y-3">
                  {DOCUMENT_TYPES.map(dt => {
                    const existing = documents?.find(d => d.documentType === dt);
                    return (
                      <div key={dt} className="flex items-center justify-between rounded-lg border border-[#E8E0D8] bg-white px-4 py-3">
                        <div className="flex items-center gap-3">
                          <FileText className={`h-5 w-5 ${existing ? "text-green-600" : "text-[#8D8A87]"}`} />
                          <div>
                            <p className="text-sm font-medium text-[#2D2A26]">{dt}</p>
                            {existing ? (
                              <p className="text-xs text-green-600">{existing.fileName} <span className="text-[#8D8A87]">— {new Date(existing.createdAt).toLocaleDateString()}</span></p>
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
                            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => handleFileUpload(e, dt)} disabled={uploading} />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {documents && documents.length > 0 && (
                  <div className="rounded-lg bg-[#F5EDE6] p-3">
                    <p className="text-xs font-medium text-[#2D2A26]">{documents.length} document(s) uploaded</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {documents.map(d => (
                        <span key={d.id} className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-xs text-[#8D8A87]">
                          <FileText className="h-3 w-3" />{d.documentType}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Confirmation */}
            {step === "confirmation" && (
              <div className="space-y-5">
                <div><h2 className="font-serif text-lg font-semibold text-[#2D2A26]">Confirmation</h2><p className="text-xs text-[#8D8A87]">Review all information before saving</p></div>
                <div className="space-y-4">
                  <div className="rounded-lg border border-[#E8E0D8] bg-white p-4">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#C73E1D]"><Store className="h-4 w-4" />Business Information</h3>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <div><dt className="text-xs text-[#8D8A87]">Name</dt><dd className="font-medium text-[#2D2A26]">{form.name || "—"}</dd></div>
                      <div><dt className="text-xs text-[#8D8A87]">Type</dt><dd className="font-medium text-[#2D2A26]">{form.businessType || "—"}</dd></div>
                      <div><dt className="text-xs text-[#8D8A87]">Reg Number</dt><dd className="font-medium text-[#2D2A26]">{form.businessRegNumber || "—"}</dd></div>
                      <div><dt className="text-xs text-[#8D8A87]">KRA PIN</dt><dd className="font-mono text-xs font-medium text-[#2D2A26]">{form.kraPin || "—"}</dd></div>
                      <div><dt className="text-xs text-[#8D8A87]">Nature</dt><dd className="font-medium text-[#2D2A26]">{form.natureOfBusiness || "—"}</dd></div>
                      <div><dt className="text-xs text-[#8D8A87]">Phone</dt><dd className="font-medium text-[#2D2A26]">{form.phone || "—"}</dd></div>
                      <div className="md:col-span-2"><dt className="text-xs text-[#8D8A87]">Email</dt><dd className="font-medium text-[#2D2A26]">{form.email || "—"}</dd></div>
                    </dl>
                  </div>
                  <div className="rounded-lg border border-[#E8E0D8] bg-white p-4">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#C73E1D]"><Globe className="h-4 w-4" />Address</h3>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <div><dt className="text-xs text-[#8D8A87]">Country</dt><dd className="font-medium text-[#2D2A26]">{form.country || "—"}</dd></div>
                      <div><dt className="text-xs text-[#8D8A87]">County</dt><dd className="font-medium text-[#2D2A26]">{form.county || "—"}</dd></div>
                      <div><dt className="text-xs text-[#8D8A87]">Sub County</dt><dd className="font-medium text-[#2D2A26]">{form.subCounty || "—"}</dd></div>
                      <div><dt className="text-xs text-[#8D8A87]">Address</dt><dd className="font-medium text-[#2D2A26]">{form.address || "—"}</dd></div>
                    </dl>
                  </div>
                  <div className="rounded-lg border border-[#E8E0D8] bg-white p-4">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#C73E1D]"><FileText className="h-4 w-4" />Documents</h3>
                    {documents && documents.length > 0 ? (
                      <ul className="space-y-1">
                        {documents.map(d => (
                          <li key={d.id} className="flex items-center gap-2 text-sm text-[#2D2A26]">
                            <FileText className="h-3 w-3 text-green-600" />{d.documentType}
                            <span className="text-xs text-[#8D8A87]">— {d.fileName}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-[#8D8A87]">No documents uploaded yet</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="mt-8 flex items-center justify-between border-t border-[#E8E0D8] pt-4">
              <Button variant="outline" onClick={handleBack} className="border-[#E8E0D8] text-[#2D2A26]">
                {isFirstStep ? <><ChevronLeft className="mr-1 h-4 w-4" /> Back</> : <><ChevronLeft className="mr-1 h-4 w-4" /> {steps[stepIndex - 1]?.label}</>}
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setStep("business-info")} className="text-xs text-[#8D8A87]">Start over</Button>
                <Button onClick={handleNext} disabled={(!canProceed() || saving) && step !== "confirmation" && step !== "account" && step !== "documents"} className="bg-[#C73E1D]">
                  {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : isLastStep ? <Save className="mr-1 h-4 w-4" /> : <ChevronRight className="mr-1 h-4 w-4" />}
                  {saving ? "Saving..." : isLastStep ? "Save & Finish" : `Next: ${steps[stepIndex + 1]?.label}`}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 space-y-4">
          <section className="rounded-lg border border-[#E8E0D8] bg-white p-4 print:hidden">
            <h2 className="font-serif text-lg font-semibold text-[#2D2A26]">Logo Management</h2>
            {logoLoading ? (
              <p className="mt-2 text-xs text-[#8D8A87]">Loading logo…</p>
            ) : activeLogo ? (
              <div className="mt-3 space-y-3">
                <img
                  src={`data:${activeLogo.mimeType};base64,${activeLogo.fileData}`}
                  alt="Business logo preview"
                  className="h-20 w-auto max-w-full object-contain"
                />
                <p className="text-xs text-[#8D8A87]">
                  {activeLogo.fileName} · {formatFileSize(activeLogo.sizeBytes)}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-[#8D8A87]">No logo uploaded.</p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <label className="cursor-pointer">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploadLogoMutation.isPending}
                  className="text-xs"
                  asChild
                >
                  <span>
                    <Upload className="mr-1 h-3 w-3" />
                    {activeLogo ? "Replace logo" : "Upload logo"}
                  </span>
                </Button>
                <input
                  type="file"
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.svg,image/jpeg,image/png,image/svg+xml"
                  onChange={handleLogoInputChange}
                  disabled={uploadLogoMutation.isPending}
                  aria-label="Upload business logo"
                />
              </label>
              {activeLogo ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteLogo}
                  disabled={deleteLogoMutation.isPending}
                  className="text-red-600 hover:text-red-800"
                >
                  <X className="mr-1 h-4 w-4" />
                  Delete logo
                </Button>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-[#8D8A87]">
              Accepted formats: JPEG, PNG, SVG. Maximum size: 5 MB.
            </p>
          </section>

          <section className="rounded-lg border border-[#E8E0D8] bg-white p-4">
            <h2 className="font-serif text-lg font-semibold text-[#2D2A26]">Profile Summary</h2>
            <dl className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <dt className="text-xs text-[#8D8A87]">Business Name</dt>
                <dd className="text-sm text-[#2D2A26]">{form.name || business.name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#8D8A87]">Registration Number</dt>
                <dd className="text-sm text-[#2D2A26]">{form.businessRegNumber || business.businessRegNumber || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#8D8A87]">Business Type</dt>
                <dd className="text-sm text-[#2D2A26]">{form.businessType || business.businessType || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#8D8A87]">Operational Status</dt>
                <dd className="text-sm text-[#2D2A26]">{business.isActive ? "Active" : "Inactive"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-[#E8E0D8] bg-white p-4">
            <h2 className="font-serif text-lg font-semibold text-[#2D2A26]">Business Documents</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-[#E8E0D8] text-left text-xs uppercase tracking-wide text-[#8D8A87]">
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Uploaded</th>
                    <th className="px-2 py-2">Size</th>
                    <th className="px-2 py-2 print:hidden">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {docsLoading ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-4 text-[#8D8A87]">Loading documents…</td>
                    </tr>
                  ) : (documentsDetailed?.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-4 text-[#8D8A87]">No documents available.</td>
                    </tr>
                  ) : (
                    documentsDetailed!.map((doc) => (
                      <tr key={doc.id} className="border-b border-[#F2EAE2] align-middle text-[#2D2A26]">
                        <td className="px-2 py-2">{doc.fileName}</td>
                        <td className="px-2 py-2">{doc.documentType}</td>
                        <td className="px-2 py-2">{new Date(doc.createdAt).toLocaleDateString("en-KE")}</td>
                        <td className="px-2 py-2">{formatFileSize(doc.fileSizeBytes)}</td>
                        <td className="px-2 py-2 print:hidden">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadDocument(doc.id)}
                            disabled={downloadDocumentMutation.isPending}
                          >
                            Download
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <style>{`
          @media print {
            .print\\:hidden { display: none !important; }
            .print\\:block { display: block !important; }
            body { background: #fff !important; }
            table, tr, td, th { page-break-inside: avoid; }
            section { break-inside: avoid; }
          }
        `}</style>
      </div>
    </div>
  );
}

export default BusinessDetails;
