# Changelog

## [Unreleased] — Employee Username Improvement & User Profile Page

### Added
- **Smart employee username generation** ([api/employees-payroll-router.ts](file://d:\DevCenter\abuilds\fina\finaflow\api\employees-payroll-router.ts)) — `buildEmployeeUsername(fullName, businessName, isTaken)` now uses the employee's first name as the username instead of the old `emp_phone` pattern. If the first name is taken in the account, it falls back to `{first3BizChars}_{firstName}` (e.g. `gen_nitram` for business "General" + first name "Nitram"), then numbered variants. The `create` mutation performs uniqueness checking with a bounded retry loop against the DB. No more `emp_` prefix.
- **User profile page** ([src/pages/Profile.tsx](file://d:\DevCenter\abuilds\fina\finaflow\src\pages/Profile.tsx)) — a new `/profile` route with an edit form for username, name, email, and phone. The username field validates uniqueness across the account. A "Change Password" dialog is also available. When visiting with `?id=` (from the Team page), the profile shows a read-only view of another user's info.
- **Self-service profile update endpoint** ([api/users-router.ts](file://d:\DevCenter\abuilds\fina\finaflow\api\users-router.ts)) — `users.updateProfile` uses `authedQuery` middleware so any authenticated user can update their own profile. Username uniqueness is enforced against the account's existing users.
- **Sidebar clickable user area** ([src/components/Layout.tsx](file://d:\DevCenter\abuilds\fina\finaflow\src\components\Layout.tsx)) — both desktop and mobile sidebar user info panels now link to `/profile` with a hover state.
- **View Profile on Team page** ([src/pages/Users.tsx](file://d:\DevCenter\abuilds\fina\finaflow\src\pages\Users.tsx)) — a `UserCircle` button in each user row navigates to `/profile?id={userId}` for quick profile lookup.

### Changed
- `buildEmployeeUsername` is now async and accepts `(fullName, businessName, isTaken)` instead of `(phone, fullName)` — all call sites and tests updated accordingly.

### Files
- **Added** — `src/pages/Profile.tsx`
- **Modified** — `api/employees-payroll-router.ts`, `api/users-router.ts`, `src/components/Layout.tsx`, `src/pages/Users.tsx`, `src/App.tsx`, `api/lib/__tests__/user-references.test.ts`, `e2e/__tests__/user-management-flow.test.ts`

## [Unreleased] — Role Sync & Login Redirect Fix

### Added
- **Role-sync endpoints** ([api/permissions-router.ts](file://d:\DevCenter\abuilds\fina\finaflow\api\permissions-router.ts)) — `getUserBusinessRole`, `updateUserBusinessRole`, `verifyRoleSync`, and `getRoleChangeLog` queries/mutations provide a single backend source of truth for user role assignments. `listUsers` now returns `businessRoles` (a `Record<number, string>` mapping each business ID to its per-business role) alongside the existing `businessIds`.
- **Role-cascade in user management** ([api/permissions-router.ts](file://d:\DevCenter\abuilds\fina\finaflow\api\permissions-router.ts)) — `updateUserRole` cascades global role changes to every active `user_businesses` row and fixes the broken `logAuditEvent` call to use the correct `logAudit` function.
- **Role-cascade in user section** ([api/users-router.ts](file://d:\DevCenter\abuilds\fina\finaflow\api\users-router.ts)) — the `update` mutation now synchronizes the `user_businesses.role` column when the global `users.role` changes, keeping both UI sections in lock-step.
- **`RoleSyncBadge` and `RoleChangeLog` components** ([src/pages/Users.tsx](file://d:\DevCenter\abuilds\fina\finaflow\src\pages\Users.tsx)) — inline badge showing "In sync" / "Needs sync" per user, plus a timestamped audit log picker for administrators.
- **Audit log UI** ([src/pages/Users.tsx](file://d:\DevCenter\abuilds\fina\finaflow\src\pages\Users.tsx)) — new "Role Change Audit Log" card in the Businesses tab lets admins pick a user and see timestamped before/after role history from the `audit_log` table.
- **Sync column in Businesses tab** ([src/pages/Users.tsx](file://d:\DevCenter\abuilds\fina\finaflow\src\pages\Users.tsx)) — each user row now shows a Sync status badge and per-business role badges; the role dropdown calls `updateUserBusinessRole` immediately.

### Fixed
- **Post-login redirect returning to `/login`** ([src/pages/Login.tsx](file://d:\DevCenter\abuilds\fina\finaflow\src\pages\Login.tsx), [src/providers/trpc.tsx](file://d:\DevCenter\abuilds\fina\finaflow\src\providers\trpc.tsx), [src/hooks/useAuth.ts](file://d:\DevCenter\abuilds\fina\finaflow\src\hooks\useAuth.ts)) — two root causes worked in tandem: (1) `gcTime: 0` caused auth data to be garbage-collected immediately when the Login page unmounted during navigation; (2) `invalidate()` only marks queries as stale but leaves the cached `null` data, so ProtectedRoute saw stale unauthenticated data and redirected before the refetch completed. Fixed by raising `gcTime` to 300s / `staleTime` to 30s in QueryClient defaults, removing the `gcTime: 0` override from `useAuth()`, and using `utils.localAuth.me.reset()` before `navigate("/dashboard")` to clear the stale cache entry entirely.
- **`logAuditEvent` runtime crash** ([api/permissions-router.ts](file://d:\DevCenter\abuilds\fina\finaflow\api\permissions-router.ts)) — the `updateUserRole` mutation was calling an undefined `logAuditEvent` function. Changed to `logAudit` with the correct parameter shape (`resource`/`resourceId` instead of `entityType`/`entityId`).
- **Cross-tenant notification leak** ([api/notifications-router.ts](file://d:\DevCenter\abuilds\fina\finaflow\api\notifications-router.ts)) — `generateOverdueNotifications` and `autoReHighlight` now scope overdue-bill queries to the caller's current business locations using `getCurrentBusinessLocationIds()`. Previously, a user could generate notification rows for overdue bills belonging to other businesses in the database. Regression test at `api/__tests__/notification-scope.test.ts` proves a Business A user cannot be notified about Business B's overdue bills.

### Removed
- **Over-engineered role-sync hooks** (`src/hooks/role-sync/`) — removed 5 files implementing in-process pub/sub (`emitRoleSync`/`useRoleSync`), cross-tab `BroadcastChannel` bridge (`useRoleSyncFromOtherTabs`/`broadcastRoleSyncToOtherTabs`), and exponential-backoff retry helper (`runWithRetry`). These were unnecessary because tRPC's `utils.invalidate()` is the built-in synchronization mechanism — calling it after a mutation automatically refetches every component using the same query. Cross-tab sync is already handled by React Query's `refetchOnWindowFocus: true` (configured in `trpc.tsx`). Failed mutation retries are handled natively by the tRPC client.

### Files
- **Modified** — `api/permissions-router.ts`, `api/users-router.ts`, `src/pages/Login.tsx`, `src/pages/Users.tsx`, `src/providers/trpc.tsx`, `src/components/ProtectedRoute.tsx`

## [Unreleased] — Employee Management: User Sync, Safe Deletion, and Status Metrics

### Added
- **Employee → user auto-provisioning on creation** ([api/employees-payroll-router.ts](file://d:\DevCenter\abuilds\fina\finaflow\api\employees-payroll-router.ts)) — `buildEmployeeUsername(phone, fullName)` derives a unique username (`emp_<last-9-digits-of-phone>`, else `emp_<slug-of-name>`), and the `create` mutation now creates a `users` row (employee role, same phone) and a `userBusinesses` link in the same transaction. The frontend ([src/pages/Payroll.tsx](file://d:\DevCenter\abuilds\fina\finaflow\src\pages\Payroll.tsx)) captures the resulting username + one-time password and surfaces them in a credentials dialog.
- **Referential-integrity helper for user deletion** ([api/lib/user-references.ts](file://d:\DevCenter\abuilds\fina\finaflow\api\lib\user-references.ts)) — `findLinkedRecordsForUser(userId)` counts references across 19 user-linked tables with soft-delete awareness. Returns a `UserDeletionCheck` with `blockingGroups` / `informationalGroups`; `formatLinkedRecordsMessage` produces human-readable multi-line output.
- **Safe-delete + disable/enable endpoints** ([api/users-router.ts](file://d:\DevCenter\abuilds\fina\finaflow\api\users-router.ts)) — `users.delete` refuses to drop a user that has blocking linked records, throws `TRPCError` with `code: "USER_DELETION_BLOCKED"` and structured `cause` payload. Self-delete is rejected. New `users.disable` and `users.enable` mutations flip `users.isActive` and write `auditLog` rows. `users.getDeletionCheck` and `users.getStatusMetrics` are exposed as pre-flight queries.
- **UI: per-user Disable/Enable + blocked-deletion fallback + metrics tab** ([src/pages/Users.tsx](file://d:\DevCenter\abuilds\fina\finaflow\src\pages\Users.tsx)) — each row gets Disable/Enable actions. The delete mutation now consumes the structured `USER_DELETION_BLOCKED` error and offers a "Disable instead" fallback with record counts. A new "Account Metrics" tab renders per-business status counts.
- **Tests** — 8 unit tests for username builder + message formatter ([api/lib/__tests__/user-references.test.ts](file://d:\DevCenter\abuilds\fina\finaflow\api\lib\__tests__\user-references.test.ts)) and 4 integration tests covering no-linked-records, business memberships, and sales records ([api/__tests__/user-deletion-flow.test.ts](file://d:\DevCenter\abuilds\fina\finaflow\api\__tests__\user-deletion-flow.test.ts)). Vitest include list extended with `e2e/` folder.

### Changed
- **Employee creation payload** ([src/pages/Payroll.tsx](file://d:\DevCenter\abuilds\fina\finaflow\src\pages\Payroll.tsx)) — the success path now expects `createdEmployee` with `username` + `initialPassword`, opens a credentials dialog, and resets form state only after the owner closes the dialog.

### Fixed
- **Risky hard-delete on user accounts** — business owners could previously drop any user they had created, which silently destroyed historical records. The router now blocks deletion with linked records and offers `disable` as the safe alternative.
- **Employee payroll assignment without a user account** — payroll advances and salary payments now have an authoritative user target because every employee is created with a `users` row alongside the `employees` row.

### Files
- **Added** — `api/lib/user-references.ts`, `api/lib/__tests__/user-references.test.ts`, `api/__tests__/user-deletion-flow.test.ts`, `e2e/__tests__/user-management-flow.test.ts`
- **Modified** — `api/employees-payroll-router.ts`, `api/users-router.ts`, `src/pages/Payroll.tsx`, `src/pages/Users.tsx`, `vitest.config.ts`

## [Unreleased] — Auth Workflow: Tabbed Switcher, Mobile Touch Targets, and Returning-User CTAs

### Added
- **Persistent Sign In / Sign Up tab pair on `/login`** ([src/pages/Login.tsx](file://d:\DevCenter\abuilds\fina\finaflow\src\pages\Login.tsx)) — a top-level `intent` state plus a tablist (`role="tablist"`, `aria-label="Authentication mode"`) now renders regardless of whether the user is on the account-lookup, credentials, or signup step. Users are no longer trapped in the registration flow because the Sign In tab is missing; the same tab pair appears from the home page, from a deep-link to `/login?type=partner`, and from the mobile Sign In button in the header. Switching tabs preserves the user's existing form state — no re-typing of the account name, email, or password.
- **Prominent, persistent Sign In button + tabbed auth control in the home header** ([src/pages/Home.tsx](file://d:\DevCenter\abuilds\fina\finaflow\src\pages\Home.tsx)) — the previously cramped `Sign In` + `Get Started` button row has been replaced with a single segmented control (`role="tablist"`, `data-testid="header-auth-tabs"`) that mirrors the same Sign In / Sign Up tab pair used on `/login`. A dedicated `Join as Partner` chip with a 44px touch target sits next to the tab pair on medium-and-up viewports. The accidental-click problem between the Sign In and Sign Up buttons is gone because the two options now share a single bordered container with mutually-exclusive active states.
- **Mobile Sign In button outside the hamburger menu** ([src/pages/Home.tsx](file://d:\DevCenter\abuilds\fina\finaflow\src\pages\Home.tsx)) — a separate, prominent Sign In button (`data-testid="header-mobile-signin"`, 44px min-height) is always visible from `sm:` upward, so users can sign in on phones without opening the menu. The hamburger now only contains marketing links, the Get Started CTA, and the Join as Partner CTA — Sign In is never buried.
- **"Already have an account? Sign In" full-width CTAs** — added in three places: directly under the Sign Up submit button on `/login` (`data-testid="account-cta-signin"`, 48px min-height), below the primary Get Started Free + Join as Partner buttons in the hero section (`data-testid="hero-account-cta"`, 48px min-height), and under the Partner Program section (`data-testid="partner-account-cta"`) using translucent styling so it stays legible against the dark gradient background.
- **Password visibility toggles with `aria-pressed` state** — the credentials form's password input, the signup form's password input, and the confirm-password input each render an Eye / EyeOff toggle (`aria-label`, `aria-pressed`) sized to a 44px touch target so the affordance is reachable on mobile without occluding the field.
- **Native HTML `autoComplete` hints across every auth input** — `username` on the account ID and username fields, `current-password` on the credentials form, `new-password` on signup + confirm, `name` on the full-name field, `email`, `tel`, and `organization`. Password managers can now offer to fill returning users.
- **Improved in-line error messaging** — failed logins and account lookups now render the error message both in a Sonner toast AND directly under the affected field with a red `X` icon and `role="alert"`, so users who dismissed the toast still see what went wrong.

### Changed
- **Login flow tab semantics** ([src/pages/Login.tsx](file://d:\DevCenter\abuilds\fina\finaflow\src\pages\Login.tsx)) — introduced an `Intent` type ("login" | "signup") that sits above the existing `accountLookup` / `credentials` / `signup` step state. Toggling the intent tab clears stale error surfaces but never wipes form data.
- **Home header navigation grouping** ([src/pages/Home.tsx](file://d:\DevCenter\abuilds\fina\finaflow\src\pages\Home.tsx)) — marketing nav links collapse into a single `lg:` viewport (was `md:`) so the tabbed auth control + partner CTA can always sit in the top-right even on tablets.

### Fixed
- **Sign In tab missing on the registration page** — users on `/login?type=partner` or `/login?type=standard` previously saw no path back to Sign In without manually editing the URL.
- **Header Sign In button hidden behind the mobile hamburger** — the small text-style "Sign In" link was only visible at `md:` viewports, forcing phone users to open the menu.
- **Sign Up submit button below WCAG 2.1 48x48 touch target** — the previous `Button` defaulted to `h-9` (36px). The Sign Up submit button is now `min-h-[52px]`.

### Files
- **Modified** — `src/pages/Login.tsx`, `src/pages/Home.tsx`
- **Added** — `src/pages/__tests__/Login.test.tsx`, `src/pages/__tests__/Home.test.tsx`

## [Unreleased] — Multi-Location Assignment & Role Synchronization

### Added
- **Multi-location assignment support** — Users can now be assigned to multiple locations with a primary designation. The new `user_locations` junction table supports many-to-many relationships between users and locations.
- **Audit logging for role changes** — All role and location assignment changes are now logged with the `logAuditEvent` function, tracking what changed, who made the change, and when.
- **Role synchronization across tables** — When a user's role is updated, the change is automatically synchronized to the `userBusinesses` junction table to maintain consistency.

### Changed
- **Users list endpoint** — Now returns `locations` array for each user containing `{ locationId, isPrimary }` objects instead of just a single `locationId`.
- **User creation** — Now supports `locationIds` array for multi-location assignment. The first location in the array is marked as primary.
- **User update** — Now supports `locationIds` array for updating multi-location assignments. All existing assignments are deactivated and replaced with the new set.

### Fixed
- **Role synchronization defect** — Fixed the issue where updating a user's role in the user management interface would not reflect in the business section's role selector. The `updateUserRole` mutation now synchronizes role changes to the `userBusinesses` table.
- **Audit trail gaps** — All user modifications (create, update, delete, role change) are now logged with comprehensive audit events.

### Database
- **New table: `user_locations`** — Junction table with columns: `id`, `userId`, `locationId`, `isPrimary`, `isActive`, `assignedAt`, `assignedBy`.
- **Migration: `0013_user_locations.sql`** — Creates the table, indexes, and migrates existing single-location assignments.
- **Schema updates** — Added `userLocations` table definition and `UserLocation` type to `db/schema.ts`.

### API Changes
- `users.list` — Returns users with `locations` array.
- `users.get` — Returns user with `locations` array.
- `users.create` — Accepts `locationIds` array.
- `users.update` — Accepts `locationIds` array for multi-location updates.
- `users.getUserLocations` — New endpoint to fetch location assignments for a user.
- `permissions.updateUserRole` — Now synchronizes role to `userBusinesses` and logs audit events.

### Files Modified
- `db/schema.ts` — Added `userLocations` table definition.
- `db/migrations/0013_user_locations.sql` — New migration for multi-location support.
- `api/users-router.ts` — Updated to support multi-location assignments.
- `api/permissions-router.ts` — Fixed role synchronization and added audit logging.
- `api/lib/audit.ts` — Already had `logAuditEvent` function.

## [Unreleased] — Hero Headline Rotation: 3× Slower

### Changed
- **Hero headline + subtitle rotation interval tripled** — The `rotationMs` default in [RotatingHeadline.tsx](file:///d:\DevCenter\abuilds\fina\finaflow\src\components\landing\RotatingHeadline.tsx) bumped from `5500` to `16500` (5.5s → 16.5s, exactly 3× as requested). The same five A/B variations now stay on screen long enough to actually be read, with the crossfade animation duration unchanged at 0.55s. The total cycle through all five variations is now ~82s (was ~27.5s), giving each headline a real chance to land instead of flickering past. The 0.55s enter/exit blur-and-slide motion stays — only the dwell time between variations changed.

### Files
- `src/components/landing/RotatingHeadline.tsx` — `rotationMs` default `5500` → `16500`

## [Unreleased] — Hero Headline: Simplified Wording + Industry Variations

### Changed
- **Hero headlines restructured to single-line** — The 4 two-line variations (line1 + line2 with a gradient accent) were the root cause of the "headline bleeding into subtitle" overlap. Swapped to a single-line structure with a single `headline` field, so the headline always renders as one wrapped line on mobile or one straight line on desktop. Gradient direction flipped from `bg-gradient-to-br` (diagonal) to `bg-gradient-to-r` (horizontal) which reads more naturally on a single line. Font size retuned from `text-[2.5rem] md:text-[3.5rem]` to `text-[1.75rem] md:text-[2.75rem]` — slightly smaller so the longer variations don't dominate the hero. Headline container `min-h` bumped to `min-h-[6.5rem] md:min-h-[3.75rem]` to accommodate the longest variation on mobile without layout shift.
- **Headline text rewritten for directness** — Old "Your Business Finances, / Finally Made Simple" → new "Business Finances finally made simple". Old "Losing Track of Your / Bills and Expenses?" → new "Losing track of bills and expenses". Old "See Every Shilling. / In Real Time." → new "See every coin in real time". The conversational lowercase ("finally", "every", "in") and tighter phrasing cut the hero message in half — punchier, less corporate, fewer syllables before the value prop lands.

### Added
- **`construction` headline variation** — "Construction Expenses, finally at your fingertips" with a project-level subtitle ("Track every shilling across materials, labor, and subcontractors — with project-level visibility. No more guessing where the budget went, no more end-of-month pile of receipts to reconcile."). Targets the construction / contractor segment where job-costing and project visibility are the primary pain.
- **`budget` headline variation** — "Budgeted Expenses, finally Aligned." with a budget-discipline subtitle ("Plan it, track it, stay on it. Finaflow keeps every department aligned to the same budget in real time — with variance alerts before you blow past the line, not after."). Targets finance leads who care about plan-vs-actual.
- The hero now rotates through **5 A/B variations** total (pain-point, aspirational, clarity, construction, budget) on a 5.5s cycle, so the same visitor sees five different value propositions in one session.

### Files
- `src/components/landing/RotatingHeadline.tsx` — switched from `{ line1, line2 }` to `{ headline }`, added construction + budget variations, horizontal gradient, smaller font, bigger mobile min-h
- `src/components/landing/__tests__/RotatingHeadline.tsx` — switched from `{ line1, line2 }` to `{ headline }`, added construction + budget variations, horizontal gradient, smaller font, bigger mobile min-h

