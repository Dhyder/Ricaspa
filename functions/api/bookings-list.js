// Dashboard booking list. Legacy staff-secret access is intentionally removed.
import { json } from "../_lib/voucherCore.js";
import { requireSession } from "../_lib/dashboardAuth.js";
import { listBookingsByDate, listUpcomingBookings } from "../_lib/bookingLedger.js";

export async function onRequestGet(context) {
  try { await requireSession(context); } catch { return json({ error: "Not authenticated" }, 401); }
  const { request, env } = context;
  const url = new URL(request.url), date = url.searchParams.get("date"), upcoming = url.searchParams.get("upcoming");
  try {
    if (upcoming) return json({ bookings: await listUpcomingBookings(env, new Date().toISOString().split("T")[0], 200) });
    if (!date) return json({ error: "Missing date (YYYY-MM-DD) or upcoming=1" }, 400);
    return json({ bookings: await listBookingsByDate(env, date) });
  } catch (err) { return json({ error: "Unable to load bookings" }, 500); }
}
