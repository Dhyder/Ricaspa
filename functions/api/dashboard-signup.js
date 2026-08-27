import { json } from "../_lib/voucherCore.js";
import { hashPassword, audit } from "../_lib/dashboardAuth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: "Dashboard user storage is not configured. Bind your D1 database as DB and apply migrations/0004_dashboard_users.sql." }, 503);
  const setupKey = env.SUPERUSER_SETUP_KEY;
  if (!setupKey) return json({ error: "Superuser setup is not configured. Add SUPERUSER_SETUP_KEY to this deployment." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request" }, 400); }
  if (body.setupKey !== setupKey) return json({ error: "Invalid setup key" }, 403);
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 10) return json({ error: "Name, valid email and a 10+ character password are required" }, 400);
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM dashboard_users WHERE role='superuser' AND status='active'").first();
  if (Number(count?.n || 0) > 0) return json({ error: "Initial superuser already exists. Create additional users from the dashboard." }, 409);
  const exists = await env.DB.prepare("SELECT id FROM dashboard_users WHERE email=?1").bind(email).first();
  if (exists) return json({ error: "An account with that email already exists" }, 409);
  const id=crypto.randomUUID(), now=new Date().toISOString();
  await env.DB.prepare("INSERT INTO dashboard_users (id,name,email,password_hash,role,status,created_at,updated_at) VALUES (?1,?2,?3,?4,'superuser','active',?5,?5)").bind(id,name,email,await hashPassword(password),now).run();
  await audit(env,{id,name,email,role:'superuser'},'initial_superuser_created','dashboard_user',id);
  return json({ ok:true, message:'Superuser created. You can now sign in at /dashboard/login.html.' },201);
}
