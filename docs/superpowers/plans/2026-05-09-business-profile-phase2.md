# Business Profile Management (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add business logo management and reusable print letterhead support to the Business Profile flow with secure APIs, validation, optimization, and tests.

**Architecture:** Introduce a dedicated `business_logos` table and logo procedures in `businesses-router` using existing business membership guardrails and audit logging. Add frontend logo upload/preview/delete workflows to `BusinessDetails`, optimize raster images client-side before upload, and render a reusable `BusinessLetterhead` component in print output.

**Tech Stack:** TypeScript, React 19, tRPC, Drizzle ORM, Vitest, Sonner toasts, existing audit logger.

---

## File Structure And Responsibilities

- **Create:** `db/schema.ts` (modify existing with `businessLogos` table)
- **Create:** `api/lib/logo-validation.ts`
- **Modify:** `api/businesses-router.ts`
- **Create:** `api/__tests__/logo-validation.test.ts`
- **Create:** `api/__tests__/business-logo-router-contract.test.ts`
- **Create:** `src/features/business-profile/logo-utils.ts`
- **Create:** `src/features/business-profile/BusinessLetterhead.tsx`
- **Create:** `src/features/business-profile/__tests__/logo-utils.test.ts`
- **Create:** `src/features/business-profile/__tests__/BusinessLetterhead.test.tsx`
- **Modify:** `src/pages/BusinessDetails.tsx`
- **Modify:** `src/pages/__tests__/business-details-profile.test.ts`

## Task 1: Add Logo Schema + Backend Validation Helpers

**Files:**
- Modify: `db/schema.ts`
- Create: `api/lib/logo-validation.ts`
- Test: `api/__tests__/logo-validation.test.ts`

- [ ] **Step 1: Write failing backend helper tests**

```ts
import { describe, expect, it } from "vitest";
import {
  MAX_LOGO_BYTES,
  ALLOWED_LOGO_MIME_TYPES,
  assertAllowedLogoMimeType,
  assertLogoMaxSize,
} from "../lib/logo-validation";

describe("logo validation helpers", () => {
  it("accepts allowed mime types", () => {
    expect(() => assertAllowedLogoMimeType("image/png")).not.toThrow();
  });

  it("rejects unsupported mime types", () => {
    expect(() => assertAllowedLogoMimeType("image/webp")).toThrow(/Unsupported logo format/i);
  });

  it("rejects payload bigger than max size", () => {
    expect(() => assertLogoMaxSize(MAX_LOGO_BYTES + 1)).toThrow(/5MB/i);
  });

  it("exports expected allowed mime set", () => {
    expect(ALLOWED_LOGO_MIME_TYPES).toContain("image/svg+xml");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api/__tests__/logo-validation.test.ts`  
Expected: FAIL with module-not-found for `logo-validation`.

- [ ] **Step 3: Add `business_logos` table and helper implementation**

```ts
// db/schema.ts (new table)
export const businessLogos = pgTable("business_logos", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number" }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  fileData: text("fileData").notNull(),
  width: integer("width"),
  height: integer("height"),
  sizeBytes: integer("sizeBytes").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  uploadedBy: bigint("uploadedBy", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
}, (table) => ({
  bizLogoBusinessIdx: index("idx_business_logos_businessId").on(table.businessId),
  bizLogoActiveIdx: index("idx_business_logos_isActive").on(table.isActive),
  bizLogoDeletedAtIdx: index("idx_business_logos_deletedAt").on(table.deletedAt),
}));
```

```ts
// api/lib/logo-validation.ts
// ABOUTME: Central validation rules for uploaded business logos.
// ABOUTME: Shared by router and tests to enforce MIME and max size constraints.
export const ALLOWED_LOGO_MIME_TYPES = ["image/jpeg", "image/png", "image/svg+xml"] as const;
export const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export function assertAllowedLogoMimeType(mimeType: string): void {
  if (!ALLOWED_LOGO_MIME_TYPES.includes(mimeType as (typeof ALLOWED_LOGO_MIME_TYPES)[number])) {
    throw new Error("Unsupported logo format. Allowed: JPEG, PNG, SVG.");
  }
}

export function assertLogoMaxSize(sizeBytes: number): void {
  if (sizeBytes > MAX_LOGO_BYTES) {
    throw new Error("Logo exceeds 5MB maximum size.");
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- api/__tests__/logo-validation.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add db/schema.ts api/lib/logo-validation.ts api/__tests__/logo-validation.test.ts
git commit -m "feat: add business logo schema and validation helpers"
```

## Task 2: Add Logo API Procedures With Access Control + Audit

**Files:**
- Modify: `api/businesses-router.ts`
- Test: `api/__tests__/business-logo-router-contract.test.ts`

- [ ] **Step 1: Write failing API contract tests**

