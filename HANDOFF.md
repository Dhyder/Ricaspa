# Ricaspa — AI Handoff

Updated: 2026-08-28
Branch: `mignon`

## CRITICAL CURRENT TRUTH
The supplied `shadcn-admin-1.0.0.zip` is the UI source of truth. The production `/dashboard` has **NOT** been successfully migrated to that React template.

Production still serves the legacy static dashboard under `dashboard/`. `dashboard-react/` is an isolated migration target and is **not** the active `/dashboard` route.

Do NOT claim the supplied template is integrated until its actual component tree is imported/used, the React app builds, `/dashboard` serves the React build, and the result is verified.

## Backend/auth — preserve these
- Cloudflare Pages + Functions.
- Production D1: `ricaspa-ledger`, UUID `cdf2839a-2f0f-4705-a327-563da5d2cb31`.
- KV binding: `VOUCHERS`, ID `20e21678c21f48718b235646ff753777`.
- Dashboard auth/session/audit: `functions/_lib/dashboardAuth.js` + D1.
- `0004_dashboard_users.sql` and schema repair migration are applied remotely.
- PBKDF2 must stay at 100,000 iterations for Workers compatibility.
- Sign-in and initial superuser setup work. After setup, only Superusers create additional accounts.
- Existing dashboard APIs provide stats, bookings, orders, vouchers, users and audit data.
- `POST /api/redeem-voucher` supports non-redeeming lookup via `{code, action:"lookup"}`.
- Never substitute mock operational data.

## ORIGINAL TEMPLATE TO USE
The uploaded template contains the actual components. These must be reused/adapted rather than recreated as lookalikes:
- `src/components/ui/sidebar.tsx`
- `src/components/layout/app-sidebar.tsx`
- `src/components/layout/header.tsx`
- `src/components/layout/main.tsx`
- `src/components/layout/profile-dropdown.tsx`
- `src/components/data-table/pagination.tsx`
- `src/components/data-table/toolbar.tsx`
- `src/components/data-table/view-options.tsx`
- profile/settings components
- users/team components
- SignIn2 / SignUp2 auth styling

Preserve the template hierarchy, spacing, responsive behavior, component styling and interaction patterns. Adapt only Rica content/branding.

## CURRENT PRODUCTION UI PROBLEMS
- Pagination is still broken/clunky. Rows-per-page does not reliably operate on the complete dataset.
- Duplicate table controls exist because legacy static enhancements have been layered on top of each other.
- Voucher desk has duplicate Scan Voucher actions; there must be exactly ONE scan action in ONE logical location.
- QR camera scanning has not been reliably verified in production.
- Profile editing/template profile experience is not properly integrated.
- Staff & Users and Activity Log need end-to-end verification.
- The real supplied template components have not been transplanted into the production dashboard.
- Production currently loads legacy scripts such as `app.js`, `enhancements.js`, `lookup-ui.js`, `template-layout.js`, `scanner-fix.js`, `template-table.js`, and `template-shell.js`. Do not continue adding overlay patches. Retire them when React replaces the static dashboard.
- Rica branding must stay warm brown/tan/gold/ivory based on the logo. No green primary branding.

## DATA REQUIREMENTS
- Bookings must show customer, service/date and status.
- Orders must show customer, amount/value, payment state and fulfilment/finalization state.
- Vouchers must show reference, customer, amount/value, status and timestamps.
- Dashboard stats must render scalar values, never `[object Object]`.

## CORRECT NEXT IMPLEMENTATION
1. Extract/use the supplied ZIP as the actual React source.
2. Port its real Sidebar/SidebarProvider, Header, Main, ProfileDropdown, data-table Pagination/Toolbar/ViewOptions, Profile and Users components into `dashboard-react/`.
3. Wire those real components to the existing Ricaspa auth and APIs.
4. Replace the handwritten table/pagination layer with the template data-table primitives. Implement page size, search/filter and complete dataset handling correctly.
5. Replace the duplicate voucher UI with one Voucher Desk containing one Lookup action and one Scan QR action. Camera requires HTTPS/permission and a real QR decoder; manual lookup is the fallback.
6. Implement the supplied template's profile editing experience.
7. Implement staff/users and activity using the existing APIs and authenticated audit actor.
8. Build React successfully.
9. Change Pages routing/entrypoint so `/dashboard` actually serves the built React application.
10. Verify production before removing the static fallback.
11. Remove legacy overlay scripts after parity is confirmed; do not stack more scripts onto the old dashboard.

## FUTURE
WhatsApp plan: WhatsApp Business webhook -> Cloudflare Function -> D1 message records -> dashboard Messages inbox. Associate messages with customers/booking candidates. Do not fabricate WhatsApp conversations.

## DEFINITION OF DONE
- [ ] Actual supplied template components are imported and used.
- [ ] `/dashboard` serves the React template build.
- [ ] Sidebar is independently scrollable and collapsible.
- [ ] No duplicate pagination/table controls.
- [ ] Rows-per-page works across the complete dataset.
- [ ] Search/filter works correctly.
- [ ] Exactly one Scan QR action exists.
- [ ] QR camera works in HTTPS production.
- [ ] Manual voucher lookup works.
- [ ] Voucher customer/amount/status display.
- [ ] Bookings and orders show customer/status/amount fields.
- [ ] Staff & Users works.
- [ ] Activity Log works and attributes actions to the authenticated actor.
- [ ] Profile uses the supplied template and supports editing.
- [ ] SignIn2 / SignUp2 styling remains intact.
- [ ] Rica palette has no green primary branding.
- [ ] No completion/deployment claim without a successful repository write/build/deployment verification.
