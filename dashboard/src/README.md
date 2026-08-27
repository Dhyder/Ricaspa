# Dashboard source layer

This directory is the maintainable integration layer for the Rica Spa Shadcn dashboard.

The deployed bundle under `dashboard/assets/` is intentionally left untouched while the source layer is introduced. New dashboard features should be implemented here and built into the dashboard assets as part of the deployment pipeline.

Architecture:

- UI: React + Shadcn-style components
- API: same-origin `/api/dashboard-*`
- Auth: HttpOnly `rica_dash_session` cookie
- Backend: existing Cloudflare Pages Functions + KV ledgers

Never expose `STAFF_SECRET` to client code.
