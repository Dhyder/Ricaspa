# Rica Spa Admin Dashboard

The `/dashboard` application is the staff administration interface for Rica Spa.

## Integration

The dashboard is served by the existing Cloudflare Pages deployment and talks to the same-origin `/api/dashboard-*` endpoints. Authentication uses the existing `STAFF_SECRET` server-side. The secret is exchanged for an HttpOnly session cookie and is never stored in browser JavaScript.

Current integrated endpoints:

- `POST /api/dashboard-login`
- `POST /api/dashboard-logout`
- `GET /api/dashboard-stats`
- `GET /api/dashboard-bookings`
- `GET /api/dashboard-orders`

Do not put `STAFF_SECRET` or other production credentials into dashboard assets.

## Direction

The dashboard should remain the management layer over the existing booking, voucher, payment and ledger services. Avoid replacing the public site or moving the payment backend simply to change the UI stack.
