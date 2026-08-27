import { json } from "../_lib/voucherCore.js";
import { clearSessionCookie, destroySession, getSession, audit } from "../_lib/dashboardAuth.js";

export async function onRequestPost(context) {
  const user = await getSession(context);
  if (user) await audit(context.env, user, "logout");
  await destroySession(context);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json", "Set-Cookie": clearSessionCookie() } });
}
