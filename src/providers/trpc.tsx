import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";

export const trpc = createTRPCReact<AppRouter>();

let queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 0,
      refetchOnWindowFocus: true,
    },
  },
});

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

export function getCsrfTokenFromCookies(cookieHeader?: string | null): string | null {
  const source = cookieHeader ?? (typeof document !== "undefined" ? document.cookie : "");
  if (!source) return null;

  for (const part of source.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === "csrf_token") {
      return rawValue.join("=") || null;
    }
  }

  return null;
}

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        const headers: Record<string, string> = {};
        const token = csrfToken ?? getCsrfTokenFromCookies();
        if (!csrfToken && token) {
          csrfToken = token;
        }
        if (token) {
          headers["x-csrf-token"] = token;
        }
        return headers;
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

export function resetQueryClient() {
  queryClient.clear();
  queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        gcTime: 0,
        refetchOnWindowFocus: true,
      },
    },
  });
}

export function getQueryClient() {
  return queryClient;
}

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
