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
- Production-facing `/dashboard` is still the static Pages implementation under `dashboard/`.
- `dashboard/index.html` loads `dashboard/app.js` and `dashboard/rica-dashboard.css`; latest index has cache-busting query strings.
- React/Vite exists under `dashboard-react/` as an isolated migration target, but is NOT the active `/dashboard` route yet.
- Do not claim React is live until Pages build/routing is changed and verified.

## Live dashboard data
- `/api/dashboard-stats` exposes scalar compatibility fields: `totalBookings`, `pendingBookings`, `totalOrders`, `revenue`.
- `/api/dashboard-bookings?upcoming=1` is the intended upcoming-bookings call.
- `/api/dashboard-orders` provides real voucher order data.
- `/api/dashboard-vouchers` is wired into the active dashboard and reads real `VOUCHERS` KV records server-side. It excludes `voucher-ref:*` helper keys and returns code/ref, buyerName/email/phone, recipient, service/type, value, status, created/expiry/redemption fields.
- Active Vouchers page now shows Reference, Customer, Service, Value, Status, Created, Expiry and Redeemed information.
- Never use mock voucher/order/booking data.

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
- Planned WhatsApp integration: WhatsApp Business webhook -> Cloudflare Function -> D1 message records -> React Messages inbox; messages can be associated with customers and booking candidates. Do not fake WhatsApp data.

## React migration plan
1. Finish template-faithful React components for Overview, Bookings, Vouchers, Orders, Profile, Staff & Users, Activity, Customers and Messages.
2. Reuse the supplied template's actual component patterns instead of another custom visual approximation.
3. Connect every React page to the real APIs/D1.
4. Build and verify the React output locally/CI.
5. Route `/dashboard` to built React output only after parity verification; keep static dashboard as fallback until then.

## Immediate functional priorities
1. Deploy/verify active dashboard voucher columns.
2. Verify Superuser Staff & Users create/status actions.
3. Verify those actions appear in Activity Log with the actor.
4. Add Profile and Customers.
5. Add Messages using real contact/booking data.
6. Add booking/message linking.
7. Design WhatsApp webhook integration after the internal message/customer model exists.

## Verification
- Sign-in and first-Superuser setup work in production.
- Dashboard stats show numbers, never `[object Object]`.
- Real upcoming bookings/orders render.
- Vouchers show customer/value/status from KV.
- Superuser can create/manage staff.
- Staff/user changes appear in Activity Log.
- React build succeeds before production routing changes.

## Honesty rule
Do not claim a change is complete unless the repository write succeeded and, for deploy/build claims, the corresponding build/deployment result has been verified.
