# Project Configuration for AI Agents

## Commands
- **Lint**: `npm run lint`
- **Typecheck**: `npm run check`
- **Test all**: `npm test`
- **Test with coverage**: `npm run test:coverage`
- **Test watch**: `npm run test:watch`
- **Build**: `npm run build`
- **Dev server (Portless)**: `npm run dev`
- **Dev server (no Portless)**: `npm run dev:app`
- **Format**: `npm run format`

## Portless
- Install: `npm install -g portless`
- Dev URL: `https://finaflow.localhost` — `.localhost` resolves natively in all browsers
- **Windows prerequisite**: Portless needs `openssl.exe` on PATH for TLS. After installing OpenSSL:
  - Binary: `C:\Program Files\OpenSSL-Win64\bin\openssl.exe`
  - Config: `C:\Program Files\OpenSSL-Win64\bin\cnf\openssl.cnf`
  - These are wired automatically via `scripts\dev.cmd` — edit that file if your paths differ
- First run generates a local CA and prompts to trust it for HTTPS
- Temporarily bypass by setting `PORTLESS=0` in your environment (or use `npm run dev:app`)

## Project Structure
- `api/` - Backend Hono.js + tRPC server
- `src/` - Frontend React 19 app
- `db/` - Database schema (Drizzle ORM) and migrations
- `api/lib/` - Shared utilities (password, tax, decimal, pagination, rate-limit, csrf, audit)
- `api/queries/connection.ts` - DB connection with connection pooling

## Navigation & Layout
- Sidebar items defined in `src/components/Layout.tsx` (allNavItems array)
- **Accounting Hub**: Accounts page at `/accounts` hosts three sections via URL param `?section=`:
  - `accounts` (default): Legacy accounts & payment-methods tabbed view
  - `chart-of-accounts`: Embedded ChartOfAccounts component
  - `journal-entries`: Embedded JournalEntries component
- **Calendar Hub**: Calendar page at `/calendar` hosts two sections via URL param `?section=`:
  - `calendar` (default): Cashflow calendar timeline view
  - `payments`: Embedded DailyPayments component
- Old standalone routes (`/chart-of-accounts`, `/journal-entries`, `/daily-payments`) redirect to their respective hub pages with `?section=...`
- Each section renders without its own `<Layout>` wrapper when embedded; standalone pages accept `embedded?: boolean` prop

## Key Conventions
- All financial calculations use decimal.js (not parseFloat)
- All multi-step financial operations use db.transaction()
- JWT stored in httpOnly cookies (not localStorage)
- CSRF protection on all mutation endpoints
- Rate limiting on all endpoints (login: 10/min, API: 100/min)
- All list endpoints filter by location/business context
- All tables have indexes on locationId, businessId, userId, deletedAt, status
- Error boundaries wrap every route in App.tsx
- All protected routes use <ProtectedRoute> + <AuthLayout>
- Lazy loading (React.lazy + Suspense) for all routes
- Audit logging for sensitive operations

## Changelog Convention
- **CHANGELOG.md is append-only**: New entries are always added at the top of the file under `[Unreleased]`. Previous entries are never edited, reordered, or removed after they are written.
- **Chronological ordering**: Newer changes go above older ones. Each section represents a logical batch of work.
- **Updated after every task**: After completing a task or set of related tasks, a new changelog section is added summarizing what was added, changed, fixed, and tested.
- **Re-update only on explicit instruction**: If a previous changelog entry was overwritten or needs updating, only do so when the user specifically asks. Do not rewrite history without user direction.