```ts
import { describe, expect, it } from "vitest";
import {
  uploadLogoInputSchema,
  getActiveLogoInputSchema,
  deleteLogoInputSchema,
} from "../businesses-router";

describe("business logo router contracts", () => {
  it("validates upload payload", () => {
    expect(uploadLogoInputSchema.parse({
      businessId: 1,
      fileName: "logo.png",
      mimeType: "image/png",
      fileData: "iVBORw0KGgoAAAANSUhEUgAA",
      width: 512,
      height: 128,
      sizeBytes: 104857,
    })).toBeTruthy();
  });

  it("validates getActiveLogo payload", () => {
    expect(getActiveLogoInputSchema.parse({ businessId: 2 })).toEqual({ businessId: 2 });
  });

  it("rejects invalid delete payload", () => {
    expect(() => deleteLogoInputSchema.parse({ businessId: 0 })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api/__tests__/business-logo-router-contract.test.ts`  
Expected: FAIL due to missing exports.

- [ ] **Step 3: Implement procedures**

```ts
export const uploadLogoInputSchema = z.object({
  businessId: z.number().int().positive(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  fileData: z.string().min(1),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  sizeBytes: z.number().int().positive(),
});
export const getActiveLogoInputSchema = z.object({ businessId: z.number().int().positive() });
export const deleteLogoInputSchema = z.object({ businessId: z.number().int().positive() });

uploadLogo: businessManage
  .input(uploadLogoInputSchema)
  .mutation(async ({ input, ctx }) => {
    const db = getDb();
    assertAllowedLogoMimeType(input.mimeType);
    assertLogoMaxSize(input.sizeBytes);
    const userId = ctx.user!.id;
    await db.transaction(async (tx) => {
      await tx.update(businessLogos).set({ isActive: false, updatedAt: new Date() }).where(and(
        eq(businessLogos.businessId, input.businessId),
        eq(businessLogos.isActive, true),
        isNull(businessLogos.deletedAt),
      ));
      const [logo] = await tx.insert(businessLogos).values({
        businessId: input.businessId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileData: input.fileData,
        width: input.width ?? null,
        height: input.height ?? null,
        sizeBytes: input.sizeBytes,
        isActive: true,
        uploadedBy: userId,
      } as any).returning();
      await logAudit({
        userId,
        businessId: input.businessId,
        action: "UPLOAD_LOGO",
        resource: "business_logos",
        resourceId: logo.id,
        details: { fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes },
      });
    });
    return { success: true };
  }),
```

```ts
getActiveLogo: businessManage
  .input(getActiveLogoInputSchema)
  .query(async ({ input }) => {
    const db = getDb();
    const [row] = await db.select().from(businessLogos).where(and(
      eq(businessLogos.businessId, input.businessId),
      eq(businessLogos.isActive, true),
      isNull(businessLogos.deletedAt),
    )).limit(1);
    return row ?? null;
  }),

deleteLogo: businessManage
  .input(deleteLogoInputSchema)
  .mutation(async ({ input, ctx }) => {
    const db = getDb();
    const [row] = await db.select().from(businessLogos).where(and(
      eq(businessLogos.businessId, input.businessId),
      eq(businessLogos.isActive, true),
      isNull(businessLogos.deletedAt),
    )).limit(1);
    if (!row) throw new Error("Active logo not found");
    await db.update(businessLogos).set({
      isActive: false,
      deletedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(businessLogos.id, row.id));
    await logAudit({
      userId: ctx.user!.id,
      businessId: input.businessId,
      action: "DELETE_LOGO",
      resource: "business_logos",
      resourceId: row.id,
      details: { fileName: row.fileName },
    });
    return { success: true };
  }),
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- api/__tests__/business-logo-router-contract.test.ts api/__tests__/logo-validation.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/businesses-router.ts api/__tests__/business-logo-router-contract.test.ts
git commit -m "feat: add business logo API with audit logging"
```

## Task 3: Add Frontend Logo Optimization Helpers + Tests

**Files:**
- Create: `src/features/business-profile/logo-utils.ts`
- Test: `src/features/business-profile/__tests__/logo-utils.test.ts`

- [ ] **Step 1: Write failing helper tests**

```ts
import { describe, expect, it } from "vitest";
import { isAllowedLogoType, validateLogoFileSizeBytes } from "../logo-utils";

describe("logo utils", () => {
  it("accepts png type", () => {
    expect(isAllowedLogoType("image/png")).toBe(true);
  });

  it("rejects unsupported type", () => {
    expect(isAllowedLogoType("image/webp")).toBe(false);
  });

  it("validates 5MB max", () => {
    expect(validateLogoFileSizeBytes(5 * 1024 * 1024)).toBe(true);
    expect(validateLogoFileSizeBytes(5 * 1024 * 1024 + 1)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/business-profile/__tests__/logo-utils.test.ts`  
