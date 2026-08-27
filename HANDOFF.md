# Ricaspa Dashboard Handoff

Updated: 2026-08-27

## Current branch
- `mignon`

## Current state
- Cloudflare Pages Functions now compile past the missing `isAuthenticated` export.
- `functions/_lib/dashboardAuth.js` exports session/auth helpers including `isAuthenticated`, `requireSession`, `requireRole`, password hashing/verification, sessions, and audit logging.
- `functions/api/dashboard-setup.js` implements one-time first-Superuser creation using `SUPERUSER_SETUP_KEY` and D1 `DB`.
- `functions/api/dashboard-login.js` authenticates dashboard users against D1 and creates an HTTP-only session.
- `migrations/0004_dashboard_users.sql` is required for dashboard users/sessions/audit tables.
- `mignon` contains the real D1/KV production configuration supplied by the owner: DB=`ricaspa-ledger`, D1 UUID=`cdf2839a-2f0f-4705-a327-563da5d2cb31`, KV=`VOUCHERS`, ID=`20e21678c21f48718b235646ff753777`.
- The first deployment after this configuration successfully compiled and published assets, then failed only when publishing the Function because an earlier placeholder D1 UUID was committed; that placeholder was replaced with the real configuration.

## Known current blocker
The user reports `/dashboard/setup.html` returns `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` when creating the first Superuser. The setup page calls `POST /api/dashboard-setup` and expects JSON. The function itself returns JSON, so the next AI should verify the deployed Pages routing/function mapping and whether `/api/dashboard-setup` is being served by the Function or falling through to an HTML asset. Do not assume this is a database error.

## UI requirement
The user explicitly says the existing dashboard had its own styling and does NOT want it stripped out or replaced by generic styling. Preserve the existing dashboard design system and customize it to Rica. Auth pages currently have styling, but the user says they still look horrible; give login and first-Superuser setup a polished Rica treatment while retaining the dashboard's visual language. Do not remove the Superuser setup/sign-up flow.

## Product direction
- Dashboard replaces the old `staff-vouchers` / `staff-bookings` operational interfaces.
- Individual authenticated accounts: `superuser` and `staff`.
- Actions such as booking approvals/status changes and voucher redemption must be attributable to the logged-in user and written to the audit log.
- Superusers manage staff/users and can see who approved/redeemed actions.
- Avoid using a shared `X-Staff-Secret` as the dashboard's primary authentication mechanism.

## Deployment notes
- Do not commit real local secret values such as `SUPERUSER_SETUP_KEY`.
- The repository's historical `.gitignore` ignored Wrangler config files, which caused Cloudflare deployments to miss local configuration. Keep a safe committed Wrangler config with the real non-secret D1/KV IDs.
- There was also a bad redirect rule `/dashboard/* /dashboard/index.html 200` reported by Cloudflare as an infinite loop. It should be removed/fixed after the setup endpoint is verified.

## Verification sequence
1. Deploy current `mignon`.
2. Open `/api/dashboard-setup` directly and confirm it returns JSON (not the dashboard HTML).
3. Open `/dashboard/setup.html` and create the first Superuser using the configured Cloudflare `SUPERUSER_SETUP_KEY`.
4. Login at `/dashboard/login.html`.
5. Verify Superuser can create Staff.
6. Verify booking approval and voucher redemption record the correct user in audit/history.
7. Verify dashboard UI and auth pages are responsive and visually consistent with Rica.
8. Reconcile `mignon` with `admin-shadcn-integration` only after the working state is verified; do not force-push over newer work.

## Important honesty rule
Do not tell the user a change is complete unless the repository write succeeded and, where applicable, the deployment/build result confirms it.
