import { trpc, resetQueryClient, setCsrfToken } from "@/providers/trpc";

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

let csrfTokenFromResponse: string | null = null;

export function setCsrfFromResponse(token: string | null) {
  csrfTokenFromResponse = token;
  setCsrfToken(token);
}

export function useAuth() {
  const { data: user, isLoading } = trpc.localAuth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
    gcTime: 0,
  });

  const logout = () => {
    resetQueryClient();
    setCsrfFromResponse(null);
    window.location.href = "/login";
  };

  return { user: user as AuthUser | null, isLoading, logout };
}

