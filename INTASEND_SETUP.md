# IntaSend Payment Integration — Setup

## 1. Sign up and get keys

Sign up at https://intasend.com (or log in if you already have an account
from checking it out earlier). Once verified:

- Dashboard → **Settings → API Keys**
- You'll see **Test** and **Live** keys separately — both work against the
  same API URL, IntaSend tells them apart by the key itself, not a different
  sandbox domain like Pesapal used
- Grab your **Publishable Key** and **Secret Key** from the Test section
  while developing

## 2. Set environment variables

Cloudflare dashboard → `ricaspa` project → **Settings → Environment variables**
(or `npx wrangler pages secret put NAME --project-name=ricaspa` from the CLI,
whichever you used before):

```
INTASEND_PUBLISHABLE_KEY = your test publishable key
INTASEND_SECRET_KEY = your test secret key
INTASEND_WEBHOOK_CHALLENGE = (see step 3 — you choose this string yourself)
```

## 3. Set up the webhook (dashboard-based, not an API call)

Unlike Pesapal, you don't register the webhook via a curl command — it's
configured directly in the IntaSend dashboard:

1. Dashboard → **Webhooks**
2. Set the destination URL to:
   ```
   https://ricaspa.beauty/api/payment-webhook
   ```
3. Set a **challenge** — this is just a secret string *you* make up (e.g. a
   long random password). IntaSend sends it back with every webhook call so
   you can verify the request actually came from them.
4. Put that exact same string in the `INTASEND_WEBHOOK_CHALLENGE` env var
   from step 2.

## 4. Deploy

```bash
npx wrangler pages deploy . --project-name=ricaspa
```

## 5. Test the flow

1. Go to `ricaspa.beauty/vouchers`, uncheck **Test mode**
2. Submit the form — you should get redirected to IntaSend's checkout page
3. On test keys, IntaSend's sandbox lets you complete M-Pesa/card flows
   without moving real money — check their docs for current test card
   numbers if the checkout page doesn't show them directly
4. After completing checkout, you'll land back on `vouchers?ref=...`
   which polls `/api/order-status` until the voucher is confirmed
5. Check the buyer's inbox — email should arrive once IntaSend's webhook
   fires

## How it actually works (for reference)

- `/api/initiate-payment` — validates the form, asks IntaSend for a checkout
  URL, stashes the voucher details plus IntaSend's `checkout_id`/`signature`
  in KV under `pending:REF`, returns the checkout URL to the browser
- The browser redirects to IntaSend's hosted checkout (customer picks M-Pesa
  or card there)
- `/api/payment-webhook` — **this is the real source of truth.** IntaSend
  calls this when payment state changes. It verifies the challenge string,
  checks the state is `COMPLETE`, and only then generates the voucher code,
  saves it, and sends the email.
- `/api/order-status` — the frontend polls this after redirect-back, just to
  show the customer a status message. It doesn't finalize anything itself —
  it double-checks directly with IntaSend using the stored `checkout_id` in
  case the webhook hasn't landed yet.

Same reasoning as before on why finalization lives in the webhook and not
the browser redirect: if the customer closes the tab right after paying, the
webhook still fires and the voucher still gets created and emailed.

## Going live

Once you're ready for real payments:
1. Switch to your **Live** publishable/secret keys from the same API Keys page
2. Set up a second webhook entry in the dashboard pointing at the same URL,
   using your live keys' challenge (or reuse the same challenge if IntaSend's
   dashboard doesn't separate test/live webhook config — check what your
   dashboard shows)
3. Update the Cloudflare env vars with the live keys
4. Redeploy
