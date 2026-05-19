import { useState } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { formatKES, formatDate, getLocalDateString } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Receipt, Camera, Trash2, ChevronDown, ChevronUp, Filter, X } from "lucide-react";
import { toast } from "sonner";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function DailySales() {
  const [open, setOpen] = useState(false);
  const [expandedSale, setExpandedSale] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Filter states
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const utils = trpc.useUtils();
  const { data: locations } = trpc.locations.list.useQuery();
  
  // Calculate date range based on period filter
  const getDateRange = () => {
    const today = new Date();
    let dateFrom = "";
    let dateTo = "";
    
    switch (filterPeriod) {
      case "today":
        dateFrom = dateTo = getLocalDateString(today);
        break;
      case "week": {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
        dateFrom = getLocalDateString(weekStart);
        dateTo = getLocalDateString(today);
        break;
      }
      case "month": {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        dateFrom = getLocalDateString(monthStart);
        dateTo = getLocalDateString(today);
        break;
      }
      case "year": {
        const yearStart = new Date(today.getFullYear(), 0, 1);
        dateFrom = getLocalDateString(yearStart);
        dateTo = getLocalDateString(today);
        break;
      }
      case "custom":
        dateFrom = customDateFrom;
        dateTo = customDateTo;
        break;
      default:
        // "all" - no date filter
        break;
    }
    
    return { dateFrom, dateTo };
  };
  
  const { dateFrom, dateTo } = getDateRange();
  
  const { data: sales, refetch } = trpc.dailySales.list.useQuery({
    locationId: filterBranch !== "all" ? parseInt(filterBranch) : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  
  const { data: settings } = trpc.settings.list.useQuery();
  const { data: allPaymentMethods } = trpc.paymentMethods.list.useQuery();

  const createSale = trpc.dailySales.create.useMutation({
    onSuccess: async () => {
      setOpen(false);
      resetForm();
      await utils.dailySales.list.invalidate();
      await refetch();
      toast.success("Sales recorded");
    },
    onError: (err) => toast.error(err.message),
  });

  const [selectedLocation, setSelectedLocation] = useState("");
  const [saleDate, setSaleDate] = useState(getLocalDateString());
  const [paymentAmounts, setPaymentAmounts] = useState<Record<number, string>>({});
  const [discountAmount, setDiscountAmount] = useState("");
  const [voidAmount, setVoidAmount] = useState("");
  const [unpaidAmount, setUnpaidAmount] = useState("");
  const [ticketCount, setTicketCount] = useState("");
  const [orderCount, setOrderCount] = useState("");
  const [notes, setNotes] = useState("");
  const [unpaidNotes, setUnpaidNotes] = useState("");
  const [attachments, setAttachments] = useState<{ imageData: string; mimeType: string; caption: string }[]>([]);

  // Get payment methods for selected location
  const { data: locPaymentMethods } = trpc.paymentMethods.byLocation.useQuery(
    { locationId: +selectedLocation },
    { enabled: !!selectedLocation }
  );

  const photosEnabled = settings?.photosDailySales !== "false";

  const resetForm = () => {
    setSelectedLocation("");
    setSaleDate(getLocalDateString());
    setPaymentAmounts({});
    setDiscountAmount("");
    setVoidAmount("");
    setUnpaidAmount("");
    setTicketCount("");
    setOrderCount("");
    setNotes("");
    setUnpaidNotes("");
    setAttachments([]);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: { imageData: string; mimeType: string; caption: string }[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} too large (max 5MB)`); continue; }
      const base64 = await fileToBase64(file);
      newAttachments.push({ imageData: base64, mimeType: file.type, caption: file.name });
    }
    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocation) { toast.error("Please select a location"); return; }

    const payments = Object.entries(paymentAmounts)
      .filter(([, amount]) => amount && parseFloat(amount) > 0)
      .map(([paymentMethodId, amount]) => ({ paymentMethodId: +paymentMethodId, amount }));

    if (payments.length === 0) { toast.error("Enter at least one payment amount"); return; }

    createSale.mutate({
      locationId: +selectedLocation,
      saleDate,
      payments,
      discountAmount: discountAmount || "0.00",
      voidAmount: voidAmount || "0.00",
      unpaidAmount: unpaidAmount || "0.00",
      ticketCount: parseInt(ticketCount) || 0,
      orderCount: parseInt(orderCount) || 0,
      notes,
      unpaidNotes,
      attachments: photosEnabled ? attachments : undefined,
    });
  };

  const grossTotal = Object.values(paymentAmounts).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  const netTotal = grossTotal - (parseFloat(discountAmount) || 0) - (parseFloat(voidAmount) || 0);
  
  // Calculate summary stats for filtered data
  const totalSales = sales?.reduce((sum, s) => sum + parseFloat(s.netSales || "0"), 0) || 0;
  const totalRecords = sales?.length || 0;
  
  const clearFilters = () => {
    setFilterBranch("all");
    setFilterPeriod("all");
    setCustomDateFrom("");
    setCustomDateTo("");
  };
  
  const hasActiveFilters = filterBranch !== "all" || filterPeriod !== "all";

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Daily Sales</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">Record sales with configurable payment methods per branch</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowFilters(!showFilters)}
              className={hasActiveFilters ? "border-[#C73E1D] text-[#C73E1D]" : ""}
            >
              <Filter className="mr-2 h-4 w-4" /> 
              {showFilters ? "Hide Filters" : "Show Filters"}
              {hasActiveFilters && <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#C73E1D] text-xs text-white">!</span>}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#C73E1D] hover:bg-[#C73E1D]/90"><Plus className="mr-2 h-4 w-4" /> Record Sales</Button>
              </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto bg-white">
              <DialogHeader><DialogTitle className="font-serif text-xl text-[#2D2A26]">Record Daily Sales</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Branch</Label>
                    <select value={selectedLocation} onChange={e => { setSelectedLocation(e.target.value); setPaymentAmounts({}); }} className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm" required>
                      <option value="">Select branch</option>
                      {locations?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} required />
                  </div>
                </div>

                {/* Dynamic payment methods */}
                {selectedLocation && locPaymentMethods && locPaymentMethods.length > 0 && (
                  <div className="border-t border-[#E8E0D8] pt-4">
                    <h3 className="mb-3 text-sm font-semibold text-[#2D2A26]">Payment Methods</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {locPaymentMethods.map(pm => (
                        <div key={pm.id} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs">{pm.name}</Label>
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pm.color ?? "#C73E1D" }} />
                            {pm.linkedAccountName && <span className="text-[10px] text-[#8D8A87]">→ {pm.linkedAccountName}</span>}
                          </div>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#8D8A87]">KES</span>
                            <Input type="number" step="0.01" value={paymentAmounts[pm.id] ?? ""} onChange={e => setPaymentAmounts(p => ({ ...p, [pm.id]: e.target.value }))} className="pl-10" placeholder="0.00" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between text-sm">
                      <span className="text-[#8D8A87]">Gross: <strong className="text-[#2D2A26]">{formatKES(grossTotal.toFixed(2))}</strong></span>
                      <span className="text-[#2E7D32] font-medium">Net: {formatKES(Math.max(0, netTotal).toFixed(2))}</span>
                    </div>
                  </div>
                )}
                {selectedLocation && (!locPaymentMethods || locPaymentMethods.length === 0) && (
                  <div className="rounded-lg bg-[#F5EDE6] p-4 text-center text-sm text-[#8D8A87]">
                    No payment methods tagged to this branch. <a href="/accounts?tab=payment-methods" className="text-[#C73E1D] underline">Go to Payment Methods</a> to set them up.
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1"><Label className="text-xs">Discounts</Label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#8D8A87]">KES</span><Input type="number" step="0.01" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} className="pl-10" placeholder="0.00" /></div></div>
                  <div className="space-y-1"><Label className="text-xs">Voids</Label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#8D8A87]">KES</span><Input type="number" step="0.01" value={voidAmount} onChange={e => setVoidAmount(e.target.value)} className="pl-10" placeholder="0.00" /></div></div>
                  <div className="space-y-1"><Label className="text-xs">Unpaid / Credit Sales</Label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#8D8A87]">KES</span><Input type="number" step="0.01" value={unpaidAmount} onChange={e => setUnpaidAmount(e.target.value)} className="pl-10" placeholder="0.00" /></div></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Tickets</Label><Input type="number" value={ticketCount} onChange={e => setTicketCount(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Orders</Label><Input type="number" value={orderCount} onChange={e => setOrderCount(e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label>Notes</Label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes for the day..." className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm min-h-[80px] resize-y" /></div>
                <div className="space-y-2"><Label>Unpaid Notes</Label><textarea value={unpaidNotes} onChange={e => setUnpaidNotes(e.target.value)} placeholder="Who owes what and why..." className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm min-h-[60px] resize-y" /></div>

                {photosEnabled && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Camera className="h-4 w-4" /> Attach Photos</Label>
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((att, idx) => (
                        <div key={idx} className="relative h-16 w-16 rounded-lg border border-[#E8E0D8] overflow-hidden">
                          <img src={att.imageData} alt="" className="h-full w-full object-cover" />
                          <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="absolute top-0 right-0 rounded-bl bg-[#D32F2F] p-0.5 text-white"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      ))}
                      <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-[#8D8A87] text-[#8D8A87] hover:border-[#C73E1D] hover:text-[#C73E1D]">
                        <Plus className="h-5 w-5" />
                        <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={handleFile} />
                      </label>
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full bg-[#C73E1D] hover:bg-[#C73E1D]/90" disabled={createSale.isPending}>
                  {createSale.isPending ? "Saving..." : `Record Sales · ${formatKES(Math.max(0, netTotal).toFixed(2))}`}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <Card className="border-[#E8E0D8] bg-white">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-lg font-semibold text-[#2D2A26]">Filters</h3>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-[#C73E1D] hover:text-[#C73E1D]/90">
                      <X className="mr-1 h-4 w-4" /> Clear All
                    </Button>
                  )}
                </div>
                
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {/* Branch Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[#2D2A26]">Branch</Label>
                    <Select value={filterBranch} onValueChange={setFilterBranch}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All Branches" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Branches</SelectItem>
                        {locations?.map(loc => (
                          <SelectItem key={loc.id} value={loc.id.toString()}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Period Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[#2D2A26]">Period</Label>
                    <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All Time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="week">This Week</SelectItem>
                        <SelectItem value="month">This Month</SelectItem>
                        <SelectItem value="year">This Year</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Custom Date Range - Show when "custom" is selected */}
                  {filterPeriod === "custom" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-[#2D2A26]">From Date</Label>
                        <Input 
                          type="date" 
                          value={customDateFrom} 
                          onChange={e => setCustomDateFrom(e.target.value)}
                          max={customDateTo || undefined}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-[#2D2A26]">To Date</Label>
                        <Input 
                          type="date" 
                          value={customDateTo} 
                          onChange={e => setCustomDateTo(e.target.value)}
                          min={customDateFrom || undefined}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Summary Stats */}
                <div className="flex flex-wrap gap-4 border-t border-[#E8E0D8] pt-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#8D8A87]">Total Records:</span>
                    <span className="font-mono text-sm font-semibold text-[#2D2A26]">{totalRecords}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#8D8A87]">Total Sales:</span>
                    <span className="font-mono text-sm font-semibold text-[#2E7D32]">{formatKES(totalSales.toFixed(2))}</span>
                  </div>
                  {filterBranch !== "all" && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#8D8A87]">Branch:</span>
                      <span className="text-sm font-medium text-[#2D2A26]">
                        {locations?.find(l => l.id.toString() === filterBranch)?.name || "Unknown"}
                      </span>
                    </div>
                  )}
                  {filterPeriod !== "all" && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#8D8A87]">Period:</span>
                      <span className="text-sm font-medium text-[#2D2A26]">
                        {filterPeriod === "today" && "Today"}
                        {filterPeriod === "week" && "This Week"}
                        {filterPeriod === "month" && "This Month"}
                        {filterPeriod === "year" && "This Year"}
                        {filterPeriod === "custom" && customDateFrom && customDateTo && 
                          `${formatDate(customDateFrom)} - ${formatDate(customDateTo)}`}
                        {filterPeriod === "custom" && (!customDateFrom || !customDateTo) && 
                          "Select date range"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Card View */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {sales?.map((sale) => {
            const isExpanded = expandedSale === sale.id;
            const locationName = locations?.find(l => l.id === sale.locationId)?.name ?? "Unknown";
            const hasUnpaid = parseFloat(sale.unpaidAmount || "0") > 0;
            return (
              <Card key={sale.id} className="border-[#E8E0D8] bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="font-serif text-base text-[#2D2A26]">{formatDate(sale.saleDate)}</CardTitle>
                      <p className="text-xs text-[#8D8A87]">{locationName}</p>
                    </div>
                    <span className="font-mono text-sm font-semibold text-[#2E7D32]">{formatKES(sale.netSales)}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {/* Payment breakdown from child records */}
                  {sale.payments && sale.payments.length > 0 ? (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      {sale.payments.map((p: any) => {
                        const pm = allPaymentMethods?.find(m => m.id === p.paymentMethodId);
                        return (
                          <div key={p.id} className="flex justify-between">
                            <span className="text-[#8D8A87]">{pm?.name ?? "Unknown"}</span>
                            <span className="font-mono">{formatKES(p.amount)}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-[#8D8A87]">Legacy entry — no payment breakdown</p>
                  )}
                  {hasUnpaid && <div className="rounded-md bg-[#D4A854]/10 px-2 py-1 text-xs text-[#D4A854]">Unpaid: {formatKES(sale.unpaidAmount)}</div>}
                  {sale.notes && <p className="text-xs text-[#8D8A87] line-clamp-2">{sale.notes}</p>}
                  <button onClick={() => setExpandedSale(isExpanded ? null : sale.id)} className="flex w-full items-center justify-center gap-1 text-xs text-[#8D8A87] hover:text-[#C73E1D]">
                    {isExpanded ? <>Less <ChevronUp className="h-3 w-3" /></> : <>More <ChevronDown className="h-3 w-3" /></>}
                  </button>
                  {isExpanded && (
                    <div className="space-y-2 border-t border-[#E8E0D8] pt-2">
                      {sale.notes && <div><p className="text-xs font-medium text-[#2D2A26]">Notes</p><p className="text-sm text-[#8D8A87] whitespace-pre-wrap">{sale.notes}</p></div>}
                      {hasUnpaid && <div><p className="text-xs font-medium text-[#D4A854]">Unpaid Details</p><p className="text-sm text-[#8D8A87]">{sale.unpaidNotes || "No details"}</p></div>}
                      <SaleAttachments recordId={sale.id} onPreview={setPreviewImage} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {(!sales || sales.length === 0) && (
          <Card className="border-[#E8E0D8] bg-white">
            <CardContent className="py-12 text-center"><Receipt className="mx-auto mb-2 h-8 w-8 text-[#8D8A87]/30" /><p className="text-sm text-[#8D8A87]">No sales yet. Click "Record Sales" to add your first entry.</p></CardContent>
          </Card>
        )}
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Preview" className="max-h-[90vh] max-w-full rounded-lg" />
        </div>
      )}
    </Layout>
  );
}

function SaleAttachments({ recordId, onPreview }: { recordId: number; onPreview: (url: string) => void }) {
  const { data: attachments } = trpc.dailySales.getAttachments.useQuery({ recordId });
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-[#2D2A26]">Photos</p>
      <div className="flex flex-wrap gap-2">
        {attachments.map(att => (
          <img key={att.id} src={att.imageData} alt={att.caption ?? ""} className="h-16 w-16 cursor-pointer rounded-lg border border-[#E8E0D8] object-cover" onClick={() => onPreview(att.imageData)} />
        ))}
      </div>
    </div>
  );
}
