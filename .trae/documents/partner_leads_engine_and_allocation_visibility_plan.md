# Partner Leads Engine And Allocation Visibility Plan

## Summary
Finish the requested leads and referral workflow by building the missing Partner Dashboard UI, completing the allocation-tab duplication there, and closing the remaining verification gaps around role visibility and account-level referral attribution. The backend foundation for leads, signup matching, invitation templates, and Settings-based `Referred By` is already present on disk, so execution should continue from the current partial implementation rather than restarting it.

## Current State Analysis

### Already Implemented On Disk
- `db/schema.ts`
  - Adds `lead_commission_status`.
  - Adds a concrete `leads` table with creator scope, normalized email/phone, matched signup references, referral usage, commission state, invite timestamps, and soft delete support.
  - Extends `email_log_type` with `lead_invitation`.
- `db/migrations/0029_partner_leads.sql`
  - Creates the new enum and `leads` table and adds lookup indexes.
- `api/lib/leads.ts`
  - Normalizes email/phone.
  - Finds latest matching leads.
  - Evaluates commission eligibility.
  - Applies account-wide referral syncing.
  - Marks signup conversions.
- `api/leads-router.ts`
  - Exposes `list`, `stats`, `create`, `update`, `sendInvitationEmail`, `prepareSmsInvitation`, and `myContact`.
- `api/router.ts`
  - Mounts `leads: leadsRouter`.
- `api/local-auth-router.ts`
  - Calls lead conversion logic after successful signup.
- `api/account-subscriptions-router.ts`
  - Extends `mySubscription` with account-level referral details.
  - Adds `setReferredBy` mutation.
- `api/lib/email-templates.ts`
  - Adds branded HTML/text email templates and SMS text generation for lead invites.
- `api/partner-router.ts`
  - Adds backend role checks for allocation claim/management access.
- `src/pages/Settings.tsx`
  - Replaces the old read-only referral card with editable account-level `Referred By` UI.
- `src/pages/Businesses.tsx`
  - Hides the `Partner Allocations` tab for standard business accounts.
- `src/components/partner/AllocationsTab.tsx`
  - Blocks claim-allocation UI for non-partner, non-admin accounts.
- Focused tests already present:
  - `api/lib/__tests__/leads.test.ts`
  - `api/__tests__/local-auth-registration.test.ts`

### Still Missing Or Incomplete
- `src/pages/PartnerDashboard.tsx`
  - Still only has `overview`, `allocations`, and `commissions`.
  - Does not surface the new leads engine.
  - Uses the claim-side `AllocationsTab`, not the owner management experience requested for duplication.
- No dedicated dashboard components yet for leads management:
  - there is no `src/components/partner/LeadsTab.tsx`
  - there is no `LeadFormDialog` or reusable lead-status badge component
- Remaining automated coverage is incomplete:
  - no router-level tests for `api/leads-router.ts`
  - no backend tests for `setReferredBy`
  - no frontend tests for Settings, Businesses, or Partner Dashboard visibility
- Full repo verification has not yet been completed:
  - lint
  - typecheck
  - broader test sweep
  - browser/E2E confirmation

## Assumptions & Decisions
- Audience:
  - lead creation is available to authenticated users who are using the partner/business workflow requested by the feature
  - allocation management and claim flows are visible only to partner accounts plus admins
- Lead matching:
  - at least one of `email` or `phone` is required
  - latest matching lead wins when duplicates exist
- Referral eligibility:
  - signup referral remains valid when a matching pre-added lead belongs to the same referrer
  - post-signup `Referred By` in Settings becomes commission-eligible only when the referred account had already been added as a lead by that same referrer before signup
  - otherwise the referral is stored as information only
- Referral scope:
  - Settings referral is account-wide, not business-specific
- SMS:
  - this phase is template-only; it returns and records the SMS body but does not deliver through a provider
- Allocation duplication:
  - Partner Dashboard gets the owner allocation management experience in its own tab
  - the existing claim flow remains available only to partner/admin-eligible users through the claim-side component/routes

## Proposed Changes

### 1. Finish The Partner Dashboard Leads Experience
- `src/pages/PartnerDashboard.tsx`
  - Expand the tab state from `overview | allocations | commissions` to include `leads`.
  - Query `trpc.leads.stats` and `trpc.leads.list` so the dashboard shows:
    - total leads
    - joined leads
    - referral-used leads
    - commission-eligible leads
  - Add a new `Leads` tab button beside the existing navigation.
  - Keep the existing overview and commissions sections intact so referral history and commission views do not regress.
- New component: `src/components/partner/LeadsTab.tsx`
  - Render filters for:
    - all statuses
    - joined yes/no
    - referral used yes/no
    - commission eligible yes/no
  - Render both:
    - desktop table
    - mobile card list
  - Provide actions for:
    - create lead
    - edit lead
    - send invitation email
    - generate/copy SMS invitation text
  - Show lead conversion state, referral usage, commission eligibility, and any matched business/account references returned by the API.
