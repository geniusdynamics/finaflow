import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Toaster } from "@/components/ui/sonner";
import { PageSkeleton } from "@/components/Skeleton";
import AuthLayout from "@/components/AuthLayout";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Dashboard = lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const DailySales = lazy(() => import("./pages/DailySales").then(m => ({ default: m.DailySales })));
const Expenses = lazy(() => import("./pages/Expenses").then(m => ({ default: m.Expenses })));
const Suppliers = lazy(() => import("./pages/Suppliers").then(m => ({ default: m.Suppliers })));
const Bills = lazy(() => import("./pages/Bills").then(m => ({ default: m.Bills })));
const Accounts = lazy(() => import("./pages/Accounts").then(m => ({ default: m.Accounts })));
const Payroll = lazy(() => import("./pages/Payroll").then(m => ({ default: m.Payroll })));
const Mpesa = lazy(() => import("./pages/Mpesa").then(m => ({ default: m.Mpesa })));
const Calendar = lazy(() => import("./pages/Calendar").then(m => ({ default: m.Calendar })));
const Reports = lazy(() => import("./pages/Reports").then(m => ({ default: m.Reports })));
const DailyLedger = lazy(() => import("./pages/DailyLedger").then(m => ({ default: m.DailyLedger })));
const DailyPayments = lazy(() => import("./pages/DailyPayments").then(m => ({ default: m.DailyPayments })));
const Users = lazy(() => import("./pages/Users").then(m => ({ default: m.Users })));
const Locations = lazy(() => import("./pages/Locations").then(m => ({ default: m.Locations })));
const Settings = lazy(() => import("./pages/Settings").then(m => ({ default: m.Settings })));
const Feedback = lazy(() => import("./pages/Feedback").then(m => ({ default: m.Feedback })));
const Businesses = lazy(() => import("./pages/Businesses").then(m => ({ default: m.Businesses })));
const PaymentMethods = lazy(() => import("./pages/PaymentMethods").then(m => ({ default: m.PaymentMethods })));
const SupplierPrices = lazy(() => import("./pages/SupplierPrices").then(m => ({ default: m.SupplierPrices })));
const Integrations = lazy(() => import("./pages/Integrations").then(m => ({ default: m.Integrations })));
const PartnerDashboard = lazy(() => import("./pages/PartnerDashboard").then(m => ({ default: m.PartnerDashboard })));

function SuspendedPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;
}

function ProtectedPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AuthLayout>{children}</AuthLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Suspense fallback={<PageSkeleton />}><Home /></Suspense>} />
        <Route path="/login" element={<Suspense fallback={<PageSkeleton />}><Login /></Suspense>} />
        <Route path="/dashboard" element={<ErrorBoundary><Suspense fallback={<PageSkeleton />}><ProtectedPage><Dashboard /></ProtectedPage></Suspense></ErrorBoundary>} />
        <Route path="/daily-sales" element={<ErrorBoundary><Suspense fallback={<PageSkeleton />}><ProtectedPage><DailySales /></ProtectedPage></Suspense></ErrorBoundary>} />
        <Route path="/expenses" element={<ErrorBoundary><Suspense fallback={<PageSkeleton />}><ProtectedPage><Expenses /></ProtectedPage></Suspense></ErrorBoundary>} />
        <Route path="/suppliers" element={<ErrorBoundary><Suspense fallback={<PageSkeleton />}><ProtectedPage><Suppliers /></ProtectedPage></Suspense></ErrorBoundary>} />
        <Route path="/bills" element={<ErrorBoundary><Suspense fallback={<PageSkeleton />}><ProtectedPage><Bills /></ProtectedPage></Suspense></ErrorBoundary>} />
        <Route path="/accounts" element={<ErrorBoundary><Suspense fallback={<PageSkeleton />}><ProtectedPage><Accounts /></ProtectedPage></Suspense></ErrorBoundary>} />
        <Route path="/locations" element={<ErrorBoundary><Suspense fallback={<PageSkeleton />}><ProtectedPage><Locations /></ProtectedPage></Suspense></ErrorBoundary>} />
        <Route path="/payroll" element={<ErrorBoundary><Suspense fallback={<PageSkeleton />}><ProtectedPage><Payroll /></ProtectedPage></Suspense></ErrorBoundary>} />
        <Route path="/mpesa" element={<ErrorBoundary><Suspense fallback={<PageSkeleton />}><ProtectedPage><Mpesa /></ProtectedPage></Suspense></ErrorBoundary>} />
        <Route path="/daily-ledger" element={<ErrorBoundary><Suspense fallback={<PageSkeleton />}><ProtectedPage><DailyLedger /></ProtectedPage></Suspense></ErrorBoundary>} />
        <Route path="/daily-payments" element={<ErrorBoundary><Suspense fallback={<PageSkeleton />}><ProtectedPage><DailyPayments /></ProtectedPage></Suspense></ErrorBoundary>} />
        <Route path="/calendar" element={<ErrorBoundary><Suspense fallback={<PageSkeleton />}><ProtectedPage><Calendar /></ProtectedPage></Suspense></ErrorBoundary>} />
        <Route path="/reports" element={<ErrorBoundary><Suspense fallback={<PageSkeleton />}><ProtectedPage><Reports /></ProtectedPage></Suspense></ErrorBoundary>} />
        <Route path="/users" element={<ErrorBoundary><Suspense fallback={<PageSkeleton />}><ProtectedPage><Users /></ProtectedPage></Suspense></ErrorBoundary>} />
        <Route path="/settings" element={<ErrorBoundary><Suspense fallback={<PageSkeleton />}><ProtectedPage><Settings /></ProtectedPage></Suspense></ErrorBoundary>} />
        <Route path="/feedback" element={<ErrorBoundary><Suspense fallback={<PageSkeleton />}><ProtectedPage><Feedback /></ProtectedPage></Suspense></ErrorBoundary>} />
        <Route path="/businesses" element={<ErrorBoundary><Suspense fallback={<PageSkeleton />}><ProtectedPage><Businesses /></ProtectedPage></Suspense></ErrorBoundary>} />
        <Route path="/payment-methods" element={<ErrorBoundary><Suspense fallback={<PageSkeleton />}><ProtectedPage><PaymentMethods /></ProtectedPage></Suspense></ErrorBoundary>} />
        <Route path="/supplier-prices" element={<ErrorBoundary><Suspense fallback={<PageSkeleton />}><ProtectedPage><SupplierPrices /></ProtectedPage></Suspense></ErrorBoundary>} />
        <Route path="/integrations" element={<ErrorBoundary><Suspense fallback={<PageSkeleton />}><ProtectedPage><Integrations /></ProtectedPage></Suspense></ErrorBoundary>} />
        <Route path="/partner" element={<ErrorBoundary><Suspense fallback={<PageSkeleton />}><ProtectedPage><PartnerDashboard /></ProtectedPage></Suspense></ErrorBoundary>} />
        <Route path="*" element={<Suspense fallback={<PageSkeleton />}><NotFound /></Suspense>} />
      </Routes>
      <Toaster />
    </>
  );
}
