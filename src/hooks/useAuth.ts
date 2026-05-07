import { useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { resetQueryClient } from "@/providers/trpc";

export interface AuthUser {
  id: number;
  name: string | null;
  username: string | null;
  role: string;
  email: string | null;
  phone: string | null;
  locationId: number | null;
  isActive: boolean;
  userType: string | null;
  currentBusinessId: number | null;
  currentBusiness: any | null;
  businessIds: number[];
  businessRole: string;
  accountId: string | null;
}

export function useAuth() {
  const { data: user, isLoading } = trpc.localAuth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    if (user && user.id) {
      localStorage.setItem("finaflow_current_business_id", String(user.currentBusinessId ?? ""));
    }
  }, [user?.currentBusinessId]);

  const logout = () => {
    resetQueryClient();
    localStorage.removeItem("finaflow_token");
    localStorage.removeItem("finaflow_current_business_id");
    window.location.href = "/login";
  };

  return { user: user as AuthUser | null, isLoading, logout };
}

export function getCurrentBusinessId(): number | null {
  const stored = localStorage.getItem("finaflow_current_business_id");
  return stored ? parseInt(stored, 10) : null;
}
