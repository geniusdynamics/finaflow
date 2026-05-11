---
name: paykit-best-practices
description: Configure PayKit server and client, set up database connections, manage customer identification, handle events, configure logging, and use testing mode. Use when users need to configure or troubleshoot their PayKit setup.
---

# PayKit Best Practices

General configuration reference for PayKit.

## createPayKit Options

```typescript
import { createPayKit } from "paykitjs"

export const paykit = createPayKit({
  database: process.env.DATABASE_URL!,
  provider: stripe({ ... }),
  plans: [free, pro, enterprise],
  basePath: "/paykit",
  identify: async (request) => { ... },
  on: { ... },
  plugins: [dash()],
  logging: { ... },
  testing: { ... },
})
```

| Option | Required | Description |
|--------|----------|-------------|
| `database` | Yes | PostgreSQL connection string or `pg.Pool` instance |
| `provider` | Yes | Payment provider config (e.g., `stripe()`) |
| `plans` | No | Array of plans defined with `plan()` |
| `basePath` | No | API route prefix. Default: `"/paykit"` |
| `identify` | No | Resolve customer from HTTP request |
| `on` | No | Event handlers |
| `plugins` | No | Array of plugins |
| `logging` | No | Logging configuration |
| `testing` | No | Testing mode configuration |

---

## Customer Identification

The `identify` function resolves a customer from an incoming HTTP request. Required for client-side SDK usage.

```typescript
export const paykit = createPayKit({
  // ...
  identify: async (request) => {
    const session = await getSession(request)
    if (!session) return null

    return {
      customerId: session.user.id,
      email: session.user.email,
      name: session.user.name,
    }
  },
})
```

**Rules:**
- Return `{ customerId, email?, name? }` or `null`
- When `identify` is set, client requests are authenticated through it
- If the resolved `customerId` doesn't match a request's explicit `customerId`, PayKit rejects with 403
- Without `identify`, client SDK methods won't work. Only server-side calls are available

---

## Event Handlers

```typescript
export const paykit = createPayKit({
  // ...
  on: {
    "customer.updated": ({ payload }) => {
      // Fires when subscriptions or entitlements change
      console.log(`Customer ${payload.customerId} updated`)
      console.log("Subscriptions:", payload.subscriptions)
    },
    "*": ({ event }) => {
      // Wildcard: fires on every event
      console.log(`Event: ${event.name}`)
    },
  },
})
```

Use `customer.updated` to sync billing state to your app (e.g., update user roles, invalidate caches).

---

## Database

PayKit uses PostgreSQL with Drizzle ORM internally. All tables are prefixed with `paykit_`.

**Connection options:**

```typescript
// Connection string
database: "postgresql://user:pass@localhost:5432/mydb"

// pg.Pool instance (for connection pooling)
import pg from "pg"
database: new pg.Pool({ connectionString: process.env.DATABASE_URL })
```

**Schema management:**

```bash
npx paykitjs push    # Create tables + sync plans to DB and Stripe
npx paykitjs status  # Check sync state
```

Never edit PayKit's database tables directly. Use the API methods.

---

## Customer Management

```typescript
// Create or update a customer
await paykit.upsertCustomer({
  id: "user_123",
  email: "jane@example.com",
  name: "Jane Doe",
})

// Get customer with subscriptions and entitlements
const customer = await paykit.getCustomer({ id: "user_123" })

// List customers with pagination
const { data, total, hasMore } = await paykit.listCustomers({
  limit: 50,
  offset: 0,
  planIds: ["pro"],
})

// Delete a customer
await paykit.deleteCustomer({ id: "user_123" })
```

**Note:** `upsertCustomer` auto-subscribes to the default plan if the customer doesn't exist yet.

---

## Type Inference

PayKit infers plan and feature IDs from your configuration:

```typescript
// Access inferred types
type PlanId = typeof paykit.$infer.planId       // "free" | "pro" | ...
type FeatureId = typeof paykit.$infer.featureId // "messages" | "pro_models" | ...

// Client inherits types from the instance
const client = createPayKitClient<typeof paykit>()
// client.subscribe({ planId: "pro" })  // planId is typed
```

---

## Route Handler

Mount PayKit's API routes in your framework:

**Next.js (App Router):**

```typescript
// app/paykit/[[...slug]]/route.ts
import { paykitHandler } from "paykitjs/handlers/next"
import { paykit } from "@/lib/paykit"

export const { GET, POST } = paykitHandler(paykit)
```

The `basePath` option in `createPayKit` must match the route path.

---

## Testing Mode

For tests, use testing mode to avoid hitting Stripe:

```typescript
const paykit = createPayKit({
  // ...
  testing: {
    enabled: true,
  },
})
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Client methods return 401 | `identify` is missing or returning `null` |
| Plans not showing in Stripe | Run `npx paykitjs push` |
| Tables not created | Run `npx paykitjs push` |
| Customer not auto-subscribed | Ensure a plan has `default: true` in its group |
| `basePath` mismatch | `createPayKit({ basePath })` must match your route handler path |
