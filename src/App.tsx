// ABOUTME: Root application component that wires up all routes with lazy loading, error boundaries, and permission checks.
// ABOUTME: Every protected route specifies a requiredPermission that is enforced by ProtectedRoute.
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { Toaster } from "@/components/ui/sonner";
import { PageSkeleton } from "@/components/Skeleton";
import type { Permission } from "@/lib/permissions";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const Dashboard = lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const DailySales = lazy(() => import("./pages/DailySales").then(m => ({ default: m.DailySales })));
const Expenses = lazy(() => import("./pages/Expenses").then(m => ({ default: m.Expenses })));
const Suppliers = lazy(() => import("./pages/Suppliers").then(m => ({ default: m.Suppliers })));
const Bills = lazy(() => import("./pages/Bills").then(m => ({ default: m.Bills })));
const Accounts = lazy(() => import("./pages/Accounts").then(m => ({ default: m.Accounts })));
const Payroll = lazy(() => import("./pages/Payroll").then(m => ({ default: m.Payroll })));
const Wallet = lazy(() => import("./pages/Wallet").then(m => ({ default: m.Wallet })));
const WalletAdmin = lazy(() => import("./pages/WalletAdmin").then(m => ({ default: m.WalletAdmin })));
const Calendar = lazy(() => import("./pages/Calendar").then(m => ({ default: m.Calendar })));
const Reports = lazy(() => import("./pages/Reports").then(m => ({ default: m.Reports })));
const Users = lazy(() => import("./pages/Users").then(m => ({ default: m.Users })));
const Locations = lazy(() => import("./pages/Locations").then(m => ({ default: m.Locations })));
const Settings = lazy(() => import("./pages/Settings").then(m => ({ default: m.Settings })));
const Businesses = lazy(() => import("./pages/Businesses"));
const BusinessOverview = lazy(() => import("./pages/BusinessOverview").then(m => ({ default: m.BusinessOverview })));
const BusinessDetails = lazy(() => import("./pages/BusinessDetails").then(m => ({ default: m.BusinessDetails })));
const PartnerDashboard = lazy(() => import("./pages/PartnerDashboard").then(m => ({ default: m.PartnerDashboard })));
const Profile = lazy(() => import("./pages/Profile").then(m => ({ default: m.Profile })));
const Budgets = lazy(() => import("./pages/Budgets"));
const Admin = lazy(() => import("./pages/Admin"));

function SuspendedPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;
}

