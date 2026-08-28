# Rica Spa Authentication

Auth pages are styled as Rica Spa versions of the Sign In 2 / Sign Up 2 pattern: split brand panel on desktop, focused form panel, responsive single-column mobile layout.

## Account setup

- Employee signup: creates a `pending` employee account.
- Superuser signup: requires the `SUPERUSER_SETUP_KEY` server secret and creates an active superuser.
- The legacy `STAFF_SECRET` remains available for staff passphrase access.

The superuser setup key is intentionally a separate secret from `STAFF_SECRET`. Configure it in Cloudflare Pages as `SUPERUSER_SETUP_KEY` for Preview and Production. Never commit the value to Git.

Dashboard user records require the existing D1 binding named `DB` and migration `0004_dashboard_users.sql` applied to that database.
