---
name: stripe-best-practices
description: Configure the Stripe provider for PayKit, set up API keys, webhook endpoints, sync plans with paykitjs push, handle webhooks, and use the Stripe Customer Portal. Use when users need to connect PayKit to Stripe or troubleshoot Stripe integration.
---

# Stripe Provider

Connect PayKit to Stripe with `@paykitjs/stripe`.

## Setup

### 1. Install the provider

```bash
pnpm add @paykitjs/stripe
```

### 2. Get your Stripe keys

From the [Stripe Dashboard](https://dashboard.stripe.com/apikeys):
- **Secret key** (`sk_test_...` or `sk_live_...`)
- **Webhook signing secret** (`whsec_...`), created when you add a webhook endpoint

### 3. Add environment variables

```env
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

### 4. Configure the provider

```typescript
import { createPayKit } from "paykitjs"
import { stripe } from "@paykitjs/stripe"

export const paykit = createPayKit({
  // ...
  provider: stripe({
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  }),
})
```

---

## Syncing Plans to Stripe

After defining or changing plans, sync them:

```bash
npx paykitjs push
```

This creates/updates in Stripe:
- **Products**: one per plan
- **Prices**: one per plan with pricing

Check sync status:

```bash
npx paykitjs status
```

**Note:** Always run `push` after modifying plans. PayKit won't auto-sync on startup.

---

## Webhook Setup

PayKit processes Stripe webhooks through its route handler. Configure Stripe to send webhooks to:

```
https://your-domain.com/paykit/api/webhook
```

### Required Stripe webhook events

PayKit needs these events enabled in your Stripe webhook endpoint:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

### Local development

Use the Stripe CLI to forward webhooks locally:

```bash
stripe listen --forward-to localhost:3000/paykit/api/webhook
```

The CLI outputs a webhook signing secret (`whsec_...`). Use this as `STRIPE_WEBHOOK_SECRET` in development.

---

## Customer Portal

Stripe's Customer Portal lets customers manage their billing. PayKit provides a wrapper:

**Server-side:**

```typescript
const { url } = await paykit.customerPortal({
  customerId: "user_123",
  returnUrl: "https://example.com/billing",
})

// Redirect user to url
```

**Client-side:**

```typescript
await paykitClient.customerPortal({
  returnUrl: window.location.href,
})
```

Configure the Customer Portal appearance and features in the [Stripe Dashboard](https://dashboard.stripe.com/settings/billing/portal).

---

## How PayKit Uses Stripe

PayKit maps its concepts to Stripe objects:

| PayKit | Stripe |
|--------|--------|
| Customer | Customer |
| Plan | Product |
| Plan price | Price |
| Subscription | Subscription |
| Checkout flow | Checkout Session |

PayKit stores its own records in your PostgreSQL database and keeps them in sync with Stripe via webhooks.

---

## Test vs Live Mode

Use Stripe test keys (`sk_test_...`) during development. Switch to live keys (`sk_live_...`) for production.

PayKit doesn't distinguish between modes. It follows whatever key you provide.

**Test cards:** Use Stripe's [test card numbers](https://docs.stripe.com/testing#cards) to simulate payments:
- `4242 4242 4242 4242` succeeds
- `4000 0000 0000 0002` declines

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Webhooks not arriving | Verify endpoint URL matches `basePath + /api/webhook` |
| Webhook signature fails | Check `STRIPE_WEBHOOK_SECRET` matches the endpoint's signing secret |
| Plans not in Stripe | Run `npx paykitjs push` |
| Checkout redirects to wrong URL | Check `successUrl` and `cancelUrl` in `subscribe()` |
| Customer Portal not configured | Set it up in Stripe Dashboard > Settings > Billing > Portal |
| Local webhooks not working | Run `stripe listen --forward-to localhost:3000/paykit/api/webhook` |
