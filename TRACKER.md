# Rica Spa Voucher System — Tracker

## 🔴 Critical — verify before any real launch

- [ ] **Confirm migrations 0002 and 0003 are actually applied to the live
      D1 database.** Very likely cause of a real production 500 on
      `/api/book-session` (fixed in code — see below — but the underlying
      "did the migration run" question is still open). Check via
      `wrangler d1 migrations list ricaspa-ledger --remote` or the
      Cloudflare dashboard.
- [ ] **Confirm every required env var is actually set in Cloudflare.**
      `STAFF_SECRET` was referenced in code for two sessions without ever
      being set — don't assume the others are set just because the code
      references them. **Confirmed 2026-08-24: `BOOKING_NOTIFY_EMAIL` was
      never set**, which was silently breaking `/api/book-session`'s email
      send (no crash, just a swallowed failure — logging added, see
      `AI_HANDOFF.md`). Assume `CONTACT_NOTIFY_EMAIL` is in the same state
      until checked. Full checklist in `INTASEND_SETUP.md` §0:
      `INTASEND_PUBLISHABLE_KEY`, `INTASEND_SECRET_KEY`,
      `INTASEND_WEBHOOK_CHALLENGE`, `RESEND_API_KEY`, `STAFF_SECRET`,
      `TEST_MODE_SECRET`, `VOUCHER_SIGNING_SECRET`, `BOOKING_NOTIFY_EMAIL`,
      `CONTACT_NOTIFY_EMAIL`, `TURNSTILE_SECRET_KEY` — plus the `DB` and
      `VOUCHERS` bindings. Set in the **Production** environment
      specifically, then redeploy:
      `npx wrangler pages deploy . --project-name=ricaspa`.
- [x] **Turnstile site key set** (`0x4AAAAAAEcnrbs179lUlLpV`) in both
      forms in `index.html`, 2026-08-24. Still need to confirm
      `TURNSTILE_SECRET_KEY` is set in Cloudflare Production env vars —
      the site key alone doesn't verify anything server-side, both halves
      are required (see `AI_HANDOFF.md`'s bot-protection entry).
- [ ] **New `STAFF_SECRET` issued 2026-08-25** — set it in Cloudflare
      Production, redeploy, retest both staff pages. This replaces
      whatever value (if any) was set from the earlier passphrase.
- [ ] **Verify the booking and contact forms against the real deployment,
      not just the mock test suite.** `test/booking-contact.test.mjs`
      passes locally (34/34), but that only proves the code logic — submit
      both forms for real once deployed and confirm the emails actually
      land and D1 rows appear.
- [ ] **End-to-end payment confirmation still not fully verified.** A real
      M-Pesa STK push was confirmed reaching IntaSend with the correct
      amount — but the full chain past that point hasn't been proven yet:
  - [ ] Does the "COMPLETE" event fire and redirect back to `/vouchers?ref=...`?
  - [ ] Does the webhook actually get called by IntaSend, verify the
        challenge, and finalize (check: does `completed:REF` appear in KV
        with a code)?
  - [ ] Does the buyer actually receive the voucher email, QR included?
  - [ ] For a gift purchase with a recipient email filled in: does the
        recipient get the voucher, AND does the buyer get the separate
        confirmation email?
  - **How to test:** once sandbox keys are approved, run a full sandbox
    purchase and check every box above. If sandbox approval is slow, a
    single real 500 KES purchase covers the same ground.
- [ ] **Dashboard user storage is not configured (new blocker, 2026-08-27).**
      The dashboard reports: `Dashboard user storage is not configured.
      Bind your D1 database as DB and apply migrations/0004_dashboard_users.sql.`
      The current `mignon` branch contains migrations 0001–0003 but no
      `0004_dashboard_users.sql`, so this needs to be reconciled before
      dashboard authentication/user storage can be considered production-ready.
      First confirm the live Cloudflare Pages/Workers `DB` binding points to
      `ricaspa-ledger`; then add/apply the intended 0004 schema and retest
      `/dashboard` login and protected dashboard APIs. Do not mark resolved
      until the live deployment can authenticate and persist/read dashboard
      user records successfully.

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
- [x] **Basic rate limiting** on `/api/initiate-payment`, `/api/book-session`,
      and `/api/contact-message` (8 attempts per IP per 10 min via KV, each
      under its own key prefix). Not perfectly precise (KV isn't
      transactional), but stops casual spam. Cloudflare's dashboard-level
      Rate Limiting Rules can layer on top for stronger protection later.
- [x] **Redemption/lookup tool built** — `/staff-vouchers.html`, a simple
      passphrase-gated page for reception to look up or redeem a code
      without touching the Cloudflare dashboard. Needs `STAFF_SECRET` env var.
- [x] **D1 transaction ledger** — every order attempt, finalization
      state, and email send is recorded in D1 (`orders`, `email_events`),
      not just KV. Real database provisioned (see `wrangler.toml`).
- [x] **Signed QR codes on vouchers** — QR encodes `code.signature`
      (HMAC-SHA256, `VOUCHER_SIGNING_SECRET`), verified at
      `/api/redeem-voucher` when scanned. Prevents a fabricated/edited QR
      from being accepted; doesn't rotate over time (that's the deferred
      "live rotating page" idea below).
