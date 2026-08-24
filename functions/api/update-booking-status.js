// POST /api/update-booking-status
// Body: { ref, status }  status ∈ new | confirmed | declined | completed | no-show
//
// Staff-only (STAFF_SECRET). Lets reception mark a requested slot as
// confirmed/declined/etc from the tracker UI, without touching the
// Cloudflare dashboard.

import { json } from "../_lib/voucherCore.js";
import { updateBookingStatus } from "../_lib/bookingLedger.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  const providedSecret = request.headers.get("X-Staff-Secret");
  if (!env.STAFF_SECRET || providedSecret !== env.STAFF_SECRET) {
    return json({ error: "Not authorized" }, 401);
  }

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
    return json({ success: true, ref, status });
  } catch (err) {
    return json({ error: String(err.message || err) }, 400);
  }
}
