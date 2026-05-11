// ABOUTME: Auth-aware route guard that redirects unauthenticated or unauthorized users away from protected pages.
// ABOUTME: Uses the centralised permission library so route gating stays in sync with backend definitions.
import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/spinner";
import { hasPermission } from "@/lib/permissions";
import type { Permission } from "@/lib/permissions";

interface Props {
  children: ReactNode;
  requiredPermission?: Permission;
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

  if (requiredPermission && !hasPermission(user.role, requiredPermission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
