// GET /api/bookings-list?date=YYYY-MM-DD
// GET /api/bookings-list?upcoming=1
//
// Staff-only (same STAFF_SECRET passphrase as /staff-vouchers.html — no new
// secret to manage). Backs /staff-bookings.html's slot tracker: either a
// single day's bookings (sorted by time) or a rolling list of everything
// from today onward, so reception can see what's been requested before
// confirming a new one by phone/WhatsApp.

import { json } from "../_lib/voucherCore.js";
import { listBookingsByDate, listUpcomingBookings } from "../_lib/bookingLedger.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  const providedSecret = request.headers.get("X-Staff-Secret");
  if (!env.STAFF_SECRET || providedSecret !== env.STAFF_SECRET) {
    return json({ error: "Not authorized" }, 401);
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const upcoming = url.searchParams.get("upcoming");

  try {
    if (upcoming) {
      const today = new Date().toISOString().split("T")[0];
      const bookings = await listUpcomingBookings(env, today);
      return json({ bookings });
    }

    if (!date) return json({ error: "Missing date (YYYY-MM-DD) or upcoming=1" }, 400);
    const bookings = await listBookingsByDate(env, date);
    return json({ bookings });
  } catch (err) {
    return json({ error: String(err.message || err) }, 500);
  }
}
