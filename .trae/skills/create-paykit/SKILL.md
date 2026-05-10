---
name: create-paykit
description: Scaffold and implement billing in TypeScript apps with PayKit. Detect framework, configure database, set up Stripe provider, mount route handler, create client, define plans and features. Use when users need to add billing to a new or existing project with PayKit.
---

# Create PayKit

Scaffold billing in a TypeScript application using PayKit.

## Planning Phase

Before writing any code, determine:

1. **Framework**: detect from project files:

| File | Framework |
|------|-----------|
| `next.config.*` | Next.js (App Router) |
| `package.json` with `"next"` | Next.js |

Currently only Next.js is supported.

2. **Database**: check for existing PostgreSQL setup:
   - Look for `DATABASE_URL` in `.env` or `.env.local`
   - Check for existing Drizzle/Prisma config
   - If none exists, ask the user for their PostgreSQL connection string

3. **Stripe**: check for existing Stripe keys:
   - Look for `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `.env`
   - If missing, inform the user they need these from the Stripe dashboard

4. **Ask the user** what plans they need:
   - How many plan tiers? (e.g., free, pro, enterprise)
   - Any metered features? (e.g., API calls, messages, storage)
   - Any boolean features? (e.g., priority support, custom branding)
   - Pricing and billing intervals?

## Implementation

### 1. Install dependencies

```bash
pnpm add paykitjs @paykitjs/stripe
```

### 2. Add environment variables

Add to `.env.local`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

### 3. Create PayKit configuration

Create `lib/paykit.ts` (or `src/lib/paykit.ts` depending on project structure):

```typescript
import { createPayKit, feature, plan } from "paykitjs"
import { stripe } from "@paykitjs/stripe"

const messages = feature({ id: "messages", type: "metered" })
const proModels = feature({ id: "pro_models", type: "boolean" })

const free = plan({
  id: "free",
  group: "base",
  default: true,
  includes: [messages({ limit: 100, reset: "month" })],
})

const pro = plan({
  id: "pro",
  group: "base",
  price: { amount: 19, interval: "month" },
  includes: [
    messages({ limit: 2_000, reset: "month" }),
    proModels(),
  ],
})

export const paykit = createPayKit({
  database: process.env.DATABASE_URL!,
  provider: stripe({
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  }),
  plans: [free, pro],
  basePath: "/paykit",
  identify: async (request) => {
    // Replace with your auth logic
    // Return { customerId, email, name } or null
    return null
  },
})
```

Adapt features, plans, and pricing to what the user described in the planning phase.

### 4. Mount the route handler

Create `app/paykit/[[...slug]]/route.ts`:

```typescript
import { paykitHandler } from "paykitjs/handlers/next"
import { paykit } from "@/lib/paykit"

export const { GET, POST } = paykitHandler(paykit)
```

### 5. Create the client

Create `lib/paykit-client.ts`:

```typescript
import { createPayKitClient } from "paykitjs/client"
import type { paykit } from "./paykit"

export const paykitClient = createPayKitClient<typeof paykit>()
```

### 6. Push schema to database and Stripe

```bash
npx paykitjs push
```

This creates the database tables and syncs plans/prices to Stripe.

### 7. Verify

- [ ] `lib/paykit.ts` exists with plans, features, and provider configured
- [ ] Route handler mounted at `app/paykit/[[...slug]]/route.ts`
- [ ] Client created in `lib/paykit-client.ts`
- [ ] Environment variables set in `.env.local`
- [ ] `npx paykitjs push` completes without errors
- [ ] `npx paykitjs status` shows all plans synced
