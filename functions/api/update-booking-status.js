import { json } from "../_lib/voucherCore.js";
import { updateBookingStatus } from "../_lib/bookingLedger.js";
import { requireSession, audit } from "../_lib/dashboardAuth.js";

export async function onRequestPost(context) {
  let user;
  try { user = await requireSession(context); } catch { return json({ error: "Not authorized" }, 401); }
  let body;
  try { body = await context.request.json(); } catch { return json({ error: "Invalid request body" }, 400); }
  const ref = String(body.ref || "").trim();
  const status = String(body.status || "").trim();
  if (!ref || !status) return json({ error: "Missing ref or status" }, 400);
  try {
    const updated = await updateBookingStatus(context.env, ref, status);
    if (!updated) return json({ error: "No booking found with that ref" }, 404);
    await audit(context.env, user, `booking_${status}`, "booking", ref);
    return json({ success: true, ref, status, actedBy: { id: user.id, name: user.name, role: user.role } });
  } catch (err) { return json({ error: String(err.message || err) }, 400); }
}
