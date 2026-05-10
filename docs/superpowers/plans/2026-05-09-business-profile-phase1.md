# Business Profile Management (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a complete business profile view with print support and secure document metadata/download management in the Businesses module.

**Architecture:** Extend the existing `BusinessDetails` route and `businesses-router` with focused, reusable helpers. Keep DB base64 document storage, add strict business-membership checks for list/download APIs, and add audit logging on download operations. Implement print-safe UI via `@media print` and a structured profile summary + documents table.

**Tech Stack:** React 19, TypeScript, tRPC, Drizzle ORM, Vitest, Sonner toasts, existing audit logger.

---

## File Structure And Responsibilities

- **Create:** `api/lib/business-documents.ts`
- Responsibility: reusable document utilities (file-size calculation, filename sanitization, mime fallback).

- **Create:** `api/__tests__/business-documents-utils.test.ts`
- Responsibility: unit tests for pure business-document utility behavior.

- **Modify:** `api/businesses-router.ts`
- Responsibility: add `getDocumentsDetailed` and `downloadDocument` procedures with access control + audit logging.

- **Create:** `api/__tests__/business-documents-router-contract.test.ts`
- Responsibility: verify router input schemas and download payload shaping helpers.

- **Create:** `src/features/business-profile/formatters.ts`
- Responsibility: client-side formatting helpers for file size and print metadata.

- **Create:** `src/features/business-profile/__tests__/formatters.test.ts`
- Responsibility: unit tests for frontend formatting helpers.

- **Modify:** `src/pages/BusinessDetails.tsx`
- Responsibility: full profile summary view, documents metadata table, secure download action, print button and print-only blocks.

- **Create:** `src/pages/__tests__/business-details-profile.test.tsx`
- Responsibility: render-level checks for profile summary fields, docs metadata columns, and print action visibility.

## Task 1: Add Backend Document Utility Layer

**Files:**
- Create: `api/lib/business-documents.ts`
- Test: `api/__tests__/business-documents-utils.test.ts`

- [ ] **Step 1: Write the failing utility tests**

```ts
import { describe, expect, it } from "vitest";
import {
  base64SizeBytes,
  sanitizeDownloadFileName,
  resolveMimeType,
} from "../lib/business-documents";

describe("business document utils", () => {
  it("calculates byte size from base64 payload", () => {
    expect(base64SizeBytes("SGVsbG8=")).toBe(5);
  });

  it("sanitizes unsafe filename characters", () => {
    expect(sanitizeDownloadFileName("../../tax:cert?.pdf")).toBe("tax-cert-.pdf");
  });

  it("falls back mime type when none provided", () => {
    expect(resolveMimeType(undefined)).toBe("application/octet-stream");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api/__tests__/business-documents-utils.test.ts`  
Expected: FAIL with module/function-not-found errors.

- [ ] **Step 3: Write minimal utility implementation**

```ts
// ABOUTME: Utilities for business document metadata and download-safe naming.
// ABOUTME: Keeps router logic focused on access control and persistence.
export function base64SizeBytes(base64: string): number {
  const cleaned = (base64 || "").replace(/\s/g, "");
  if (!cleaned) return 0;
  const padding = cleaned.endsWith("==") ? 2 : cleaned.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((cleaned.length * 3) / 4) - padding);
}

export function sanitizeDownloadFileName(fileName: string): string {
  const cleaned = (fileName || "document.bin")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "");
  return cleaned || "document.bin";
}

export function resolveMimeType(mimeType?: string | null): string {
  return mimeType && mimeType.trim().length > 0 ? mimeType : "application/octet-stream";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- api/__tests__/business-documents-utils.test.ts`  
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add api/lib/business-documents.ts api/__tests__/business-documents-utils.test.ts
git commit -m "feat: add business document utility helpers"
```

## Task 2: Add Secure Document Metadata And Download Procedures

**Files:**
- Modify: `api/businesses-router.ts`
- Test: `api/__tests__/business-documents-router-contract.test.ts`

- [ ] **Step 1: Write failing contract tests for new router exports**

```ts
import { describe, expect, it } from "vitest";
import {
  downloadDocumentInputSchema,
  getDocumentsDetailedInputSchema,
  mapDownloadPayload,
} from "../businesses-router";

