import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/spinner";

interface Props {
  children: ReactNode;
  requiredPermission?: string;
}

export function ProtectedRoute({ children, requiredPermission }: Props) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission) {
    const rolePermissions: Record<string, string[]> = {
      owner: ["*"],
      admin: ["sales:view", "sales:create", "expenses:view", "expenses:create", "bills:view", "bills:pay",
        "accounts:view", "accounts:manage", "payroll:view", "payroll:process", "reports:view",
        "users:manage", "settings:manage", "mpesa:view"],
      manager: ["sales:view", "sales:create", "expenses:view", "expenses:create", "bills:view", "bills:pay",
        "accounts:view", "payroll:view", "payroll:process", "reports:view", "mpesa:view"],
      employee: ["sales:view", "sales:create", "expenses:view", "bills:view", "mpesa:view"],
      viewer: ["sales:view", "expenses:view", "bills:view", "accounts:view", "reports:view", "mpesa:view"],
    };
    const perms = rolePermissions[user.role] || [];
    if (!perms.includes("*") && !perms.includes(requiredPermission)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}
