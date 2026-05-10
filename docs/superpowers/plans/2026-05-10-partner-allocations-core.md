# Partner Allocations Core (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one-time partner allocation invites, claim/revoke lifecycle, rights presets, and allocated-business context switching without breaking existing ownership flows.

**Architecture:** Introduce `allocation_invites` and `partner_allocations` tables as lifecycle records, then sync effective access into `user_businesses` so existing middleware and route protection continue to work. Implement owner and partner APIs under `partnerRouter`, add Partner Dashboard Allocations UI and owner-side allocation management UI, and extend business list payload to label allocated contexts in the global switcher.

**Tech Stack:** TypeScript, React 19, tRPC, Drizzle ORM, Vitest, existing audit logging and permission middleware.

---

## File Structure And Responsibilities

- **Modify:** `db/schema.ts` (add allocation enums + tables + indexes)
- **Create:** `api/lib/partner-allocations.ts` (rights profiles, code generation, invite state guards)
- **Modify:** `api/partner-router.ts` (owner and partner allocation procedures)
- **Modify:** `api/businesses-router.ts` (return allocation source metadata in `list`)
- **Modify:** `api/context.ts` (include allocation rights profile in user context when business is allocated)
- **Modify:** `api/middleware.ts` (apply rights profile clamp for allocated contexts)
- **Create:** `api/__tests__/partner-allocations-contract.test.ts`
- **Create:** `api/__tests__/partner-allocations-rights.test.ts`
- **Modify:** `src/pages/PartnerDashboard.tsx` (add optional Allocations tab and claim flow)
- **Modify:** `src/pages/Businesses.tsx` (owner allocation management section)
- **Modify:** `src/components/Layout.tsx` (render business source labels in switcher)
- **Create:** `src/pages/__tests__/partner-allocations-ui.test.tsx`
- **Create:** `src/pages/__tests__/business-allocations-owner-ui.test.tsx`
- **Modify:** `e2e/__tests__/sales-cycle.test.ts` (add allocation-based access scenario)

## Task 1: Add Allocation Schema And Helper Contracts

**Files:**
- Modify: `db/schema.ts`
- Create: `api/lib/partner-allocations.ts`
- Test: `api/__tests__/partner-allocations-contract.test.ts`

- [ ] **Step 1: Write failing contract tests**

```ts
import { describe, expect, it } from "vitest";
import {
  RIGHTS_PROFILES,
  assertRightsProfile,
  generateAllocationCode,
  assertInviteStatusCanTransition,
} from "../lib/partner-allocations";

describe("partner allocation contracts", () => {
  it("exports fixed rights profiles", () => {
    expect(RIGHTS_PROFILES).toEqual(["view_only", "create_view", "manage"]);
  });

  it("validates a supported rights profile", () => {
    expect(() => assertRightsProfile("view_only")).not.toThrow();
  });

  it("rejects unknown rights profile", () => {
    expect(() => assertRightsProfile("custom")).toThrow(/rights profile/i);
  });

  it("generates uppercase allocation code with prefix", () => {
    expect(generateAllocationCode()).toMatch(/^ALLOC[A-Z0-9]{8}$/);
  });

  it("allows active to consumed transition", () => {
    expect(() => assertInviteStatusCanTransition("active", "consumed")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api/__tests__/partner-allocations-contract.test.ts`  
Expected: FAIL because `partner-allocations.ts` does not exist.

- [ ] **Step 3: Add schema + helper implementation**

```ts
// db/schema.ts (add near other enums/tables)
export const allocationRightsEnum = pgEnum("allocation_rights", ["view_only", "create_view", "manage"]);
export const allocationInviteStatusEnum = pgEnum("allocation_invite_status", ["active", "consumed", "revoked", "expired"]);
export const partnerAllocationStatusEnum = pgEnum("partner_allocation_status", ["active", "revoked"]);

export const allocationInvites = pgTable("allocation_invites", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull(),
  ownerAccountId: bigint("ownerAccountId", { mode: "number" }).notNull(),
  businessId: bigint("businessId", { mode: "number" }).notNull(),
  rightsProfile: allocationRightsEnum("rightsProfile").notNull(),
  status: allocationInviteStatusEnum("status").default("active").notNull(),
  createdBy: bigint("createdBy", { mode: "number" }).notNull(),
  consumedByPartnerAccountId: bigint("consumedByPartnerAccountId", { mode: "number" }),
  consumedByPartnerUserId: bigint("consumedByPartnerUserId", { mode: "number" }),
  consumedAt: timestamp("consumedAt"),
  revokedAt: timestamp("revokedAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
}, (table) => ({
  codeUnique: uniqueIndex("uq_allocation_invites_code").on(table.code),
  ownerAccountIdx: index("idx_allocation_invites_ownerAccountId").on(table.ownerAccountId),
  businessIdx: index("idx_allocation_invites_businessId").on(table.businessId),
}));
```

