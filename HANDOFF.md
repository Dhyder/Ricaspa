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
- Template was inspected directly from the supplied zip. Important reusable pieces include `src/components/ui/sidebar.tsx`, `src/components/layout/app-sidebar.tsx`, `src/components/layout/header.tsx`, `src/components/layout/main.tsx`, `src/components/layout/profile-dropdown.tsx`, `src/components/data-table/pagination.tsx`, `src/components/data-table/toolbar.tsx`, `src/components/data-table/view-options.tsx`, and the users/settings profile components.
- Current static dashboard does NOT literally run the template React components yet; it currently reproduces selected template interaction patterns. Do not claim full template transplant until the React migration is actually wired to production.

## Current dashboard
- Production-facing `/dashboard` is the static Pages implementation under `dashboard/`.
- `dashboard/index.html` loads `dashboard/app.js`, `dashboard/rica-dashboard.css`, `dashboard/enhancements.js`, `dashboard/lookup-ui.js`, `dashboard/template-layout.js`, and `dashboard/scanner-fix.js` with cache-busting versions.
- React/Vite exists under `dashboard-react/` as an isolated migration target, but is NOT the active `/dashboard` route yet.
- Do not claim React is live until Pages build/routing is changed and verified.

## Rica visual direction
- Rica does NOT use green as its brand color. Do not introduce green as a primary brand color.
- Dashboard accent direction is derived from the supplied Rica logo: warm brown/tan/gold neutrals, with warm ivory surfaces and restrained dark text.
- Keep the template's Shadcn layout/component discipline while adapting color, typography and content to Rica.

## Sidebar/layout
- `dashboard/template-layout.js` now adds a template-style collapsible/offcanvas desktop sidebar.
- Sidebar is sticky to the viewport, has its own height/overflow boundary, and no longer grows with page content.
- Collapse state persists in localStorage and can be toggled with the sidebar button or Ctrl/Cmd+B, following the supplied template's sidebar interaction pattern.
- Mobile remains a stacked navigation layout.

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
- Supplied template contains richer reusable data-table primitives; React migration should use those rather than extending the static implementation indefinitely.

## Voucher tools
- Vouchers page has a visible `Lookup & scan` card above the voucher table.
- Manual lookup calls `POST /api/redeem-voucher` with `{code, action:"lookup"}`; it does not redeem during lookup.
- The lookup result shows reference, customer, service, value and status and exposes a separate Redeem action.
- `dashboard/scanner-fix.js` now stops the older camera stream and starts a ZXing browser decoder for QR/barcodes after camera permission is granted. It loads the decoder from the jsDelivr/unpkg-compatible CDN at runtime.
- Scanner displays explicit camera errors and retains manual lookup as fallback.
- Camera scanning requires HTTPS/secure context and browser camera permission.

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
1. Port the supplied template's actual Sidebar/SidebarProvider behavior and data-table primitives into `dashboard-react/`.
2. Port actual Profile, Users, search, pagination, toolbar and related template components rather than another visual approximation.
3. Adapt those components to Rica branding and dashboard sections: Overview, Bookings, Vouchers, Orders, Profile, Staff & Users, Activity, Customers and Messages.
4. Connect every React page to the real APIs/D1.
5. Build and verify the React output locally/CI.
6. Route `/dashboard` to built React output only after parity verification; keep static dashboard as fallback until then.

## Immediate functional priorities
1. Verify the warm Rica palette against the actual supplied logo and remove any remaining green declarations.
2. Verify collapsible sidebar at desktop and responsive behavior at mobile.
3. Verify table search/pagination on real dashboard data.
4. Verify voucher manual lookup and camera scanning/redemption flow in HTTPS production.
5. Verify Superuser Staff & Users create/status actions.
6. Verify those actions appear in Activity Log with the actor.
7. Port the actual supplied template components into React.
8. Add Profile and Customers using template components.
9. Add Messages using real contact/booking data.
10. Add booking/message linking.
11. Design WhatsApp webhook integration after the internal message/customer model exists.

## Verification
- Sign-in and first-Superuser setup work in production.
- Dashboard stats show numbers, never `[object Object]`.
- Real upcoming bookings/orders render.
- Orders show customer, amount, payment state and fulfilment state.
- Vouchers show customer/value/status from KV.
- Vouchers can be looked up manually and scanned where camera + decoder are available.
- Overview quick actions navigate to their corresponding sections.
- Sidebar can collapse and does not grow with content.
- Superuser can create/manage staff.
- Staff/user changes appear in Activity Log.
- React build succeeds before production routing changes.

## Honesty rule
Do not claim a change is complete unless the repository write succeeded and, for deploy/build claims, the corresponding build/deployment result has been verified.
