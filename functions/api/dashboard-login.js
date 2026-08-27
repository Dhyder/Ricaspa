// POST /api/dashboard-login   body: { passphrase }
// Same passphrase as the staff desks (STAFF_SECRET). On success, sets an
// httpOnly session cookie the rest of /api/dashboard-*.js checks — the
// dashboard SPA never sees or stores STAFF_SECRET itself.

import { json } from "../_lib/voucherCore.js";
import { createSessionCookie } from "../_lib/dashboardAuth.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }

  if (!env.STAFF_SECRET || body.passphrase !== env.STAFF_SECRET) {
    return json({ error: "Wrong passphrase" }, 401);
  }

  const cookie = await createSessionCookie(env);
  if (!cookie) return json({ error: "Server not configured" }, 500);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Set-Cookie": cookie },
  });
}
