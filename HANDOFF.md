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
- A React/Vite dashboard has been started under `dashboard-react/` on `mignon`.
- It is intentionally isolated from the existing public site and current static dashboard until parity is reached.
- `dashboard-react/src/main.jsx` now loads real APIs for stats, upcoming bookings, and orders.
- Overview normalizes object-valued stats to scalar display values, preventing `[object Object]`.
- React sections currently include Overview, Bookings, Messages, Vouchers, Orders, Customers, Staff & Users, and Activity as the component structure; non-overview sections still need their real template components and API integrations.
- `dashboard-react/index.html` uses a relative module path so the React entry resolves within its own directory.
- The current React shell is a foundation, NOT yet the final template transplant.

## Data work
- `/api/dashboard-stats` has compatibility scalar fields: `totalBookings`, `pendingBookings`, `totalOrders`, `revenue`.
- `/api/dashboard-bookings?upcoming=1` is the intended upcoming-bookings call.
- Real booking table: `bookings` with `ref`, `name`, `email`, `phone`, `service`, `preferred_date`, `preferred_time`, `message`, `status`, notifications and timestamps.
- Valid booking statuses: `new`, `confirmed`, `declined`, `completed`, `no-show`.
- Never use mock booking/order data.
- Verify order/revenue mapping against the real API response.

## Product direction
- Dashboard replaces legacy staff-vouchers/staff-bookings interfaces.
- Roles: `superuser` and staff/employee.
- Superusers manage staff accounts.
- All approvals, booking status changes, voucher redemption and administrative actions should be attributable to the authenticated user and written to audit log.
- Planned customer-facing operational layer: Customers + Messages.
- Planned WhatsApp integration: WhatsApp Business webhook -> Cloudflare Function -> D1 message records -> React Messages inbox; messages can be associated with customers and booking candidates. Do not fake WhatsApp data.

## Immediate next steps
1. Finish React shell using the actual supplied template components/patterns.
2. Implement Profile and Staff & Users with real dashboard APIs.
3. Implement Messages and Customers data model/UI.
4. Connect every dashboard page to real D1/API data.
5. Add booking/message linking.
6. Only then add WhatsApp Business webhook integration.
7. Build/test React output before routing production `/dashboard` to it.
8. Keep static dashboard as fallback until React parity is verified.

## Verification
- Sign-in and first-Superuser setup work in production.
- Confirm dashboard stats show numbers, never `[object Object]`.
- Confirm real upcoming bookings/orders render.
- Confirm staff actions identify the logged-in user in audit log.
- Confirm Superuser can create/manage staff.
- Confirm React build succeeds before production routing changes.

## Honesty rule
Do not claim a change is complete unless the repository write succeeded and, for deploy/build claims, the corresponding build/deployment result has been verified.