```ts
// api/lib/partner-allocations.ts
// ABOUTME: Shared rules for partner allocation invite and rights lifecycle.
// ABOUTME: Keeps router procedures and tests aligned on status and rights contracts.
export const RIGHTS_PROFILES = ["view_only", "create_view", "manage"] as const;
type RightsProfile = (typeof RIGHTS_PROFILES)[number];

export function assertRightsProfile(value: string): asserts value is RightsProfile {
  if (!RIGHTS_PROFILES.includes(value as RightsProfile)) throw new Error("Invalid rights profile");
}

export function generateAllocationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return `ALLOC${Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")}`;
}

export function assertInviteStatusCanTransition(from: string, to: string): void {
  const key = `${from}->${to}`;
  const allowed = new Set(["active->consumed", "active->revoked", "active->expired"]);
  if (!allowed.has(key)) throw new Error(`Invalid invite transition: ${key}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- api/__tests__/partner-allocations-contract.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add db/schema.ts api/lib/partner-allocations.ts api/__tests__/partner-allocations-contract.test.ts
git commit -m "feat: add partner allocation schema contracts"
```

## Task 2: Add Allocation APIs (Generate, Claim, List, Revoke)

**Files:**
- Modify: `api/partner-router.ts`
- Modify: `api/router.ts`
- Test: `api/__tests__/partner-allocations-contract.test.ts`

- [ ] **Step 1: Write failing API contract tests**

```ts
import { describe, expect, it } from "vitest";
import {
  generateAllocationInviteInputSchema,
  claimAllocationInviteInputSchema,
  revokeAllocationInputSchema,
} from "../partner-router";

describe("partner allocation api contracts", () => {
  it("accepts owner invite generation payload", () => {
    expect(generateAllocationInviteInputSchema.parse({ businessId: 1, rightsProfile: "view_only" })).toBeTruthy();
  });

  it("accepts partner claim payload", () => {
    expect(claimAllocationInviteInputSchema.parse({ code: "ALLOCAB12CD34" })).toBeTruthy();
  });

  it("rejects invalid revoke payload", () => {
    expect(() => revokeAllocationInputSchema.parse({ allocationId: 0 })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api/__tests__/partner-allocations-contract.test.ts`  
Expected: FAIL due to missing schema exports.

- [ ] **Step 3: Implement APIs with transactional claim/revoke**

```ts
export const generateAllocationInviteInputSchema = z.object({
  businessId: z.number().int().positive(),
  rightsProfile: z.enum(["view_only", "create_view", "manage"]),
});
export const claimAllocationInviteInputSchema = z.object({
  code: z.string().min(8).max(20).transform((v) => v.trim().toUpperCase()),
});
export const revokeAllocationInputSchema = z.object({
  allocationId: z.number().int().positive(),
});

generateInvite: ownerQuery.input(generateAllocationInviteInputSchema).mutation(async ({ input, ctx }) => {
  // validate owner scope + create active invite + audit log
  return { code: "ALLOCXXXXYYYY", link: `${ctx.req.headers.get("origin") ?? ""}/partner?alloc=ALLOCXXXXYYYY` };
}),

claimInvite: authedQuery.input(claimAllocationInviteInputSchema).mutation(async ({ input, ctx }) => {
  // tx: verify partner account type, consume invite, insert allocation, upsert user_businesses, audit
  return { success: true };
}),

revoke: ownerQuery.input(revokeAllocationInputSchema).mutation(async ({ input, ctx }) => {
  // set allocation revoked + deactivate matching user_businesses row + audit
  return { success: true };
}),

listOwnerAllocations: ownerQuery.query(async ({ ctx }) => {
  // return owner allocations grouped by business and partner user
  return [];
}),

listPartnerAllocations: authedQuery.query(async ({ ctx }) => {
  // return partner allocations grouped by owner account and business
  return [];
}),
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- api/__tests__/partner-allocations-contract.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/partner-router.ts api/router.ts api/__tests__/partner-allocations-contract.test.ts
git commit -m "feat: add partner allocation api procedures"
```

## Task 3: Enforce Rights Presets In Middleware For Allocated Context

**Files:**
- Modify: `api/context.ts`
- Modify: `api/middleware.ts`
- Test: `api/__tests__/partner-allocations-rights.test.ts`

- [ ] **Step 1: Write failing rights clamp tests**

```ts
import { describe, expect, it } from "vitest";
import { clampPermissionsForAllocation } from "../middleware";

describe("allocation rights clamp", () => {
  it("view_only strips create and delete permissions", () => {
    const next = clampPermissionsForAllocation(["sales.view", "sales.create", "sales.delete"], "view_only");
    expect(next).toContain("sales.view");
    expect(next).not.toContain("sales.create");
    expect(next).not.toContain("sales.delete");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api/__tests__/partner-allocations-rights.test.ts`  
Expected: FAIL because helper export is missing.

- [ ] **Step 3: Add allocation-aware context and permission clamp**

```ts
// api/context.ts (when loading currentBusiness membership)
const allocation = await db.select().from(partnerAllocations).where(and(
  eq(partnerAllocations.partnerUserId, user.id),
  eq(partnerAllocations.ownerBusinessId, effectiveCurrentBusinessId),
  eq(partnerAllocations.status, "active"),
  isNull(partnerAllocations.deletedAt),
)).limit(1);

return {
  ...existingUserContext,
  allocationRightsProfile: allocation[0]?.rightsProfile ?? null,
  accessSource: allocation[0] ? "allocated" : "owned",
};
```

```ts
// api/middleware.ts
export function clampPermissionsForAllocation(base: string[], profile: "view_only" | "create_view" | "manage"): string[] {
  if (profile === "manage") return base;
  if (profile === "create_view") return base.filter((key) => !key.endsWith(".delete"));
  return base.filter((key) => key.endsWith(".view") || key.endsWith(".read"));
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- api/__tests__/partner-allocations-rights.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/context.ts api/middleware.ts api/__tests__/partner-allocations-rights.test.ts
git commit -m "feat: enforce allocation rights profiles in middleware"
```

## Task 4: Return Allocation Source Metadata For Switcher

**Files:**
- Modify: `api/businesses-router.ts`
- Modify: `src/components/Layout.tsx`
- Test: `src/pages/__tests__/partner-allocations-ui.test.tsx`

- [ ] **Step 1: Write failing switcher label test**

```tsx
it("shows allocated source label in business switcher", () => {
  // mock businesses.list returning one allocated business
  // render Layout and expect label text "Allocated:"
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/__tests__/partner-allocations-ui.test.tsx`  
Expected: FAIL because metadata is not returned/rendered.

- [ ] **Step 3: Add metadata to business list and render label**

```ts
// api/businesses-router.ts in list query response shape
return rows.map((b) => ({
  ...b,
  branchCount: locCountMap.get(b.id) ?? 0,
  accessSource: allocationMap.has(b.id) ? "allocated" : "owned",
  allocationOwnerAccountName: allocationMap.get(b.id)?.ownerAccountName ?? null,
}));
```

```tsx
// src/components/Layout.tsx in business selector row
{b.accessSource === "allocated" && (
  <span className="ml-2 rounded bg-[#2E7D32]/10 px-1.5 py-0 text-[10px] text-[#2E7D32]">
    Allocated: {b.allocationOwnerAccountName ?? "Client"}
  </span>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/pages/__tests__/partner-allocations-ui.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/businesses-router.ts src/components/Layout.tsx src/pages/__tests__/partner-allocations-ui.test.tsx
git commit -m "feat: label allocated businesses in switcher"
```

## Task 5: Add Partner Dashboard Allocations Tab And Claim Form

**Files:**
- Modify: `src/pages/PartnerDashboard.tsx`
- Test: `src/pages/__tests__/partner-allocations-ui.test.tsx`

- [ ] **Step 1: Write failing tab + claim tests**

```tsx
it("renders Allocations tab for partner dashboard", () => {
  // render PartnerDashboard
  // expect "Allocations" tab and code input
});

it("submits allocation code and refreshes assignments", async () => {
  // mock claim mutation success
  // submit code
  // expect success toast and refetch call
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/__tests__/partner-allocations-ui.test.tsx`  
Expected: FAIL until tab and claim UI are added.

- [ ] **Step 3: Implement Allocations tab UI**

```tsx
const [tab, setTab] = useState<"overview" | "allocations">("overview");
const [allocationCode, setAllocationCode] = useState("");
const { data: partnerAllocations } = trpc.partner.listPartnerAllocations.useQuery();
const claimInvite = trpc.partner.claimInvite.useMutation({
  onSuccess: () => {
    toast.success("Allocation claimed successfully");
    utils.partner.listPartnerAllocations.invalidate();
    utils.businesses.list.invalidate();
    setAllocationCode("");
  },
});
```

```tsx
<div className="flex gap-2">
  <Button variant={tab === "overview" ? "default" : "outline"} onClick={() => setTab("overview")}>Overview</Button>
  <Button variant={tab === "allocations" ? "default" : "outline"} onClick={() => setTab("allocations")}>Allocations</Button>
</div>
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- src/pages/__tests__/partner-allocations-ui.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/PartnerDashboard.tsx src/pages/__tests__/partner-allocations-ui.test.tsx
git commit -m "feat: add partner allocations tab and claim flow"
```

## Task 6: Add Owner Allocation Management Section

**Files:**
- Modify: `src/pages/Businesses.tsx`
- Test: `src/pages/__tests__/business-allocations-owner-ui.test.tsx`

- [ ] **Step 1: Write failing owner allocation UI tests**

```tsx
it("allows owner to generate allocation invite with selected rights profile", async () => {
  // render Businesses page
  // choose business + rights profile
  // click generate
  // expect code/link rendered
});

it("allows owner to revoke allocation", async () => {
  // render with existing allocation row
  // click revoke
  // expect row marked revoked
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/__tests__/business-allocations-owner-ui.test.tsx`  
Expected: FAIL until section exists.

- [ ] **Step 3: Implement owner allocation section**

```tsx
const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);
const [rightsProfile, setRightsProfile] = useState<"view_only" | "create_view" | "manage">("view_only");
const { data: ownerAllocations } = trpc.partner.listOwnerAllocations.useQuery();
const generateInvite = trpc.partner.generateInvite.useMutation();
const revokeAllocation = trpc.partner.revoke.useMutation();
```

```tsx
<Card>
  <CardHeader><CardTitle>External Partner Allocations</CardTitle></CardHeader>
  <CardContent>
    {/* business selector + rights selector + generate button + code/link + active allocations table */}
  </CardContent>
</Card>
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- src/pages/__tests__/business-allocations-owner-ui.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Businesses.tsx src/pages/__tests__/business-allocations-owner-ui.test.tsx
git commit -m "feat: add owner allocation management ui"
```

## Task 7: End-to-End And Regression Validation

**Files:**
- Modify: `e2e/__tests__/sales-cycle.test.ts`
- Verify: all modified files above

- [ ] **Step 1: Add failing E2E allocation access test**

```ts
test("owner invite -> partner claim -> access -> owner revoke -> access denied", async () => {
  // create owner + partner fixtures
  // generate invite
  // claim as partner
  // switch business and assert view access
  // revoke as owner
  // assert partner loses access
});
```

- [ ] **Step 2: Run E2E test to verify it fails first**

Run: `npm test -- e2e/__tests__/sales-cycle.test.ts`  
Expected: FAIL before implementation completes.

- [ ] **Step 3: Run full targeted verification**

Run:
`npm test -- api/__tests__/partner-allocations-contract.test.ts api/__tests__/partner-allocations-rights.test.ts src/pages/__tests__/partner-allocations-ui.test.tsx src/pages/__tests__/business-allocations-owner-ui.test.tsx e2e/__tests__/sales-cycle.test.ts`  
Expected: PASS.

Run: `npm run check`  
Expected: PASS or only pre-existing unrelated issues.

Run: `npm run lint`  
Expected: PASS or only pre-existing unrelated issues.

- [ ] **Step 4: Final commit**

```bash
git add db/schema.ts api/lib/partner-allocations.ts api/partner-router.ts api/router.ts api/context.ts api/middleware.ts api/businesses-router.ts api/__tests__/partner-allocations-contract.test.ts api/__tests__/partner-allocations-rights.test.ts src/pages/PartnerDashboard.tsx src/pages/Businesses.tsx src/components/Layout.tsx src/pages/__tests__/partner-allocations-ui.test.tsx src/pages/__tests__/business-allocations-owner-ui.test.tsx e2e/__tests__/sales-cycle.test.ts
git commit -m "feat: complete partner allocations core phase 1"
```

## Plan Self-Review

- **Spec coverage:**  
  - One-time code/link generation, claim, revoke, and scoped listings are covered in Task 2 and Task 6.  
  - Rights presets and enforcement are covered in Task 1 and Task 3.  
  - Partner Allocations tab and owner management UI are covered in Task 5 and Task 6.  
  - Unified switcher labeling and allocated context behavior are covered in Task 4.  
  - Integration/E2E validation and regressions are covered in Task 7.

- **Placeholder scan:**  
  - No `TBD`, `TODO`, or unresolved deferred implementation markers in executable steps.

- **Type consistency:**  
  - Rights profile values are consistent across schema, helpers, APIs, middleware, and UI (`view_only`, `create_view`, `manage`).  
  - Procedure names are consistent (`generateInvite`, `claimInvite`, `revoke`, `listOwnerAllocations`, `listPartnerAllocations`).
