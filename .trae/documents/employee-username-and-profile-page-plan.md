# Plan: Improved Username Creation & User Profile Page

## Summary

Three interconnected features:
1. **Improved `buildEmployeeUsername`** — replace phone-based username with first-name-based, fallback to `{first3Biz}_{firstName}` pattern when the name is taken.
2. **User profile page** — a new `/profile` route for viewing/editing own user info (username, name, email, phone, password).
3. **Navigation to profile** — clickable sidebar user area and per-user "View Profile" from the Team page.

---

## 1. Improved Employee Username

**File:** `api/employees-payroll-router.ts`

### Current behavior
`buildEmployeeUsername(phone, fullName)` returns `emp_{last9PhoneDigits}` when phone is available (>=6 digits), or `emp_{slugifiedName}` otherwise.

### New behavior
- Extract `firstName` = `fullName.split(" ")[0]` → lowercase, slugified (remove non-alpha, trim)
- Use lowercased `firstName` as the **primary** username candidate
- Check if `{username}_{accountId}` already exists in the `users` table (query the DB)
- If **not taken** → return `firstName`
- If **taken** → derive business abbreviation from `ctx.user?.currentBusiness?.name` (first 3 lowercase letters), return `{bizAbbr}_{firstName}` (e.g. the business `Gen` + first name `Nitram` → `gen_nitram`)
- If **still taken** → append a numeric suffix: `{bizAbbr}_{firstName}_{1|2|3}` (bounded retry, max 5 attempts)

### Changes needed

**`api/employees-payroll-router.ts`:**
1. Rewrite `buildEmployeeUsername` to accept `firstName`, `businessName`, and an `isTaken(username)` callback:
   - `firstName` = first word of `fullName`, slugified
   - `bizAbbr` = first 3 chars of `businessName`, lowercased
   - Try `firstName` → if taken, try `{bizAbbr}_{firstName}` → if taken, try `{bizAbbr}_{firstName}_{n}` (n=1..5)
   - No more `emp_` prefix

2. In the `create` mutation, pass the current business name from `ctx.user?.currentBusiness?.name`, and pass a reference to the DB for uniqueness checking.

### Frontend impact (Payroll.tsx)
- Returned `username` will no longer have an `emp_` prefix — the credentials dialog automatically shows whatever `data.username` is, so **no changes needed**.

---

## 2. Backend: Profile Update Endpoint

**File:** `api/users-router.ts`

### Add a new procedure: `updateProfile`

```typescript
updateProfile: authedQuery  // NOT userManage — any authenticated user can update their own
  .input(z.object({
    username: z.string().min(3).max(100).optional(),
    name: z.string().min(1).optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    const db = getDb();
    const userId = ctx.user!.id;  // always own profile
    const accountId = ctx.user!.accountId;
    
    // If updating username, check uniqueness within the account
    if (input.username) {
      const existing = await db.query.users.findFirst({
        where: (u, { and, eq, ne }) => and(
          eq(u.username, input.username),
          eq(u.accountId, accountId),
          eq(u.isActive, true),
          ne(u.id, userId),
          isNull(u.deletedAt),
        ),
      });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Username already taken in this account" });
    }
    
    await db.update(users).set(input).where(eq(users.id, userId));
    return { success: true };
  })
```

Key points:
- Uses `authedQuery` middleware — any logged-in user can call it
- Forces `ctx.user!.id` — can only edit own profile
- Username uniqueness validated against `(accountId, username)` composite index
- Fields are optional — only send what you want to change

---

## 3. New User Profile Page

**File:** `src/pages/Profile.tsx` (new)

### Component structure

```
ProfilePage (default export)
├── ProfileHeader — avatar placeholder, name, role badge, last sign-in
├── ProfileForm
│   ├── Username field (editable, with inline uniqueness check)
│   ├── Name field (editable)
│   ├── Email field (editable)
│   ├── Phone field (editable)
│   └── Save button → calls trpc.users.updateProfile
├── ChangePasswordSection
│   └── Old password, New password, Confirm → calls trpc.users.changePassword
└── LinkedEmployeesSection (if current user role === "employee")
    └── Lists employees linked to this user (from trpc.employees.list)
```

