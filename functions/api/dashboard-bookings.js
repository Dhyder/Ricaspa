// GET /api/dashboard-bookings?upcoming=1
// GET /api/dashboard-bookings?date=YYYY-MM-DD
// Session-cookie protected. Same underlying data as bookings-list.js (the
// staff desk's endpoint), but gated by the dashboard's cookie session
// instead of a per-request X-Staff-Secret header.

import { json } from "../_lib/voucherCore.js";
import { isAuthenticated } from "../_lib/dashboardAuth.js";
import { listBookingsByDate, listUpcomingBookings } from "../_lib/bookingLedger.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!(await isAuthenticated(context))) {
    return json({ error: "Not authenticated" }, 401);
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const upcoming = url.searchParams.get("upcoming");

  try {
    if (upcoming) {
      const today = new Date().toISOString().split("T")[0];
      const bookings = await listUpcomingBookings(env, today, 200);
      return json({ bookings });
    }
    if (!date) return json({ error: "Missing date (YYYY-MM-DD) or upcoming=1" }, 400);
    const bookings = await listBookingsByDate(env, date);
    return json({ bookings });
  } catch (err) {
    return json({ error: String(err.message || err) }, 500);
  }
}
