# Rica Spa Voucher System — Tracker

## 🔴 Critical — verify before any real launch

- [ ] **End-to-end payment confirmation still not fully verified.** A real
      M-Pesa STK push was confirmed reaching IntaSend with the correct
      amount — but the full chain past that point hasn't been proven yet:
  - [ ] Does the "COMPLETE" event fire and redirect back to `/vouchers?ref=...`?
  - [ ] Does the webhook actually get called by IntaSend, verify the
        challenge, and finalize (check: does `completed:REF` appear in KV
        with a code)?
  - [ ] Does the buyer actually receive the voucher email?
  - [ ] For a gift purchase with a recipient email filled in: does the
        recipient get the voucher, AND does the buyer get the separate
        confirmation email?
  - **How to test:** once sandbox keys are approved, run a full sandbox
    purchase and check every box above. If sandbox approval is slow, a
    single real 500 KES purchase covers the same ground.

## 🟠 Security & reliability

- [x] Removed public "Test Mode" checkbox from the live site
- [x] `/api/create-voucher` requires `X-Test-Secret` header
- [x] Fixed corrupted `_redirects` file (had debug curl text committed into it by mistake)
- [x] **Webhook idempotency** — pending record is now claimed (deleted)
      before finalizing, so a duplicate IntaSend webhook call can't create a
      second voucher. Failed finalizations are preserved under `failed:REF`
      instead of being silently lost.
- [x] **Truthful order states** — `/api/order-status` now returns
      `pending` / `completed` / `failed` / `unknown` instead of just
      inferring "completed" from an absent pending record
- [x] **Buyer confirmation email now checks `response.ok`** — a failed
      Resend call is recorded (`emailWarning`) instead of silently treated
      as success
- [x] **Voucher codes now use `crypto.getRandomValues()`** instead of
      `Math.random()`
- [x] **Basic rate limiting** on `/api/initiate-payment` (8 attempts per IP
      per 10 min via KV). Not perfectly precise (KV isn't transactional),
      but stops casual spam. Cloudflare's dashboard-level Rate Limiting
      Rules can layer on top for stronger protection later.
- [x] **Redemption/lookup tool built** — `/staff-vouchers.html`, a simple
      passphrase-gated page for reception to look up or redeem a code
      without touching the Cloudflare dashboard. Needs `STAFF_SECRET` env var.
- [ ] Error responses still sometimes echo raw internal error strings —
      fine while debugging, worth trimming before real customers can
      trigger and see them
- [ ] Leftover Pesapal env vars still in Cloudflare, unused but uncleaned

## 🟡 Known gaps / decisions pending

- [ ] **Card support unconfirmed.** IntaSend's docs contradict each other.
      M-Pesa works regardless — confirm card status directly with IntaSend
      before promising "M-Pesa + card" anywhere in marketing
- [ ] **Discount voucher type** — UI exists (disabled, "Soon"), mechanics
      never decided
- [ ] Dead PHP contact/booking forms still referenced on the main site —
      Cloudflare Pages doesn't run PHP, these silently do nothing
- [ ] No dashboard/list view of all vouchers sold — only individually
      look-up-able by code

## ✅ Done

- [x] Voucher purchase form (cash amount / specific service / self-gift / gift-someone-else)
- [x] Real service catalog + server-side price validation
- [x] Voucher email + separate buyer confirmation email for gifts
- [x] Moved off Pesapal (not licensed in Kenya) to IntaSend (CBK-licensed)
- [x] Worked around IntaSend's Cloudflare Workers IP block via client-side SDK checkout
- [x] Clean `/vouchers` URL, page unlinked from nav + noindex while in progress
- [x] Full security/reliability hardening pass (see above)