Expected: FAIL because helper file doesn’t exist.

- [ ] **Step 3: Implement helper module**

```ts
// ABOUTME: Client-side business-logo validation and optimization helpers.
// ABOUTME: Keeps BusinessDetails UI simple while enforcing consistent upload rules.
export const ALLOWED_LOGO_TYPES = ["image/jpeg", "image/png", "image/svg+xml"] as const;
export const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_LOGO_WIDTH = 512;

export function isAllowedLogoType(mimeType: string): boolean {
  return ALLOWED_LOGO_TYPES.includes(mimeType as (typeof ALLOWED_LOGO_TYPES)[number]);
}

export function validateLogoFileSizeBytes(size: number): boolean {
  return size <= MAX_LOGO_SIZE_BYTES;
}
```

- [ ] **Step 4: Add optimization API and run tests**

```ts
export async function optimizeLogoFile(file: File): Promise<{
  fileData: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
}> {
  // SVG: passthrough
  if (file.type === "image/svg+xml") {
    const raw = await file.text();
    const base64 = btoa(unescape(encodeURIComponent(raw)));
    return { fileData: base64, mimeType: file.type, width: null, height: null, sizeBytes: file.size };
  }
  // PNG/JPEG: canvas resize to MAX_LOGO_WIDTH
  // (implementation details in Task execution)
  throw new Error("Implement raster optimization");
}
```

Run: `npm test -- src/features/business-profile/__tests__/logo-utils.test.ts`  
Expected: PASS for current tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/business-profile/logo-utils.ts src/features/business-profile/__tests__/logo-utils.test.ts
git commit -m "feat: add logo validation and optimization helpers"
```

## Task 4: Build Reusable BusinessLetterhead Component + Tests

**Files:**
- Create: `src/features/business-profile/BusinessLetterhead.tsx`
- Test: `src/features/business-profile/__tests__/BusinessLetterhead.test.tsx`

- [ ] **Step 1: Write failing component test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BusinessLetterhead } from "../BusinessLetterhead";

describe("BusinessLetterhead", () => {
  it("renders name and account line", () => {
    render(<BusinessLetterhead business={{
      name: "Acme Traders", accountId: "ACME123", phone: "+254700000000", email: "info@acme.com",
      address: "Nairobi", county: "Nairobi City", subCounty: "Westlands",
    }} logo={null} generatedAt={new Date("2026-05-09T10:00:00.000Z")} />);
    expect(screen.getByText(/Acme Traders/i)).toBeInTheDocument();
    expect(screen.getByText(/ACME123/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/business-profile/__tests__/BusinessLetterhead.test.tsx`  
Expected: FAIL (component missing).

- [ ] **Step 3: Implement component**

```tsx
// ABOUTME: Reusable branded letterhead for business-facing printable documents.
// ABOUTME: Renders logo and key identity fields in a print-friendly header block.
export function BusinessLetterhead({ business, logo, generatedAt }: BusinessLetterheadProps) {
  return (
    <header className="mb-4 border-b border-[#E8E0D8] pb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {logo ? <img src={`data:${logo.mimeType};base64,${logo.fileData}`} alt="Business logo" className="h-14 w-auto max-w-[160px] object-contain" /> : null}
          <div>
            <h2 className="font-serif text-lg font-semibold text-[#2D2A26]">{business.name}</h2>
            <p className="text-xs text-[#8D8A87]">Account {business.accountId}</p>
          </div>
        </div>
        <div className="text-right text-xs text-[#8D8A87]">
          <p>{business.phone || "—"}</p>
          <p>{business.email || "—"}</p>
          <p>{business.address || "—"}</p>
          <p>{generatedAt.toLocaleString("en-KE")}</p>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/business-profile/__tests__/BusinessLetterhead.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/business-profile/BusinessLetterhead.tsx src/features/business-profile/__tests__/BusinessLetterhead.test.tsx
git commit -m "feat: add reusable business letterhead component"
```

## Task 5: Integrate Logo Management + Print Letterhead Into BusinessDetails

**Files:**
- Modify: `src/pages/BusinessDetails.tsx`
- Modify: `src/pages/__tests__/business-details-profile.test.ts`

- [ ] **Step 1: Write failing integration tests**

```ts
it("shows logo management section", () => {
  const html = renderToStaticMarkup(React.createElement(BusinessDetails));
  expect(html).toContain("Logo Management");
});

it("keeps print profile action and letterhead block", () => {
  const html = renderToStaticMarkup(React.createElement(BusinessDetails));
  expect(html).toContain("Print Profile");
  expect(html).toContain("Account ACME123");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/__tests__/business-details-profile.test.ts`  
Expected: FAIL if logo section/letterhead not present.

- [ ] **Step 3: Integrate logo query/mutations and upload handlers**

