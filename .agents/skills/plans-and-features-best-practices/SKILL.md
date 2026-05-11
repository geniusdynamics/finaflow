---
name: plans-and-features-best-practices
description: Define billing plans and features with PayKit's schema DSL, configure plan groups, boolean and metered features, pricing intervals, default plans, and inferred TypeScript types. Use when users need to model their billing structure, add new plans, or modify features with PayKit.
---

# Plans and Features

Define your billing structure in code with PayKit's schema DSL.

## Features

A feature is a capability that a plan grants. Two types:

### Boolean Features

On/off access. Either the customer has it or doesn't.

```typescript
import { feature } from "paykitjs"

const customBranding = feature({ id: "custom_branding", type: "boolean" })
const prioritySupport = feature({ id: "priority_support", type: "boolean" })
```

### Metered Features

Tracked usage with a limit that resets on an interval.

```typescript
const messages = feature({ id: "messages", type: "metered" })
const apiCalls = feature({ id: "api_calls", type: "metered" })
const storage = feature({ id: "storage_gb", type: "metered" })
```

Metered features require `limit` and `reset` when included in a plan.

**Feature ID rules:** lowercase alphanumeric with `_` and `-`, 1-64 characters.

---

## Plans

A plan bundles features together with optional pricing.

```typescript
import { plan } from "paykitjs"

const free = plan({
  id: "free",
  group: "base",
  default: true,
  includes: [
    messages({ limit: 100, reset: "month" }),
    apiCalls({ limit: 1_000, reset: "month" }),
  ],
})

const pro = plan({
  id: "pro",
  group: "base",
  price: { amount: 29, interval: "month" },
  includes: [
    messages({ limit: 5_000, reset: "month" }),
    apiCalls({ limit: 50_000, reset: "month" }),
    customBranding(),
    prioritySupport(),
  ],
})

const enterprise = plan({
  id: "enterprise",
  group: "base",
  price: { amount: 99, interval: "month" },
  includes: [
    messages({ limit: 100_000, reset: "month" }),
    apiCalls({ limit: 1_000_000, reset: "month" }),
    customBranding(),
    prioritySupport(),
  ],
})
```

### Plan Options

| Option | Required | Description |
|--------|----------|-------------|
| `id` | Yes | Unique identifier. Lowercase alphanumeric, `_`, `-`. 1-64 chars |
| `group` | No | Mutual exclusivity group. Customer can have one active plan per group |
| `default` | No | Auto-subscribe new customers. Requires `group` |
| `price` | No | `{ amount, interval }`. Omit for free plans |
| `name` | No | Display name. Auto-derived from ID if omitted |
| `includes` | No | Array of feature includes |

### Pricing

```typescript
price: { amount: 19, interval: "month" }
price: { amount: 190, interval: "year" }
```

`amount` is in the provider's default currency unit (dollars for USD). Max: $999,999.99.

`interval`: `"month"` or `"year"`.

---

## Plan Groups

Plans in the same group are mutually exclusive. A customer can only hold one active plan per group at a time. Switching between plans in the same group triggers upgrade/downgrade logic automatically.

```typescript
// These three plans are mutually exclusive
const free = plan({ id: "free", group: "base", default: true, ... })
const pro = plan({ id: "pro", group: "base", ... })
const enterprise = plan({ id: "enterprise", group: "base", ... })
```

**Default plan:** One plan per group can be `default: true`. New customers are auto-subscribed to it on `upsertCustomer`.

---

## Feature Reset Intervals

For metered features, `reset` determines when usage resets:

| Reset | Period |
|-------|--------|
| `"day"` | Every 24 hours |
| `"week"` | Every 7 days |
| `"month"` | Every calendar month |
| `"year"` | Every calendar year |

Reset is lazy. It happens on the next `check()` or `report()` call after the reset time passes.

---

## Including Features in Plans

Boolean features take no arguments:

```typescript
includes: [customBranding(), prioritySupport()]
```

Metered features require `limit` and `reset`:

```typescript
includes: [messages({ limit: 5_000, reset: "month" })]
```

The same feature can have different limits across plans:

```typescript
const free = plan({
  id: "free",
  includes: [messages({ limit: 100, reset: "month" })],
})

const pro = plan({
  id: "pro",
  includes: [messages({ limit: 5_000, reset: "month" })],
})
```

---

## Passing Plans to PayKit

```typescript
export const paykit = createPayKit({
  // ...
  plans: [free, pro, enterprise],
})
```

After changing plans, run `npx paykitjs push` to sync to the database and Stripe.

---

## Type Inference

Plan and feature IDs are inferred as literal types:

```typescript
type PlanId = typeof paykit.$infer.planId
// "free" | "pro" | "enterprise"

type FeatureId = typeof paykit.$infer.featureId
// "messages" | "api_calls" | "custom_branding" | "priority_support"
```

These types flow through to `subscribe()`, `check()`, `report()`, and the client SDK.

---

## Common Billing Models

### SaaS with tiers

```typescript
const free = plan({ id: "free", group: "main", default: true, includes: [...] })
const pro = plan({ id: "pro", group: "main", price: { amount: 29, interval: "month" }, includes: [...] })
```

### Usage-based (AI, API)

```typescript
const tokens = feature({ id: "tokens", type: "metered" })
const starter = plan({
  id: "starter", group: "main", default: true,
  includes: [tokens({ limit: 10_000, reset: "month" })],
})
const growth = plan({
  id: "growth", group: "main",
  price: { amount: 49, interval: "month" },
  includes: [tokens({ limit: 100_000, reset: "month" })],
})
```

### Feature-gated

```typescript
const analytics = feature({ id: "analytics", type: "boolean" })
const sso = feature({ id: "sso", type: "boolean" })
const basic = plan({ id: "basic", group: "main", default: true, includes: [] })
const business = plan({
  id: "business", group: "main",
  price: { amount: 79, interval: "month" },
  includes: [analytics(), sso()],
})
```
