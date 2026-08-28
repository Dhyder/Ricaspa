# Ricaspa — AI Handoff

Updated: 2026-08-29
Branch: `mignon`

## CURRENT TRUTH

`/dashboard` now serves a real build of the supplied `shadcn-admin-1.0.0`
template — the actual component tree (Sidebar, Header, Main, data
primitives, auth forms), not a lookalike. `dashboard-react/` (the earlier,
wrong-approach migration attempt — a single hand-rolled ~20KB file, not
the real template) has been removed.

**Not yet verified against the live deployment** — built and type-checked
locally (`tsc -b && vite build`, zero errors), pushed to `mignon`, and
Cloudflare auto-deploys on push, but no one has clicked through the actual
production URL yet. Do that before telling the site owner this is "done":
sign in, hit every page (Dashboard, Vouchers, Bookings, Staff Users,
Activity Log, Settings), confirm the SPA fallback in `_redirects` resolves
deep links on refresh, confirm `/dashboard/setup` correctly shows or hides
based on whether a superuser already exists.

## Backend/auth — real, live, working (verified by reading the deployed code)

- Cloudflare Pages + Functions.
- Production D1: `ricaspa-ledger`, UUID `cdf2839a-2f0f-4705-a327-563da5d2cb31`.
- KV binding: `VOUCHERS`, ID `20e21678c21f48718b235646ff753777`.
- Tables: `dashboard_users`, `dashboard_sessions`, `dashboard_audit_log`
  (migrations `0004_dashboard_users.sql` + `0005_dashboard_schema_repair.sql`).
- Auth: email + password, PBKDF2 (100k iterations — must stay at that
  number, changing it invalidates every existing password hash), DB-backed
  session cookie (not a signed stateless token — logout actually deletes
  the row).
- Roles: `superuser` | `employee`. Only superusers can manage staff
  accounts (`/api/dashboard-users`) or view the audit log
  (`/api/dashboard-audit`).
- First superuser: `GET /api/dashboard-setup` reports `setupRequired`;
  `POST` with `{setupKey, name, email, password}` creates it, gated by the
  `SUPERUSER_SETUP_KEY` env var. The dashboard's `/dashboard/setup` route
  calls this — confirm `SUPERUSER_SETUP_KEY` is actually set in Cloudflare
  and that someone has completed this step before assuming staff can log in.
- `dashboard-signup.js` (a second, inconsistent duplicate of the setup
  flow — 10-char vs 8-char password minimums, different duplicate-user
  check, not wired to any page) has been deleted.
- Session-protected data APIs, all under `/api/dashboard-*.js`:
  `-stats`, `-orders`, `-bookings` (GET list / POST status update),
  `-vouchers` (GET list / POST lookup-or-redeem), `-users` (superuser:
  GET/POST/PATCH), `-audit` (superuser: GET). The redeem and
  status-update actions did not exist before this session — the dashboard
  could view vouchers/bookings but not act on them. Both now write to
  `dashboard_audit_log` with the acting user.
- Never substitute mock operational data.

## Legacy static pages — still live, not yet retired

`staff-vouchers.html` and `staff-bookings.html` (passphrase/`STAFF_SECRET`
gated, at the repo root, not under `/dashboard`) are untouched and still
work. They're now redundant with the React dashboard's Vouchers/Bookings
pages, but retiring them is a site-owner call, not an AI one — don't
remove without asking. If/when they're retired, `STAFF_SECRET` becomes
unused (the dashboard auth doesn't touch it) — check nothing else
references it before removing the env var.

## KNOWN GAPS / NOT DONE

- QR camera scanning: the old `staff-vouchers.html` had a vendored `jsQR`
  camera scanner. The new dashboard's Vouchers page only has manual code
  entry — no camera scan yet. If reception relies on scanning, this is a
  real regression until it's added.
- Dashboard's data tables are plain `<Table>` components, not the
  template's full data-table primitives (pagination, column visibility,
  toolbar filters). Fine for the current data volume; revisit if voucher/
  booking counts grow enough that an unpaginated table becomes unusable.
- No WhatsApp integration (still just a future idea, see below).
- Large JS bundle warning at build time (`_authenticated` chunk ~300KB,
  `index` ~650KB) — not broken, just not code-split. Low priority.

## FUTURE

WhatsApp plan: WhatsApp Business webhook -> Cloudflare Function -> D1
message records -> dashboard Messages inbox. Associate messages with
customers/booking candidates. Do not fabricate WhatsApp conversations.

## RULE FOR WHOEVER READS THIS NEXT

Don't claim something is "done" or "verified" without actually checking
it against the live deployment, and update this file's CURRENT TRUTH
section the moment you find out something above is stale — that's the
entire reason this file caused so much churn last time.
