# Ricaspa Dashboard Handoff

Updated: 2026-08-27

## Current branch
- `mignon`

## Current state
- Cloudflare Pages Functions compile and dashboard authentication is working in production.
- `functions/_lib/dashboardAuth.js` exports session/auth helpers including `isAuthenticated`, `requireSession`, `requireRole`, password hashing/verification, sessions, and audit logging.
- PBKDF2 was reduced to Cloudflare Workers' supported 100,000 iteration limit.
- `functions/api/dashboard-setup.js` implements one-time first-Superuser creation using `SUPERUSER_SETUP_KEY` and D1 `DB`.
- `functions/api/dashboard-login.js` authenticates dashboard users against D1 and creates an HTTP-only session.
- Production D1 is `ricaspa-ledger`, UUID `cdf2839a-2f0f-4705-a327-563da5d2cb31`; KV `VOUCHERS`, ID `20e21678c21f48718b235646ff753777`.
- Production migration history records `0004_dashboard_users.sql` as applied, but initially only `dashboard_users` existed. Repair migration `0005_dashboard_schema_repair.sql` was added to create missing `dashboard_sessions` and `dashboard_audit_log` without resetting existing data.
- The user confirmed dashboard sign-in now works.

## UI source of truth
- The user uploaded `shadcn-admin-1.0.0.zip` and explicitly identified it as the original template.
- The original auth design to reproduce is the Shadcn `SignIn2` / SignUp experience: split two-column page, centered form, logo/brand header, restrained typography, muted helper text, and visual panel on the right.
- The uploaded template contains `src/features/auth/sign-in/sign-in-2.tsx`, `src/features/auth/sign-up/index.tsx`, and related auth components.
- Do NOT invent another dashboard/auth visual system. Preserve the original template structure and interaction feel, replacing branding/content with Rica assets and operational language.
- `dashboard/login.html` and `dashboard/setup.html` were restyled to follow the SignIn2/SignUp2 pattern while retaining the real JSON auth/setup endpoints.
- The user specifically wants initial Superuser signup/setup to use the SignUp2 styling, consistent with login.

## Dashboard product direction
- Dashboard replaces the old `staff-vouchers` / `staff-bookings` operational interfaces.
- Individual authenticated accounts: `superuser` and staff/employee.
- Superusers manage staff/users and can see who approved/redeemed actions.
- Booking status changes and voucher redemption must be attributable to the logged-in user and written to the audit log.
- Avoid using a shared `X-Staff-Secret` as the dashboard's primary authentication mechanism.

## Data integration blocker / next work
- The user reported that the dashboard shows no booking/pending data even when logged in.
- Root cause found: `/api/dashboard-stats` returned nested `orders` and `bookings` summaries while the dashboard expected scalar values. Compatibility fields were added: `totalBookings`, `pendingBookings`, `totalOrders`, and `revenue`.
- `/api/dashboard-bookings` previously required either `date` or `upcoming=1`, while the dashboard called it without a parameter. It was changed to return upcoming bookings by default.
- The real booking schema uses the `bookings` table with `ref`, `name`, `email`, `phone`, `service`, `preferred_date`, `preferred_time`, `message`, `status`, notification states, and timestamps. Valid booking statuses are `new`, `confirmed`, `declined`, `completed`, `no-show`.
- These data fixes need production deployment and verification against real records. Do not substitute mock data.
- Verify orders/revenue mapping against the actual `ledger.js` response before declaring the data layer complete.

## Dashboard UI recovery status
- The user explicitly rejected the recently generated dashboard as NOT being the original template.
- The uploaded `shadcn-admin-1.0.0.zip` is now the authoritative UI reference. The repo's `admin-shadcn-integration` branch is not sufficient as the source of truth.
- `mignon` remains a static Cloudflare Pages implementation, so the Shadcn design must be reproduced in the static dashboard rather than switching the whole site to a React build.
- Preserve the working auth/session/data architecture while replacing presentation with the supplied template's actual visual structure.

## Deployment notes
- Do not commit real local secret values such as `SUPERUSER_SETUP_KEY`.
- Keep the safe committed Wrangler config with the real non-secret D1/KV IDs so Pages can bind production resources.
- Cloudflare previously reported `/dashboard/* /dashboard/index.html 200` as an infinite-loop redirect rule. Remove/fix that rule if it remains.

## Verification sequence
1. Deploy current `mignon`.
2. Confirm `/api/dashboard-setup` returns JSON.
3. Confirm `/dashboard/login.html` uses the supplied SignIn2-style Rica presentation.
4. Confirm `/dashboard/setup.html` uses the supplied SignUp2-style Rica presentation.
5. Confirm Superuser login/session works.
6. Confirm dashboard overview pulls real booking/order counts.
7. Confirm Bookings loads real upcoming records and pending/new statuses.
8. Confirm booking approval/status change records the logged-in user.
9. Confirm voucher redemption records the logged-in user.
10. Confirm Superuser can create Staff accounts and see the user list.
11. Confirm Activity Log shows who performed actions.
12. Verify the production build before calling the UI/data work complete.

## Important honesty rule
Do not tell the user a change is complete unless the repository write succeeded and, where applicable, the deployment/build result confirms it.
