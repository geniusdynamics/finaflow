# Project Configuration for AI Agents

## Commands
- **Lint**: `npm run lint`
- **Typecheck**: `npm run check`
- **Test all**: `npm test`
- **Test with coverage**: `npm run test:coverage`
- **Test watch**: `npm run test:watch`
- **Build**: `npm run build`
- **Dev server**: `npm run dev`
- **Format**: `npm run format`

## Project Structure
- `api/` - Backend Hono.js + tRPC server
- `src/` - Frontend React 19 app
- `db/` - Database schema (Drizzle ORM) and migrations
- `api/lib/` - Shared utilities (password, tax, decimal, pagination, rate-limit, csrf, audit)
- `api/queries/connection.ts` - DB connection with connection pooling

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
