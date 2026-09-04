# Rica Spa Voucher System — Tracker

## 🔴 Critical — verify before any real launch

- [ ] **LIVE INCIDENT, 2026-08-31: IntaSend webhook 100% delivery failure** — `mignon` is Cloudflare Production. IntaSend deactivated the webhook after repeated failures. Compare `INTASEND_WEBHOOK_CHALLENGE`, reactivate the subscription, redeploy, and run a real test purchase. Audit affected orders from 2026-08-21 onward.
- [ ] Confirm migrations 0002/0003 and dashboard migrations 0004/0005 are applied to the live D1 database.
- [ ] Confirm all required Production env vars and bindings are configured. Full checklist remains in `INTASEND_SETUP.md`.
- [ ] Verify real booking/contact submissions and notification emails after deployment.
- [ ] Complete end-to-end payment confirmation: IntaSend completion → webhook → voucher issuance → email/QR.
- [ ] **Dashboard user storage:** `DB` must point to `ricaspa-ledger`; apply `0004_dashboard_users.sql` and `0005_dashboard_schema_repair.sql` where needed. `SUPERUSER_SETUP_KEY` must be configured for superuser signup.

## 🟢 Admin V2 — richa-spa-admin-v2

- [x] Working branch created from the latest `mignon`; do not use the old `admin-shadcn-integration` branch as the source of truth.
- [x] Dashboard session storage uses D1 (`dashboard_users`, `dashboard_sessions`, `dashboard_audit_log`).
- [x] Superuser setup uses a separate `SUPERUSER_SETUP_KEY`; never commit the key.
- [x] Superuser-only voucher deletion endpoint: `/api/dashboard-delete-voucher` removes the KV voucher and D1 order and writes an audit event. Requires `confirm=true`.
- [x] Superuser-only offline voucher redemption: `/api/redeem-voucher` updates the KV voucher, D1 `voucher_state`, and audit log.
- [ ] Wire the delete/redeem controls into the Shadcn dashboard Vouchers UI with confirmation dialogs and role-aware visibility.
- [ ] Add superuser employee management: approve, disable, role changes, and audit history.
- [x] Add self-contained Rica Spa Sign In 2 / Sign Up 2 pages so auth is styled even when the React dashboard shell is not loaded.
- [ ] Replace remaining Shadcn demo identity/branding in the dashboard shell and display `/api/dashboard-me` authenticated user.
- [x] Remove the dashboard catch-all redirect dependency; middleware remains the private dashboard access boundary.

## 🟡 Growth / platform

### TikTok voucher campaign

- [x] Added server-side TikTok Events API helper at `functions/_lib/tiktokEvents.js`.
- [x] Emit `Schedule` only after a booking is successfully accepted by the booking notification flow.
- [x] Emit `Purchase` only after IntaSend `COMPLETE` voucher finalization.
- [x] Emit `Purchase` for the protected test-voucher path too, so test conversions can be verified.
- [x] Send `value` as numeric voucher value and `currency` as `KES` on every `Purchase`.
- [x] Send explicit `event_id` for deduplication and hash email/phone/external ID for matching.
- [ ] Configure `TIKTOK_PIXEL_ID` and `TIKTOK_ACCESS_TOKEN` in Cloudflare Preview/Production.
- [ ] Temporarily configure `TIKTOK_TEST_EVENT_CODE` and verify `Schedule` + `Purchase` in TikTok Events Manager Test Events.
- [ ] After verification, remove the test event code and confirm normal Events Manager reporting.
- [ ] Confirm campaign/Ads Manager reports the required funnel events and that Purchase value/currency warnings disappear.

- [x] Add PWA manifest, branded install icons, and service worker code. **Not yet deployment-verified; PNG icon variants and browser install testing remain to be completed.**
- [ ] Add an install UX (`beforeinstallprompt`) where supported and verify installability on Chrome/Android/iOS.
- [ ] SEO: replace important `#book-a-session` sitelink targets with a crawlable booking URL whose destination is the booking form, not the working-hours section. Preserve fragment support only as a compatibility layer.
- [ ] Remove obsolete PHP form files once references are rechecked.
- [ ] Confirm card-payment support directly with IntaSend before marketing it.

## 🟠 Security / reliability backlog

- [ ] Trim raw internal error strings from public responses.
- [ ] Remove unused Pesapal env vars.
- [ ] Consider stronger Cloudflare rate limiting in addition to KV-based application limits.
- [ ] Design the deferred rotating voucher QR / live voucher page.

## Latest admin-v2 changes

- 2026-09-01: created `richa-spa-admin-v2` from current `mignon`.
- 2026-09-01: added superuser-only voucher deletion and offline redemption controls at the API layer.
- 2026-09-01: synchronized offline redemption into the D1 order ledger and audit log.
- 2026-09-01: added standalone Rica Spa Sign In 2 / Sign Up 2 pages to prevent unstyled auth screens.
- 2026-09-01: removed dashboard redirect dependency and kept middleware as the private dashboard access boundary.
- 2026-09-01: added PWA manifest, SVG install icons, and service worker; live installability remains unverified.
- 2026-09-04: added server-side TikTok Events API for `Schedule` and voucher `Purchase`, including explicit KES value/currency and event IDs.

**Rule:** do not mark deployment or third-party verification complete unless it was actually tested against the live/Preview deployment.