describe("business documents router contracts", () => {
  it("accepts valid getDocumentsDetailed input", () => {
    expect(getDocumentsDetailedInputSchema.parse({ businessId: 9 })).toEqual({ businessId: 9 });
  });

  it("rejects invalid download input", () => {
    expect(() => downloadDocumentInputSchema.parse({ documentId: 0 })).toThrow();
  });

  it("maps document row to download payload with safe defaults", () => {
    const payload = mapDownloadPayload({
      fileName: "my cert?.pdf",
      mimeType: null,
      fileData: "SGVsbG8=",
    });
    expect(payload.fileName).toBe("my-cert-.pdf");
    expect(payload.mimeType).toBe("application/octet-stream");
    expect(payload.fileData).toBe("SGVsbG8=");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api/__tests__/business-documents-router-contract.test.ts`  
Expected: FAIL because exports/procedures are missing.

- [ ] **Step 3: Implement router additions with access control and audit logging**

```ts
export const getDocumentsDetailedInputSchema = z.object({ businessId: z.number().int().positive() });
export const downloadDocumentInputSchema = z.object({ documentId: z.number().int().positive() });

export function mapDownloadPayload(row: { fileName: string; mimeType?: string | null; fileData: string }) {
  return {
    fileName: sanitizeDownloadFileName(row.fileName),
    mimeType: resolveMimeType(row.mimeType),
    fileData: row.fileData,
  };
}

// In businessesRouter:
getDocumentsDetailed: businessManage
  .input(getDocumentsDetailedInputSchema)
  .query(async ({ input, ctx }) => {
    const db = getDb();
    const userId = ctx.user!.id;
    const access = await db.select().from(userBusinesses).where(and(
      eq(userBusinesses.userId, userId),
      eq(userBusinesses.businessId, input.businessId),
      eq(userBusinesses.isActive, true),
    )).limit(1);
    if (access.length === 0) throw new Error("You do not have access to this business");

    const rows = await db.select({
      id: businessDocuments.id,
      fileName: businessDocuments.fileName,
      documentType: businessDocuments.documentType,
      mimeType: businessDocuments.mimeType,
      uploadedBy: businessDocuments.uploadedBy,
      createdAt: businessDocuments.createdAt,
      fileData: businessDocuments.fileData,
    }).from(businessDocuments).where(and(
      eq(businessDocuments.businessId, input.businessId),
      isNull(businessDocuments.deletedAt),
    ));

    return rows.map((row) => ({
      id: row.id,
      fileName: row.fileName,
      documentType: row.documentType,
      mimeType: resolveMimeType(row.mimeType),
      uploadedBy: row.uploadedBy,
      createdAt: row.createdAt,
      fileSizeBytes: base64SizeBytes(row.fileData),
    }));
  }),

downloadDocument: businessManage
  .input(downloadDocumentInputSchema)
  .mutation(async ({ input, ctx }) => {
    const db = getDb();
    const userId = ctx.user!.id;
    const [doc] = await db.select().from(businessDocuments)
      .where(and(eq(businessDocuments.id, input.documentId), isNull(businessDocuments.deletedAt)))
      .limit(1);
    if (!doc) throw new Error("Document not found");

    const access = await db.select().from(userBusinesses).where(and(
      eq(userBusinesses.userId, userId),
      eq(userBusinesses.businessId, doc.businessId),
      eq(userBusinesses.isActive, true),
    )).limit(1);
    if (access.length === 0) throw new Error("You do not have access to this business");

    await logAudit({
      userId,
      businessId: doc.businessId,
      action: "DOWNLOAD",
      resource: "business_documents",
      resourceId: doc.id,
      details: { fileName: doc.fileName, mimeType: doc.mimeType },
    });

    return mapDownloadPayload(doc);
  }),
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- api/__tests__/business-documents-router-contract.test.ts api/__tests__/business-documents-utils.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/businesses-router.ts api/__tests__/business-documents-router-contract.test.ts
git commit -m "feat: add secure business document metadata and download API"
```

## Task 3: Add Frontend Formatting Helpers And Tests

**Files:**
- Create: `src/features/business-profile/formatters.ts`
- Test: `src/features/business-profile/__tests__/formatters.test.ts`

- [ ] **Step 1: Write failing formatter tests**

```ts
import { describe, expect, it } from "vitest";
import { formatFileSize, buildPrintGeneratedLabel } from "../formatters";

describe("business profile formatters", () => {
  it("formats bytes to KB with one decimal", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats large values to MB", () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("builds print generated label with account id", () => {
    const label = buildPrintGeneratedLabel("ACCT123", new Date("2026-05-09T10:00:00.000Z"));
    expect(label).toContain("ACCT123");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/business-profile/__tests__/formatters.test.ts`  
Expected: FAIL due to missing file/functions.

- [ ] **Step 3: Implement minimal formatters**

```ts
// ABOUTME: Presentation helpers for business profile metadata and print labels.
// ABOUTME: Keeps BusinessDetails component focused on rendering and interactions.
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildPrintGeneratedLabel(accountId: string, at: Date): string {
  return `Generated ${at.toLocaleString("en-KE")} · Account ${accountId}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/business-profile/__tests__/formatters.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/business-profile/formatters.ts src/features/business-profile/__tests__/formatters.test.ts
git commit -m "feat: add business profile formatting helpers"
```

## Task 4: Implement Profile Summary + Documents Metadata Table + Download UX

**Files:**
- Modify: `src/pages/BusinessDetails.tsx`
- Test: `src/pages/__tests__/business-details-profile.test.tsx`

- [ ] **Step 1: Write failing render tests for profile and documents metadata**

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BusinessDetails } from "../BusinessDetails";

describe("BusinessDetails profile view", () => {
  it("renders profile heading and print button", () => {
    render(<BusinessDetails />);
    expect(screen.getByText(/Business Details/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Print Profile/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/__tests__/business-details-profile.test.tsx`  
Expected: FAIL because `Print Profile` and metadata table are not rendered yet.

- [ ] **Step 3: Implement UI and download flow in `BusinessDetails`**

```tsx
const { data: documentsDetailed, isLoading: docsLoading } = trpc.businesses.getDocumentsDetailed.useQuery(
  { businessId: businessId! },
  { enabled: !!businessId }
);
const downloadDocument = trpc.businesses.downloadDocument.useMutation();

function triggerBase64Download(fileName: string, mimeType: string, fileData: string) {
  const byteChars = atob(fileData);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function handleDownloadDocument(documentId: number) {
  try {
    const payload = await downloadDocument.mutateAsync({ documentId });
    triggerBase64Download(payload.fileName, payload.mimeType, payload.fileData);
    toast.success("Document download started");
  } catch (err: any) {
    toast.error(err.message || "Failed to download document");
  }
}
```

- [ ] **Step 4: Add profile-summary and documents metadata table markup**

```tsx
<section className="rounded-lg border border-[#E8E0D8] bg-white p-4 print:break-inside-avoid">
  <h2 className="font-serif text-lg font-semibold text-[#2D2A26]">Profile Summary</h2>
  <dl className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
    <div><dt className="text-xs text-[#8D8A87]">Business Name</dt><dd className="text-sm text-[#2D2A26]">{form.name || "—"}</dd></div>
    <div><dt className="text-xs text-[#8D8A87]">Registration Number</dt><dd className="text-sm text-[#2D2A26]">{form.businessRegNumber || "—"}</dd></div>
    <div><dt className="text-xs text-[#8D8A87]">Business Type</dt><dd className="text-sm text-[#2D2A26]">{form.businessType || "—"}</dd></div>
    <div><dt className="text-xs text-[#8D8A87]">Operational Status</dt><dd className="text-sm text-[#2D2A26]">{business.isActive ? "Active" : "Inactive"}</dd></div>
  </dl>
</section>

<section className="rounded-lg border border-[#E8E0D8] bg-white p-4 print:break-inside-avoid">
  <h2 className="font-serif text-lg font-semibold text-[#2D2A26]">Business Documents</h2>
  <div className="mt-3 overflow-x-auto">
    <table className="w-full text-sm">
      <thead><tr><th>Name</th><th>Type</th><th>Uploaded</th><th>Size</th><th className="print:hidden">Actions</th></tr></thead>
      <tbody>
        {(documentsDetailed || []).map((doc) => (
          <tr key={doc.id}>
            <td>{doc.fileName}</td>
            <td>{doc.documentType}</td>
            <td>{new Date(doc.createdAt).toLocaleDateString("en-KE")}</td>
            <td>{formatFileSize(doc.fileSizeBytes)}</td>
            <td className="print:hidden">
              <Button size="sm" variant="outline" onClick={() => handleDownloadDocument(doc.id)}>Download</Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</section>
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npm test -- src/pages/__tests__/business-details-profile.test.tsx src/features/business-profile/__tests__/formatters.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/BusinessDetails.tsx src/pages/__tests__/business-details-profile.test.tsx
git commit -m "feat: add business profile summary and secure document downloads"
```

## Task 5: Add Professional Print Layout For Business Profile

**Files:**
- Modify: `src/pages/BusinessDetails.tsx`
- Test: `src/pages/__tests__/business-details-profile.test.tsx`

- [ ] **Step 1: Write failing test for print action presence and generated metadata**

```tsx
it("renders print metadata block", () => {
  render(<BusinessDetails />);
  expect(screen.getByText(/Generated/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/__tests__/business-details-profile.test.tsx`  
Expected: FAIL if metadata block not present.

- [ ] **Step 3: Implement print button and print stylesheet rules**

```tsx
<div className="mb-4 flex items-center justify-end gap-2 print:hidden">
  <Button variant="outline" onClick={() => window.print()}>Print Profile</Button>
</div>
<p className="hidden text-xs text-[#8D8A87] print:block">
  {buildPrintGeneratedLabel(business.accountId || "N/A", new Date())}
</p>

<style>{`
  @media print {
    .print\\:hidden { display: none !important; }
    .print\\:block { display: block !important; }
    body { background: #fff !important; }
    table, tr, td, th { page-break-inside: avoid; }
    section { break-inside: avoid; }
  }
`}</style>
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- src/pages/__tests__/business-details-profile.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Run lint/type checks for touched scope**

Run: `npx eslint src/pages/BusinessDetails.tsx src/pages/__tests__/business-details-profile.test.tsx src/features/business-profile/formatters.ts`  
Expected: PASS or only pre-existing unrelated lint issues.

- [ ] **Step 6: Commit**

```bash
git add src/pages/BusinessDetails.tsx src/pages/__tests__/business-details-profile.test.tsx
git commit -m "feat: add printable business profile layout"
```

## Task 6: End-To-End Verification And Handoff

**Files:**
- Modify: `docs/superpowers/specs/2026-05-09-business-profile-phase1-design.md` (only if final notes are needed)
- Modify: `docs/superpowers/plans/2026-05-09-business-profile-phase1.md` (mark completed tasks if executing inline)

- [ ] **Step 1: Run full targeted test suite**

Run: `npm test -- api/__tests__/business-documents-utils.test.ts api/__tests__/business-documents-router-contract.test.ts src/features/business-profile/__tests__/formatters.test.ts src/pages/__tests__/business-details-profile.test.tsx`  
Expected: PASS all targeted tests.

- [ ] **Step 2: Manual browser validation checklist**

Run app: `npm run dev`  
Verify:
- Open `Businesses` -> `Details` for active business.
- Confirm full profile summary fields render.
- Confirm docs list shows name/type/upload date/size.
- Download file and verify opened file matches expected type.
- Print preview in Edge and Chromium shows profile + docs summary with hidden action controls.
- Mobile viewport check at 320px and 768px for responsive table overflow behavior.

- [ ] **Step 3: Final commit**

```bash
git add api/businesses-router.ts api/lib/business-documents.ts api/__tests__/business-documents-utils.test.ts api/__tests__/business-documents-router-contract.test.ts src/pages/BusinessDetails.tsx src/pages/__tests__/business-details-profile.test.tsx src/features/business-profile/formatters.ts src/features/business-profile/__tests__/formatters.test.ts
git commit -m "feat: complete business profile phase 1 management and printing"
```

## Plan Self-Review

- **Spec coverage:**  
  - Business detail view: covered in Task 4 profile summary section.  
  - Print profile: covered in Task 5.  
  - Document metadata + secure download + audit: covered in Task 2 and Task 4.  
  - Error/loading/user feedback/responsive behavior: covered in Task 4 and Task 6 manual checks.

- **Placeholder scan:**  
  - No `TBD`, `TODO`, or undefined “implement later” actions in task steps.

- **Type and naming consistency:**  
  - Shared names are consistent across tasks: `getDocumentsDetailed`, `downloadDocument`, `base64SizeBytes`, `formatFileSize`, `buildPrintGeneratedLabel`.
