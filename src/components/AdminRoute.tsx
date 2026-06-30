import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/providers/trpc";

interface Props {
  children: ReactNode;
}

export function AdminRoute({ children }: Props) {
  const { user, isLoading: authLoading } = useAuth();
  const { data: adminStatus, isLoading: adminLoading } = trpc.admin.verify.useQuery(undefined, {
    retry: false,
    enabled: !!user,
  });

  if (authLoading || adminLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!user || !adminStatus?.isSuperAdmin) {
    return <Navigate to="/404" replace />;
  }

  return <>{children}</>;
}