- [x] **Camera QR scanner on `/staff-vouchers.html`** — vendored `jsQR`
      (Apache-2.0, no CDN dependency), decodes `code.signature`, shows a
      "✓ verified" badge on a signature match.
- [x] **Booking + contact forms moved off Web3Forms onto Cloudflare
      Functions** (`/api/book-session`, `/api/contact-message`) — Resend +
      D1, same pattern as the rest of the app, no third-party dependency or
      hardcoded public access keys in client JS.
- [x] **Bot protection on booking + contact forms** — honeypot field
      (dropped silently) + Cloudflare Turnstile (verified server-side in
      `functions/_lib/turnstile.js`). Degrades to honeypot-only rather than
      blocking every submission if `TURNSTILE_SECRET_KEY` isn't set — but
      the site key placeholder in `index.html` MUST be replaced before
      deploy or real submissions silently fail (see 🔴 above).
- [x] **Fixed a real production 500 on `/api/book-session`** — some D1
      ledger writes weren't wrapped in try/catch and could throw uncaught
      after the notify email had already sent. All ledger calls in
      `book-session.js`/`contact-message.js` now degrade instead of
      crashing; regression test added.
- [x] **Slot tracker** — `/staff-bookings.html`, staff-gated (same
      passphrase as the voucher desk), Today/Upcoming/date views of booking
      requests with one-tap status updates (confirmed/declined/completed/
      no-show). Doesn't hard-block double-booking (see 🟡 below for why).
- [x] **Fixed a stored XSS in `staff-vouchers.html`** — voucher fields
      (`toName` etc., attacker-controlled via the public purchase form)
      were interpolated into `innerHTML` unescaped. Added the same
      `escapeHtml()` pattern `staff-bookings.html` already had.
- [x] **`book-session.js` now validates `date`/`time` format server-side**
      (was presence-only, relying on the HTML `<input>` type constraints
      which a direct POST can bypass) — both the source of the earlier XSS
      class of bug and now closed at both the input and display ends.
- [x] **Staff passphrase gate now actually verifies on unlock** —
      previously showed the desk/tracker UI for ANY non-empty input and
      only failed on the first real API call. New
      `functions/api/staff-auth.js` checks immediately; both pages also
      handle a mid-session 401 (passphrase rotated while logged in) by
      re-prompting instead of erroring silently. Added `sessionStorage`
      (not `localStorage`) persistence so a shared front-desk device isn't
      retyping the passphrase every page refresh.
- [ ] Error responses still sometimes echo raw internal error strings —
      fine while debugging, worth trimming before real customers can
      trigger and see them
