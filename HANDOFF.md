# Ricaspa Dashboard Handoff

Updated: 2026-08-27

## Current branch
- `mignon`

## Current state
- Cloudflare Pages Functions compile and dashboard authentication is working in production.
- Production D1: `ricaspa-ledger` (`cdf2839a-2f0f-4705-a327-563da5d2cb31`); KV `VOUCHERS` (`20e21678c21f48718b235646ff753777`).
- Dashboard auth/session, Superuser setup, staff accounts and audit logging are implemented.
- PBKDF2 is compatible with Cloudflare Workers.
- Production migration history includes `0004_dashboard_users.sql`; repair migration `0005_dashboard_schema_repair.sql` creates missing session/audit tables without resetting data.

## UI source of truth
- User uploaded `shadcn-admin-1.0.0.zip` and explicitly identified it as the original template.
- Auth reference is the template's SignIn2 / SignUp2 experience. Do not invent another auth visual system.
- Login and first-Superuser setup have been restyled to follow that reference while preserving the real JSON endpoints.

## Dashboard direction
- Dashboard replaces the old staff-vouchers/staff-bookings interfaces.
- Roles: `superuser` and staff/employee.
- Superusers manage staff and see approval/redemption attribution through the audit log.
- Keep the existing Cloudflare API/D1/auth architecture stable while changing presentation.

## Data status
- Dashboard stats previously rendered `[object Object]`; `dashboard/app.js` now normalizes object/scalar summary responses.
- Booking list now calls `/api/dashboard-bookings?upcoming=1` and uses real `bookings` records.
- `dashboard-stats.js` exposes scalar compatibility fields: `totalBookings`, `pendingBookings`, `totalOrders`, `revenue`.
- Production still needs verification of the exact order/revenue mapping against real ledger records. Never use mock data.

## React dashboard — STARTED
A new isolated React/Vite application now exists under `dashboard-react/` on `mignon`.

Important: it is **NOT yet wired into the production Pages build**. This is intentional. Creating it cannot replace the public Rica website or current dashboard until parity is reached.

Current React foundation:
- Vite + React entrypoint
- Rica/Shadcn-inspired shell
- Workspace navigation for Overview, Bookings, Messages, Vouchers, Orders, Customers, Staff & Users, Activity
- Responsive sidebar/layout
- Placeholder live-data cards and sections

Latest React commits:
- `307a0aed24d205521675faa67a8f4c56583e98b2` package foundation
- `1379c1099d05aec378c3034037c3b032d9447d92` Vite config
- `11d5c0ac9b4ffaba8f4f5b739013f0be673399ce` React entrypoint
- `584c54f5cf3f113f97316ef4c872c43fec00e3c3` React workspace shell
- `a4a1d1277e210ce714f0490ba31317d3cfba979b` React styling

## Next React work
1. Use the actual uploaded template components as the visual source — especially profile, user management, message/inbox, cards, tables, forms and settings — rather than inventing replacements.
2. Add a shared API/data layer for the existing dashboard endpoints and auth/session endpoints.
3. Replace placeholder React cards with real D1-backed stats and booking/order data.
4. Build Messages and Customers as real components.
5. Add Profile/account settings and richer Staff/User management.
6. Add message-to-booking linking.
7. Add WhatsApp Business webhook integration only after real provider credentials are configured. Store incoming messages in D1; do not fabricate WhatsApp messages.
8. Test React build separately, then switch `/dashboard` to React only after visual/data/auth parity is verified.

## WhatsApp concept
Target flow: WhatsApp Business/provider -> Cloudflare webhook -> D1 messages -> React Messages inbox -> staff can link a conversation to a customer/booking -> optional confirmation reply. Booking intent extraction can be added later, but approval remains an explicit staff action and must be audited.

## Deployment notes
- Never commit real local secrets such as `SUPERUSER_SETUP_KEY`.
- Keep production D1/KV bindings configured.
- Remove/fix the old `/dashboard/* /dashboard/index.html 200` infinite-loop redirect if it remains.

## Verification
Before switching production to React: build locally, verify auth, real stats, bookings, orders, users, audit, voucher redemption, responsive UI, and error/loading states. Only then change Pages routing/build output.

## Honesty rule
Do not claim a change is complete unless the repository write succeeded and, where applicable, deployment/build verification confirms it.
