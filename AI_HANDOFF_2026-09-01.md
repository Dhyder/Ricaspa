# AI HANDOFF ADDENDUM — 2026-09-01

This addendum supersedes older assumptions where it conflicts with the current integration branch.

## Dashboard

- Work is on `admin-shadcn-integration`.
- Dashboard authentication is enforced by `functions/_middleware.js`.
- `_redirects` was removed from the branch because it caused Preview dashboard redirect loops.
- Dashboard user storage uses D1 binding `DB` and migration `migrations/0004_dashboard_users.sql`.
- `SUPERUSER_SETUP_KEY` is the dedicated secret for creating superusers. `STAFF_SECRET` remains the legacy staff passphrase.
- Voucher dashboard actions now include a superuser-only endpoint at `/api/dashboard-voucher-action` for deleting voucher/order clutter and marking vouchers redeemed when supplied offline. These actions write an audit record.
- Dashboard order listing now includes `voucher_state`.

## Voucher operations

- Delete removes the D1 order and, when available, its KV voucher code and `voucher-ref:<ref>` mapping.
- Offline redemption changes the KV voucher status to `redeemed`, records timestamp and acting superuser email, updates the linked D1 order by voucher code, and writes an audit event.
- The dashboard UI still needs to wire buttons to these API actions.

## TikTok tracking

The base Pixel being present does not guarantee Event Builder events are firing. TikTok's current documentation distinguishes the base Pixel from event code and recommends verifying web events in Events Manager Test Events. The intended implementation is explicit code for business-critical actions: `Schedule` after a confirmed booking submission and `Purchase` only after confirmed voucher payment. Do not fire Purchase merely on the voucher checkout button click. If Pixel + Events API are eventually both used, implement event IDs/deduplication.

## SEO / booking links

Important booking navigation should not depend on fragment-only sitelinks such as `/#book-a-session`. Google recommends a logical internal link structure and descriptive anchor text for sitelinks. The project should introduce a crawlable booking destination such as `/book` or `/book-a-session`, with the booking form as the primary content, then point nav/marketing links there. Fragment scrolling can remain as a progressive enhancement, not the canonical destination.

## PWA

Added `manifest.webmanifest` and `sw.js`, with middleware injection of the manifest link and service-worker registration. Verify the final deployed app in Chrome DevTools/Application and ensure real 192px/512px icons are supplied. The goal is an installable Rica Spa web app, not a packaged native app.

## Outstanding

- Wire dashboard voucher delete/redeem controls.
- Finish Superuser employee approval/disable/role UI.
- Finish Sign In 2 / Sign Up 2 visual wiring.
- Configure/apply D1 migration in Preview and Production.
- Configure `SUPERUSER_SETUP_KEY` in Preview and Production.
- Diagnose TikTok base Pixel + Schedule/Purchase firing in browser and Events Manager Test Events.
- Replace fragment-only booking links with a crawlable booking URL and ensure that URL opens the booking form itself rather than working hours.
- Keep this addendum and `TRACKER.md` updated after major integration changes.
