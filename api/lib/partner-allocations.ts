// ABOUTME: Shared rules for partner allocation invite and rights lifecycle.
// ABOUTME: Keeps routers and tests aligned on status and rights profile contracts.
export const RIGHTS_PROFILES = ["view_only", "create_view", "manage"] as const;

export type RightsProfile = (typeof RIGHTS_PROFILES)[number];

export function assertRightsProfile(value: string): asserts value is RightsProfile {
  if (!RIGHTS_PROFILES.includes(value as RightsProfile)) {
    throw new Error("Invalid rights profile");
  }
}

export function generateAllocationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const suffix = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `ALLOC${suffix}`;
}

const INVITE_TRANSITIONS = new Set(["active->consumed", "active->revoked", "active->expired"]);

export function assertInviteStatusCanTransition(from: string, to: string): void {
  const transition = `${from}->${to}`;
  if (!INVITE_TRANSITIONS.has(transition)) {
    throw new Error(`Invalid invite transition: ${transition}`);
  }
}
