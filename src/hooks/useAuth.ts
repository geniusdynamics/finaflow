import { trpc, resetQueryClient, setCsrfToken, setAuthToken } from "@/providers/trpc";

export interface AuthUser {
  id: number;
  name: string | null;
  username: string | null;
  role: string;
  email: string | null;
  phone: string | null;
  locationId: number | null;
  assignedLocationIds: number[];
  enforceUserLocation: boolean;
  isActive: boolean;
  userType: string | null;
  currentBusinessId: number | null;
  currentBusiness: { id: number; name: string; slug: string } | null;
  businessIds: number[];
  businessRole: string;
  accountId: string | null;
  permissions: string[];
}

export function setCsrfFromResponse(token: string | null) {
  setCsrfToken(token);
}

export function useAuth() {
  const { data: user, isLoading } = trpc.localAuth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: true,
  });

  const logout = () => {
    resetQueryClient();
    setCsrfFromResponse(null);
    setAuthToken(null);
    window.location.href = "/login";
  };

  return { user: user as AuthUser | null, isLoading, logout };
}