### Route: `src/pages/App.tsx`
Add:
```typescript
const Profile = lazy(() => import("./pages/Profile").then(m => ({ default: m.Profile })));
...
<Route path="/profile" element={<ErrorBoundary><SuspendedPage><ProtectedPage><Profile /></ProtectedPage></SuspendedPage></ErrorBoundary>} />
```

Note: `/profile` does NOT require `users:manage` — any authenticated user can access their own profile.

### Form patterns (follow existing code style)
- Use `@/components/ui/input`, `@/components/ui/label`, `@/components/ui/button` like the rest of the codebase
- Mutations: `trpc.users.updateProfile.useMutation`, `trpc.users.changePassword.useMutation`
- Data: `useAuth()` for current user info
- Toast feedback via `sonner` (already used project-wide)
- Dark-toned accent button color: `bg-[#C73E1D]` consistent with other submit buttons

---

## 4. Sidebar: Make User Area Clickable

**File:** `src/components/Layout.tsx`

### Desktop sidebar (around line 217-226)
Wrap the user info `<div>` in a `<Link to="/profile">`:

```tsx
<Link to="/profile" className="mb-3 flex items-center gap-3 rounded-lg bg-[#F5EDE6] px-3 py-2 hover:bg-[#EDE0D6] transition-colors">
  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#D4A854]/20">
    <Users className="h-4 w-4 text-[#D4A854]" />
  </div>
  {!sidebarCollapsed && (
    <div className="flex-1 overflow-hidden">
      <p className="truncate text-sm font-medium text-[#2D2A26]">{user?.name ?? "User"}</p>
      <p className="text-xs capitalize text-[#8D8A87]">{role}</p>
    </div>
  )}
</Link>
```

### Mobile sidebar (around line 408-412)
Same treatment — wrap in `<Link to="/profile" onClick={() => setMenuOpen(false)}>`.

---

## 5. Team Page: Click to View Profile

**File:** `src/pages/Users.tsx`

Add a "View Profile" action in each user row (or make the name/username clickable).

### Option (simpler): Add a button per row
In the Actions column, add a new button before the existing actions:
```tsx
<Button size="sm" variant="ghost" onClick={() => navigate(`/profile?id=${u.id}`)}>
  <UserCircle className="h-4 w-4 text-[#8D8A87]" />
</Button>
```

Import `useNavigate` from `react-router`.

### Profile page handles `?id=` query param
When `?id=` is present:
- Fetch user via `trpc.users.get.useQuery({ id })` — this uses `authedQuery` so any authenticated user can read profiles within their account
- Show a read-only view (no edit fields, or at least grey them out)
- The save button is hidden or disabled when viewing another user

When no `?id=` (own profile):
- Use `useAuth()` data
- All fields editable via `trpc.users.updateProfile`

---

## 6. Files Changed/Added

| File | Action | What |
|------|--------|------|
| `api/employees-payroll-router.ts` | Modified | Rewrite `buildEmployeeUsername` + update `create` mutation |
| `api/users-router.ts` | Modified | Add `updateProfile` procedure |
| `src/pages/Profile.tsx` | **New** | Profile page component |
| `src/pages/App.tsx` | Modified | Add `/profile` route |
| `src/components/Layout.tsx` | Modified | Sidebar user area → `<Link to="/profile">` |
| `src/pages/Users.tsx` | Modified | Add "View Profile" action per user row |

---

## 7. Verification

1. **Unit test**: Update `api/lib/__tests__/user-references.test.ts` — add tests for new `buildEmployeeUsername` logic (first-name extraction, business abbreviation fallback, uniqueness retry)
2. **Typecheck**: `npm run check` — verify no TypeScript errors
3. **Lint**: `npm run lint` — verify no ESLint errors on changed files
4. **Tests**: `npm test` — verify existing tests still pass
5. **Manual**: Serve the app, create an employee, verify the generated username format, navigate to profile, edit username
