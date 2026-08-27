import { json } from "../_lib/voucherCore.js";
import { hashPassword, audit } from "../_lib/dashboardAuth.js";

async function setup(c) {
  if (!c.env.DB) return json({ error: "Dashboard user storage is not configured. Bind D1 as DB and apply migrations/0004_dashboard_users.sql." }, 503);
  if (!c.env.SUPERUSER_SETUP_KEY) return json({ error: "Superuser setup is not configured on this deployment." }, 503);
  try {
    const existing = await c.env.DB.prepare("SELECT COUNT(*) AS count FROM dashboard_users").first();
    if (Number(existing?.count || 0) > 0) return json({ error: "Initial setup is already complete. Ask a Superuser to create additional accounts." }, 409);
    const b = await c.request.json();
    const setupKey = String(b.setupKey || "");
    const name = String(b.name || "").trim();
    const email = String(b.email || "").trim().toLowerCase();
    const password = String(b.password || "");
    if (setupKey !== c.env.SUPERUSER_SETUP_KEY) return json({ error: "Invalid setup key" }, 403);
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) return json({ error: "Name, valid email and an 8+ character password are required" }, 400);
    const id = crypto.randomUUID(), now = new Date().toISOString();
    await c.env.DB.prepare("INSERT INTO dashboard_users (id,name,email,password_hash,role,status,created_at,updated_at) VALUES (?1,?2,?3,?4,'superuser','active',?5,?5)").bind(id,name,email,await hashPassword(password),now).run();
    await audit(c.env,{id,name,email,role:"superuser"},"initial_superuser_created","dashboard_user",id,{email});
    return json({ ok: true, user: { id, name, email, role: "superuser" } }, 201);
  } catch (e) {
    console.error("dashboard-setup POST failed", e);
    return json({ error: e?.message || "Unable to create Superuser" }, 500);
  }
}

export async function onRequestGet(c) {
  if (!c.env.DB) return json({ error: "Dashboard user storage is not configured. Bind D1 as DB and apply migrations/0004_dashboard_users.sql." }, 503);
  try {
    const row = await c.env.DB.prepare("SELECT COUNT(*) AS count FROM dashboard_users").first();
    return json({ setupRequired: Number(row?.count || 0) === 0 });
  } catch (e) {
    return json({ error: e?.message || "Unable to check setup status" }, 500);
  }
}

export async function onRequestPost(c) { return setup(c); }
export async function onRequest(c) {
  if (c.request.method === "POST") return setup(c);
  if (c.request.method === "GET") return onRequestGet(c);
  return json({ error: "Method not allowed" }, 405, { Allow: "GET, POST" });
}
