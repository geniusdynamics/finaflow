// ABOUTME: Resolves the active business id for financial report generation from authenticated user state.
// ABOUTME: Prevents reports from defaulting to an unrelated tenant when business context is missing.
import type { AuthUser } from "@/hooks/useAuth";

export function resolveFinancialReportBusinessId(user: AuthUser | null | undefined): number | null {
  return user?.currentBusiness?.id ?? user?.currentBusinessId ?? null;
}
