import { Routes, Route } from "react-router";
import Home from "./pages/Home";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import { Dashboard } from "./pages/Dashboard";
import { DailySales } from "./pages/DailySales";
import { Expenses } from "./pages/Expenses";
import { Suppliers } from "./pages/Suppliers";
import { Bills } from "./pages/Bills";
import { Accounts } from "./pages/Accounts";
import { Payroll } from "./pages/Payroll";
import { Mpesa } from "./pages/Mpesa";
import { Calendar } from "./pages/Calendar";
import { Reports } from "./pages/Reports";
import { DailyLedger } from "./pages/DailyLedger";
import { DailyPayments } from "./pages/DailyPayments";
import { Users } from "./pages/Users";
import { Locations } from "./pages/Locations";
import { Settings } from "./pages/Settings";
import { Feedback } from "./pages/Feedback";
import { Businesses } from "./pages/Businesses";
import { PaymentMethods } from "./pages/PaymentMethods";
import { SupplierPrices } from "./pages/SupplierPrices";
import { Integrations } from "./pages/Integrations";
import { PartnerDashboard } from "./pages/PartnerDashboard";

import { Toaster } from "@/components/ui/sonner";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/daily-sales" element={<DailySales />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/bills" element={<Bills />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/locations" element={<Locations />} />
        <Route path="/payroll" element={<Payroll />} />
        <Route path="/mpesa" element={<Mpesa />} />
        <Route path="/daily-ledger" element={<DailyLedger />} />
        <Route path="/daily-payments" element={<DailyPayments />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/users" element={<Users />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/businesses" element={<Businesses />} />
        <Route path="/payment-methods" element={<PaymentMethods />} />
        <Route path="/supplier-prices" element={<SupplierPrices />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/partner" element={<PartnerDashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </>
  );
}
