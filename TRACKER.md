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
- [x] Superuser-only voucher actions API added: delete test/clutter vouchers and mark vouchers redeemed offline
- [x] Voucher state is exposed in dashboard order data

## 🟡 Dashboard / product work

- [ ] Wire the Shadcn dashboard voucher table to `/api/dashboard-voucher-action` delete/redeem controls.
- [ ] Build Superuser employee management: approve, disable, role management, audit history.
- [ ] Finish Rica Spa Sign In 2 / Sign Up 2 UI wiring.
- [ ] Configure D1 `DB` binding and apply `0004_dashboard_users.sql` in Preview + Production.
- [ ] Set `SUPERUSER_SETUP_KEY` in Preview + Production. Never commit its value.

## 🟡 Marketing / analytics

- [ ] TikTok Pixel: diagnose base pixel loading, then fire `Schedule` only after successful booking submission and `Purchase` only after confirmed voucher payment. Add event IDs/parameters where appropriate and verify with TikTok Test Events.
- [ ] Google sitelinks: replace important `href="#..."` navigation with crawlable destination URLs. The booking sitelink should point to the actual booking form, not a working-hours section. Use descriptive anchors and a dedicated `/book` or `/book-a-session` URL where practical.
- [ ] Google Ads conversion: booking form wired; contact + voucher purchase still need conversion labels / confirmed purchase trigger.

## 🟢 Web app

- [x] Added `manifest.webmanifest` for Rica Spa
- [x] Added service worker and HTML injection for manifest/SW registration
- [ ] Verify installability in Chrome DevTools/Application and add a proper 192x192 + 512x512 icon set if current logo files don't meet the requested dimensions. Chrome's installability guidance requires a manifest, icons, start URL and suitable display mode, and service-worker support remains useful for app-like behavior.

## 🟢 Website navigation / SEO

- [ ] Remove remaining fragment-only booking links such as `#book-a-session` from important internal navigation.
- [ ] Introduce a crawlable booking destination and preserve smooth scrolling on the destination page if desired.
- [ ] Re-submit/update sitemap and request recrawl after URL structure changes.

## 🟢 Operational docs

- [x] Keep `AI_HANDOFF.md` and this tracker updated whenever a major integration, deployment requirement, security change, or unresolved issue is introduced.
