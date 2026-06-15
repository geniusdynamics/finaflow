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
      staleTime: 30_000,
      gcTime: 300_000,
      refetchOnWindowFocus: true,
    },
  },
});

let csrfToken: string | null = null;
let authToken: string | null = null; // Bearer JWT fallback

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
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
        const csrf = csrfToken ?? getCsrfTokenFromCookies();
        if (!csrfToken && csrf) {
          csrfToken = csrf;
        }
        if (csrf) {
          headers["x-csrf-token"] = csrf;
        }
        // Send JWT as Bearer token fallback if available (more reliable than cookie-only auth)
        if (authToken) {
          headers["authorization"] = `Bearer ${authToken}`;
        }
        return headers;
      },
      fetch(input, init) {
        console.log(`[trpc-client] --> ${typeof input === "string" ? input : (input as URL).href}`, init?.method ?? "GET");
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        }).then(async (res) => {
          const clone = res.clone();
          const body = await clone.text().catch(() => "<unreadable>");
          console.log(`[trpc-client] <-- ${typeof input === "string" ? input : (input as URL).href} ${res.status} body=${body.slice(0, 300)}`);
          return res;
        }).catch((err) => {
          console.error(`[trpc-client] <-- NETWORK ERROR:`, err);
          throw err;
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
        staleTime: 30_000,
        gcTime: 300_000,
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
