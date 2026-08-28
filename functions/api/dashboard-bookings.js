import { json } from "../_lib/voucherCore.js";
import { isAuthenticated, requireSession, audit } from "../_lib/dashboardAuth.js";
import { listBookingsByDate, listUpcomingBookings, updateBookingStatus } from "../_lib/bookingLedger.js";
export async function onRequestGet(context){const{request,env}=context;if(!(await isAuthenticated(context)))return json({error:"Not authenticated"},401);const url=new URL(request.url),date=url.searchParams.get("date"),upcoming=url.searchParams.get("upcoming");try{const today=new Date().toISOString().split("T")[0];if(upcoming||!date)return json({bookings:await listUpcomingBookings(env,today,200)});return json({bookings:await listBookingsByDate(env,date)});}catch(err){return json({error:String(err.message||err)},500)}}

// POST /api/dashboard-bookings   body: { ref, status }
// Session-protected — the dashboard's replacement for staff-bookings.html's
// status-update action. Logged to dashboard_audit_log with the acting user.
export async function onRequestPost(c) {
  let user;
  try {
    user = await requireSession(c);
  } catch (e) {
    return json({ error: e.message }, 401);
  }

  const { request, env } = c;
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const ref = (body.ref || "").trim();
  const status = (body.status || "").trim();
  if (!ref || !status) return json({ error: "Missing ref or status" }, 400);

  try {
    const updated = await updateBookingStatus(env, ref, status);
    if (!updated) return json({ error: "No booking found with that ref" }, 404);
    await audit(env, user, "booking_status_updated", "booking", ref, { status });
    return json({ success: true, ref, status });
  } catch (err) {
    return json({ error: String(err.message || err) }, 400);
  }
}
