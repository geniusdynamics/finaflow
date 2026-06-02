# FinaFlow

Business cashflow management platform built for African small and medium enterprises. Track daily sales, manage expenses, process payroll, handle M-Pesa and Mobile wallet payments, and generate real-time financial reports — all in one place.

## Features

- **Dashboard** — Real-time financial overview with cashflow charts and KPIs
- **Daily Sales** — Record and track point-of-sale and direct sales
- **Expenses & Bills** — Manage operational expenses, purchase orders, and supplier bills
- **Payroll** — Employee management, payroll processing, and payslip generation
- **M-Pesa Integration** — Parse and reconcile M-Pesa transaction messages
- **Partner Allocations** — Track partner profit-sharing and allocations
- **Reports** — Financial reports with interactive charts (Recharts)
- **Multi-business / Multi-location** — Tenant-scoped data isolation
- **Role-based Access Control** — Granular permissions (32 permissions, 5 roles)
- **Subscriptions** — Account subscription management with usage enforcement

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS, shadcn/ui, Recharts |
| **Backend** | Hono.js, tRPC, Zod validation |
| **Database** | PostgreSQL 16, Drizzle ORM |
| **Auth** | JWT (httpOnly cookies), bcrypt, CSRF protection |
| **Testing** | Vitest, Playwright, MSW |
| **Build** | Vite, esbuild, Docker |

## Prerequisites

- Node.js 20+
- PostgreSQL 16+
- npm

## Quick Start

### Using Docker Compose (recommended)

```bash
cp .env.example .env
docker compose up -d
npm run db:migrate
npm run dev:app
```

### Manual Setup

```bash
# 1. Clone and install dependencies
git clone <repo-url>
cd finaflow
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env and set your DATABASE_URL

# 3. Create the database
createdb finaflow_dev

# 4. Run database migrations
npm run db:migrate

# 5. Start development servers
npm run dev
```

The app will be available at `https://finaflow.localhost` (with Portless) or `http://localhost:5173`.

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with Portless (HTTPS) |
| `npm run dev:app` | Start dev server without Portless |
| `npm run build` | Build frontend + backend for production |
| `npm start` | Run production server |
| `npm test` | Run all tests |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint all files with ESLint |
| `npm run format` | Format all files with Prettier |
| `npm run check` | Type-check with TypeScript |
| `npm run db:generate` | Generate a new Drizzle migration |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:push` | Push schema changes directly (dev only) |

## Project Structure

```
api/              Backend Hono.js + tRPC server
  lib/              Shared utilities (decimal, tax, rate-limit, csrf, etc.)
  queries/          Database query modules
  __tests__/        API integration tests
  test/             Test setup and helpers
contracts/        Shared TypeScript types, constants, and error definitions
db/               Database schema (Drizzle ORM) and migrations
e2e/              Playwright end-to-end tests
scripts/          Utility scripts (migrations, diagnostics, data fixes)
src/              Frontend React 19 application
  components/       Reusable UI components (shadcn/ui)
  features/        Feature-specific components and utilities
  hooks/           Custom React hooks
  pages/           Route page components
  providers/       Context providers (tRPC, etc.)
resources/        Screenshots and design documents
```

## Environment Variables

Key configuration is documented in `.env.example`. Essential variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `APP_ID` | Application identifier |
| `APP_SECRET` | JWT signing secret |
| `KIMI_AUTH_URL` | OAuth server URL |
| `BCRYPT_ROUNDS` | Password hashing cost factor |

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the GNU Affero General Public License v3.0 — see the [LICENSE](LICENSE) file for details.
