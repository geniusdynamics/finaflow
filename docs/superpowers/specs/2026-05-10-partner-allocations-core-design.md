# Partner Allocations Core (Phase 1) Design

## Scope
Phase 1 delivers partner allocation core capabilities for partner-type accounts:
- One-time allocation code/link generation by account owners
- Partner claim flow using allocation code/link
- Owner-managed allocation revoke flow
- Rights assignment using preset profiles
- Partner dashboard Allocations tab
- Owner-facing allocation management surface
- Unified business switcher support for allocated businesses

Out of scope for Phase 1:
- Demo account re-architecture and daily demo reset automation
- Super admin account/env capability model
- Advanced custom per-feature permission matrix

## Goals
- Let account owners grant controlled access to a selected business for partner users.
- Ensure partner access is clearly scoped, auditable, and revocable.
- Keep partner users inside their own account context while working on allocated businesses.
- Reuse existing authorization and business membership patterns with minimal regression risk.

## Decisions
- Use dedicated allocation entities instead of overloading referral entities.
- Use one-time allocation invites (single claim, then consumed).
- Use rights presets for Phase 1:
  - `view_only`
  - `create_view`
  - `manage`
- Represent effective access through `user_businesses` synchronization to preserve existing route protections.
- Expose allocated and owned businesses together in the business switcher, with source labeling.

## Existing Context
- Registration already supports `userType` values: `standard` and `partner`.
- Partner dashboard exists at `/partner` with existing metrics and referral actions.
- Business membership and most route authorization rely on `user_businesses` and middleware permission checks.
- Referral code generation patterns exist and can be reused for allocation token shape and link UX.

## Proposed Architecture

### Data Model
Add table: `partner_allocations`
- `id` (pk)
- `ownerAccountId` (fk -> `customer_accounts.id`, indexed)
- `ownerBusinessId` (fk -> `businesses.id`, indexed)
- `partnerAccountId` (fk -> `customer_accounts.id`, indexed)
- `partnerUserId` (fk -> `users.id`, indexed)
- `rightsProfile` (enum: `view_only`, `create_view`, `manage`)
- `status` (enum: `active`, `revoked`)
- `createdBy` (fk -> `users.id`)
- `revokedBy` (fk -> `users.id`, nullable)
- `createdAt`, `updatedAt`, `revokedAt`, `deletedAt`

Add table: `allocation_invites`
- `id` (pk)
- `code` (unique, indexed)
- `ownerAccountId` (fk -> `customer_accounts.id`, indexed)
- `businessId` (fk -> `businesses.id`, indexed)
- `rightsProfile` (enum: `view_only`, `create_view`, `manage`)
- `status` (enum: `active`, `consumed`, `revoked`, `expired`)
- `expiresAt` (nullable in Phase 1; not required for one-time semantics)
- `createdBy` (fk -> `users.id`)
- `consumedByPartnerAccountId` (fk -> `customer_accounts.id`, nullable)
- `consumedByPartnerUserId` (fk -> `users.id`, nullable)
- `consumedAt`, `revokedAt`, `deletedAt`, `createdAt`, `updatedAt`

Constraints and invariants:
- One invite code can be consumed by exactly one partner account.
- Consuming an invite and creating an allocation happen in one DB transaction.
- Allocation can only target partner-type claimant accounts.
- Revoke deactivates effective partner business access immediately.

### Backend API
Extend/introduce partner allocation procedures (owner side + partner side).

Owner side:
1. `allocations.generateInvite`
- Input: `businessId`, `rightsProfile`
- Validates owner membership and business/account scope.
- Creates one-time invite code and returns code + shareable link.
- Audit log action: `GENERATE_ALLOCATION_INVITE`.

2. `allocations.listOwnerAllocations`
- Input: optional `businessId`
- Returns active/revoked allocations and invite lifecycle summaries for owner context.

3. `allocations.revoke`
- Input: `allocationId`
- Validates owner scope.
- Sets allocation status `revoked`.
- Deactivates mirrored partner row in `user_businesses`.
- Audit log action: `REVOKE_PARTNER_ALLOCATION`.

4. `allocations.revokeInvite`
- Input: `inviteId`
- Revokes unconsumed invite code.
- Audit log action: `REVOKE_ALLOCATION_INVITE`.

