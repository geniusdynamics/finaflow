---
name: subscriptions-best-practices
description: Manage subscriptions with PayKit's unified subscribe API, handle upgrades, downgrades, cancellations, resumptions, checkout flows, payment URLs, and subscription status transitions. Use when users need to implement subscription flows or understand PayKit's subscribe semantics.
---

# Subscriptions

PayKit uses a single `subscribe()` method for all subscription transitions.

## subscribe()

```typescript
const result = await paykit.subscribe({
  customerId: "user_123",
  planId: "pro",
  successUrl: "https://example.com/billing?success=true",
  cancelUrl: "https://example.com/billing",
})
```

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `customerId` | Yes | Your app's user ID |
| `planId` | Yes | Target plan ID (type-safe) |
| `successUrl` | Yes | Redirect after successful checkout |
| `cancelUrl` | No | Redirect if user cancels checkout |
| `forceCheckout` | No | Always redirect to checkout, even if payment method exists |

### Return Value

```typescript
interface SubscribeResult {
  paymentUrl: string | null
  invoice?: {
    providerInvoiceId: string
    hostedUrl: string | null
    currency: string
    totalAmount: number
    status: string | null
  }
  requiredAction?: {
    type: string
    paymentIntentId?: string
    clientSecret?: string
  } | null
}
```

---

## Transition Semantics

`subscribe()` determines the correct action based on the customer's current state:

| Current State | Target | Behavior |
|--------------|--------|----------|
| No subscription | Free plan | Activates immediately |
| No subscription | Paid plan, no payment method | Returns `paymentUrl` for Stripe Checkout |
| No subscription | Paid plan, has payment method | Creates subscription directly |
| On free plan | Paid plan | Checkout or direct subscription |
| On paid plan | Higher-priced plan (same group) | **Upgrade**: switches immediately |
| On paid plan | Lower-priced plan (same group) | **Downgrade**: scheduled for period end |
| On paid plan | Free plan (same group) | **Cancel**: scheduled for period end |
| Pending cancel | Same plan | **Resume**: clears cancellation |
| Pending downgrade | Current plan | **Resume**: cancels the scheduled change |
| On current plan | Same plan, no pending changes | No-op |

---

## Server-Side Usage

```typescript
// New subscription (may require checkout)
const { paymentUrl } = await paykit.subscribe({
  customerId: "user_123",
  planId: "pro",
  successUrl: "/billing?success=true",
})

if (paymentUrl) {
  // Redirect user to Stripe Checkout
  redirect(paymentUrl)
}

// Upgrade (immediate, no checkout needed)
await paykit.subscribe({
  customerId: "user_123",
  planId: "enterprise",
  successUrl: "/billing",
})

// Downgrade (scheduled for period end)
await paykit.subscribe({
  customerId: "user_123",
  planId: "free",
  successUrl: "/billing",
})

// Resume a pending cancellation
await paykit.subscribe({
  customerId: "user_123",
  planId: "pro", // same plan they're on
  successUrl: "/billing",
})
```

---

## Client-Side Usage

The client SDK omits `customerId` because it is resolved via `identify`.

```typescript
import { paykitClient } from "@/lib/paykit-client"

// Subscribe to a plan
await paykitClient.subscribe({
  planId: "pro",
  successUrl: `${window.location.origin}/billing?success=true`,
  cancelUrl: `${window.location.origin}/billing`,
})

// Open Stripe Customer Portal (manage payment methods, invoices)
await paykitClient.customerPortal({
  returnUrl: window.location.href,
})
```

---

## Reading Subscription State

```typescript
const customer = await paykit.getCustomer({ id: "user_123" })

for (const sub of customer.subscriptions) {
  console.log(sub.planId)              // "pro"
  console.log(sub.status)             // "active", "canceled", etc.
  console.log(sub.cancelAtPeriodEnd)  // true if pending cancellation
  console.log(sub.currentPeriodEnd)   // when the current period ends
}
```

---

## Handling Checkout Redirects

When `subscribe()` returns a `paymentUrl`, redirect the user to complete payment:

**Server component / API route:**

```typescript
import { redirect } from "next/navigation"

const { paymentUrl } = await paykit.subscribe({
  customerId: userId,
  planId: "pro",
  successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
})

if (paymentUrl) {
  redirect(paymentUrl)
}
```

**Client-side:**

```typescript
const result = await paykitClient.subscribe({
  planId: "pro",
  successUrl: `${window.location.origin}/billing?success=true`,
})
```

The client SDK handles redirects automatically when a `paymentUrl` is returned.

---

## Webhooks

Stripe sends webhooks for subscription lifecycle events. PayKit processes them automatically via the route handler.

Ensure your webhook endpoint is configured in Stripe to point to `{your-domain}/paykit/api/webhook`.

To react to subscription changes in your app:

```typescript
export const paykit = createPayKit({
  // ...
  on: {
    "customer.updated": ({ payload }) => {
      // Sync subscription state to your app
      await updateUserRole(payload.customerId, payload.subscriptions)
    },
  },
})
```

---

## Stripe Customer Portal

Let customers manage their billing (update payment method, view invoices, cancel):

```typescript
// Server-side
const { url } = await paykit.customerPortal({
  customerId: "user_123",
  returnUrl: "https://example.com/billing",
})

// Client-side
await paykitClient.customerPortal({
  returnUrl: window.location.href,
})
```
