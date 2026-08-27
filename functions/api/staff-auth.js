// GET /api/staff-auth
// Header: X-Staff-Secret
//
// Just checks the passphrase and returns 200 or 401 — nothing else. Used
// by both staff-vouchers.html and staff-bookings.html at the moment
// someone clicks "Unlock", so a wrong passphrase is caught immediately
// with a clear message, instead of silently showing the desk UI and only
// failing later on the first real lookup/list call.

import { json } from "../_lib/voucherCore.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const providedSecret = request.headers.get("X-Staff-Secret");
  if (!env.STAFF_SECRET || providedSecret !== env.STAFF_SECRET) {
    return json({ error: "Wrong passphrase" }, 401);
  }
  return json({ ok: true });
}
