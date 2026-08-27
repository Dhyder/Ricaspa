import { json } from "../_lib/voucherCore.js";
import { hashPassword } from "../_lib/dashboardAuth.js";

const id = () => crypto.randomUUID();

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: "Dashboard user storage is not configured. Bind your D1 database as DB and apply migrations/0004_dashboard_users.sql." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request" }, 400); }

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const role = body.role === "superuser" ? "superuser" : "employee";

  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
    return json({ error: "Name, valid email and an 8+ character password are required" }, 400);
  }

  const setupKey = env.SUPERUSER_SETUP_KEY;
  if (role === "superuser") {
    if (!setupKey) return json({ error: "Superuser setup is not configured. Add SUPERUSER_SETUP_KEY to this deployment." }, 503);
    if (body.setupKey !== setupKey) return json({ error: "Invalid superuser setup key" }, 403);
  }

  const exists = await env.DB.prepare("SELECT id FROM dashboard_users WHERE email = ?1").bind(email).first();
  if (exists) return json({ error: "An account with that email already exists" }, 409);

  const now = new Date().toISOString();
  const status = role === "employee" ? "pending" : "active";
  await env.DB.prepare("INSERT INTO dashboard_users (id,name,email,password_hash,role,status,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?7)").bind(id(), name, email, await hashPassword(password), role, status, now).run();
  return json({ ok: true, status, message: status === "pending" ? "Employee account created and awaiting approval" : "Superuser account created" }, 201);
}
