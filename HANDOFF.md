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

## Current dashboard transition
- A React/Vite dashboard is being built under `dashboard-react/` on `mignon`.
- It is isolated from the public site/current static dashboard until parity is reached.
- React now loads live stats, upcoming bookings and orders.
- React Overview normalizes object-valued stats to scalar display values, preventing `[object Object]`.
- React Vouchers now calls authenticated `/api/dashboard-vouchers` and displays code, customer, service, value, status, expiry and creation data.
- React Staff & Users now calls `/api/dashboard-users`, lists real users, and has a real Superuser-only create-user form backed by POST `/api/dashboard-users`.
- React Activity now calls `/api/dashboard-audit` and renders the real audit trail with user, action, entity and metadata.
- `functions/api/dashboard-vouchers.js` lists voucher records from KV server-side, skips internal `voucher-ref:*` keys, and returns only dashboard-safe fields. No direct KV access from the browser.
- Non-admin sections Messages/Customers/Profile still need their real template components and API integrations.

## Data work
- `/api/dashboard-stats` has compatibility scalar fields: `totalBookings`, `pendingBookings`, `totalOrders`, `revenue`.
- `/api/dashboard-bookings?upcoming=1` is the intended upcoming-bookings call.
- Real booking table: `bookings` with `ref`, `name`, `email`, `phone`, `service`, `preferred_date`, `preferred_time`, `message`, `status`, notifications and timestamps.
- Voucher storage is KV (`VOUCHERS`); voucher records contain code, buyerName, buyerEmail, buyerPhone, toName, serviceName/value, type, status, createdAt, expiresAt, and optional redemption fields.
- Valid booking statuses: `new`, `confirmed`, `declined`, `completed`, `no-show`.
- Never use mock booking/order data.
- Verify order/revenue mapping against the real API response.

## Auth / users / audit
- `dashboard-users.js` GET/POST/PATCH are real D1-backed endpoints and Superuser protected.
- `dashboard-audit.js` is a real Superuser-protected read endpoint over `dashboard_audit_log` joined to `dashboard_users`.
- `dashboardAuth.js` exposes `isAuthenticated`, `requireSession`, `requireRole`, `audit`, and PBKDF2 helpers.
- User creation and administrative actions call `audit`; dashboard activity therefore reflects real actions, not demo entries.

## Product direction
- Dashboard replaces legacy staff-vouchers/staff-bookings interfaces.
- Roles: `superuser` and staff/employee.
- Superusers manage staff accounts.
- All approvals, booking status changes, voucher redemption and administrative actions should be attributable to the authenticated user and written to audit log.
- Planned customer-facing operational layer: Customers + Messages.
- Planned WhatsApp integration: WhatsApp Business webhook -> Cloudflare Function -> D1 message records -> React Messages inbox; messages can be associated with customers and booking candidates. Do not fake WhatsApp data.

## Immediate next steps
1. Finish React UI with actual supplied template components/patterns, not generic replacements.
2. Implement Profile, Customers and Messages using real template components and APIs.
3. Add booking actions (confirm/decline/complete) with authenticated actor attribution and audit entries.
4. Add voucher redemption/admin actions with audit attribution.
5. Add booking/message linking and customer history.
6. Only then add WhatsApp Business webhook integration.
7. Build/test React output before routing production `/dashboard` to it.
8. Keep static dashboard as fallback until React parity is verified.

## Verification
- Sign-in and first-Superuser setup work in production.
- Confirm dashboard stats show numbers, never `[object Object]`.
- Confirm real upcoming bookings/orders render.
- Confirm Vouchers shows customer/value/status rather than only reference/timestamp.
- Confirm Superuser can list/create/manage staff.
- Confirm Activity shows audit events and actor names.
- Confirm React build succeeds before production routing changes.

## Honesty rule
Do not claim a change is complete unless the repository write succeeded and, for deploy/build claims, the corresponding build/deployment result has been verified.
