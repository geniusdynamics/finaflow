# FinaFlow

Business cashflow management platform built for African small and medium enterprises. Track daily sales, manage expenses, process payroll, handle M-Pesa payments, and generate real-time financial reports — all in one place.

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

## Screenshots

### Dashboard Overview
![Dashboard Overview](resources/cashflow%20dash.png)

### Accounts Management
![Accounts Management](resources/accounts.png)

### Bills & Payables
![Bills & Payables](resources/bills.png)

### Expenses Management
![Expenses Management](resources/expenses.png)

### Transactions
![Transactions](resources/transactions.png)

### Reports & Analytics
![Reports & Analytics](resources/reports.png)

### Budget Planning
![Budget Planning](resources/budget.png)

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS, shadcn/ui, Recharts |
| **Backend** | Hono.js, tRPC, Zod validation |
| **Database** | PostgreSQL 16, Drizzle ORM |
| **Auth** | JWT (httpOnly cookies), bcrypt, CSRF protection |
| **Testing** | Vitest, Playwright, MSW |
| **Build** | Vite, esbuild |

## Prerequisites

- **Node.js 20+** — `node --version`
- **PostgreSQL 16+** — `psql --version`
- **npm** — `npm --version`
- **OpenSSL** *(Windows only)* — required by Portless (HTTPS dev server)

### Windows OpenSSL Note

Portless needs `openssl.exe` on PATH for local HTTPS certificates. Install from [slproweb.com/products/Win32OpenSSL.html](https://slproweb.com/products/Win32OpenSSL.html).

The dev script (`scripts/dev.cmd`) wires the paths automatically:
- Binary: `C:\Program Files\OpenSSL-Win64\bin\openssl.exe`
- Config: `C:\Program Files\OpenSSL-Win64\bin\cnf\openssl.cnf`

If you don't want to install OpenSSL, use `npm run dev:app` instead (HTTP only).

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url>
cd finaflow
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
```

Edit `.env` with these required values:

| Variable | Required | Example | Purpose |
|----------|----------|---------|---------|
| `DATABASE_URL` | ✅ | `postgresql://postgres:pass@localhost:5432/finaflow_dev` | PostgreSQL connection |
| `APP_ID` | ✅ | `finaflow-dev` | Application identifier |
| `APP_SECRET` | ✅ | `a-strong-32-char-random-secret` | JWT signing secret |

### 3. Create the database

```bash
createdb -U postgres finaflow_dev
```

Or via psql:

```bash
psql -U postgres -c "CREATE DATABASE finaflow_dev;"
```

### 4. Run migrations

```bash
npm run db:migrate:run
```

This applies all migration files from `db/migrations/` in sequence. Creates **61 tables**, **27 enum types**, indexes, and **19 foreign key constraints**.

### 5. Seed demo data

```bash
node db/seed-demo.cjs
```

Creates a complete demo environment with realistic data:

| Data | Details |
|------|---------|
| Business | 1 restaurant business, 2 branches |
| Accounts | M-PESA till, cash drawers, bank accounts (12 total) |
| Payment methods | Cash, M-PESA, Bank Transfer — linked to branches and accounts |
| Daily sales | 72 days of sales data across both branches |
| Expenses | Supplier-linked expense records |
| Suppliers | 15 realistic suppliers |
| Employees | 5 employees with salary structures |
| Payroll | 3 periods, 15 payroll entries with full tax calculations |
| Budgets | 6 categories × 3 months |
| Ledger | 107 entries tracking all money movement |
| M-PESA | 15 transaction records |

Log in after seeding with the credentials shown in the script output.

### 6. Start the dev server

**With HTTPS (recommended):**

```bash
npm run dev
```

First run generates a local CA certificate — accept the prompt to trust it.

**Without HTTPS:**

```bash
npm run dev:app
```

### 7. Open the app

The app will be available at:

| URL | Mode |
|-----|------|
| `https://finaflow.localhost` | Portless (HTTPS) |
| `http://localhost:5173` | Direct Vite |

Log in with the demo credentials from the seeder output and explore the Dashboard, Sales, Expenses, Payroll, Reports, and other modules.

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
| `npm run check` | TypeScript type-check (`tsc -b`) |
| `npm run db:generate` | Generate new Drizzle migration from schema changes |
| `npm run db:migrate:run` | Apply pending migrations using the custom runner |
| `npm run db:push` | Push schema directly to DB (dev only, no migration files) |

## Seeding Options

There are three seed scripts for different purposes:

| Script | Command | What it creates |
|--------|---------|----------------|
| **Full demo** | `node db/seed-demo.cjs` | Complete demo business with all data (recommended for testing) |
| **Minimal seed** | `npx tsx db/seed.ts` | Basic locations, accounts, categories, suppliers |
| **Accounting COA** | `npx tsx db/seed-accounting.ts` | Full chart of accounts with GL classification |

## Common Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `DATABASE_URL is not set` | Missing or incomplete `.env` | `cp .env.example .env` and fill in values |
| `ECONNREFUSED :5432` | PostgreSQL not running | Start PostgreSQL service or check `pg_isready` |
| `relation "accounts" does not exist` | Migrations not run | `npm run db:migrate:run` |
| `openssl: command not found` *(Windows)* | OpenSSL not on PATH | Install OpenSSL or use `npm run dev:app` |
| Port 3000 in use | Another process on that port | Kill the process or set `PORT` env var |
| `Cannot find module 'tsx'` | Dependencies not installed | `npm install` |
| CORS errors in browser | `APP_URL` mismatch | Set `APP_URL` to match your browser URL |
| Portless fails to start | CA certificate not trusted | Run `npx portless trust` or use `npm run dev:app` |

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

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `APP_ID` | — | Application identifier |
| `APP_SECRET` | — | JWT signing secret |
| `APP_URL` | `http://localhost:5173` | Frontend URL for CORS |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost factor |
| `NHIF_RATE` | `2.75` | NHIF/SHIF contribution rate (%) |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window in ms |
| `RATE_LIMIT_MAX_LOGIN` | `10` | Max login attempts per window |
| `RATE_LIMIT_MAX_API` | `100` | Max API requests per window |

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the GNU Affero General Public License v3.0 — see the [LICENSE](LICENSE) file for details.
