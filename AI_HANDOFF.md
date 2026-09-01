# AI HANDOFF — RICA SPA

> Durable baton-pass memory for any AI coding agent continuing this repository.
> Last updated: 2026-09-01 for `richa-spa-admin-v2`.
> `mignon` is the current production/source-of-truth branch. `richa-spa-admin-v2` is a working branch created directly from the latest `mignon`.
> Treat the repository and Git history as the source of truth; do not assume previous chat history is available.

## Current architecture

Rica Spa is a static HTML/CSS/JavaScript marketing site for a Nairobi spa, deployed on Cloudflare Pages with Functions under `functions/api/`. KV binding `VOUCHERS` is the operational voucher store and D1 binding `DB` is the durable ledger/dashboard store.

Important files:
- `functions/api/*` — serverless endpoints.
- `functions/_lib/voucherCore.js` — voucher validation, generation, KV persistence and email delivery.
- `functions/_lib/ledger.js` — D1 orders/email ledger and dashboard reporting.
- `functions/_lib/dashboardAuth.js` — D1-backed dashboard sessions, password hashing, role checks and audit logging.
- `dashboard/` — Shadcn-based staff dashboard assets/source layer.
- `migrations/0004_dashboard_users.sql` — dashboard users/sessions/audit schema.
- `migrations/0005_dashboard_schema_repair.sql` — repairs production DBs where 0004 only created `dashboard_users`.

## Admin V2 decisions

- `mignon` remains production/source of truth. Do not merge the old `admin-shadcn-integration` branch wholesale.
- Dashboard access is session-based and must not rely on a client-only guard.
- Dashboard sessions use an HttpOnly `rica_dash_session` cookie backed by D1.
- Roles are `superuser` and `employee`; employee signup starts as `pending`.
- Superuser creation requires the separate Cloudflare secret `SUPERUSER_SETUP_KEY`.
- Legacy `STAFF_SECRET` should remain available only where explicitly needed for legacy staff tools.
- Voucher deletion and offline redemption are superuser-only and must be audited.

## Implemented on `richa-spa-admin-v2`

- `POST /api/dashboard-delete-voucher`: superuser-only, requires `confirm=true`, deletes the voucher from KV, deletes the D1 order, and records an audit event.
- `POST /api/redeem-voucher`: superuser-only offline redemption, verifies optional QR signature, updates KV status, synchronizes D1 `voucher_state='redeemed'`, and records an audit event.
- Dashboard migrations 0004/0005 are present in this branch. They still need live Cloudflare D1 verification/application.

## Still to build

1. Wire delete/redeem actions into the Shadcn Vouchers page with role-aware controls and confirmation dialogs.
2. Finish Sign In 2 / Sign Up 2 Rica Spa styling and authenticated-user display.
3. Add superuser employee management: approve, disable, role changes, audit history.
4. Verify TikTok `Schedule` after a successful booking and `Purchase` only after confirmed payment. The base pixel being present is not sufficient.
5. Finish PWA manifest/service worker/install UX and verify deployed icon sizes.
6. Replace important `#book-a-session` SEO links with a crawlable booking URL whose destination is the booking form.
7. Update this handoff and `TRACKER.md` after every meaningful implementation batch.

## Critical production verification

- IntaSend webhook deliveries have previously failed and the subscription was deactivated. Compare `INTASEND_WEBHOOK_CHALLENGE`, reactivate the IntaSend webhook, redeploy, and perform a real test purchase before calling payment finalization fixed.
- Verify Production env vars and bindings, especially `DB`, `VOUCHERS`, `STAFF_SECRET`, `SUPERUSER_SETUP_KEY`, IntaSend credentials/challenge, Resend, Turnstile and voucher signing secret.
- Do not claim Preview/Production third-party events or payments were tested unless they were actually observed in the provider dashboard.

## Working rule

Make new work against `richa-spa-admin-v2`, based on current `mignon`. Keep `mignon` untouched until the batch is verified and ready to merge.