Partner side:
1. `allocations.claimInvite`
- Input: `code`
- Validates partner account type and code state (`active` + unconsumed).
- In transaction:
  - marks invite consumed
  - creates active `partner_allocations` row
  - creates/reactivates `user_businesses` row for partner user and target business
- Audit log action: `CLAIM_PARTNER_ALLOCATION`.

2. `allocations.listPartnerAllocations`
- Returns allocated businesses grouped by customer account with rights profile and status.

### Rights Model
Preset-to-permission mapping (Phase 1):
- `view_only`: view/read permissions for allocated business modules.
- `create_view`: `view_only` plus create/add permissions for supported modules.
- `manage`: broad management rights, including edit/delete where already supported by system policy.

Enforcement strategy:
- Keep existing role + permission checks.
- Add allocation-aware permission resolution path:
  - owned membership keeps existing behavior
  - allocated membership clamps permissions to rights profile ceiling
- Prefer deny-by-default for permissions not explicitly granted by the profile.

### Frontend
Partner dashboard updates:
- Add optional `Allocations` tab on `PartnerDashboard`.
- Tab contains:
  - code claim form (`Allocation ID`)
  - assigned client accounts and businesses
  - rights badge per allocation
  - allocation status and timestamps

Owner-facing allocation management:
- Add an allocation section in the account/business management area:
  - select business
  - select rights profile
  - generate code/link
  - list assigned partners and rights
  - revoke assignment/invite

Business switcher updates:
- Show owned + allocated businesses together for partner users.
- Include source label metadata (example: `Owned`, `Allocated: <Client Account Name>`).
- Keep context switching behavior aligned with existing `switchBusiness` mutation and scope checks.

### Security Model
- Claim endpoints require authenticated partner user context.
- Invite generation/revoke requires authenticated owner/admin permissions in account scope.
- All operations validate same-account ownership and business membership before mutation.
- All mutation endpoints are CSRF-protected and rate-limited under existing middleware standards.
- All allocation lifecycle events are audit logged.

### Error Handling
- Invalid/unknown code -> validation/not-found style error.
- Already consumed/revoked/expired code -> explicit state conflict error.
- Non-partner claimant -> authorization/validation error.
- Owner tries to revoke outside owned scope -> forbidden error.
- Attempt to access revoked allocation business -> forbidden + current business fallback behavior.

## Testing Strategy

### Unit Tests
- Invite code generation format and uniqueness handling.
- Rights profile mapping returns expected permission ceilings.
- Allocation status transition guards (`active` -> `consumed`/`revoked` only where valid).

### Integration Tests (API)
- Owner can generate invite for owned business.
- Partner can claim invite exactly once.
- Non-partner account claim is rejected.
- Claim creates allocation and active `user_businesses` row atomically.
- Revoke deactivates effective business membership and blocks subsequent access.
- Owner allocation list and partner allocation list return tenant-scoped results only.

### Frontend Tests
- Partner dashboard renders `Allocations` tab and claim flow states.
- Owner allocation UI generates link and displays assignment rows.
- Revoke action updates UI status and hides revoked access from active views.
- Business switcher includes allocated entries with source labels.

### End-to-End Tests
- Full flow: owner generates code -> partner claims -> partner switches context -> partner can only perform profile-allowed actions -> owner revokes -> partner loses access immediately.
- Regression checks for standard owner-only flows to ensure no permission leaks.

## Rollout
- Ship behind a feature flag for staged validation (`PARTNER_ALLOCATIONS_ENABLED`).
- Apply DB migration, then deploy API and frontend together.
- Backward compatible for existing non-partner flows.
- Add operator docs for invite generation/revoke lifecycle and troubleshooting.

## Completion Criteria (Phase 1)
- Owners can generate one-time allocation code/link per selected business.
- Partner users can claim valid code and see assigned businesses.
- Rights presets are enforced consistently on allocated business context.
- Revocation removes partner access immediately and is audit logged.
- Allocated businesses appear in unified switcher with source labels.

## Phase 2 Preview (Deferred)
- Demo assignment model: account-to-business demo allocations instead of isolated per-signup demo tenant creation.
- Daily demo reset schedule and deterministic reseed runbook.
- Super admin ENV and account-level elevated controls for demo ownership and governance.
