# Business Profile Management (Phase 1) Design

## Scope
Phase 1 delivers a complete business profile detail experience in the Businesses module with:
- Full business detail view
- Print-ready business profile output
- Document list with metadata
- Secure document download with access control and audit logging

Out of scope for Phase 1:
- Logo upload and optimization
- Reusable letterhead generation (planned for Phase 2)
- Storage migration away from current DB base64 document storage

## Goals
- Allow users to enter a specific business profile and view complete business details in one place.
- Provide a professional printable profile document with business + documents summary.
- Expose secure per-document download for authorized business members only.
- Preserve current architecture patterns and avoid broad refactors.

## Constraints and Decisions
- Keep existing `businessDocuments.fileData` base64 storage for fastest delivery.
- Reuse current route: `/businesses/:id/details`.
- Enforce business membership checks for all document read/download operations.
- Record audit events for document downloads.

## Existing System Context
- Frontend detail page: `src/pages/BusinessDetails.tsx`
- Businesses actions page: `src/pages/Businesses.tsx`
- API router: `api/businesses-router.ts`
- Existing docs endpoints:
  - `uploadDocument`
  - `getDocuments`
  - `deleteDocument`

## Proposed Architecture

### Frontend
Enhance `BusinessDetails` with three clear sections:
1. **Profile Summary**
   - Display complete business details:
   - Name, account ID, registration number, business type
   - Contact details (phone/email)
   - Address (country/county/sub-county/address)
   - Plan and operational status
2. **Documents Table**
   - Metadata columns: name, document type, upload date, file size
   - Actions: download (and existing delete where allowed)
3. **Print Action**
   - `Print Profile` button calling `window.print()`
   - Print CSS that outputs a clean profile + document summary only

Componentization (same file or extracted):
- `BusinessProfileSummary`
- `BusinessDocumentsTable`
- print-only header metadata block

### Backend
Extend `businesses-router` with:
1. `getDocumentsDetailed({ businessId })`
   - Returns scoped document metadata with:
   - `id`, `fileName`, `documentType`, `mimeType`
   - `createdAt`, `uploadedBy`
   - computed `fileSizeBytes`
2. `downloadDocument({ documentId })`
   - Resolves the document + owning business
   - Verifies current user membership for that business
   - Returns `fileName`, `mimeType`, `fileData`
   - Writes audit record for download action

## Data Flow
1. User opens business details page.
2. Frontend loads business data + detailed document metadata query.
3. User clicks download:
   - Frontend calls `downloadDocument`.
   - Backend validates access and logs audit.
   - Frontend decodes base64 payload and triggers browser download.
4. User clicks print:
   - Browser print preview renders profile + docs summary in print layout.

## Security Model
- All profile/doc endpoints remain authenticated.
- Membership check required for business document list/download.
- Deny access with clear forbidden errors for cross-business attempts.
- Audit logging captures:
  - userId
  - businessId
  - documentId
  - filename
  - action type (`DOWNLOAD`)

## UX and Error Handling
- Loading states:
  - profile loading
  - document list loading
  - per-row download pending
- Empty states:
  - no business data
  - no documents uploaded
- Error states:
  - failed metadata fetch
  - unauthorized download
  - download processing failures
- Feedback:
  - success/error toasts for download and print failures
- Responsive behavior:
  - table wraps/scrolls on small screens
  - profile summary uses stacked mobile layout

## Print Design
- Use `@media print` rules to:
  - Hide navigation, buttons, interactive controls
  - Show document summary table and profile details
  - Apply consistent typography and spacing for official printing
  - Keep sections page-break-safe (`break-inside: avoid`)
- Include generated metadata (date/time) in print header area.

## Testing Strategy

### Backend Tests
- `getDocumentsDetailed` returns only documents for accessible businesses.
- `downloadDocument` rejects unauthorized user access.
- `downloadDocument` returns expected payload for authorized users.
- Download writes audit log with expected metadata.

### Frontend Tests
- Profile summary renders all required business fields.
- Documents table renders all metadata columns.
- Download action calls API and handles success/error flows.
- Print action exists and triggers print behavior.

### Manual Validation
- Desktop and mobile visual checks for summary/documents layout.
- Print preview verification in Chromium/Edge.
- Unauthorized access simulation by user/business context mismatch.

## Rollout
- Feature remains isolated to Businesses and BusinessDetails modules.
- No changes to accounting/ledger transaction logic.
- Phase 1 completion criteria:
  - Full profile detail view shipped
  - Printable profile shipped
  - Secure document download + audit logging shipped

## Phase 2 Preview
After Phase 1 approval and stabilization:
- Logo upload with validation (JPEG/PNG/SVG, max 5MB)
- Image optimization for display
- Reusable branded letterhead generation component
