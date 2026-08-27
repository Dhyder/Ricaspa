import { json } from "../_lib/voucherCore.js";
import { hashPassword } from "../_lib/dashboardAuth.js";

const id = () => crypto.randomUUID();

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: "Dashboard user storage is not configured" }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request" }, 400); }

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const role = body.role === "superuser" ? "superuser" : "employee";

  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
    return json({ error: "Name, valid email and an 8+ character password are required" }, 400);
  }

  // Superuser creation is deliberately protected. A public signup form must
  // never allow an anonymous visitor to grant themselves full administration.
  if (role === "superuser" && body.setupKey !== env.STAFF_SECRET) return json({ error: "Superuser signup requires the setup key" }, 403);

  const exists = await env.DB.prepare("SELECT id FROM dashboard_users WHERE email = ?1").bind(email).first();
  if (exists) return json({ error: "An account with that email already exists" }, 409);

  const now = new Date().toISOString();
  const status = role === "employee" ? "pending" : "active";
  await env.DB.prepare("INSERT INTO dashboard_users (id,name,email,password_hash,role,status,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?7)").bind(id(), name, email, await hashPassword(password), role, status, now).run();
  return json({ ok: true, status, message: status === "pending" ? "Employee account created and awaiting approval" : "Superuser account created" }, 201);
}
