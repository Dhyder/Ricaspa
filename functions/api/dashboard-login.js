import { json } from "../_lib/voucherCore.js";
import { createSessionCookie, verifyPassword, audit } from "../_lib/dashboardAuth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: "Dashboard user storage is not configured. Bind your D1 database as DB and apply migrations/0004_dashboard_users.sql." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request" }, 400); }
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) return json({ error: "Email and password are required" }, 400);
  const user = await env.DB.prepare("SELECT id,name,email,password_hash,role,status FROM dashboard_users WHERE email=?1").bind(email).first();
  if (!user || user.status !== "active" || !(await verifyPassword(password, user.password_hash))) return json({ error: "Invalid email or password" }, 401);
  const cookie = await createSessionCookie(env, user);
  await env.DB.prepare("UPDATE dashboard_users SET last_login_at=?,updated_at=? WHERE id=?").bind(new Date().toISOString(), new Date().toISOString(), user.id).run();
  await audit(env, user, "login");
  return new Response(JSON.stringify({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } }), { status: 200, headers: { "Content-Type": "application/json", "Set-Cookie": cookie } });
}