function ProtectedPage({ children, requiredPermission }: { children: React.ReactNode; requiredPermission?: Permission | Permission[] }) {
  return <ProtectedRoute requiredPermission={requiredPermission}>{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Suspense fallback={<PageSkeleton />}><Home /></Suspense>} />
        <Route path="/login" element={<Suspense fallback={<PageSkeleton />}><Login /></Suspense>} />
        <Route path="/forgot-password" element={<Suspense fallback={<PageSkeleton />}><ForgotPassword /></Suspense>} />
        <Route path="/reset-password" element={<Suspense fallback={<PageSkeleton />}><ResetPassword /></Suspense>} />
        <Route path="/dashboard" element={<ErrorBoundary><SuspendedPage><ProtectedPage requiredPermission="dashboard:view"><Dashboard /></ProtectedPage></SuspendedPage></ErrorBoundary>} />
        <Route path="/daily-sales" element={<ErrorBoundary><SuspendedPage><ProtectedPage requiredPermission={["sales:view", "sales:create", "sales:view_own"]}><DailySales /></ProtectedPage></SuspendedPage></ErrorBoundary>} />
        <Route path="/expenses" element={<ErrorBoundary><SuspendedPage><ProtectedPage requiredPermission={["expenses:view", "expenses:create"]}><Expenses /></ProtectedPage></SuspendedPage></ErrorBoundary>} />
        <Route path="/suppliers" element={<ErrorBoundary><SuspendedPage><ProtectedPage requiredPermission={["suppliers:view", "suppliers:manage"]}><Suppliers /></ProtectedPage></SuspendedPage></ErrorBoundary>} />
        <Route path="/bills" element={<ErrorBoundary><SuspendedPage><ProtectedPage requiredPermission={["bills:view", "bills:create"]}><Bills /></ProtectedPage></SuspendedPage></ErrorBoundary>} />
        <Route path="/accounts" element={<ErrorBoundary><SuspendedPage><ProtectedPage requiredPermission={["accounts:view", "accounts:manage"]}><Accounts /></ProtectedPage></SuspendedPage></ErrorBoundary>} />
        <Route path="/chart-of-accounts" element={<Navigate to="/accounts?section=chart-of-accounts" replace />} />
        <Route path="/locations" element={<ErrorBoundary><SuspendedPage><ProtectedPage requiredPermission="settings:manage"><Locations /></ProtectedPage></SuspendedPage></ErrorBoundary>} />
        <Route path="/payroll" element={<ErrorBoundary><SuspendedPage><ProtectedPage requiredPermission="payroll:view"><Payroll /></ProtectedPage></SuspendedPage></ErrorBoundary>} />
        <Route path="/wallet" element={<ErrorBoundary><SuspendedPage><ProtectedPage requiredPermission="wallet:view"><Wallet /></ProtectedPage></SuspendedPage></ErrorBoundary>} />
        <Route path="/admin/wallet" element={<ErrorBoundary><SuspendedPage><ProtectedPage requiredPermission="wallet:admin"><WalletAdmin /></ProtectedPage></SuspendedPage></ErrorBoundary>} />
        <Route path="/daily-payments" element={<Navigate to="/calendar?section=payments" replace />} />
        <Route path="/calendar" element={<ErrorBoundary><SuspendedPage><ProtectedPage requiredPermission="calendar:view"><Calendar /></ProtectedPage></SuspendedPage></ErrorBoundary>} />
        <Route path="/reports" element={<ErrorBoundary><SuspendedPage><ProtectedPage requiredPermission="reports:view"><Reports /></ProtectedPage></SuspendedPage></ErrorBoundary>} />
        <Route path="/budgets" element={<ErrorBoundary><SuspendedPage><ProtectedPage requiredPermission="budgets:view"><Budgets /></ProtectedPage></SuspendedPage></ErrorBoundary>} />
        <Route path="/journal-entries" element={<Navigate to="/accounts?section=journal-entries" replace />} />
        <Route path="/users" element={<ErrorBoundary><SuspendedPage><ProtectedPage requiredPermission="users:manage"><Users /></ProtectedPage></SuspendedPage></ErrorBoundary>} />
        <Route path="/settings" element={<ErrorBoundary><SuspendedPage><ProtectedPage requiredPermission="settings:manage"><Settings /></ProtectedPage></SuspendedPage></ErrorBoundary>} />
        <Route path="/feedback" element={<Navigate to="/settings?tab=feedback" replace />} />
        <Route path="/businesses" element={<ErrorBoundary><SuspendedPage><ProtectedPage requiredPermission="business:manage"><Businesses /></ProtectedPage></SuspendedPage></ErrorBoundary>} />
        <Route path="/businesses/:id" element={<ErrorBoundary><SuspendedPage><ProtectedPage requiredPermission="business:manage"><BusinessOverview /></ProtectedPage></SuspendedPage></ErrorBoundary>} />
        <Route path="/businesses/:id/details" element={<ErrorBoundary><SuspendedPage><ProtectedPage requiredPermission="business:manage"><BusinessDetails /></ProtectedPage></SuspendedPage></ErrorBoundary>} />
        <Route path="/profile" element={<ErrorBoundary><SuspendedPage><ProtectedPage><Profile /></ProtectedPage></SuspendedPage></ErrorBoundary>} />
        <Route path="/partner" element={<ErrorBoundary><SuspendedPage><ProtectedPage requiredPermission="partner:view"><PartnerDashboard /></ProtectedPage></SuspendedPage></ErrorBoundary>} />
        <Route path="/admin" element={<ErrorBoundary><SuspendedPage><AdminRoute><Admin /></AdminRoute></SuspendedPage></ErrorBoundary>} />
        <Route path="/unauthorized" element={<Suspense fallback={<PageSkeleton />}><Unauthorized /></Suspense>} />
        <Route path="*" element={<Suspense fallback={<PageSkeleton />}><NotFound /></Suspense>} />
      </Routes>
      <Toaster />
    </>
  );
}
