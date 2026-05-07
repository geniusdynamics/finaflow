import { useState } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { getLocalDateString, formatKES } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FileText, TrendingDown, Smartphone, Receipt, Landmark } from "lucide-react";

export function DailyPayments() {
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const { data: payments } = trpc.dashboard.dailyPayments.useQuery({ date: selectedDate });

  const billsTotal = payments?.billPayments?.reduce((s, b) => s + parseFloat(b.balanceDue), 0) ?? 0;
  const expensesTotal = payments?.expenses?.reduce((s, e) => s + parseFloat(e.amount), 0) ?? 0;
  const mpesaOut = payments?.mpesa?.filter(t => parseFloat(t.amount) < 0).reduce((s, t) => s + Math.abs(parseFloat(t.amount)), 0) ?? 0;
  const payrollTotal = payments?.payroll?.reduce((s, p) => s + parseFloat(p.totalNetPay || "0"), 0) ?? 0;
  const grandTotal = billsTotal + expensesTotal + mpesaOut + payrollTotal;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Daily Payments</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">All payments on a given day: bills, salaries, expenses</p>
          </div>
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-auto" />
        </div>

        <div className="grid gap-4 sm:grid-cols-5">
          <Card className="border-[#E8E0D8]"><CardContent className="p-4"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-[#ED6C02]"/><span className="text-xs uppercase text-[#8D8A87]">Bills Due</span></div><p className="mt-2 font-mono text-xl font-semibold text-[#ED6C02]">{formatKES(billsTotal)}</p><p className="text-xs text-[#8D8A87]">{payments?.billPayments?.length ?? 0} bills</p></CardContent></Card>
          <Card className="border-[#E8E0D8]"><CardContent className="p-4"><div className="flex items-center gap-2"><TrendingDown className="h-4 w-4 text-[#D32F2F]"/><span className="text-xs uppercase text-[#8D8A87]">Expenses</span></div><p className="mt-2 font-mono text-xl font-semibold text-[#D32F2F]">{formatKES(expensesTotal)}</p><p className="text-xs text-[#8D8A87]">{payments?.expenses?.length ?? 0} entries</p></CardContent></Card>
          <Card className="border-[#E8E0D8]"><CardContent className="p-4"><div className="flex items-center gap-2"><Landmark className="h-4 w-4 text-[#D4A854]"/><span className="text-xs uppercase text-[#8D8A87]">Payroll</span></div><p className="mt-2 font-mono text-xl font-semibold text-[#D4A854]">{formatKES(payrollTotal)}</p><p className="text-xs text-[#8D8A87]">{payments?.payroll?.length ?? 0} periods</p></CardContent></Card>
          <Card className="border-[#E8E0D8]"><CardContent className="p-4"><div className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-[#C73E1D]"/><span className="text-xs uppercase text-[#8D8A87]">M-PESA Out</span></div><p className="mt-2 font-mono text-xl font-semibold text-[#C73E1D]">{formatKES(mpesaOut)}</p><p className="text-xs text-[#8D8A87]">{payments?.mpesa?.filter(t => parseFloat(t.amount) < 0).length ?? 0} txns</p></CardContent></Card>
          <Card className="border-[#E8E0D8] bg-[#C73E1D]/5"><CardContent className="p-4"><div className="flex items-center gap-2"><Receipt className="h-4 w-4 text-[#C73E1D]"/><span className="text-xs uppercase text-[#8D8A87]">Grand Total</span></div><p className="mt-2 font-mono text-xl font-semibold text-[#C73E1D]">{formatKES(grandTotal)}</p><p className="text-xs text-[#8D8A87]">All outflows</p></CardContent></Card>
        </div>

        {payments?.billPayments && payments.billPayments.length > 0 && (
          <Card className="border-[#E8E0D8]"><CardHeader className="pb-3"><CardTitle className="font-serif text-lg flex items-center gap-2"><FileText className="h-5 w-5 text-[#ED6C02]"/>Bills Due</CardTitle></CardHeader>
            <CardContent><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b"><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Ref</th><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Description</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Total</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Paid</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Balance</th><th className="pb-2 text-center text-xs uppercase text-[#8D8A87]">Status</th></tr></thead>
              <tbody className="divide-y">{payments.billPayments.map(b => <tr key={b.id} className="hover:bg-[#F5EDE6]/50"><td className="py-2 text-xs font-mono text-[#8D8A87]">{b.billNumber || `BILL-${String(b.id).padStart(4,"0")}`}</td><td className="py-2 text-sm font-medium">{b.description}</td><td className="py-2 text-right font-mono text-sm">{formatKES(b.amount)}</td><td className="py-2 text-right font-mono text-sm text-[#2E7D32]">{formatKES(b.amountPaid)}</td><td className="py-2 text-right font-mono text-sm font-semibold text-[#D32F2F]">{formatKES(b.balanceDue)}</td><td className="py-2 text-center"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${b.status === "overdue" ? "bg-[#D32F2F]/10 text-[#D32F2F]" : b.status === "partial" ? "bg-[#D4A854]/10 text-[#D4A854]" : b.status === "paid" ? "bg-[#2E7D32]/10 text-[#2E7D32]" : "bg-[#ED6C02]/10 text-[#ED6C02]"}`}>{b.status}</span></td></tr>)}</tbody>
            </table></div></CardContent>
          </Card>
        )}

        {payments?.expenses && payments.expenses.length > 0 && (
          <Card className="border-[#E8E0D8]"><CardHeader className="pb-3"><CardTitle className="font-serif text-lg flex items-center gap-2"><TrendingDown className="h-5 w-5 text-[#D32F2F]"/>Expenses Today</CardTitle></CardHeader>
            <CardContent><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b"><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Description</th><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Method</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Amount</th></tr></thead>
              <tbody className="divide-y">{payments.expenses.map(e => <tr key={e.id} className="hover:bg-[#F5EDE6]/50"><td className="py-2 text-sm">{e.description}</td><td className="py-2 text-sm capitalize text-[#8D8A87]">{e.paymentMethod}</td><td className="py-2 text-right font-mono text-sm font-semibold text-[#D32F2F]">{formatKES(e.amount)}</td></tr>)}</tbody>
            </table></div></CardContent>
          </Card>
        )}

        {payments?.mpesa && payments.mpesa.filter(t => parseFloat(t.amount) < 0).length > 0 && (
          <Card className="border-[#E8E0D8]"><CardHeader className="pb-3"><CardTitle className="font-serif text-lg flex items-center gap-2"><Smartphone className="h-5 w-5 text-[#C73E1D]"/>M-PESA Outflows Today</CardTitle></CardHeader>
            <CardContent><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b"><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">ID</th><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Type</th><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Party</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Amount</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Fee</th></tr></thead>
              <tbody className="divide-y">{payments.mpesa.filter(t => parseFloat(t.amount) < 0).map(t => <tr key={t.id} className="hover:bg-[#F5EDE6]/50"><td className="py-2 font-mono text-xs text-[#8D8A87]">{t.txnId}</td><td className="py-2 text-sm capitalize">{t.txnType}</td><td className="py-2 text-sm">{t.partyName ?? t.description}</td><td className="py-2 text-right font-mono text-sm font-semibold text-[#D32F2F]">{formatKES(Math.abs(parseFloat(t.amount)))}</td><td className="py-2 text-right font-mono text-xs text-[#8D8A87]">{formatKES(t.txnFee)}</td></tr>)}</tbody>
            </table></div></CardContent>
          </Card>
        )}

        {payments?.payroll && payments.payroll.length > 0 && (
          <Card className="border-[#E8E0D8]"><CardHeader className="pb-3"><CardTitle className="font-serif text-lg flex items-center gap-2"><Landmark className="h-5 w-5 text-[#D4A854]"/>Payroll Today</CardTitle></CardHeader>
            <CardContent><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b"><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Period</th><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Status</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Net Pay</th></tr></thead>
              <tbody className="divide-y">{payments.payroll.map(p => <tr key={p.id} className="hover:bg-[#F5EDE6]/50"><td className="py-2 text-sm font-medium">{p.periodName}</td><td className="py-2 text-sm capitalize"><span className={`rounded-full px-2 py-0.5 text-xs ${p.status === "paid" ? "bg-[#2E7D32]/10 text-[#2E7D32]" : p.status === "processed" ? "bg-[#D4A854]/10 text-[#D4A854]" : "bg-[#8D8A87]/10 text-[#8D8A87]"}`}>{p.status}</span></td><td className="py-2 text-right font-mono text-sm font-semibold text-[#D32F2F]">{formatKES(p.totalNetPay || "0")}</td></tr>)}</tbody>
            </table></div></CardContent>
          </Card>
        )}

        {(!payments || (payments.billPayments?.length === 0 && payments.expenses?.length === 0 && payments.mpesa?.filter(t => parseFloat(t.amount) < 0).length === 0 && payments.payroll?.length === 0)) && (
          <Card className="border-[#E8E0D8]"><CardContent className="py-12 text-center"><Receipt className="mx-auto mb-3 h-12 w-12 opacity-20 text-[#8D8A87]"/><p className="text-sm text-[#8D8A87]">No payments recorded for this date.</p></CardContent></Card>
        )}
      </div>
    </Layout>
  );
}