- [ ] Leftover Pesapal env vars still in Cloudflare, unused but uncleaned
- [ ] `forms/book-a-table.php` and `forms/contact.php` are now fully dead
      (nothing references them) — safe to delete in a cleanup pass

## 🟡 Known gaps / decisions pending

- [ ] **Card support unconfirmed.** IntaSend's docs contradict each other.
      M-Pesa works regardless — confirm card status directly with IntaSend
      before promising "M-Pesa + card" anywhere in marketing
- [ ] **Discount voucher type** — UI exists (disabled, "Soon"), mechanics
      never decided
- [ ] **Live rotating QR page** — deferred follow-up to the static signed
      QR. Spec'd in `AI_HANDOFF.md` (search "rotating QR"): a "My Voucher"
      page the email links to, polling a short-lived token endpoint every
      ~30s so the QR can't just be screenshotted and reused. Not started.
- [ ] No dashboard/list view of all vouchers sold — only individually
      queryable in D1 directly (the slot tracker covers this for bookings,
      not yet done for vouchers)
- [ ] **Hard double-booking prevention not implemented** — the slot
      tracker gives staff visibility, but doesn't reject a submission for
      an already-requested date/time. Left this way deliberately since
      resource capacity (rooms/therapists) isn't known — see
      `AI_HANDOFF.md`'s 2026-08-24 entry for the reasoning and how to add
      it if the business turns out to be single-resource.
- [ ] **Booking deposit / paid checkout — explicitly deferred, not a
      priority right now.** Idea: reuse the existing IntaSend + D1 ledger
      infra (already built for vouchers) to charge a small deposit to
      confirm a booking slot, instead of "we'll call to confirm." Would
      also help filter joke submissions as a side effect, but that's now
      separately handled by Turnstile + honeypot, so this isn't blocking
      anything — it's a business-model change (paid slot vs. free request)
      more than a technical one, worth deciding deliberately rather than
      bundling into a bot-fix pass.

- [x] **Google Ads conversion — booking form wired**, 2026-08-25
      (`assets/js/ads-conversions.js`, fires on the `rica:form-success`
      event `validate.js` now dispatches on real success).
- [ ] **Google Ads conversion — contact form + voucher purchase still
      need conversion labels from the site owner** (Google Ads → Tools &
      Settings → Conversions) before they can be wired. Voucher purchase
      is structurally different — doesn't go through `validate.js`, needs
      its own `gtag()` call in `voucher.js` at the payment-confirmed point,
      not the same event listener as the other two forms.

## ✅ Done

- [x] Voucher purchase form (cash amount / specific service / self-gift / gift-someone-else)
- [x] Real service catalog + server-side price validation
- [x] Voucher email + separate buyer confirmation email for gifts, with QR code
- [x] Moved off Pesapal (not licensed in Kenya) to IntaSend (CBK-licensed)
- [x] Worked around IntaSend's Cloudflare Workers IP block via client-side SDK checkout
- [x] Clean `/vouchers` URL, linked from the main nav ("Gift Vouchers",
      between Packages and Contact) as of 2026-08-25. `noindex` left ON
      deliberately until the live payment flow is proven end-to-end (see
      🔴 above) — reachable by anyone browsing the site, just not yet
      surfaced by search engines.
- [x] Chatway confirmed scoped to `index.html` only — removed from
      `vouchers.html` 2026-08-25, was never on the staff pages or
      `services.html` to begin with.
- [x] Full security/reliability hardening pass (see above)
- [x] D1 transaction ledger + real database provisioned
- [x] Signed QR codes + staff camera scanner
- [x] Booking section retailored (real backend, service dropdown instead of
      restaurant "Number of People", fixed alt text) and tracked as its own
      line item through to completion
- [x] Contact form also moved to a real backend in the same pass (Web3Forms removed)
- [x] Mock/local test coverage for the full webhook lifecycle (51 checks)
      and the booking/contact backends (22 checks) — 73/73 passing
