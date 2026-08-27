import { json } from "../_lib/voucherCore.js";
import { clearSessionCookie } from "../_lib/dashboardAuth.js";

export async function onRequestPost() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Set-Cookie": clearSessionCookie() },
  });
}
