// ABOUTME: Builds the signup URL that carries a Fina Connect session to the
// ABOUTME: sibling app. Kept pure so the query contract (ref, source, session,
// ABOUTME: state, source account) is tested without a running deployment.

export type SignupReferralTarget = "finaflow" | "finabill";

export type SignupReferralInput = {
  target: SignupReferralTarget;
  /** Origin of the app where the account will be created. */
  appUrl: string;
  sessionPublicId: string;
  state: string;
  sourceAccount?: string | null;
  sourceName?: string | null;
};

/**
 * FinaFlow opens its signup tab directly from `/login?ref=`, while FinaBill has
 * a dedicated `/signup`. The referral code names the *source* app, not a
 * merchant, because the pairing is the point of the link.
 */
export function buildSignupReferralUrl(input: SignupReferralInput): string {
  const base = input.appUrl.trim().replace(/\/+$/, "");
  if (!base) {
    throw new Error("The sibling app URL is not configured");
  }

  const toFinaflow = input.target === "finaflow";
  const params = new URLSearchParams({
    ref: toFinaflow ? "FINABILL" : "FINAFLOW",
    source: toFinaflow ? "finabill" : "finaflow",
    connect: input.sessionPublicId,
    state: input.state,
  });
  if (input.sourceAccount?.trim()) {
    params.set("source_account", input.sourceAccount.trim());
  }
  if (input.sourceName?.trim()) {
    params.set("source_name", input.sourceName.trim());
  }

  return `${base}${toFinaflow ? "/login" : "/signup"}?${params.toString()}`;
}