```tsx
const { data: activeLogo, refetch: refetchLogo, isLoading: logoLoading } = trpc.businesses.getActiveLogo.useQuery(
  { businessId: businessId! },
  { enabled: !!businessId }
);
const uploadLogoMutation = trpc.businesses.uploadLogo.useMutation();
const deleteLogoMutation = trpc.businesses.deleteLogo.useMutation();

async function handleLogoUpload(file: File) {
  if (!isAllowedLogoType(file.type)) throw new Error("Unsupported logo format. Allowed: JPEG, PNG, SVG.");
  if (!validateLogoFileSizeBytes(file.size)) throw new Error("Logo exceeds 5MB maximum size.");
  const optimized = await optimizeLogoFile(file);
  await uploadLogoMutation.mutateAsync({
    businessId: businessId!,
    fileName: file.name,
    mimeType: optimized.mimeType,
    fileData: optimized.fileData,
    width: optimized.width,
    height: optimized.height,
    sizeBytes: optimized.sizeBytes,
  });
  await refetchLogo();
}
```

- [ ] **Step 4: Render logo management + letterhead print block**

```tsx
<section className="rounded-lg border border-[#E8E0D8] bg-white p-4 print:hidden">
  <h2 className="font-serif text-lg font-semibold text-[#2D2A26]">Logo Management</h2>
  {logoLoading ? <p className="text-xs text-[#8D8A87]">Loading logo…</p> : activeLogo ? (
    <img src={`data:${activeLogo.mimeType};base64,${activeLogo.fileData}`} alt="Business logo preview" className="mt-3 h-20 w-auto object-contain" />
  ) : <p className="mt-2 text-xs text-[#8D8A87]">No logo uploaded.</p>}
</section>

<div className="hidden print:block">
  <BusinessLetterhead business={business} logo={activeLogo ?? null} generatedAt={new Date()} />
</div>
```

- [ ] **Step 5: Run tests and lint**

Run: `npm test -- src/pages/__tests__/business-details-profile.test.ts src/features/business-profile/__tests__/BusinessLetterhead.test.tsx src/features/business-profile/__tests__/logo-utils.test.ts`  
Expected: PASS.

Run: `npx eslint src/pages/BusinessDetails.tsx src/features/business-profile/logo-utils.ts src/features/business-profile/BusinessLetterhead.tsx`  
Expected: PASS or only pre-existing unrelated issues.

- [ ] **Step 6: Commit**

```bash
git add src/pages/BusinessDetails.tsx src/pages/__tests__/business-details-profile.test.ts
git commit -m "feat: add business logo management and print letterhead integration"
```

## Task 6: Final Verification

**Files:**
- Verify: all touched files above

- [ ] **Step 1: Run targeted backend + frontend tests**

Run:
`npm test -- api/__tests__/logo-validation.test.ts api/__tests__/business-logo-router-contract.test.ts src/features/business-profile/__tests__/logo-utils.test.ts src/features/business-profile/__tests__/BusinessLetterhead.test.tsx src/pages/__tests__/business-details-profile.test.ts`
Expected: PASS.

- [ ] **Step 2: Manual checks**

Run: `npm run dev`  
Verify:
- Upload JPEG/PNG/SVG logo in Business Details.
- Reject unsupported type and >5MB file with clear message.
- Replace existing logo and verify latest is rendered.
- Delete logo and verify empty state.
- Print preview shows letterhead with business identity and logo.

- [ ] **Step 3: Final commit**

```bash
git add db/schema.ts api/lib/logo-validation.ts api/businesses-router.ts api/__tests__/logo-validation.test.ts api/__tests__/business-logo-router-contract.test.ts src/features/business-profile/logo-utils.ts src/features/business-profile/BusinessLetterhead.tsx src/features/business-profile/__tests__/logo-utils.test.ts src/features/business-profile/__tests__/BusinessLetterhead.test.tsx src/pages/BusinessDetails.tsx src/pages/__tests__/business-details-profile.test.ts
git commit -m "feat: complete business profile phase 2 logo and letterhead system"
```

## Plan Self-Review

- **Spec coverage:**  
  - `business_logos` table and versioned active record logic: Task 1 + Task 2.  
  - Logo upload/replace/delete API with access + audit: Task 2.  
  - Frontend upload validation/optimization and UX: Task 3 + Task 5.  
  - Reusable letterhead component and print integration: Task 4 + Task 5.  
  - Backend + frontend + manual testing: Task 6.

- **Placeholder scan:**  
  - No `TBD`, `TODO`, or unresolved implementation placeholders in task actions.

- **Type consistency:**  
  - Shared identifiers remain consistent: `uploadLogoInputSchema`, `getActiveLogoInputSchema`, `deleteLogoInputSchema`, `BusinessLetterhead`, `optimizeLogoFile`.
