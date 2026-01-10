---
title: Required Environment Variables
description: A detailed guide to configuring and using environment variables in your project.
---

:::note
If you're not familiar with environment variables, you can [read more about them in the introduction section](/docs/intro/env/). The current page is only describing where to find the required keys to fill out your `.env` file.
:::

If you're using the Versator Next.js Template, you'll need to fill out the `.env` file to run and build your project. Versator v1.3.0 requires the following environment variables:

## General

:::tip
On production, this should be the URL of your deployed app.
:::

**NEXT_PUBLIC_APP_URL**:

- Default: `http://localhost:3000`
- Format: `https://example.com`

## Database

:::tip
It's recommended to use a cloud PostgreSQL database service like [Neon](https://neon.tech).

When the following connection string is set, you can run [Drizzle](https://orm.drizzle.team) ORM's `bun db:push` command to create/update the database tables.
:::

**DATABASE_URL**:

- Default: `undefined`
- Format: `postgresql://username:password@localhost:5432/database_name`

## Clerk

:::tip
You can find the required keys in the [Clerk](https://clerk.com) dashboard.
:::

**NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY**:

- Default: `undefined`
- Format: `pk_test_•••`

**CLERK_SECRET_KEY**:

- Default: `undefined`
- Format: `sk_test_•••`

**CLERK_ENCRYPTION_KEY**:

- Default: `undefined`
- Format: `•••`
- Helper: `bunx randomstring length=64`

## Stripe

:::tip
You can find the required keys in the [Stripe](https://stripe.com) dashboard.

Make sure you have the test mode enabled in the right top corner of the dashboard.
:::

**NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY**:

- Default: `undefined`
- Format: `pk_test_•••`

**STRIPE_API_KEY**:

- Default: `undefined`
- Format: `sk_test_•••`

**STRIPE_PRO_MONTHLY_PRICE_ID**:

- Default: `undefined`
- Format: `price_•••`

**STRIPE_WEBHOOK_SECRET**:

- Default: `undefined`
- Format: `whsec_•••`

```bash
# [STRIPE WEBHOOK FOR DEVELOPMENT]
# 1. Install Stripe CLI: https://stripe.com/docs/stripe-cli#install
# 2. Create webhook: https://dashboard.stripe.com/test/webhooks/create?endpoint_location=local
# 3. Open 3 terminals:
#    - Terminal 1: "bun dev"
#    - Terminal 2: "stripe login"
#    - Terminal 3: "bun stripe:listen"
# 4. Copy the signing secret from the terminal and paste it into STRIPE_WEBHOOK_SIGNING_SECRET.
# 5. Run "stripe trigger payment_intent.succeeded", wait for it to complete, then click Done.
# Keep "bun stripe:listen" enabled when testing Stripe on localhost.
# Test data: 4242424242424242 | 12/34 | 567

# [STRIPE WEBHOOK FOR PRODUCTION]
# 1. Create webhook: https://dashboard.stripe.com/test/webhooks/create?endpoint_location=hosted
# 2. Endpoint: https://use-the-domain-here.com/api/webhooks/stripe
# 3. Select all events and add the endpoint.
# 4. Ensure "Latest API version" is selected.
# 5. Reveal the signing secret.
# Note: You will get the test-mode production signing key. Switch to live-mode for the real key.
```

## Uploadthing

:::tip
You can find the required keys in the [Uploadthing](https://uploadthing.com) dashboard.

Uploadthing is free to use. No worries if after signing up, you'll be redirected to the subscription purchase page. Just click on the Stripe's `←` button to go back to the Uploadthing dashboard and find the keys.
:::

**UPLOADTHING_TOKEN**:

- Default: `undefined`
- Format: `•••`

**UPLOADTHING_SECRET**:

- Default: `undefined`
- Format: `sk_live_•••`

## Resend

:::tip
You can find the required keys in the [Resend](https://resend.com) dashboard.
:::

**RESEND_API_KEY**:

- Default: `undefined`
- Format: `re_•••`

**EMAIL_FROM_ADDRESS**:

- Default: `onboarding@resend.dev`
- Format: `email@example.com`
