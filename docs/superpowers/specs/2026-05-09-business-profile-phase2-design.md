# Business Profile Management (Phase 2) Design

## Scope
Phase 2 delivers branded identity and letterhead capabilities for the Businesses module with:
- Logo upload/replace/delete management
- Backend-enforced logo validation and access control
- Client-side image optimization (max width 512px for raster images)
- Reusable letterhead component applied to Business Profile print output

Out of scope for Phase 2:
- Object storage migration
- PDF export pipeline
- Cross-module rollout (invoices/reports) beyond reusable component readiness

## Goals
- Let businesses upload and manage an official logo for profile branding.
- Enforce strict upload constraints for security and consistency.
- Generate a reusable branded letterhead on printed business profile output.
- Preserve existing architecture patterns with minimal refactor risk.

## Decisions
- Use a dedicated `business_logos` table for clean metadata/version tracking.
- Keep storage in DB for now (base64 payload), matching current document strategy.
- Support `image/jpeg`, `image/png`, and `image/svg+xml` only.
- Enforce max input size of 5MB.
- Optimize JPEG/PNG on frontend to max 512px width before upload.
- Apply letterhead in print-only Business Profile output first.

## Existing Context
- Current page: `src/pages/BusinessDetails.tsx`
- Current backend router: `api/businesses-router.ts`
- Existing business document storage and secure list/download patterns already implemented in Phase 1
- Existing print entry point: `Print Profile` in Business Details

## Proposed Architecture

### Data Model
Add new table: `business_logos`
- `id` (pk)
- `businessId` (fk -> businesses.id, indexed)
- `fileName` (string)
- `mimeType` (string)
- `fileData` (base64 string, optimized for raster uploads)
- `width` (number, nullable for SVG if not parsed)
- `height` (number, nullable for SVG if not parsed)
- `sizeBytes` (number)
- `isActive` (boolean, default true)
- `uploadedBy` (fk -> users.id)
- `createdAt`, `updatedAt`, `deletedAt`

Behavior:
- Keep historical records by deactivating prior active logo on new upload.
- Exactly one active logo per business enforced in service-layer transaction.

### Backend API
Extend `businesses-router` with:
1. `uploadLogo`
- Input: `businessId`, `fileName`, `mimeType`, `fileData`, `width`, `height`, `sizeBytes`
- Checks:
  - membership authorization
  - allowed MIME type
  - max input size (<= 5MB)
- Transaction:
  - set previous active logo(s) to inactive
  - insert new active logo
- Audit log action: `UPLOAD_LOGO` on `business_logos`

2. `getActiveLogo`
- Input: `businessId`
- Returns active logo payload + metadata
- Membership check required

3. `deleteLogo`
- Input: `businessId` (or active logo id scoped to business)
- Soft-delete and deactivate active logo
- Audit log action: `DELETE_LOGO`

Error semantics:
- unauthorized membership -> explicit access error
- invalid MIME -> validation error
- oversize payload -> validation error
- missing logo -> not found style error for delete/get where applicable

### Frontend
Enhance `BusinessDetails` with a new **Logo Management** block:
- Current logo preview (when available)
- Upload control with immediate validation:
  - file type check
  - 5MB max size check
- Replace logo workflow (same upload path)
- Delete logo action
- Success/error toasts and loading states for upload/delete/fetch

Client optimization pipeline:
- JPEG/PNG:
  - read file
  - draw to canvas
  - resize to max width 512px preserving aspect ratio
  - export optimized base64 and measured dimensions/bytes
- SVG:
  - validate MIME and size
  - pass through source payload

### Reusable Letterhead Component
Create `BusinessLetterhead` component:
- Inputs: `business`, `logo`, `generatedAt`
- Output:
  - left/right aligned branded header with logo, business name, contact and address lines
- Behavior:
  - normal display hidden unless print mode context requires
  - print mode: rendered at top of Business Profile

Designed for reuse:
- isolate styles and props so invoices/reports can consume later without changing core logic

### Print Integration
- Insert `BusinessLetterhead` at the top of print output in `BusinessDetails`.
- Keep print-safe behavior from Phase 1:
  - hide interactive controls
  - preserve profile/doc sections
  - maintain page-break-friendly sections
- Ensure logo scales cleanly in print (max height guard).

## Security Model
- All logo operations require authentication and business membership.
- Backend remains source of truth regardless of frontend checks.
- All logo create/delete actions are audit logged with user/business/resource metadata.
- Only active, non-deleted logos are returned by `getActiveLogo`.

## UX and Error Handling
- Frontend states:
  - loading active logo
  - upload in progress
  - delete in progress
  - empty state when no logo configured
- Error messages:
  - unsupported format
  - file exceeds 5MB
  - optimization failure
  - backend rejection/access error
- Responsive:
  - logo preview and controls stack on mobile
  - letterhead remains readable at narrow widths and in print preview

## Testing Strategy

### Backend Tests
- `uploadLogo` accepts valid MIME/size and writes active logo row.
- `uploadLogo` rejects unsupported MIME.
- `uploadLogo` rejects payload larger than 5MB.
- `uploadLogo` deactivates prior active logo within same business.
- `getActiveLogo` returns only active non-deleted logo for authorized member.
- `deleteLogo` soft-deletes active logo and logs audit event.
- Cross-business requests are denied.

### Frontend Tests
- File validation rejects wrong MIME and oversize payload pre-upload.
- Raster optimization helper resizes width to <=512 and preserves ratio.
- SVG path bypasses raster optimization and uploads raw payload.
- `BusinessDetails` renders logo preview and actions when logo exists.
- `BusinessLetterhead` renders in print block with business + logo data.

### Manual Validation
- Upload JPEG, PNG, SVG successfully and verify preview.
- Replace existing logo and verify latest active logo is displayed.
- Delete logo and verify fallback/empty state.
- Print preview in Chromium/Edge confirms letterhead appears and controls are hidden.
- Verify cross-business access denies logo fetch/upload/delete.

## Rollout
- Isolated feature release in Businesses module and schema migration.
- No dependency on Accounts/Ledger transaction flows.
- Backward compatible when business has no logo configured.

## Phase 2 Completion Criteria
- Business users can upload, replace, and delete logos with validation.
- Optimized raster logos are stored and rendered correctly.
- Business Profile print output includes reusable letterhead.
- Security and audit coverage are enforced and validated by tests.
