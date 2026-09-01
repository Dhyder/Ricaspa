# Rica Spa Voucher System — Tracker

## 🔴 Critical — verify before any real launch

- [ ] Confirm migrations 0002/0003/0004 are applied to the live D1 database. `0004_dashboard_users.sql` is now required for dashboard account storage.
- [ ] Confirm required Cloudflare bindings/secrets in Production and Preview: `DB`, `VOUCHERS`, `STAFF_SECRET`, `SUPERUSER_SETUP_KEY`, `VOUCHER_SIGNING_SECRET`, `RESEND_API_KEY`, `INTASEND_*`, booking/contact/Turnstile settings.
- [ ] End-to-end payment confirmation still needs a real/sandbox verification: COMPLETE event, webhook finalization, voucher email/QR, gift confirmation.
- [ ] Verify TikTok Pixel base code and Schedule/Purchase events in TikTok Events Manager Test Events before relying on them for optimization.

## 🟠 Security & reliability

- [x] Removed public Test Mode checkbox from the live site
- [x] `/api/create-voucher` requires `X-Test-Secret`
- [x] Webhook idempotency and truthful order states
- [x] Voucher QR signing + staff camera scanner
- [x] Booking/contact backend + Turnstile/honeypot
- [x] D1 transaction ledger
- [x] Staff booking/voucher tools
- [x] Dashboard session authentication and role foundation
- [x] Dashboard `_redirects` removed to eliminate auth redirect loops
- [x] Dashboard static assets kept accessible while dashboard routes require authentication
- [x] Superuser-only voucher actions API: delete test/clutter vouchers and mark vouchers redeemed offline
- [x] Voucher state exposed in dashboard order data
- [x] Superuser voucher UI wired into the dashboard

## 🟡 Dashboard / product work

- [x] Superuser voucher cleanup + offline redemption controls
- [ ] Build/finish Superuser employee management: approve, disable, role management, audit history.
- [ ] Finish Rica Spa Sign In 2 / Sign Up 2 UI wiring. The compiled dashboard already contains Sign In 2 and Sign Up 2 template assets; the Rica Spa auth surface still needs final template integration.
- [ ] Configure D1 `DB` binding and apply `0004_dashboard_users.sql` in Preview + Production.
- [ ] Set `SUPERUSER_SETUP_KEY` in Preview + Production. Never commit its value.

## 🟡 Marketing / analytics

- [x] Added explicit TikTok `Schedule` tracking after successful booking form submission and confirmed `Purchase` tracking after `/api/order-status` reports a completed voucher payment. Events are de-duplicated per browser session/order reference.
- [ ] Verify TikTok Pixel events in Events Manager Test Events and confirm the production Pixel receives them.
- [x] Added crawlable `/book-a-session.html` containing the real Rica Spa booking form.
- [x] Important fragment booking links are rewritten at the HTML response layer to `/book-a-session.html`, avoiding Google-facing `/#book-a-session` destinations.
- [ ] Re-submit/update sitemap and request recrawl after URL structure changes.
- [ ] Google Ads conversion: booking form wired; contact + voucher purchase still need conversion labels / confirmed purchase trigger.

## 🟢 Web app

- [x] Added `manifest.webmanifest` for Rica Spa
- [x] Added service worker and HTML injection for manifest/SW registration
- [ ] Verify installability in Chrome DevTools/Application and add a proper 192x192 + 512x512 icon set if current logo files don't meet the requested dimensions. Chrome's installability guidance requires a manifest, icons, start URL and suitable display mode, and service-worker support remains useful for app-like behavior.

## 🟢 Operational docs

- [x] Added `AI_HANDOFF_2026-09-01.md` covering dashboard auth, voucher operations, TikTok tracking, SEO booking URL and PWA work.
- [x] Keep the handoff addendum and this tracker updated whenever a major integration, deployment requirement, security change, or unresolved issue is introduced.
