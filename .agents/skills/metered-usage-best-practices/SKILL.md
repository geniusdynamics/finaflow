---
name: metered-usage-best-practices
description: Implement usage-based billing with PayKit's check and report methods, gate features by entitlements, track and decrement usage, handle balance resets, and build metered billing flows. Use when users need to add usage limits, API rate limiting, or consumption-based billing with PayKit.
---

# Metered Usage

Gate access and track consumption with `check()` and `report()`.

## check()

Verify whether a customer can use a feature.

```typescript
const result = await paykit.check({
  customerId: "user_123",
  featureId: "messages",
})

if (!result.allowed) {
  throw new Error("Usage limit reached")
}
```

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `customerId` | Yes | Your app's user ID |
| `featureId` | Yes | Feature to check (type-safe) |
| `required` | No | Check if at least this many units remain |

### Return Value

```typescript
interface CheckResult {
  allowed: boolean
  balance: {
    limit: number
    remaining: number
    resetAt: Date | null
    unlimited: boolean
  } | null
}
```

**For boolean features:** `allowed` is `true`/`false`, `balance` is `null`.

**For metered features:** `allowed` is `true` if `remaining > 0` (or `remaining >= required`), `balance` contains usage details.

### Pre-checking Availability

Use `required` to check if enough units remain before a batch operation:

```typescript
const { allowed } = await paykit.check({
  customerId: "user_123",
  featureId: "api_calls",
  required: 50,
})

if (!allowed) {
  throw new Error("Not enough API calls remaining")
}
```

---

## report()

Decrement usage after consumption.

```typescript
const result = await paykit.report({
  customerId: "user_123",
  featureId: "messages",
  amount: 1,
})

if (!result.success) {
  // Usage limit exceeded
}
```

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `customerId` | Yes | Your app's user ID |
| `featureId` | Yes | Feature to decrement (type-safe) |
| `amount` | No | Units consumed. Default: `1` |

### Return Value

```typescript
interface ReportResult {
  success: boolean
  balance: {
    limit: number
    remaining: number
    resetAt: Date | null
    unlimited: boolean
  } | null
}
```

`success` is `false` if the customer doesn't have enough remaining balance.

---

## Usage Patterns

### Gate before action (check-then-act)

```typescript
const { allowed } = await paykit.check({
  customerId: userId,
  featureId: "messages",
})

if (!allowed) {
  return { error: "Message limit reached. Upgrade your plan." }
}

await sendMessage(content)

await paykit.report({
  customerId: userId,
  featureId: "messages",
})
```

### Atomic check-and-decrement

For simpler flows, skip `check()` and use `report()` directly. It fails if balance is insufficient:

```typescript
const { success, balance } = await paykit.report({
  customerId: userId,
  featureId: "api_calls",
})

if (!success) {
  return Response.json(
    { error: "API call limit exceeded", resetAt: balance?.resetAt },
    { status: 429 },
  )
}

// Process the API call
```

### Boolean feature gate

```typescript
const { allowed } = await paykit.check({
  customerId: userId,
  featureId: "custom_branding",
})

if (!allowed) {
  return { error: "Custom branding requires a Pro plan" }
}
```

### Show usage to the user

```typescript
const { balance } = await paykit.check({
  customerId: userId,
  featureId: "messages",
})

// balance.remaining  // units left
// balance.limit      // total allowed
// balance.resetAt    // when usage resets
// balance.unlimited  // true if no limit
```

---

## Entitlement Resets

Metered entitlements reset lazily. The reset doesn't happen on a cron. It triggers on the next `check()` or `report()` call after the reset time has passed.

| Reset Interval | Behavior |
|----------------|----------|
| `"day"` | Resets every 24 hours from first usage |
| `"week"` | Resets every 7 days |
| `"month"` | Resets every calendar month |
| `"year"` | Resets every calendar year |

---

## Reading Entitlements Directly

Entitlements are also available on the customer object:

```typescript
const customer = await paykit.getCustomer({ id: "user_123" })

for (const [featureId, entitlement] of Object.entries(customer.entitlements)) {
  console.log(featureId)            // "messages"
  console.log(entitlement.balance)  // current balance
  console.log(entitlement.limit)    // max allowed
  console.log(entitlement.usage)    // consumed
  console.log(entitlement.unlimited) // boolean
  console.log(entitlement.nextResetAt)
}
```

---

## Complete Example: AI Chat with Usage Limits

```typescript
// lib/paykit.ts
const messages = feature({ id: "messages", type: "metered" })
const proModels = feature({ id: "pro_models", type: "boolean" })

const free = plan({
  id: "free",
  group: "base",
  default: true,
  includes: [messages({ limit: 50, reset: "day" })],
})

const pro = plan({
  id: "pro",
  group: "base",
  price: { amount: 20, interval: "month" },
  includes: [messages({ limit: 2_000, reset: "day" }), proModels()],
})

// app/api/chat/route.ts
export async function POST(request: Request) {
  const { userId, model, content } = await request.json()

  // Check message quota
  const { allowed, balance } = await paykit.check({
    customerId: userId,
    featureId: "messages",
  })

  if (!allowed) {
    return Response.json({
      error: "Daily message limit reached",
      resetAt: balance?.resetAt,
    }, { status: 429 })
  }

  // Check model access
  if (model === "gpt-4") {
    const { allowed } = await paykit.check({
      customerId: userId,
      featureId: "pro_models",
    })
    if (!allowed) {
      return Response.json(
        { error: "Pro models require a Pro plan" },
        { status: 403 },
      )
    }
  }

  const response = await generateResponse(model, content)

  // Decrement usage
  await paykit.report({
    customerId: userId,
    featureId: "messages",
  })

  return Response.json({ response })
}
```
