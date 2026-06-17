# Plan: Fix Payment Method-Branch Linking & User-Location Assignment Issues

## Summary

Investigate and resolve critical linking and permission issues in the account-payment method-branch association workflow. The system has three interrelated bugs: (1) payment methods can only be linked to the HQ/ALL branch, (2) user-location assignments fail to save for non-HQ branches, and (3) location assignments silently fail when an account is selected.

## Current State Analysis

### Architecture Overview

- **Database**: `user_locations` junction table maps users to locations (multi-tenant). `location_payment_methods` maps payment methods to locations.
- **Backend**: tRPC routers in `api/` with permission middleware. `getAuthorizedLocationIds()` returns all locations for owners/admins.
- **Frontend**: Users page has "Manage Locations" dialog. Accounts page has "Tag to Branches" dialog.

### Key Files
| File | Role |
|------|------|
| `api/middleware.ts` | Permission guards: `requireAuthorizedLocation`, `getAuthorizedLocationIds` |
| `api/payment-methods-router.ts` | `assignToLocation` mutation for linking PMs to branches |
| `api/users-router.ts` | `syncUserLocationAssignments`, `setUserLocations`, `update` mutations |
| `api/permissions-router.ts` | `updateUserRole` mutation -- silently drops `locationIds` |
| `api/context.ts` | Loads `assignedLocationIds` from `user_locations` |
| `src/pages/Users.tsx` | User management UI with locations dialog |
| `src/pages/Accounts.tsx` | Payment method "Tag to Branches" dialog |

### Root Causes

#### Bug 1: Payment method linking fails for non-HQ branches
**Root Cause**: Cascade from Bug 2. When user-location assignments fail to save, `assignedLocationIds` in the context only contains the HQ branch. The `getAuthorizedLocationIds` function in middleware.ts correctly returns all locations for owners, but the **indirect** issue is that when `enforceUserLocation` is ON and user assignments are incomplete, downstream components (LocationSelector) behave incorrectly.

**Secondary bug**: The `permissions.updateUserRole` mutation at [permissions-router.ts:131](file:///d:/DevCenter/abuilds/fina/finaflow/api/permissions-router.ts#L131) destructures `locationIds` and never syncs them to `user_locations`.

#### Bug 2: User-location assignments only save the original HQ branch
**Root Cause 1**: `syncUserLocationAssignments` deletes ALL records then re-inserts. If empty array is passed, all assignments are lost.

**Root Cause 2**: `permissions.updateUserRole` at [permissions-router.ts:147](file:///d:/DevCenter/abuilds/fina/finaflow/api/permissions-router.ts#L147) strips `locationIds` via destructuring and never calls `syncUserLocationAssignments`.

**Root Cause 3**: Frontend `editForm.locationIds` might be stale when edit dialog opens.

#### Bug 3: Location assignments fail when account is selected
**Root Cause**: `setUserLocations` validates each location ID with `requireAuthorizedLocation`. If selecting an account changes the user's business context, authorization fails for locations belonging to the original business. This is a context-switching issue.

## Proposed Changes

### Change 1: Fix `permissions.updateUserRole` to handle `locationIds`
**File**: `api/permissions-router.ts`

**What**: Add location assignment syncing to `updateUserRole`. After the user update transaction, if `locationIds` was passed, call `syncUserLocationAssignments`.

**Why**: Currently multi-location assignments are silently dropped during role updates.

### Change 2: Guard `syncUserLocationAssignments` against empty arrays
**File**: `api/users-router.ts`

**What**: Add a guard to skip sync when `locationIds` is empty. If called with `[]`, log a warning and return without deleting existing records.

**Why**: Prevents accidental loss of all location assignments.

### Change 3: Auto-assign owner to newly created locations
**File**: `api/locations-router.ts`

**What**: After location creation, if creating user is owner, add `user_locations` record for the new location.

**Why**: Eliminates manual assignment gaps where owners create branches but aren't assigned to them.

### Change 4: Add owner assign-to-all-locations mutation + UI
**Files**: `api/locations-router.ts` (new mutation), `src/pages/Locations.tsx` (UI button)

**What**: New tRPC mutation `assignOwnerToAll` and a button visible to owners on the Locations page.

**Why**: Allows owners to quickly gain access to all branches.

### Change 5: Pre-check default location in user location modal
**File**: `src/pages/Users.tsx`

**What**: When opening the Manage Locations dialog, if `locationIds` is empty but user has a legacy `locationId`, pre-check that location.

**Why**: Prevents confusion and data loss when users only have legacy single-location set.

### Change 6: Filter branch dropdown in Tag to Branches by user access
**File**: `src/pages/Accounts.tsx`

**What**: Filter the branch dropdown using `user?.assignedLocationIds` when `enforceLocationAssignment` is ON.

**Why**: Prevents FORBIDDEN errors from assigning to inaccessible branches.

### Change 7: Improve mutation error messages
**File**: `src/pages/Accounts.tsx`

**What**: Enhance `assignToLoc.onError` to display detailed error messages.

## Assumptions & Decisions

1. Owner bypass in `getAuthorizedLocationIds` is intentional and unchanged.
2. `syncUserLocationAssignments` is the single source of truth for all location syncs.
3. UI changes are minimal -- only fixing data flow and adding pre-selection.

## Verification Steps

1. `npm run lint` -- no new errors
2. `npm run check` -- no type errors
3. `npm test` -- all existing + new tests pass
4. Manual: create branch -> owner auto-assigned, assign locations -> all save, link PM to non-HQ -> success