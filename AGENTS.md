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
- **Accounting Hub**: Accounts page at `/accounts` hosts four sections via URL param `?section=`:
  - `accounts` (default): Legacy accounts & payment-methods tabbed view
  - `chart-of-accounts`: Embedded ChartOfAccounts component
  - `journal-entries`: Embedded JournalEntries component
  - **`debts`**: Embedded Debts component with debt cards, payments, progress tracking
- **Debts tab** inside Accounts page: Third tab alongside "Accounts" and "Payment Methods" renders `<Debts embedded />`. Full standalone page at `src/pages/Debts.tsx` exported as `Debts` with `embedded?: boolean` prop.
- **Calendar Hub**: Calendar page at `/calendar` hosts two sections via URL param `?section=`:
  - `calendar` (default): Cashflow calendar timeline view
  - `payments`: Embedded DailyPayments component
- **Settings page** (`src/pages/Settings.tsx`): Redesigned with profile-like vertical navigation. Desktop shows sticky sidebar (`lg:block w-64`), mobile shows full-width nav list (`lg:hidden`). Nav items: Features, Account, Wallets, Integrations, Feedback — each with icon, label, description.
- Old standalone routes (`/chart-of-accounts`, `/journal-entries`, `/daily-payments`) redirect to their respective hub pages with `?section=...`
- Each section renders without its own `<Layout>` wrapper when embedded; standalone pages accept `embedded?: boolean` prop

## Key Conventions
- All financial calculations use decimal.js (not parseFloat)
- All multi-step financial operations use db.transaction()
- JWT stored in httpOnly cookies (not localStorage)
- CSRF protection on all mutation endpoints
- Rate limiting on all endpoints (login: 10/min, API: 500/min, integration: 100/min, connect: 30/min)
- All list endpoints filter by location/business context
- All tables have indexes on locationId, businessId, userId, deletedAt, status
- Error boundaries wrap every route in App.tsx
- All protected routes use <ProtectedRoute> + <AuthLayout>
- Lazy loading (React.lazy + Suspense) for all routes
- Audit logging for sensitive operations

## Integrations
- External REST API lives under `/api/v1/` (versioned). All routes use API key auth (`Authorization: Bearer fna_...`).
- Unified response envelope: `{ data, meta: { requestId } }` for success, `{ error: { code, message }, meta: { requestId } }` for errors.
- API key scopes are defined in `api/lib/api-scopes.ts`. Shared business logic lives in `api/lib/integration-service.ts`.
- v1 routes are mounted in `api/routes/v1/index.ts` and wired in `api/boot.ts` via `app.route("/api/v1", v1)`.
- Incoming webhooks are handled by `api/routes/v1/webhooks.ts` (FinaBill) and `api/lib/webhook-handlers.ts` (providers), verified using `X-Fina-Signature`.
- Outgoing webhooks are dispatched by `api/lib/webhook-dispatcher.ts` and recorded in `webhookDeliveries`.
- API-key auth for integration endpoints is implemented in `api/lib/api-key-auth.ts` and `api/lib/api-key-middleware.ts`.
- Legacy tRPC integration endpoints (`integrationFinabill.*`) are thin wrappers over `integration-service.ts` — kept for backward compat.
- Old paths `/api/integration/daily-sales` and `/api/webhooks/finabill` redirect to v1 with deprecation headers.
- Fina Connect pairing endpoints (`/api/connect/*`) remain in `boot.ts` — they're M2M protocol, not CRUD.
- To add a new incoming webhook provider: extend `handleProviderWebhook` in `api/lib/webhook-handlers.ts` and mount the route in `api/routes/v1/webhooks.ts`.
- Run integration tests: `npx vitest run api/__tests__/webhook-dispatcher.test.ts api/__tests__/integration-finabill.test.ts`
- Dev server: `npm run dev` (Portless) or `npm run dev:app` (no Portless).

## Changelog Convention
- **CHANGELOG.md is append-only**: New entries are always added at the top of the file under `[Unreleased]`. Previous entries are never edited, reordered, or removed after they are written.
- **Chronological ordering**: Newer changes go above older ones. Each section represents a logical batch of work.
- **Updated after every task**: After completing a task or set of related tasks, a new changelog section is added summarizing what was added, changed, fixed, and tested.
- **Re-update only on explicit instruction**: If a previous changelog entry was overwritten or needs updating, only do so when the user specifically asks. Do not rewrite history without user direction.
