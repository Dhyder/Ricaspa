import { json } from "../_lib/voucherCore.js";
import { createSessionCookie, verifyPassword } from "../_lib/dashboardAuth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request" }, 400); }

  // Backward-compatible staff passphrase login.
  if (body.passphrase !== undefined) {
    if (!env.STAFF_SECRET) return json({ error: "Staff login is not configured on this deployment" }, 503);
    if (body.passphrase !== env.STAFF_SECRET) return json({ error: "Wrong staff passphrase" }, 401);
    const cookie = await createSessionCookie(env);
    return new Response(JSON.stringify({ ok: true, user: { id: "staff", name: "Rica Spa Staff", email: "staff@ricaspa.beauty", role: "employee" } }), { status: 200, headers: { "Content-Type": "application/json", "Set-Cookie": cookie } });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!env.DB || !email || !password) return json({ error: "Email and password are required" }, 400);
  const user = await env.DB.prepare("SELECT id,name,email,password_hash,role,status FROM dashboard_users WHERE email = ?1").bind(email).first();
  if (!user || user.status !== "active" || !(await verifyPassword(password, user.password_hash))) return json({ error: "Invalid email or password" }, 401);
  await env.DB.prepare("UPDATE dashboard_users SET last_login_at = ?1, updated_at = ?1 WHERE id = ?2").bind(new Date().toISOString(), user.id).run();
  const cookie = await createSessionCookie(env, user);
  return new Response(JSON.stringify({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } }), { status: 200, headers: { "Content-Type": "application/json", "Set-Cookie": cookie } });
}