- New component: `src/components/partner/LeadFormDialog.tsx`
  - Reuse the existing design language from `AllocationManagement.tsx` and page dialogs.
  - Support both create and edit modes.
  - Require `businessName`, `contactName`, and at least one of `email` or `phone`.
- New component: `src/components/partner/LeadStatusBadge.tsx`
  - Centralize the display for:
    - lead status
    - joined/not joined
    - referral used/not used
    - commission eligible/information only

### 2. Duplicate Owner Allocation Management Into Partner Dashboard
- `src/pages/PartnerDashboard.tsx`
  - Replace the current owner-side allocation tab content from `AllocationsTab` to `AllocationManagement` for the duplication the feature requested.
  - Keep the tab label clear, for example `Partner Allocations`, so it matches the existing business-management wording.
  - Gate the entire allocations tab using the same partner/admin visibility rule already introduced elsewhere.
- `src/components/partner/AllocationsTab.tsx`
  - Keep this component as the claim/access view.
  - Do not repurpose it for owner invite generation.
- `src/components/partner/AllocationManagement.tsx`
  - Reuse as-is unless a small extraction is needed for shared styling or empty-state text.

### 3. Align Frontend Visibility Everywhere
- `src/pages/PartnerDashboard.tsx`
  - Hide allocation-management tab content for standard business accounts.
- `src/pages/Businesses.tsx`
  - Keep the new `canUsePartnerAllocations` gate.
  - Verify tab switching cannot strand a standard user on the hidden tab state.
- `src/components/Layout.tsx`
  - Review whether navigation to `/partner` or related links needs role-aware hiding or relabeling so discoverability matches the new intended scope.
- `src/hooks/useAuth.ts`
  - Reuse `userType`, `role`, and `isSuperAdmin`; only add a computed helper if repeated gating becomes noisy.

### 4. Close Backend Test Gaps Around New Flows
- New test file: `api/__tests__/leads-router.test.ts`
  - cover `create`
  - cover `list` filters
  - cover `update`
  - cover `sendInvitationEmail`
  - cover `prepareSmsInvitation`
  - cover tenant/user isolation
- Extend `api/__tests__/account-subscription-context.test.ts` or create a targeted account subscription referral test
  - saving `Referred By` after signup
  - preventing self-referral
  - preventing duplicate reassignment
  - verifying `commissionEligible` only when the lead pre-existed for that referrer
- Extend partner-allocation tests
  - verify partner/admin access still works
  - verify standard business users are rejected by backend checks

### 5. Add Frontend Render Tests For The New UI Rules
- New or existing page tests under `src/pages/__tests__/`
  - `Settings` account tab:
    - editable referral code input appears only when `canSetReferredBy`
    - existing referral shows correct eligible/info-only state
  - `Businesses` page:
    - `Partner Allocations` tab is hidden for standard business users
    - tab remains visible for partner/admin users
  - `PartnerDashboard` page:
    - leads tab renders
    - allocations tab uses owner management view
    - standard business users do not see restricted tabs

### 6. Verify End To End
- Run:
  - `npm run lint`
  - `npm run check`
  - focused Vitest suites for new backend/frontend files
- Browser-verify:
  - create a lead with email only
  - create a lead with phone only
  - send a lead invitation email
  - generate SMS invite text
  - sign up with a matching lead and referral code
  - sign up with a matching lead but without referral code
  - add a Settings referral for a pre-added lead and confirm eligible state
  - add a Settings referral with no matching pre-added lead and confirm information-only state
  - confirm standard business accounts cannot see allocation tabs
  - confirm partner/admin accounts can manage or claim allocations through the correct surfaces

## Execution Order
1. Finish `src/pages/PartnerDashboard.tsx` tab structure and data wiring.
2. Create `LeadsTab`, `LeadFormDialog`, and `LeadStatusBadge`.
3. Swap Partner Dashboard allocation content to `AllocationManagement` and keep role gating consistent.
4. Add backend router/account-referral tests.
5. Add frontend render tests for Settings, Businesses, and Partner Dashboard.
6. Run lint, typecheck, focused tests, and browser verification.
7. Update `CHANGELOG.md` at the top under `[Unreleased]` after implementation is complete.

## Verification Steps
- Static verification
  - `npm run lint`
  - `npm run check`
- Backend verification
  - `npx vitest run api/lib/__tests__/leads.test.ts api/__tests__/local-auth-registration.test.ts api/__tests__/leads-router.test.ts`
  - run the chosen account-subscription referral test file
  - run the chosen partner-allocation authorization test file(s)
- Frontend verification
  - run the new page/component tests covering Settings, Businesses, and Partner Dashboard
- Manual/browser verification
  - complete the lead creation, signup attribution, Settings referral, and allocation visibility flows listed above
- Regression check
  - confirm referral code generation, referred-business listing, commission history, and existing allocation claim flows still behave as before for authorized roles
