# Plan: Business Overview & Location Consolidation

## Goal

Transform the current businesses page into a rich, hierarchical experience where a user can:

1. See a list of businesses (current Businesses.tsx)
2. Click into a **Business Overview page** showing all profile details (from multi-step wizard)
3. Edit business details via the multi-step wizard (opened as a dialog)
4. See, create, and delete **business locations** directly from the overview
5. Reduce sidebar clutter by embedding locations within the business context

***

## Architecture Overview

```
/businesses          → Businesses.tsx (list - keep as-is, enhance card actions)
/businesses/:id      → BusinessOverview.tsx (NEW - consolidated read-only overview + locations)
/businesses/:id/edit → BusinessDetails.tsx (multi-step wizard - reuse as dialog)
/locations           → Locations.tsx (keep for backward compat, or redirect)
```

The **BusinessOverview** page will be the central hub:

* Top section: Read-only display of all business profile fields

* Middle section: Documents & logo summary

* Bottom section: Full locations CRUD (embedded, using the same card pattern from Locations.tsx)

* Action buttons: "Edit Business Details" (opens multi-step wizard dialog)

***

## Step-by-Step Implementation

### Step 1: Add new route for Business Overview in App.tsx

**File:** **`src/App.tsx`**

* Add lazy import for `BusinessOverview`

* Add route: `<Route path="/businesses/:id" ...`

* Ensure `BusinessDetails` route stays at `/businesses/:id/details` (for direct navigation)

* Both routes require `business:manage` permission

### Step 2: Create `BusinessOverview.tsx` — the core new page

**File:** **`src/pages/BusinessOverview.tsx`** (NEW)

This page will:

* Use `useParams` to get the `id`

* Fetch business data via `trpc.businesses.get.useQuery({ id })`

* Fetch locations via `trpc.locations.list.useQuery()` (already bound to active business)

* Fetch documents via `trpc.businesses.getDocuments.useQuery({ businessId })`

* Fetch logo via `trpc.businesses.getActiveLogo.useQuery({ businessId })`

**Sections:**

| Section               | Content                                               | Source                                                                       |
| --------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| Header                | Business name, status badge, account ID, plan badge   | `businesses.get`                                                             |
| Quick Stats           | Branch count, document count, user count              | computed                                                                     |
| Business Info Card    | Name, type, reg number, KRA PIN, nature, phone, email | `businesses.get`                                                             |
| Address Card          | Country, county, sub-county, address                  | `businesses.get`                                                             |
| Account Info Card     | Account ID, plan, status                              | `businesses.get`                                                             |
| Documents Card        | List of uploaded docs with download                   | `businesses.getDocuments` + `businesses.downloadDocument`                    |
| Logo Section          | Logo preview, upload/replace                          | `businesses.getActiveLogo`                                                   |
| **Locations Section** | Full CRUD for locations — card grid                   | `locations.list`, `locations.create`, `locations.update`, `locations.delete` |

**Key Interaction:**

* "Edit Business Details" button opens the multi-step wizard as a **Dialog** (reusing the `BusinessDetails` form content inside a dialog)

* Each location card has edit/delete actions

* "Add Branch" button opens a dialog (same as current Locations.tsx)

**Implementation approach:**

* Extract the multi-step form content from `BusinessDetails.tsx` into a reusable component `BusinessDetailsForm` so it can be embedded in a dialog

* OR: Simply navigate to `/businesses/:id/details` when Edit is clicked (simpler, less refactoring)

* For locations CRUD: Replicate the pattern from `Locations.tsx` but directly in the overview

### Step 3: Enhance Businesses.tsx card actions

**File:** **`src/pages/Businesses.tsx`**

* Update the "Details" button to navigate to `/businesses/${b.id}` (overview) instead of `/businesses/${b.id}/details`

* Make the entire card clickable to navigate to the overview

* Add a "Quick Edit" inline toggle (keep existing behavior)

* Keep the "Switch" and "Reset" controls

### Step 4: (Optional) Redirect /locations → businesses overview

**File:** **`src/App.tsx`** or `Locations.tsx`

* Add a redirect from `/locations` to `/businesses` with a section param like `?section=locations`

* Or keep `/locations` for users who want standalone access but update it to show a nav back to business overview

### Step 5: (Optional) Extract reusable BusinessDetailsForm

**File:** **`src/features/business-profile/BusinessDetailsForm.tsx`** (NEW)

* Extract the multi-step form from `BusinessDetails.tsx` into a reusable component

* Accept props: `businessId`, `business`, `onSave`

* `BusinessDetails.tsx` then becomes a thin wrapper that renders `BusinessDetailsForm` inside a full page

* `BusinessOverview.tsx` renders the same `BusinessDetailsForm` inside a Dialog

***

## File Changes Summary

| File                                                    | Action                                                               |
| ------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/App.tsx`                                           | Add route `/businesses/:id` → BusinessOverview                       |
| `src/pages/BusinessOverview.tsx`                        | **CREATE** — Main overview page with all details + locations CRUD    |
| `src/pages/Businesses.tsx`                              | **MODIFY** — Update "Details" link to go to overview page            |
| `src/pages/Locations.tsx`                               | **MODIFY** — Add back-link to business overview (or keep standalone) |
| `src/features/business-profile/BusinessDetailsForm.tsx` | **CREATE** (optional) — Reusable multi-step form component           |

***

## Data Flow

```
Businesses.tsx (list)
      │  click "View" / click card
      ▼
BusinessOverview.tsx
      │  displays all business fields (read-only)
      │  displays locations (with CRUD)
      │  click "Edit Business Details"
      ▼
  Dialog: BusinessDetailsForm (multi-step wizard)
      │  OR navigate to /businesses/:id/details
```

***

## Key Design Decisions

1. **Locations scope**: `locations.list` already filters by the current active business context. The overview will show locations for the viewed business. If the viewed business is not the active one, we need an API that fetches locations by businessId. We may need to add `locations.listByBusinessId` procedure.

2. **Edit approach**: Opening the multi-step wizard as a dialog is more seamless. But navigating to `/businesses/:id/details` is simpler. We'll start with navigation and optionally upgrade to dialog later.

3. **Backend changes**: If `locations.list` only returns locations for the active business, we need to add `locations.listByBusinessId(businessId)` so the overview can show locations for any business the user has access to.

4. **Responsive layout**: The overview page should work well on mobile with collapsible sections.

***

## Acceptance Criteria

* [ ] Clicking a business in the list navigates to `/businesses/:id`

* [ ] Overview page shows all business profile fields in a clean read-only layout

* [ ] "Edit Business Details" button opens the multi-step setup wizard

* [ ] Locations section shows all branches with details (name, address, accounts)

* [ ] "Add Branch" creates a new location for this business

* [ ] Edit/delete actions work on each location

* [ ] Document list shows uploaded documents with download

* [ ] Logo section shows preview and upload controls

* [ ] All existing functionality (switch, reset, inline edit) is preserved on the list page

* [ ] Navigation is intuitive — user always knows which business they are viewing

