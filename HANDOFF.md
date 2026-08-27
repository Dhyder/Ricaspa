# Ricaspa Dashboard Handoff

Updated: 2026-08-27

## Branch
- `mignon`

## Production architecture
- Cloudflare Pages + Functions.
- Production D1: `ricaspa-ledger` UUID `cdf2839a-2f0f-4705-a327-563da5d2cb31`.
- KV binding: `VOUCHERS`, ID `20e21678c21f48718b235646ff753777`.
- Dashboard auth/session/audit lives in `functions/_lib/dashboardAuth.js` and D1.
- `0004_dashboard_users.sql` and schema repair migration are applied remotely.
- PBKDF2 uses 100,000 iterations for Workers compatibility.

## UI source of truth
- User supplied `shadcn-admin-1.0.0.zip` as the authoritative original template.
- Auth should match the template's SignIn2 / SignUp2 styling.
- Do not invent a replacement visual system.
- Dashboard should reuse template components/patterns for profiles, users, tables, cards, messages and forms, with Rica branding/content.

## Current dashboard
- Production-facing `/dashboard` is the static Pages implementation under `dashboard/`.
- `dashboard/index.html` loads `dashboard/app.js`, `dashboard/rica-dashboard.css`, and `dashboard/enhancements.js` with cache-busting versions.
- React/Vite exists under `dashboard-react/` as an isolated migration target, but is NOT the active `/dashboard` route yet.
- Do not claim React is live until Pages build/routing is changed and verified.

## Rica visual direction
- Rica does NOT use green as its brand color. Do not introduce green as a primary brand color.
- Dashboard accent direction is derived from the supplied Rica logo: warm brown/tan/gold neutrals, with warm ivory surfaces and restrained dark text.
- Keep the template's Shadcn layout/component discipline while adapting color, typography and content to Rica.

## Live dashboard data
- `/api/dashboard-stats` exposes scalar compatibility fields: `totalBookings`, `pendingBookings`, `totalOrders`, `revenue`.
- `/api/dashboard-bookings?upcoming=1` is the intended upcoming-bookings call.
- `/api/dashboard-orders` returns ledger fields `ref`, `type`, `value`, `service_name`, `buyer_name`, `buyer_email`, `payment_state`, `finalization_state`, `voucher_code`, `created_at`, and `payment_completed_at`.
- Orders UI uses the actual ledger field names for customer, service, amount, payment and fulfilment.
- `/api/dashboard-vouchers` reads real `VOUCHERS` KV records server-side and excludes `voucher-ref:*` helper keys.
- Vouchers UI shows reference, customer, service, value, status, created, expiry and redemption information.
- Never use mock voucher/order/booking data.

## Table UX
- `dashboard/enhancements.js` adds client-side search/lookup and 10-row pagination to rendered dashboard tables.
- Search searches all visible row text; paging controls show current range and total matches.
- This is currently client-side because existing endpoints return bounded datasets. If datasets grow substantially, move filtering/pagination server-side with query parameters.

## Voucher tools
- Vouchers page now injects a visible `Lookup & scan` card above the voucher table.
- Manual lookup calls `POST /api/redeem-voucher` with `{code, action:"lookup"}`; it does not redeem during lookup.
- The lookup result shows reference, customer, service, value and status and exposes a separate Redeem action for valid/unredeemed vouchers.
- Scan uses `getUserMedia` and `BarcodeDetector` where supported. Unsupported browsers still get manual lookup.
- Camera scanning requires HTTPS/secure context and permission.

## Navigation
- Administration navigation is wired through delegated `data-section` handling.
- Overview quick-action buttons such as Review bookings and Voucher Desk also use delegated navigation.
- Added template-inspired profile workspace/profile badge.
- Async dashboard errors show a retry panel instead of a dead Loading state.

## Staff & Users
- Active dashboard Staff & Users page calls `GET /api/dashboard-users`, `POST /api/dashboard-users`, and `PATCH /api/dashboard-users`.
- It lists name, email, role, status and last login; Superusers can create staff and update other users' status.
- Backend enforces Superuser role and audits `user_created` / `user_updated` actions.

## Activity Log
- Active dashboard Activity Log calls `GET /api/dashboard-audit`.
- It shows timestamp, staff name/email, action, entity/entity ID and metadata.
- Backend joins `dashboard_audit_log` to `dashboard_users` and limits to latest 200 events.
- Audit actions must be attributed to the authenticated actor; do not fake activity.

## Product direction
- Dashboard replaces legacy staff-vouchers/staff-bookings interfaces.
- Roles: `superuser` and `employee` (displayed as Staff in UI).
- Superusers manage staff accounts.
- All approvals, booking status changes, voucher redemption and administrative actions should be attributable to the authenticated user and written to audit log.
- Planned customer-facing operational layer: Customers + Messages.
- Planned WhatsApp integration: WhatsApp Business webhook -> Cloudflare Function -> D1 message records -> dashboard Messages inbox; messages can be associated with customers and booking candidates. Do not fake WhatsApp data.

## React migration plan
1. Finish template-faithful React components for Overview, Bookings, Vouchers, Orders, Profile, Staff & Users, Activity, Customers and Messages.
2. Reuse the supplied template's actual component patterns instead of another custom visual approximation.
3. Connect every React page to the real APIs/D1.
4. Build and verify the React output locally/CI.
5. Route `/dashboard` to built React output only after parity verification; keep static dashboard as fallback until then.

## Immediate functional priorities
1. Verify the warm Rica palette against the actual supplied logo and remove any remaining green declarations.
2. Verify table search/pagination on real dashboard data.
3. Verify voucher manual lookup and camera scanning/redemption flow in HTTPS production.
4. Verify Superuser Staff & Users create/status actions.
5. Verify those actions appear in Activity Log with the actor.
6. Add Profile and Customers using template components.
7. Add Messages using real contact/booking data.
8. Add booking/message linking.
9. Design WhatsApp webhook integration after the internal message/customer model exists.

## Verification
- Sign-in and first-Superuser setup work in production.
- Dashboard stats show numbers, never `[object Object]`.
- Real upcoming bookings/orders render.
- Orders show customer, amount, payment state and fulfilment state.
- Vouchers show customer/value/status from KV.
- Vouchers can be looked up manually and scanned where BarcodeDetector is supported.
- Overview quick actions navigate to their corresponding sections.
- Superuser can create/manage staff.
- Staff/user changes appear in Activity Log.
- React build succeeds before production routing changes.

## Honesty rule
Do not claim a change is complete unless the repository write succeeded and, for deploy/build claims, the corresponding build/deployment result has been verified.
